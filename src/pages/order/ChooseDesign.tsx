import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OrderLayout } from "@/components/order/OrderLayout";
import { useOrder } from "@/contexts/OrderContext";
import { useOrderPublicSettings, type OrderTemplate } from "@/hooks/useOrderPublicSettings";
import { useI18n } from "@/hooks/useI18n";

export default function ChooseDesign() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { state, setTemplate } = useOrder();
  const { templates } = useOrderPublicSettings();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<OrderTemplate["category"] | "all">("all");

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const tmplt of templates) {
      const c = String(tmplt.category ?? "").trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [templates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = templates.filter((tmplt) => {
      const byCategory = category === "all" ? true : tmplt.category === category;
      const byQuery = !q ? true : tmplt.name.toLowerCase().includes(q);
      return byCategory && byQuery;
    });
    // Keep list stable and consistent with admin `sort_order` (no user-facing sort choices).
    return [...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [category, query, templates]);

  const selected = state.selectedTemplateId;

  return (
    <OrderLayout title={t("order.step.design")} step="design" sidebar={null}>
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("order.filterTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
            <Input
              className="md:flex-1"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("order.searchTemplates")}
            />
            <div className="md:w-[220px]">
              <Select value={category} onValueChange={(v) => setCategory(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("order.category")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("order.all")}</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tmplt) => {
            const isSelected = selected === tmplt.id;
            const previewImg = String((tmplt as any)?.preview_image_url ?? "").trim();
            const demoUrl = String(tmplt.preview_url ?? "").trim();
            return (
              <Card key={tmplt.id} className={isSelected ? "ring-2 ring-ring" : ""}>
                <CardContent className="p-5">
                  <div className="mb-4 overflow-hidden rounded-md border bg-muted">
                    <AspectRatio ratio={16 / 9}>
                      {previewImg ? (
                        <img
                          src={previewImg}
                          alt={`Preview ${tmplt.name}`}
                          className="h-full w-full object-contain bg-background"
                          loading="lazy"
                        />
                      ) : (
                        <img
                          src="/placeholder.svg"
                          alt="Template preview placeholder"
                          className="h-full w-full object-contain bg-background"
                          loading="lazy"
                        />
                      )}
                    </AspectRatio>
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-foreground">{tmplt.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">Template category</p>
                    </div>
                    <Badge variant="outline">{tmplt.category}</Badge>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const url = String(tmplt.preview_url ?? "").trim();
                        if (!url) return;
                        window.open(url, "_blank", "noopener,noreferrer");
                      }}
                      disabled={!demoUrl}
                    >
                      {t("order.preview")}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setTemplate({ id: tmplt.id, name: tmplt.name })}
                      variant={isSelected ? "secondary" : "default"}
                    >
                      {isSelected ? t("order.selected") : t("order.select")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={() => navigate("/order/choose-domain")}> 
            {t("common.back")}
          </Button>
          <Button type="button" size="lg" disabled={!selected} onClick={() => navigate("/order/details")}>
            {t("order.continueDetails")}
          </Button>
        </div>
      </div>
    </OrderLayout>
  );
}

