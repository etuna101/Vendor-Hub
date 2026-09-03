import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

type DueDebt = {
  id: string;
  due_date: string;
  customers: { name: string } | null;
};

export function DueDebtNotifications() {
  const { lang } = useI18n();
  const today = new Date().toISOString().slice(0, 10);
  const { data: dueDebts = [] } = useQuery<DueDebt[]>({
    queryKey: ["due-debt-notifications", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, due_date, customers(name)")
        .eq("is_credit", true)
        .eq("credit_paid", false)
        .not("due_date", "is", null)
        .lte("due_date", today);
      if (error) throw error;
      return (data ?? []) as DueDebt[];
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!dueDebts.length || typeof window === "undefined") return;
    const storageKey = `vendorhub-due-debts-${today}`;
    const alreadyAlerted = new Set(JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as string[]);
    const newDebts = dueDebts.filter((debt) => !alreadyAlerted.has(debt.id));
    if (!newDebts.length) return;

    const label = lang === "en"
      ? `${newDebts.length} customer debt${newDebts.length === 1 ? " is" : "s are"} due or overdue.`
      : `Deni ${newDebts.length} la wateja linadaiwa leo au limechelewa.`;
    toast.warning(lang === "en" ? "Payment reminder" : "Kikumbusho cha malipo", { description: label });
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(lang === "en" ? "VendorHub payment reminder" : "VendorHub kikumbusho cha malipo", { body: label });
    }
    window.localStorage.setItem(storageKey, JSON.stringify([...alreadyAlerted, ...newDebts.map((debt) => debt.id)]));
  }, [dueDebts, lang, today]);

  return null;
}
