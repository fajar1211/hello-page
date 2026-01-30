// Supabase Edge Function: super-admin-paypal-secret
// Stores PayPal client secret in public.integration_secrets (plaintext, iv='plain').

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Env = "sandbox" | "production";

type Payload =
  | { action: "get" }
  | { action: "clear"; env: Env }
  | { action: "set"; env: Env; client_secret: string };

function normalizeEnv(input: unknown): Env {
  const v = String(input ?? "").trim().toLowerCase();
  if (v !== "sandbox" && v !== "production") throw new Error("Invalid env");
  return v as Env;
}

function secretNameForEnv(env: Env) {
  return env === "sandbox" ? "client_secret_sandbox" : "client_secret_production";
}

function normalizeSecret(input: unknown) {
  const v = String(input ?? "").trim();
  if (!v) throw new Error("client_secret is required");
  if (/\s/.test(v) || v.length < 8 || v.length > 512) throw new Error("Invalid client_secret format");
  return v;
}

function maskSecret(secret: string) {
  const s = String(secret ?? "").trim();
  if (!s) return "";
  const tail = s.slice(-4);
  return `${"*".repeat(Math.max(0, s.length - 4))}${tail}`;
}

async function requireSuperAdmin(admin: any, userId: string) {
  const { data: roleRow, error: roleErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (roleErr) return { ok: false as const, status: 500, error: roleErr.message };
  if ((roleRow as any)?.role !== "super_admin") return { ok: false as const, status: 403, error: "Forbidden" };
  return { ok: true as const, userId };
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

    const body = (await req.json()) as Payload;

    if (body.action === "get") {
      const { data: sb, error: sbErr } = await admin
        .from("integration_secrets")
        .select("updated_at,ciphertext,iv")
        .eq("provider", "paypal")
        .eq("name", secretNameForEnv("sandbox"))
        .maybeSingle();
      if (sbErr) throw sbErr;

      const { data: pr, error: prErr } = await admin
        .from("integration_secrets")
        .select("updated_at,ciphertext,iv")
        .eq("provider", "paypal")
        .eq("name", secretNameForEnv("production"))
        .maybeSingle();
      if (prErr) throw prErr;

      const sbSecret = sb && String((sb as any).iv ?? "") === "plain" ? String((sb as any).ciphertext ?? "") : "";
      const prSecret = pr && String((pr as any).iv ?? "") === "plain" ? String((pr as any).ciphertext ?? "") : "";

      return new Response(
        JSON.stringify({
          sandbox: { configured: Boolean(sbSecret), updated_at: sb ? String((sb as any).updated_at ?? null) : null, masked: sbSecret ? maskSecret(sbSecret) : null },
          production: { configured: Boolean(prSecret), updated_at: pr ? String((pr as any).updated_at ?? null) : null, masked: prSecret ? maskSecret(prSecret) : null },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (body.action === "set") {
      const env = normalizeEnv((body as any).env);
      const secret = normalizeSecret((body as any).client_secret);

      const { error } = await admin.from("integration_secrets").upsert(
        {
          provider: "paypal",
          name: secretNameForEnv(env),
          ciphertext: secret,
          iv: "plain",
        },
        { onConflict: "provider,name" },
      );
      if (error) throw error;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "clear") {
      const env = normalizeEnv((body as any).env);
      const { error } = await admin
        .from("integration_secrets")
        .delete()
        .eq("provider", "paypal")
        .eq("name", secretNameForEnv(env));
      if (error) throw error;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
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
