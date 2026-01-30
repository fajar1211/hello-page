import { useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    paypal?: any;
  }
}

export type PayPalButtonsOrderPayload = {
  amount_usd: number;
  subscription_years: number;
  promo_code?: string;
  domain: string;
  selected_template_id: string;
  selected_template_name?: string;
  customer_name: string;
  customer_email: string;
};

type Props = {
  disabled?: boolean;
  payload: PayPalButtonsOrderPayload;
  onOrderDbId?: (id: string) => void;
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

export function PayPalButtonsSection({ disabled, payload, onOrderDbId, onSuccess, onError }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const createdMapRef = useRef<Record<string, string>>({});
  const [sdkReady, setSdkReady] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const canRender = useMemo(() => {
    return Boolean(!disabled && payload.amount_usd > 0 && payload.subscription_years > 0 && payload.domain && payload.selected_template_id);
  }, [disabled, payload.amount_usd, payload.domain, payload.selected_template_id, payload.subscription_years]);

  useEffect(() => {
    if (typeof window.paypal?.Buttons === "function") {
      setSdkReady(true);
      return;
    }

    const t = window.setInterval(() => {
      if (typeof window.paypal?.Buttons === "function") {
        window.clearInterval(t);
        setSdkReady(true);
      }
    }, 250);

    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!sdkReady) return;
    if (!containerRef.current) return;
    if (!canRender) return;

    // Re-render cleanly when payload changes.
    containerRef.current.innerHTML = "";
    setRenderError(null);

    try {
      window.paypal
        .Buttons({
          createOrder: async () => {
            const { data, error } = await supabase.functions.invoke<{
              ok: boolean;
              paypal_order_id: string;
              order_db_id: string | null;
              error?: string;
            }>("paypal-create-order", { body: payload });

            if (error) throw error;
            if (!(data as any)?.ok) throw new Error((data as any)?.error ?? "PayPal create order failed");

            const orderId = String((data as any)?.paypal_order_id ?? "").trim();
            const orderDbId = String((data as any)?.order_db_id ?? "").trim();
            if (!orderId) throw new Error("PayPal order id missing");

            if (orderDbId) {
              createdMapRef.current[orderId] = orderDbId;
              onOrderDbId?.(orderDbId);
            }
            return orderId;
          },
          onApprove: async (data: any) => {
            try {
              const paypalOrderId = String(data?.orderID ?? "").trim();
              const orderDbId = createdMapRef.current[paypalOrderId];
              if (!paypalOrderId || !orderDbId) throw new Error("Missing order reference");

              const { data: cap, error } = await supabase.functions.invoke<{ ok: boolean; error?: string }>("paypal-capture-order", {
                body: { paypal_order_id: paypalOrderId, order_db_id: orderDbId },
              });
              if (error) throw error;
              if (!(cap as any)?.ok) throw new Error((cap as any)?.error ?? "PayPal capture failed");

              onSuccess?.();
            } catch (e: any) {
              const msg = e?.message ?? "Payment failed";
              onError?.(msg);
            }
          },
          onError: (err: any) => {
            const msg = String(err?.message ?? "PayPal error");
            onError?.(msg);
          },
        })
        .render(containerRef.current);
    } catch (e: any) {
      setRenderError(e?.message ?? "Failed to render PayPal buttons");
    }
  }, [canRender, onError, onOrderDbId, onSuccess, payload, sdkReady]);

  if (!sdkReady) {
    return <div className="text-sm text-muted-foreground">Memuat PayPal…</div>;
  }

  if (!canRender) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        PayPal belum bisa dipakai. Pastikan domain, template, dan total sudah siap.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {renderError ? <div className="text-sm text-destructive">{renderError}</div> : null}
      <div ref={containerRef} />
      <Button type="button" variant="outline" onClick={() => onError?.("Canceled")}>Cancel</Button>
    </div>
  );
}
