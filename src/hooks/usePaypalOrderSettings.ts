import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Env = "sandbox" | "production";

export function usePaypalOrderSettings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [env, setEnv] = useState<Env>("sandbox");
  const [clientId, setClientId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fnErr } = await supabase.functions.invoke<{ ok: boolean; env: Env; client_id: string | null; ready: boolean }>(
          "paypal-order-settings",
          { body: {} },
        );
        if (fnErr) throw fnErr;
        if (!data?.ok) throw new Error("PayPal settings not available");
        setEnv(data.env);
        setClientId(data.client_id ?? null);
        setReady(Boolean(data.ready && data.client_id));
      } catch (e: any) {
        setError(e?.message ?? "Failed to load PayPal settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { loading, error, env, clientId, ready };
}
