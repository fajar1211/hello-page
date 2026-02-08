import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/hooks/useI18n";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type PackageRow = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  price: number | null;
  is_recommended?: boolean | null;
  created_at?: string | null;
};

type WebsiteSettingsRow = { value: any } | null;

type PackagesLayoutSettings = {
  packageOrder?: string[];
};

const LAYOUT_SETTINGS_KEY = "packages_layout";

function formatIdr(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

export function OrderPackagesPreview() {
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<PackageRow[]>([]);

  const viewDetailHref = "/packages";

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        setLoading(true);

        const [pkgRes, layoutRes] = await Promise.all([
          supabase
            .from("packages")
            .select("id,name,type,description,price,is_recommended,created_at")
            .eq("is_active", true)
            .eq("show_on_public", true)
            .order("created_at", { ascending: true }),
          (supabase as any)
            .from("website_settings")
            .select("value")
            .eq("key", LAYOUT_SETTINGS_KEY)
            .maybeSingle(),
        ]);

        if (!isMounted) return;

        const base = ((pkgRes.data ?? []) as PackageRow[]).slice();
        const rawSettings = (layoutRes.data as WebsiteSettingsRow)?.value as PackagesLayoutSettings | undefined;
        const order = Array.isArray(rawSettings?.packageOrder) ? rawSettings?.packageOrder : null;

        if (order && order.length) {
          const rank = new Map<string, number>();
          order.forEach((id, idx) => rank.set(String(id), idx));
          base.sort((a, b) => {
            const ra = rank.has(a.id) ? (rank.get(a.id) as number) : Number.POSITIVE_INFINITY;
            const rb = rank.has(b.id) ? (rank.get(b.id) as number) : Number.POSITIVE_INFINITY;
            if (ra !== rb) return ra - rb;
            return (a.created_at ?? "").localeCompare(b.created_at ?? "");
          });
        }

        setPackages(base);
      } catch {
        // Silent fail: this is a non-blocking preview section.
        if (isMounted) setPackages([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const items = useMemo(() => packages, [packages]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="text-base">{t("nav.packages")}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{t("order.plan")}: {t("order.step.plan")}</p>
        </div>
        <Button asChild variant="outline">
          <Link to={viewDetailHref}>{t("home.ctaPackages")}</Link>
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("packages.loading")}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("packages.empty")}</p>
        ) : (
          <div className="grid gap-3">
            {items.map((pkg) => (
              <div key={pkg.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{pkg.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="uppercase">{pkg.type}</Badge>
                      {pkg.is_recommended ? <Badge variant="secondary">{t("packages.recommended")}</Badge> : null}
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {formatIdr(Number(pkg.price ?? 0))}
                  </p>
                </div>

                {pkg.description ? (
                  <p className="mt-2 text-sm text-muted-foreground">{pkg.description}</p>
                ) : null}

                <div className="mt-3">
                  <Button asChild variant="link" className="px-0">
                    <Link to={viewDetailHref}>{t("home.ctaPackages")}</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
