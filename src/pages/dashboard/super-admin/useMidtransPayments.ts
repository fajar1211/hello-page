import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { invokeWithAuth } from "@/lib/invokeWithAuth";

export type MidtransEnv = "sandbox" | "production";

type MidtransPaymentsItem = {
  id: string;
  created_at: string;
  domain: string;
  customer_name: string | null;
  customer_email: string | null;
  amount_usd: number | null;
  amount_idr: number | null;
  midtrans_order_id: string | null;
  midtrans_redirect_url: string | null;
  midtrans?: Record<string, any> | null;
  midtrans_error?: string | null;
};

type Response = {
  ok: boolean;
  env?: MidtransEnv;
  items?: MidtransPaymentsItem[];
  error?: string;
};

const FN = "super-admin-midtrans-payments";

export function useMidtransPayments() {
  const [env, setEnv] = useState<MidtransEnv>("production");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MidtransPaymentsItem[]>([]);

  const refresh = useCallback(
    async (opts?: { env?: MidtransEnv }) => {
      const desiredEnv = opts?.env ?? env;
      setLoading(true);
      try {
        const { data, error } = await invokeWithAuth<Response>(FN, { env: desiredEnv, limit: 20 });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || "Midtrans server key not configured");
        setItems(data.items ?? []);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message ?? "Gagal memuat transaksi Midtrans.");
      } finally {
        setLoading(false);
      }
    },
    [env],
  );

  return useMemo(
    () => ({ env, setEnv, loading, items, refresh }),
    [env, loading, items, refresh],
  );
}
