import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Env = "sandbox" | "production";

type Payload = {
  env: Env;
  limit?: number;
};

type OkResponse = {
  ok: true;
  env: Env;
  items: Array<
    OrderRow & {
      midtrans?: Record<string, unknown> | null;
      midtrans_error?: string | null;
    }
  >;
};

type ErrResponse = {
  ok: false;
  error: string;
};

function normalizeEnv(input: unknown): Env {
  const v = String(input ?? "").trim().toLowerCase();
  if (v !== "sandbox" && v !== "production") throw new Error("Invalid env");
  return v as Env;
}

function normalizeLimit(input: unknown): number {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return 20;
  return Math.min(50, Math.max(1, n));
}

function midtransBaseUrl(env: Env) {
  return env === "sandbox" ? "https://api.sandbox.midtrans.com" : "https://api.midtrans.com";
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
  if (!key.trim()) throw new Error("Midtrans server key not configured");
  return key.trim();
}

async function requireSuperAdmin(admin: any, userId: string) {
  const { data: roleRow, error: roleErr } = await admin.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  if (roleErr) return { ok: false as const, status: 500, error: roleErr.message };
  if ((roleRow as any)?.role !== "super_admin") return { ok: false as const, status: 403, error: "Forbidden" };
  return { ok: true as const, userId };
}

type OrderRow = {
  id: string;
  created_at: string;
  domain: string;
  customer_name: string | null;
  customer_email: string | null;
  amount_usd: number | null;
  amount_idr: number | null;
  payment_env: string | null;
  midtrans_order_id: string | null;
  midtrans_redirect_url: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authed = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await authed.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const authz = await requireSuperAdmin(admin, String(claimsData.claims.sub));
    if (!authz.ok) {
      return new Response(JSON.stringify({ error: authz.error }), {
        status: authz.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Partial<Payload>;
    const env = normalizeEnv(body.env);
    const limit = normalizeLimit(body.limit);

     let serverKey = "";
     try {
       serverKey = await getPlainServerKey(admin, env);
     } catch (e) {
       const msg = e instanceof Error ? e.message : String(e);
       // Treat missing config as a soft error so the dashboard doesn't crash.
       if (msg.toLowerCase().includes("not configured")) {
         const resp: ErrResponse = { ok: false, error: msg };
         return new Response(JSON.stringify(resp), {
           status: 200,
           headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
       }
       throw e;
     }
    const auth = btoa(`${serverKey}:`);

    const { data: orders, error: ordersErr } = await admin
      .from("orders")
      .select(
        "id,created_at,domain,customer_name,customer_email,amount_usd,amount_idr,payment_env,midtrans_order_id,midtrans_redirect_url",
      )
      .eq("payment_provider", "midtrans")
      .eq("payment_env", env)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (ordersErr) throw ordersErr;

     const results: OkResponse["items"] = [];

    for (const o of (orders ?? []) as OrderRow[]) {
      const orderId = String((o as any)?.midtrans_order_id ?? "").trim();

      if (!orderId) {
        results.push({ ...o, midtrans: null, midtrans_error: "Missing midtrans_order_id" });
        continue;
      }

      const statusRes = await fetch(`${midtransBaseUrl(env)}/v2/${encodeURIComponent(orderId)}/status`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${auth}`,
        },
      });

      const text = await statusRes.text();
      const json = (() => {
        try {
          return JSON.parse(text);
        } catch {
          return { raw: text };
        }
      })();

      if (!statusRes.ok) {
        results.push({ ...o, midtrans: json, midtrans_error: `Midtrans status failed (${statusRes.status})` });
        continue;
      }

      results.push({ ...o, midtrans: json, midtrans_error: null });
    }

     const resp: OkResponse = { ok: true, env, items: results };
     return new Response(JSON.stringify(resp), {
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
