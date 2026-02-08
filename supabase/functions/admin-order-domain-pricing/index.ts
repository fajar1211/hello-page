import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  // Supabase browser client adds extra headers like x-supabase-client-platform.
  // If not whitelisted, the browser preflight (OPTIONS) fails and surfaces as "Failed to fetch".
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload =
  | { action: "get" }
  | {
      action: "set";
      default_package_id: string;
      tld_prices: Array<{ tld: string; price_usd: number }>;
    };

function normalizeTld(input: unknown): string {
  const raw = String(input ?? "").trim().toLowerCase();
  const cleaned = raw
    .replace(/^\.+/, "")
    // allow admin to type multi-part TLD like "co.id" and store it in DB-friendly form "co-id"
    .replace(/\./g, "-");
  if (!cleaned) return "";
  // DB constraint: domain_tld_prices.tld must be like ".com" or ".co-id"
  return `.${cleaned}`;
}

function isValidDbTld(tldWithDot: string): boolean {
  return /^\.[a-z0-9-]{2,}$/.test(tldWithDot);
}

async function requireAdminOrSuperAdmin(admin: any, userId: string) {
  const { data: roleRow, error: roleErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (roleErr) return { ok: false as const, status: 500, error: roleErr.message };

  const role = (roleRow as any)?.role;
  if (role !== "admin" && role !== "super_admin") return { ok: false as const, status: 403, error: "Forbidden" };
  return { ok: true as const };
}

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
    const userId = String(claimsData?.claims?.sub ?? "");
    if (claimsErr || !userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const authz = await requireAdminOrSuperAdmin(admin, userId);
    if (!authz.ok) {
      return new Response(JSON.stringify({ error: authz.error }), {
        status: authz.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Payload;

    if (body.action === "get") {
      const { data: settingsRow, error: settingsErr } = await admin
        .from("domain_pricing_settings")
        .select("default_package_id")
        .eq("id", true)
        .maybeSingle();
      if (settingsErr) throw new Error(settingsErr.message);

      const defaultPackageId = (settingsRow as any)?.default_package_id ?? null;
      const { data: prices, error: pricesErr } = defaultPackageId
        ? await admin.from("domain_tld_prices").select("tld,price_usd").eq("package_id", defaultPackageId)
        : { data: [], error: null };
      if (pricesErr) throw new Error(pricesErr.message);

      return new Response(
        JSON.stringify({
          default_package_id: defaultPackageId,
          tld_prices: prices ?? [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (body.action === "set") {
      const pkgId = String((body as any).default_package_id ?? "").trim();
      if (!pkgId) {
        return new Response(JSON.stringify({ error: "default_package_id wajib" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const rows = Array.isArray((body as any).tld_prices) ? ((body as any).tld_prices as any[]) : [];
      const mapped = rows.map((r) => ({
        tld: normalizeTld(r?.tld),
        price_usd: Number(r?.price_usd),
      }));

      const invalidTlds = mapped.map((r) => r.tld).filter((tld) => tld && !isValidDbTld(tld));
      if (invalidTlds.length) {
        return new Response(
          JSON.stringify({
            error: "Format TLD tidak valid. Contoh yang benar: com, net, co-id (tanpa spasi/karakter aneh).",
            invalid_tlds: Array.from(new Set(invalidTlds)),
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const cleaned = mapped.filter((r) => r.tld && isValidDbTld(r.tld) && Number.isFinite(r.price_usd) && r.price_usd >= 0);

      const { error: upsertSettingsErr } = await admin
        .from("domain_pricing_settings")
        .upsert({ id: true, default_package_id: pkgId }, { onConflict: "id" });
      if (upsertSettingsErr) throw new Error(upsertSettingsErr.message);

      // Replace TLD prices for this package
      const { error: delErr } = await admin.from("domain_tld_prices").delete().eq("package_id", pkgId);
      if (delErr) throw new Error(delErr.message);

      if (cleaned.length) {
        const { error: insErr } = await admin
          .from("domain_tld_prices")
          .insert(cleaned.map((r) => ({ package_id: pkgId, tld: r.tld, price_usd: r.price_usd })));
        if (insErr) throw new Error(insErr.message);
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : typeof e === "object" && e
          ? JSON.stringify(e)
          : String(e);
    console.error("admin-order-domain-pricing error:", e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
