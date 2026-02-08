import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useOrder } from "@/contexts/OrderContext";
import { useI18n } from "@/hooks/useI18n";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type PackageRow = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  price: number | null;
  features?: unknown;
  is_recommended?: boolean;
};

const TARGET_NAMES = ["Website Only", "Website + Content Growth", "Website + Full Digital Marketing"] as const;

type TargetName = (typeof TARGET_NAMES)[number];

function formatIdr(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

function getFeatureSnippet(features: unknown): string[] {
  if (!Array.isArray(features)) return [];
  return features
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean)
    .slice(0, 3);
}

function resolveTargetName(name: string): TargetName | null {
  const n = normalizeName(name);
  const found = TARGET_NAMES.find((t) => normalizeName(t) === n);
  return found ?? null;
}

function targetRank(name: string): number {
  const tn = resolveTargetName(name);
  if (!tn) return Number.POSITIVE_INFINITY;
  return TARGET_NAMES.indexOf(tn);
}

function WebsitePackageCard({
  pkg,
  onViewDetail,
}: {
  pkg: PackageRow;
  onViewDetail: (pkgId: string) => void;
}) {
  const { t } = useI18n();
  const { state, setPackage, setSubscriptionYears } = useOrder();

  const isSelected = state.selectedPackageId === pkg.id;
  const price = formatIdr(Number(pkg.price ?? 0));

  const choose = () => {
    setPackage({ id: pkg.id, name: pkg.name });
    // Force user to re-confirm duration when package changes.
    setSubscriptionYears(null);
  };

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft overflow-hidden">
      <div className="flex h-full flex-col">
        <div>
          <p className="text-base font-semibold text-foreground break-words [text-wrap:balance]">{pkg.name}</p>
          <p className="mt-2 text-xl font-bold text-foreground">{price}</p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="uppercase">
              {pkg.type}
            </Badge>
            {isSelected ? <Badge variant="secondary">{t("order.selected")}</Badge> : null}
          </div>
        </div>

        {pkg.description ? <p className="mt-3 text-sm text-muted-foreground break-words">{pkg.description}</p> : null}

        <div className="mt-auto pt-5 flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="link" className="px-0" onClick={() => onViewDetail(pkg.id)}>
            {t("order.viewDetail")}
          </Button>

          <Button type="button" variant={isSelected ? "secondary" : "default"} disabled={isSelected} onClick={choose}>
            {isSelected ? t("order.selected") : t("order.select")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function WebsitePackageDetails({
  pkg,
  onBack,
}: {
  pkg: PackageRow;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const { state, setPackage, setSubscriptionYears } = useOrder();

  const isSelected = state.selectedPackageId === pkg.id;
  const price = formatIdr(Number(pkg.price ?? 0));
  const features = Array.isArray(pkg.features) ? (pkg.features as unknown[]) : [];

  const choose = () => {
    setPackage({ id: pkg.id, name: pkg.name });
    setSubscriptionYears(null);
  };

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-foreground break-words [text-wrap:balance]">{pkg.name}</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{price}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="uppercase">
              {pkg.type}
            </Badge>
            {isSelected ? <Badge variant="secondary">{t("order.selected")}</Badge> : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onBack}>
            Lihat Paket
          </Button>
          <Button type="button" variant={isSelected ? "secondary" : "default"} disabled={isSelected} onClick={choose}>
            {isSelected ? t("order.selected") : t("order.select")}
          </Button>
        </div>
      </div>

      {pkg.description ? <p className="mt-4 text-sm text-muted-foreground break-words">{pkg.description}</p> : null}

      {features.length ? (
        <div className="mt-5 rounded-xl bg-muted/30 p-4">
          <p className="text-sm font-medium text-foreground">Isi paket</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {features.map((f, idx) => {
              const text = typeof f === "string" ? f : null;
              if (!text) return null;
              return (
                <li key={`${idx}-${text}`} className="flex gap-2 text-sm text-muted-foreground">
                  <span aria-hidden className="mt-1.5 size-1.5 rounded-full bg-foreground/40 shrink-0" />
                  <span className="break-words">{text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function OrderWebsitePackagesCards() {
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [detailPackageId, setDetailPackageId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        setLoading(true);

        const res = await supabase
          .from("packages")
          .select("id,name,type,description,price,features,is_recommended")
          .eq("is_active", true)
          .eq("show_on_public", true);

        if (!isMounted) return;

        const base = (res.data ?? []) as PackageRow[];
        const filtered = base
          .filter((p) => resolveTargetName(p.name) != null)
          .slice()
          .sort((a, b) => targetRank(a.name) - targetRank(b.name));

        setPackages(filtered);
      } catch {
        if (isMounted) setPackages([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section id="order-packages" aria-label={t("nav.packages")} className="space-y-3">
      <header className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{t("nav.packages")}</h2>
        <p className="text-sm text-muted-foreground">Pilih paket dulu, lalu baru pilih durasi.</p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("packages.loading")}</p>
      ) : packages.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Paket Website belum ditemukan. Pastikan ada paket bernama: {TARGET_NAMES.join(", ")}.
        </p>
      ) : detailPackageId ? (
        (() => {
          const pkg = packages.find((p) => p.id === detailPackageId);
          if (!pkg) return null;
          return <WebsitePackageDetails pkg={pkg} onBack={() => setDetailPackageId(null)} />;
        })()
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {packages.map((pkg) => (
            <WebsitePackageCard key={pkg.id} pkg={pkg} onViewDetail={setDetailPackageId} />
          ))}
        </div>
      )}
    </section>
  );
}
