import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Env = "sandbox" | "production";

async function sha512Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-512", bytes);
  const hashBytes = new Uint8Array(digest);
  let out = "";
  for (const b of hashBytes) out += b.toString(16).padStart(2, "0");
  return out;
}

async function getPlainServerKey(admin: any, env: Env): Promise<string> {
  const name = env === "sandbox" ? "server_key_sandbox" : "server_key_production";
  const { data, error } = await admin
    .from("integration_secrets")
    .select("ciphertext,iv")
    .eq("provider", "midtrans")
    .eq("name", name)
    .maybeSingle();
  if (error) throw error;
  const iv = String((data as any)?.iv ?? "");
  const key = iv === "plain" ? String((data as any)?.ciphertext ?? "") : "";
  if (!key.trim()) throw new Error(`Missing ${name}`);
  return key.trim();
}

async function verifySignature(params: {
  signature_key: string;
  order_id: string;
  status_code: string;
  gross_amount: string;
  server_key: string;
}): Promise<boolean> {
  const expected = await sha512Hex(`${params.order_id}${params.status_code}${params.gross_amount}${params.server_key}`);
  return expected === params.signature_key;
}

function addMonthsIso(date: Date, months: number): string {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const body = (await req.json()) as any;

    const order_id = String(body?.order_id ?? "").trim();
    const status_code = String(body?.status_code ?? "").trim();
    const gross_amount = String(body?.gross_amount ?? "").trim();
    const signature_key = String(body?.signature_key ?? "").trim();

    if (!order_id || !status_code || !gross_amount || !signature_key) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify signature against production, then sandbox.
    const prodKey = await getPlainServerKey(admin, "production").catch(() => "");
    const sandKey = await getPlainServerKey(admin, "sandbox").catch(() => "");

    const isProd = prodKey ? await verifySignature({ signature_key, order_id, status_code, gross_amount, server_key: prodKey }) : false;
    const isSandbox = !isProd && sandKey ? await verifySignature({ signature_key, order_id, status_code, gross_amount, server_key: sandKey }) : false;

    if (!isProd && !isSandbox) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const env: Env = isProd ? "production" : "sandbox";

    const transaction_status = String(body?.transaction_status ?? "").trim() || null;
    const fraud_status = String(body?.fraud_status ?? "").trim() || null;
    const payment_type = String(body?.payment_type ?? "").trim() || null;
    const transaction_id = String(body?.transaction_id ?? "").trim() || null;

    // Lookup order.
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id,user_id,subscription_years")
      .eq("midtrans_order_id", order_id)
      .maybeSingle();
    if (orderErr) throw orderErr;
    if (!order) {
      // Still return 200 so Midtrans doesn't keep retrying forever.
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paid = transaction_status === "settlement" || transaction_status === "capture";
    const failed = transaction_status === "deny" || transaction_status === "cancel" || transaction_status === "expire";

    await admin
      .from("orders")
      .update({
        payment_env: env,
        midtrans_transaction_status: transaction_status,
        midtrans_fraud_status: fraud_status,
        midtrans_payment_type: payment_type,
        midtrans_transaction_id: transaction_id,
        status: paid ? "paid" : failed ? "failed" : "pending",
      })
      .eq("id", (order as any).id);

    // Activate subscription if we have an authenticated user on the order.
    const userId = (order as any).user_id as string | null;
    const years = Number((order as any).subscription_years ?? 0);
    if (paid && userId && years > 0) {
      const { data: pricingRow, error: pricingErr } = await admin
        .from("domain_pricing_settings")
        .select("default_package_id")
        .eq("id", true)
        .maybeSingle();
      if (pricingErr) throw pricingErr;
      const packageId = (pricingRow as any)?.default_package_id ?? null;
      if (packageId) {
        const now = new Date();
        const durationMonths = years * 12;
        await admin.from("user_packages").insert({
          user_id: userId,
          package_id: packageId,
          duration_months: durationMonths,
          started_at: now.toISOString(),
          activated_at: now.toISOString(),
          expires_at: addMonthsIso(now, durationMonths),
          status: "active",
        });

        // Ensure profile is active/paid (since there is no trigger wired today).
        await admin
          .from("profiles")
          .update({ account_status: "active", payment_active: true, updated_at: now.toISOString() })
          .eq("id", userId);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
