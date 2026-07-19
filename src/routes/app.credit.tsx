import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { formatKsh } from "@/lib/format";
import { HandCoins, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/credit")({ component: CreditScreen });

function CreditScreen() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();

  const { data: sales = [] } = useQuery({
    queryKey: ["credit-sales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*, customers(name, phone)").eq("is_credit", true).eq("credit_paid", false).order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const total = sales.reduce((s, r) => s + Number(r.total), 0);

  const markPaid = async (id: string) => {
    const { error } = await supabase.from("sales").update({ credit_paid: true }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(lang === "en" ? "Marked paid" : "Imelipwa");
    qc.invalidateQueries();
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">{t("credit")}</h1>
      <div className="card-soft bg-danger p-5 text-danger-foreground">
        <div className="text-sm font-semibold opacity-90">{t("outstandingCredit")}</div>
        <div className="mt-1 text-3xl font-extrabold">{formatKsh(total)}</div>
      </div>
      {sales.length === 0 ? (
        <div className="card-soft flex flex-col items-center gap-3 p-8 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-secondary"><HandCoins className="text-primary" /></div>
          <p className="text-muted-foreground">{t("empty_credit")}</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {sales.map((s: any) => (
            <div key={s.id} className="card-soft p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold">{s.customers?.name ?? (lang === "en" ? "Unknown customer" : "Mteja hajulikani")}</div>
                  <div className="text-sm text-muted-foreground">{s.product_name_snapshot} · {new Date(s.date).toLocaleDateString(lang === "sw" ? "sw-KE" : "en-KE")}</div>
                  {s.customers?.phone && <div className="text-xs text-muted-foreground">{s.customers.phone}</div>}
                </div>
                <div className="text-right">
                  <div className="text-lg font-extrabold">{formatKsh(Number(s.total))}</div>
                </div>
              </div>
              <button onClick={() => markPaid(s.id)} className="tap-target mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground">
                <CheckCircle2 size={18} /> {t("markPaid")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
