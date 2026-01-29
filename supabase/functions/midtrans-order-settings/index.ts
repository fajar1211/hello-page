import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Env = "sandbox" | "production";

const WS_MERCHANT_ID = "midtrans_merchant_id";
const WS_CLIENT_KEY_SANDBOX = "midtrans_client_key_sandbox";
const WS_CLIENT_KEY_PRODUCTION = "midtrans_client_key_production";

async function getWebsiteSetting(admin: any, key: string): Promise<string | null> {
  const { data, error } = await admin.from("website_settings").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  const v = (data as any)?.value;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

async function hasPlainServerKey(admin: any, env: Env): Promise<boolean> {
  const name = env === "sandbox" ? "server_key_sandbox" : "server_key_production";
  const { data, error } = await admin
    .from("integration_secrets")
    .select("ciphertext,iv")
    .eq("provider", "midtrans")
    .eq("name", name)
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;
  return String((data as any).iv ?? "") === "plain" && Boolean(String((data as any).ciphertext ?? "").trim());
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

    // Use service role so this endpoint can be public but still read settings.
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const merchantId = await getWebsiteSetting(admin, WS_MERCHANT_ID);
    const sandboxClientKey = await getWebsiteSetting(admin, WS_CLIENT_KEY_SANDBOX);
    const productionClientKey = await getWebsiteSetting(admin, WS_CLIENT_KEY_PRODUCTION);

    const sandboxReady = Boolean(sandboxClientKey) && (await hasPlainServerKey(admin, "sandbox"));
    const productionReady = Boolean(productionClientKey) && (await hasPlainServerKey(admin, "production"));

    // Default env: prefer production if configured, otherwise sandbox.
    const env: Env = productionReady ? "production" : "sandbox";
    const client_key = env === "production" ? productionClientKey : sandboxClientKey;

    return new Response(
      JSON.stringify({
        ok: true,
        env,
        merchant_id: merchantId,
        client_key,
        ready: env === "production" ? productionReady : sandboxReady,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
