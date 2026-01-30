// Supabase Edge Function: super-admin-xendit-secret
// Stores Xendit API key in public.integration_secrets (plaintext, iv='plain').

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload =
  | { action: "get" }
  | { action: "clear" }
  | {
      action: "set";
      api_key: string;
    };

function validateXenditSecretKey(input: string) {
  const apiKey = String(input ?? "").trim();
  if (!apiKey) return { ok: false as const, error: "api_key is required" };

  // Basic safety: no whitespace, keep length reasonable.
  if (/\s/.test(apiKey) || apiKey.length < 8 || apiKey.length > 256) {
    return { ok: false as const, error: "Invalid api_key format" };
  }

  // Xendit invoice API requires SECRET key (not public key).
  // Common prefixes: xnd_development_..., xnd_production_...
  if (!apiKey.startsWith("xnd_")) {
    return { ok: false as const, error: "Invalid Xendit key. Use a key that starts with 'xnd_'" };
  }
  if (apiKey.startsWith("xnd_public_")) {
    return {
      ok: false as const,
      error:
        "Invalid Xendit key for server-side usage. Please paste the Xendit *Secret* API Key (xnd_development_... / xnd_production_...), not the public key.",
    };
  }

  return { ok: true as const, apiKey };
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

    // Verify JWT using signing keys (verify_jwt=false)
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
      const { data, error } = await admin
        .from("integration_secrets")
        .select("updated_at")
        .eq("provider", "xendit")
        .eq("name", "api_key")
        .maybeSingle();
      if (error) throw error;

      return new Response(
        JSON.stringify({
          configured: Boolean(data),
          updated_at: data ? String((data as any).updated_at) : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (body.action === "set") {
      const validated = validateXenditSecretKey((body as any).api_key);
      if (!validated.ok) {
        return new Response(JSON.stringify({ error: validated.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await admin.from("integration_secrets").upsert(
        {
          provider: "xendit",
          name: "api_key",
          ciphertext: validated.apiKey,
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
      const { error } = await admin.from("integration_secrets").delete().eq("provider", "xendit").eq("name", "api_key");
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
