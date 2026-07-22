import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { formatKsh } from "@/lib/format";
import { HandCoins, CheckCircle2, AlertTriangle, Coins } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "./app.inventory";

export const Route = createFileRoute("/app/credit")({ component: CreditScreen });

type CreditRow = {
  id: string;
  product_name_snapshot: string;
  total: number;
  date: string;
  due_date: string | null;
  credit_paid: boolean;
  customer_id: string | null;
  customers: { name: string; phone: string | null } | null;
  paid: number;
  balance: number;
  overdue: boolean;
};

function CreditScreen() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [payingFor, setPayingFor] = useState<CreditRow | null>(null);

  const { data: rows = [] } = useQuery<CreditRow[]>({
    queryKey: ["credit-sales"],
    queryFn: async () => {
      const { data: sales, error } = await supabase
        .from("sales")
        .select("id, product_name_snapshot, total, date, due_date, credit_paid, customer_id, customers(name, phone)")
        .eq("is_credit", true)
        .eq("credit_paid", false)
        .order("date", { ascending: false });
      if (error) throw error;
      const ids = (sales ?? []).map((s: any) => s.id);
      let payments: any[] = [];
      if (ids.length) {
        const { data: pays } = await supabase.from("credit_payments").select("sale_id, amount").in("sale_id", ids);
        payments = pays ?? [];
      }
      const paidBySale = new Map<string, number>();
      for (const p of payments) paidBySale.set(p.sale_id, (paidBySale.get(p.sale_id) ?? 0) + Number(p.amount));
      const today = new Date(); today.setHours(0, 0, 0, 0);
      return (sales ?? []).map((s: any) => {
        const paid = paidBySale.get(s.id) ?? 0;
        const balance = Math.max(0, Number(s.total) - paid);
        const overdue = !!s.due_date && new Date(s.due_date) < today && balance > 0;
        return { ...s, paid, balance, overdue } as CreditRow;
      });
    },
  });

  const outstanding = rows.reduce((s, r) => s + r.balance, 0);
  const overdueCount = rows.filter((r) => r.overdue).length;
  const customersOwing = new Set(rows.filter((r) => r.customer_id).map((r) => r.customer_id)).size;

  const markPaid = async (r: CreditRow) => {
    if (r.balance > 0) {
      const { data: u } = await supabase.auth.getUser();
      const { error: pe } = await supabase.from("credit_payments").insert({
        user_id: u.user!.id, sale_id: r.id, amount: r.balance,
      } as any);
      if (pe) return toast.error(pe.message);
    }
    const { error } = await supabase.from("sales").update({ credit_paid: true } as any).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(lang === "en" ? "Marked paid" : "Imelipwa");
    qc.invalidateQueries();
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">{t("credit")}</h1>

      <div className="card-soft bg-danger p-5 text-danger-foreground">
        <div className="text-sm font-semibold opacity-90">{t("outstandingCredit")}</div>
        <div className="mt-1 text-3xl font-extrabold">{formatKsh(outstanding)}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card-soft p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Coins size={16} /> <span>{t("customersOwing")}</span>
          </div>
          <div className="mt-1 text-xl font-extrabold">{customersOwing}</div>
        </div>
        <div className={`card-soft p-4 ${overdueCount > 0 ? "bg-warning text-warning-foreground" : ""}`}>
          <div className={`flex items-center gap-1.5 text-xs font-semibold ${overdueCount > 0 ? "opacity-90" : "text-muted-foreground"}`}>
            <AlertTriangle size={16} /> <span>{lang === "en" ? "Overdue" : "Zilizochelewa"}</span>
          </div>
          <div className="mt-1 text-xl font-extrabold">{overdueCount}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card-soft flex flex-col items-center gap-3 p-8 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-secondary"><HandCoins className="text-primary" /></div>
          <p className="text-muted-foreground">{t("empty_credit")}</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {rows.map((s) => (
            <div key={s.id} className={`card-soft p-4 ${s.overdue ? "border-danger" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{s.customers?.name ?? (lang === "en" ? "Unknown customer" : "Mteja hajulikani")}</span>
                    {s.overdue && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-danger-foreground">
                        <AlertTriangle size={12} /> {lang === "en" ? "Overdue" : "Imechelewa"}
                      </span>
                    )}
                    {s.paid > 0 && s.balance > 0 && (
                      <span className="rounded-full bg-warning px-2 py-0.5 text-xs font-bold text-warning-foreground">
                        {lang === "en" ? "Partial" : "Sehemu"}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {s.product_name_snapshot} · {new Date(s.date).toLocaleDateString(lang === "sw" ? "sw-KE" : "en-KE")}
                  </div>
                  {s.customers?.phone && <div className="text-xs text-muted-foreground">{s.customers.phone}</div>}
                  {s.due_date && (
                    <div className={`text-xs ${s.overdue ? "font-bold text-danger" : "text-muted-foreground"}`}>
                      {lang === "en" ? "Due" : "Tarehe"}: {new Date(s.due_date).toLocaleDateString(lang === "sw" ? "sw-KE" : "en-KE")}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-lg font-extrabold">{formatKsh(s.balance)}</div>
                  {s.paid > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {lang === "en" ? "of" : "kati ya"} {formatKsh(Number(s.total))}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPayingFor(s)}
                  className="tap-target inline-flex items-center justify-center gap-2 rounded-xl border border-primary font-bold text-primary"
                >
                  <Coins size={18} /> {t("partialPay")}
                </button>
                <button
                  onClick={() => markPaid(s)}
                  className="tap-target inline-flex items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground"
                >
                  <CheckCircle2 size={18} /> {t("markPaid")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {payingFor && (
        <PaymentDialog
          row={payingFor}
          onClose={() => setPayingFor(null)}
          onSaved={() => { qc.invalidateQueries(); setPayingFor(null); }}
        />
      )}
    </div>
  );
}

function PaymentDialog({ row, onClose, onSaved }: { row: CreditRow; onClose: () => void; onSaved: () => void }) {
  const { t, lang } = useI18n();
  const [amount, setAmount] = useState<number>(row.balance);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) return toast.error(lang === "en" ? "Enter an amount" : "Weka kiasi");
    const capped = Math.min(amount, row.balance);
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("credit_payments").insert({
      user_id: u.user!.id, sale_id: row.id, amount: capped,
    } as any);
    if (error) { setSaving(false); return toast.error(error.message); }
    if (capped >= row.balance) {
      await supabase.from("sales").update({ credit_paid: true } as any).eq("id", row.id);
    }
    setSaving(false);
    toast.success(lang === "en" ? "Payment recorded" : "Malipo yamehifadhiwa");
    onSaved();
  };

  return (
    <Modal onClose={onClose} title={t("partialPay")}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="card-soft flex items-center justify-between bg-secondary p-4">
          <span className="text-sm font-semibold">{lang === "en" ? "Balance" : "Salio"}</span>
          <span className="text-xl font-extrabold text-primary">{formatKsh(row.balance)}</span>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{t("amount")}</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="tap-target rounded-xl border border-input bg-card px-4 text-xl font-bold"
          />
        </label>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={onClose} className="tap-target flex-1 rounded-2xl border border-border font-semibold">{t("cancel")}</button>
          <button disabled={saving} className="tap-target flex-1 rounded-2xl bg-primary font-bold text-primary-foreground">{t("save")}</button>
        </div>
      </form>
    </Modal>
  );
}
