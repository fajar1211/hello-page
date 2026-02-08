import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type OrderAddOnItem = {
  id: string;
  label: string;
  price_per_unit: number;
  unit: string;
  unit_step: number;
  max_quantity: number | null;
  sort_order: number;
};

export function useOrderAddOns(params: {
  packageId: string | null;
  quantities: Record<string, number>;
}) {
  const { packageId, quantities } = params;

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<OrderAddOnItem[]>([]);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      if (!packageId) {
        setItems([]);
        return;
      }

      setLoading(true);
      try {
        const { data } = await supabase
          .from("package_add_ons")
          .select("id,label,price_per_unit,unit,unit_step,max_quantity,sort_order")
          .eq("package_id", packageId)
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        if (!isMounted) return;
        setItems((data ?? []) as any);
      } catch {
        if (isMounted) setItems([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [packageId]);

  const total = useMemo(() => {
    if (!packageId) return 0;
    if (!items.length) return 0;
    return items.reduce((sum, a) => {
      const qty = quantities?.[a.id] ?? 0;
      return sum + Number(a.price_per_unit ?? 0) * Number(qty ?? 0);
    }, 0);
  }, [items, packageId, quantities]);

  return { loading, items, total };
}
