import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  defaultWebsiteLayoutSettings,
  sanitizeWebsiteLayoutSettings,
  type WebsiteLayoutSettings,
} from "@/pages/dashboard/admin/website-layout/types";

const SETTINGS_KEY = "website_layout";
const LAYOUT_CACHE_KEY = "ema.website_layout_cache.v1";

function readLayoutCache(): WebsiteLayoutSettings | null {
  try {
    const raw = localStorage.getItem(LAYOUT_CACHE_KEY);
    if (!raw) return null;
    return sanitizeWebsiteLayoutSettings(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeLayoutCache(value: WebsiteLayoutSettings) {
  try {
    localStorage.setItem(LAYOUT_CACHE_KEY, JSON.stringify(value));
  } catch {
    // ignore (storage might be full/disabled)
  }
}

export function useWebsiteLayoutSettings() {
  const cached = typeof window !== "undefined" ? readLayoutCache() : null;
  const hasCache = !!cached;

  const [loading, setLoading] = useState(true);
  // Important: initialize from cache to avoid flashing default brand/logo.
  const [settings, setSettings] = useState<WebsiteLayoutSettings>(cached ?? defaultWebsiteLayoutSettings);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("website_settings")
        .select("value")
        .eq("key", SETTINGS_KEY)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Failed to load website layout settings", error);
        // Keep current state (cache/default).
      } else {
        const next = sanitizeWebsiteLayoutSettings(data?.value);
        setSettings(next);
        writeLayoutCache(next);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => ({ settings, loading, hasCache }), [settings, loading, hasCache]);
}


