import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { offlineList, recordExpenseOfflineFirst } from "@/lib/offline/actions";
import { useOffline } from "@/lib/offline/OfflineProvider";
import { useI18n } from "@/lib/i18n";
import { QuickFilterBar, getPeriodRange, type PeriodKey } from "@/components/QuickFilterBar";
import { formatKsh } from "@/lib/format";
import { Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "./app.inventory";


export const Route = createFileRoute("/app/expenses")({ component: ExpensesScreen });

import { Bus, Home, Users2, Store, MoreHorizontal } from "lucide-react";

const CATEGORIES = [
  { key: "transport", en: "Transport", sw: "Usafiri", icon: Bus },
  { key: "rent", en: "Rent", sw: "Kodi", icon: Home },
  { key: "wages", en: "Wages", sw: "Mishahara", icon: Users2 },
  { key: "market_fee", en: "Market fee", sw: "Ada ya soko", icon: Store },
  { key: "misc", en: "Other", sw: "Nyingine", icon: MoreHorizontal },
] as const;
type CategoryKey = (typeof CATEGORIES)[number]["key"];

function ExpensesScreen() {
  const { t, lang } = useI18n();
  const [period, setPeriod] = useState<PeriodKey>("thisMonth");
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { from, to } = getPeriodRange(period);

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", period],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").gte("date", from.toISOString()).lte("date", to.toISOString()).order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const total = expenses.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{t("expenses")}</h1>
        <button onClick={() => setOpen(true)} className="tap-target inline-flex items-center gap-2 rounded-2xl bg-primary px-4 font-bold text-primary-foreground">
          <Plus size={18} /> {t("addExpense")}
        </button>
      </div>
      <QuickFilterBar value={period} onChange={setPeriod} />
      <div className="card-soft flex items-center justify-between p-4">
        <span className="text-sm text-muted-foreground">{t("totalExpenses")} — {t(period)}</span>
        <span className="text-xl font-extrabold">{formatKsh(total)}</span>
      </div>
      {expenses.length === 0 ? (
        <div className="card-soft flex flex-col items-center gap-3 p-8 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-secondary"><Wallet className="text-primary" /></div>
          <p className="text-muted-foreground">{t("empty_expenses")}</p>
          <button onClick={() => setOpen(true)} className="tap-target rounded-2xl bg-primary px-6 font-bold text-primary-foreground">{t("addExpense")}</button>
        </div>
      ) : (
        <div className="grid gap-2">
          {expenses.map((e: any) => {
            const cat = CATEGORIES.find((c) => c.key === e.category);
            const label = cat ? (lang === "sw" ? cat.sw : cat.en) : e.category;
            return (
              <div key={e.id} className="card-soft flex items-start justify-between p-4">
                <div className="min-w-0">
                  <div className="font-bold">{label}</div>
                  {e.description && <div className="text-sm text-muted-foreground">{e.description}</div>}
                  <div className="text-xs text-muted-foreground">{new Date(e.date).toLocaleDateString(lang === "sw" ? "sw-KE" : "en-KE")}</div>
                </div>
                <div className="text-lg font-extrabold">{formatKsh(Number(e.amount))}</div>
              </div>
            );
          })}
        </div>
      )}
      {open && <AddExpense onClose={() => setOpen(false)} onSaved={() => { qc.invalidateQueries(); setOpen(false); }} />}
    </div>
  );
}

function AddExpense({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t, lang } = useI18n();
  const [category, setCategory] = useState<CategoryKey>("stock_purchase" as CategoryKey);
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("expenses").insert({ category, amount, description, user_id: u.user!.id });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  };
  return (
    <Modal onClose={onClose} title={t("addExpense")}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">{t("category")}</span>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              const active = category === c.key;
              return (
                <button
                  type="button"
                  key={c.key}
                  onClick={() => setCategory(c.key as CategoryKey)}
                  className={`tap-target flex items-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition-colors ${
                    active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"
                  }`}
                >
                  <Icon size={18} />
                  <span>{lang === "sw" ? c.sw : c.en}</span>
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{t("amount")} (KSh)</span>
          <input required type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="tap-target rounded-xl border border-input bg-card px-4 text-xl font-bold" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{t("description")}</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="tap-target rounded-xl border border-input bg-card px-4" />
        </label>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={onClose} className="tap-target flex-1 rounded-2xl border border-border font-semibold">{t("cancel")}</button>
          <button disabled={saving} className="tap-target flex-1 rounded-2xl bg-primary font-bold text-primary-foreground">{t("save")}</button>
        </div>
      </form>
    </Modal>
  );
}
