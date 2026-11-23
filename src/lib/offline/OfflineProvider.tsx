import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { pendingCount, reviewItems, type QueueItem } from "./db";
import { processQueue } from "./sync";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

type OfflineCtx = {
  online: boolean;
  pending: number;
  review: QueueItem[];
  refresh: () => Promise<void>;
  syncNow: () => Promise<void>;
};

const Ctx = createContext<OfflineCtx>({
  online: true,
  pending: 0,
  review: [],
  refresh: async () => {},
  syncNow: async () => {},
});

export function useOffline() {
  return useContext(Ctx);
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [review, setReview] = useState<QueueItem[]>([]);

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    setPending(await pendingCount(userId));
    setReview(await reviewItems(userId));
  };

  const syncNow = async () => {
    const result = await processQueue();
    await refresh();
    if (result.synced > 0) {
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
      void queryClient.invalidateQueries({ queryKey: ["expenses"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["products-active"] });
      void queryClient.invalidateQueries({ queryKey: ["credit-sales-all"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success(lang === "sw" ? "Imesawazishwa" : "Synced", {
        description:
          lang === "sw"
            ? `${result.synced} kitu kimehifadhiwa mtandaoni.`
            : `${result.synced} item(s) saved online.`,
      });
    }
    if (result.needsReview > 0) {
      toast.warning(lang === "sw" ? "Inahitaji ukaguzi" : "Needs review", {
        description:
          lang === "sw"
            ? "Muuzo mmoja haukuweza kuhifadhiwa kwa sababu ya hisa. Angalia Dashibodi."
            : "A sale could not be saved because of stock. Check your Dashboard.",
      });
    }
  };

  useEffect(() => {
    setOnline(navigator.onLine);
    refresh();
    const goOnline = () => {
      setOnline(true);
      syncNow();
    };
    const goOffline = () => setOnline(false);
    const onCacheUpdated = (event: Event) => {
      const table = (event as CustomEvent<{ table?: string }>).detail?.table;
      const keys: Record<string, string[][]> = {
        products: [["products"], ["products-active"], ["dashboard"], ["reports"]],
        sales: [["sales"], ["sales-14d"], ["dashboard"], ["credit-sales-all"], ["reports"]],
        expenses: [["expenses"], ["dashboard"], ["reports"]],
        credit_payments: [["credit-sales-all"]],
      };
      for (const queryKey of keys[table ?? ""] ?? []) {
        void queryClient.invalidateQueries({ queryKey });
      }
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("vendorhub:offline-cache-updated", onCacheUpdated);
    const interval = window.setInterval(() => {
      if (navigator.onLine) syncNow();
      else refresh();
    }, 60_000);
    if (navigator.onLine) syncNow();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("vendorhub:offline-cache-updated", onCacheUpdated);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({ online, pending, review, refresh, syncNow }), [online, pending, review]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
