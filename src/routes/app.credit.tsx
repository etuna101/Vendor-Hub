import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { recordCreditPaymentOfflineFirst } from "@/lib/offline/actions";
import { getEdgeFunctionErrorMessage } from "@/lib/edge-function-error";

import { useI18n } from "@/lib/i18n";
import { formatKsh } from "@/lib/format";
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Coins,
  Users,
  ShoppingBag,
  Search,
  BellRing,
  MessageSquare,
  Mail,
  Smartphone,
} from "lucide-react";
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
  daysDiff: number | null;
};

function dueLabel(row: CreditRow, lang: string) {
  if (row.daysDiff === null) return null;
  const d = row.daysDiff;
  if (d === 0) return { text: lang === "en" ? "Due today" : "Inalipwa leo", tone: "warn" as const };
  if (d < 0)
    return {
      text:
        lang === "en"
          ? `Overdue by ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"}`
          : `Imechelewa siku ${Math.abs(d)}`,
      tone: "danger" as const,
    };
  return {
    text: lang === "en" ? `Due in ${d} day${d === 1 ? "" : "s"}` : `Inalipwa baada ya siku ${d}`,
    tone: "ok" as const,
  };
}

function CreditScreen() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [payingFor, setPayingFor] = useState<CreditRow | null>(null);
  const [mpesaFor, setMpesaFor] = useState<CreditRow | null>(null);
  const [remindFor, setRemindFor] = useState<CreditRow | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "owing" | "cleared">("all");

  const { data: rows = [] } = useQuery<CreditRow[]>({
    queryKey: ["credit-sales-all"],
    queryFn: async () => {
      const { data: sales, error } = await supabase
        .from("sales")
        .select(
          "id, product_name_snapshot, total, date, due_date, credit_paid, customer_id, customers(name, phone)",
        )
        .eq("is_credit", true)
        .order("date", { ascending: false });
      if (error) throw error;
      const ids = (sales ?? []).map((s: any) => s.id);
      let payments: any[] = [];
      if (ids.length) {
        const { data: pays } = await supabase
          .from("credit_payments")
          .select("sale_id, amount")
          .in("sale_id", ids);
        payments = pays ?? [];
      }
      const paidBySale = new Map<string, number>();
      for (const p of payments)
        paidBySale.set(p.sale_id, (paidBySale.get(p.sale_id) ?? 0) + Number(p.amount));
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return (sales ?? []).map((s: any) => {
        const paid = paidBySale.get(s.id) ?? 0;
        const balance = s.credit_paid ? 0 : Math.max(0, Number(s.total) - paid);
        let daysDiff: number | null = null;
        if (s.due_date) {
          const due = new Date(s.due_date);
          due.setHours(0, 0, 0, 0);
          daysDiff = Math.round((due.getTime() - today.getTime()) / 86400000);
        }
        const overdue = !s.credit_paid && daysDiff !== null && daysDiff < 0 && balance > 0;
        return { ...s, paid, balance, overdue, daysDiff } as CreditRow;
      });
    },
  });

  const owing = rows.filter((r) => !r.credit_paid && r.balance > 0);
  const cleared = rows.filter((r) => r.credit_paid || r.balance === 0);
  const outstanding = owing.reduce((s, r) => s + r.balance, 0);
  const overdueCount = owing.filter((r) => r.overdue).length;
  const customersOwing = new Set(owing.map((r) => r.customer_id ?? r.id)).size;

  const visible = useMemo(() => {
    const base = tab === "owing" ? owing : tab === "cleared" ? cleared : rows;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (r) =>
        (r.customers?.name ?? "").toLowerCase().includes(q) ||
        (r.customers?.phone ?? "").toLowerCase().includes(q) ||
        r.product_name_snapshot.toLowerCase().includes(q),
    );
  }, [tab, rows, owing, cleared, search]);

  const markPaid = async (r: CreditRow) => {
    if (r.balance > 0) {
      const { data: u } = await supabase.auth.getUser();
      const { error: pe } = await supabase.from("credit_payments").insert({
        user_id: u.user!.id,
        sale_id: r.id,
        amount: r.balance,
      } as any);
      if (pe) return toast.error(pe.message);
    }
    const { error } = await supabase
      .from("sales")
      .update({ credit_paid: true } as any)
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(lang === "en" ? "Marked paid" : "Imelipwa");
    qc.invalidateQueries();
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">{t("credit")}</h1>

      {/* Summary dashboard card */}
      <section className="card-soft overflow-hidden bg-foreground p-5 text-background">
        <div className="text-xs font-bold uppercase tracking-widest text-background/70">
          {lang === "en" ? "Total outstanding" : "Deni jumla"}
        </div>
        <div className="mt-1 text-4xl font-extrabold text-accent">
          KES {Math.round(outstanding).toLocaleString("en-KE")}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-background/10 p-3">
          <Metric
            icon={<Users size={16} />}
            value={customersOwing}
            label={lang === "en" ? "owing" : "wanadai"}
          />
          <Metric
            icon={<ShoppingBag size={16} />}
            value={owing.length}
            label={lang === "en" ? "sales" : "mauzo"}
          />
          <Metric
            icon={<CreditCard size={16} />}
            value={cleared.length}
            label={lang === "en" ? "cleared" : "zilizolipwa"}
          />
        </div>
        {overdueCount > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-danger px-3 py-2 text-sm font-bold text-danger-foreground">
            <AlertTriangle size={16} />
            {lang === "en"
              ? `${overdueCount} credit record${overdueCount === 1 ? "" : "s"} past due — send a reminder`
              : `Rekodi ${overdueCount} za deni zimechelewa — tuma kikumbusho`}
          </div>
        )}
      </section>

      {/* Search + filters */}
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === "en" ? "Search customers..." : "Tafuta wateja..."}
            className="tap-target w-full rounded-2xl border border-input bg-card pl-10 pr-4 text-base"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(
            [
              ["all", lang === "en" ? "All" : "Zote", rows.length],
              ["owing", lang === "en" ? "Owing" : "Wanadai", owing.length],
              ["cleared", lang === "en" ? "Cleared" : "Zilizolipwa", cleared.length],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
                tab === key
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground"
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="card-soft flex flex-col items-center gap-3 p-10 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-secondary">
            <CreditCard className="text-primary" />
          </div>
          <h2 className="text-lg font-extrabold">
            {lang === "en" ? "No credit records" : "Hakuna rekodi za deni"}
          </h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            {lang === "en"
              ? "Credit records will appear when customers buy on credit"
              : "Rekodi za deni zitaonekana wateja wanapochukua kwa deni"}
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {visible.map((s) => {
            const badge = !s.credit_paid && s.balance > 0 ? dueLabel(s, lang) : null;
            return (
              <div key={s.id} className={`card-soft p-4 ${s.overdue ? "border-danger" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">
                        {s.customers?.name ??
                          (lang === "en" ? "Unknown customer" : "Mteja hajulikani")}
                      </span>
                      {badge && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                            badge.tone === "danger"
                              ? "bg-danger text-danger-foreground"
                              : badge.tone === "warn"
                                ? "bg-warning text-warning-foreground"
                                : "bg-secondary text-foreground"
                          }`}
                        >
                          {badge.tone !== "ok" && <AlertTriangle size={12} />} {badge.text}
                        </span>
                      )}
                      {s.credit_paid || s.balance === 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                          <CheckCircle2 size={12} /> {lang === "en" ? "Cleared" : "Imelipwa"}
                        </span>
                      ) : s.paid > 0 ? (
                        <span className="rounded-full bg-warning px-2 py-0.5 text-xs font-bold text-warning-foreground">
                          {lang === "en" ? "Partial" : "Sehemu"}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {s.product_name_snapshot} ·{" "}
                      {new Date(s.date).toLocaleDateString(lang === "sw" ? "sw-KE" : "en-KE")}
                    </div>
                    {s.customers?.phone && (
                      <div className="text-xs text-muted-foreground">{s.customers.phone}</div>
                    )}
                    {s.due_date && (
                      <div
                        className={`text-xs ${s.overdue ? "font-bold text-danger" : "text-muted-foreground"}`}
                      >
                        {lang === "en" ? "Due" : "Tarehe"}:{" "}
                        {new Date(s.due_date).toLocaleDateString(lang === "sw" ? "sw-KE" : "en-KE")}
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
                {!s.credit_paid && s.balance > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <button
                      onClick={() => setRemindFor(s)}
                      className="tap-target inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-bold text-accent-foreground"
                    >
                      <BellRing size={16} /> {lang === "en" ? "Remind" : "Kumbusha"}
                    </button>
                    <button
                      onClick={() => setPayingFor(s)}
                      className="tap-target inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary text-sm font-bold text-primary"
                    >
                      <Coins size={16} /> {t("partialPay")}
                    </button>
                    <button
                      onClick={() => setMpesaFor(s)}
                      className="tap-target inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary bg-primary/10 text-sm font-bold text-primary"
                    >
                      <Smartphone size={16} /> M-Pesa
                    </button>
                    <button
                      onClick={() => markPaid(s)}
                      className="tap-target inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-bold text-primary-foreground"
                    >
                      <CheckCircle2 size={16} /> {t("markPaid")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {payingFor && (
        <PaymentDialog
          row={payingFor}
          onClose={() => setPayingFor(null)}
          onSaved={() => {
            qc.invalidateQueries();
            setPayingFor(null);
          }}
        />
      )}
      {mpesaFor && (
        <MpesaPaymentDialog
          row={mpesaFor}
          onClose={() => setMpesaFor(null)}
          onUpdated={() => qc.invalidateQueries()}
        />
      )}
      {remindFor && <ReminderDialog row={remindFor} onClose={() => setRemindFor(null)} />}
    </div>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-background/70">{icon}</span>
      <span className="text-lg font-extrabold">{value}</span>
      <span className="text-xs text-background/70">{label}</span>
    </div>
  );
}

function ReminderDialog({ row, onClose }: { row: CreditRow; onClose: () => void }) {
  const { lang } = useI18n();
  const [channel, setChannel] = useState<"auto" | "sms" | "whatsapp" | "email">("auto");
  const [sending, setSending] = useState(false);
  const phone = row.customers?.phone ?? "";
  const name = row.customers?.name ?? (lang === "en" ? "Customer" : "Mteja");
  const due = row.due_date
    ? new Date(row.due_date).toLocaleDateString(lang === "sw" ? "sw-KE" : "en-KE")
    : lang === "en"
      ? "as agreed"
      : "kama tulivyoagana";

  const { data: history = [], refetch: refetchHistory } = useQuery<
    Array<{ id: string; type: string; status: string; created_at: string; failure_reason: string | null }>
  >({
    queryKey: ["reminder-history", row.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, type, status, created_at, failure_reason")
        .eq("sale_id", row.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const defaultMessage =
    lang === "en"
      ? `Hello ${name}, this is a friendly reminder from your VendorHub vendor. Your balance is ${formatKsh(row.balance)} for ${row.product_name_snapshot}, due ${due}. Kindly pay via M-Pesa or at the stall. Asante!`
      : `Habari ${name}, hiki ni kikumbusho kutoka kwa muuzaji wako. Salio lako ni ${formatKsh(row.balance)} kwa ${row.product_name_snapshot}, tarehe ya kulipa ${due}. Tafadhali lipa kwa M-Pesa au ukifika kibandani. Asante!`;

  const [message, setMessage] = useState(defaultMessage);

  const sendAutoSms = async () => {
    setSending(true);
    try {
      const { data: session } = await supabase.auth.getUser();
      const userId = session.user?.id;
      if (!userId) throw new Error(lang === "en" ? "Please sign in again." : "Tafadhali ingia tena.");
      const today = new Date().toISOString().slice(0, 10);
      const type =
        row.daysDiff === null
          ? "DEBT_DUE_SOON"
          : row.daysDiff < 0
            ? "DEBT_OVERDUE"
            : row.daysDiff === 0
              ? "DEBT_DUE_TODAY"
              : "DEBT_DUE_SOON";
      const { data: created, error } = await supabase
        .from("notifications")
        .insert({
          user_id: userId,
          customer_id: row.customer_id,
          sale_id: row.id,
          type,
          message,
          reminder_date: today,
        } as any)
        .select("id")
        .maybeSingle();
      if (error) {
        if (error.code === "23505") {
          toast.info(
            lang === "en"
              ? "A reminder for this debt was already sent today."
              : "Kikumbusho cha deni hili kilitumwa leo.",
          );
          return;
        }
        throw error;
      }
      const { data: result, error: fnError } = await supabase.functions.invoke("send-sms", {
        body: { notification_id: (created as any)?.id },
      });
      if (fnError || !(result as any)?.ok) {
        // Research-stage flow: SMS delivery is not connected to a live provider yet.
        // The reminder is still recorded in history, so present it as queued, not an error.
        toast.info(
          lang === "en"
            ? "Reminder recorded. SMS delivery is not connected yet (research stage) — it is saved in the reminder history."
            : "Kikumbusho kimehifadhiwa. Utumaji wa SMS bado haujaunganishwa (hatua ya utafiti) — kimehifadhiwa kwenye historia.",
        );
      } else {
        toast.success(lang === "en" ? "Reminder SMS sent" : "SMS ya kikumbusho imetumwa");
      }
      await refetchHistory();
    } catch (err: any) {
      toast.error(err?.message ?? (lang === "en" ? "Failed to send" : "Imeshindikana"));
    } finally {
      setSending(false);
    }
  };

  const send = () => {
    if (channel === "auto") {
      void sendAutoSms();
      return;
    }
    const text = encodeURIComponent(message);
    if (channel === "email") {
      window.location.href = `mailto:?subject=${encodeURIComponent(lang === "en" ? "Payment reminder" : "Kikumbusho cha malipo")}&body=${text}`;
    } else if (channel === "whatsapp") {
      const wa = phone.replace(/[^0-9]/g, "").replace(/^0/, "254");
      window.open(`https://wa.me/${wa}?text=${text}`, "_blank", "noopener");
    } else {
      window.location.href = `sms:${phone}?body=${text}`;
    }
    onClose();
  };

  const channels = [
    {
      key: "auto" as const,
      label: lang === "en" ? "Auto SMS" : "SMS Otomatiki",
      icon: <BellRing size={16} />,
    },
    { key: "sms" as const, label: "SMS", icon: <Smartphone size={16} /> },
    { key: "whatsapp" as const, label: "WhatsApp", icon: <MessageSquare size={16} /> },
    { key: "email" as const, label: "Email", icon: <Mail size={16} /> },
  ];

  return (
    <Modal onClose={onClose} title={lang === "en" ? "Send reminder" : "Tuma kikumbusho"}>
      <div className="flex flex-col gap-3">
        <div className="card-soft flex items-center justify-between bg-secondary p-4">
          <div>
            <div className="font-bold">{name}</div>
            {phone && <div className="text-xs text-muted-foreground">{phone}</div>}
          </div>
          <span className="text-xl font-extrabold text-primary">{formatKsh(row.balance)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {channels.map((c) => (
            <button
              key={c.key}
              onClick={() => setChannel(c.key)}
              className={`tap-target inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-bold ${
                channel === c.key
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground"
              }`}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
        {channel === "auto" && (
          <p className="rounded-xl bg-secondary p-3 text-xs font-semibold text-muted-foreground">
            {lang === "en"
              ? "VendorHub records this reminder below (one per debt per day). Note: live SMS delivery is not connected yet — research-stage flow."
              : "VendorHub itarekodi kikumbusho hiki hapa chini (kimoja kwa deni kila siku). Kumbuka: utumaji wa SMS bado haujaunganishwa — hatua ya utafiti."}
          </p>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{lang === "en" ? "Message" : "Ujumbe"}</span>
          <textarea
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="rounded-xl border border-input bg-card p-3 text-sm"
          />
        </label>
        {!phone && channel !== "email" && (
          <p className="text-xs font-semibold text-danger">
            {lang === "en"
              ? "No phone number saved for this customer."
              : "Hakuna namba ya simu ya mteja huyu."}
          </p>
        )}
        {history.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">
              {lang === "en" ? "Reminder history" : "Historia ya vikumbusho"}
            </span>
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2 text-xs"
              >
                <span className="font-semibold">
                  {new Date(h.created_at).toLocaleString(lang === "sw" ? "sw-KE" : "en-KE")}
                </span>
                <span
                  className={`font-bold ${h.status === "SENT" ? "text-primary" : h.status === "FAILED" ? "text-danger" : "text-muted-foreground"}`}
                >
                  {h.status}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-1 flex gap-2">
          <button
            onClick={onClose}
            className="tap-target flex-1 rounded-2xl border border-border font-semibold"
          >
            {lang === "en" ? "Close" : "Funga"}
          </button>
          <button
            onClick={send}
            disabled={sending || (!phone && channel !== "email")}
            className="tap-target flex-1 rounded-2xl bg-primary font-bold text-primary-foreground disabled:opacity-60"
          >
            {sending
              ? lang === "en"
                ? "Sending..."
                : "Inatuma..."
              : lang === "en"
                ? "Send"
                : "Tuma"}
          </button>
        </div>

      </div>
    </Modal>
  );
}

function PaymentDialog({
  row,
  onClose,
  onSaved,
}: {
  row: CreditRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, lang } = useI18n();
  const [amount, setAmount] = useState<number>(row.balance);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0)
      return toast.error(lang === "en" ? "Enter an amount" : "Weka kiasi");
    const capped = Math.min(amount, row.balance);
    setSaving(true);
    try {
      const res = await recordCreditPaymentOfflineFirst({
        sale_id: row.id,
        amount: capped,
        mark_paid: capped >= row.balance,
      });
      toast.success(
        res.queued
          ? lang === "en"
            ? "Saved offline — will sync"
            : "Imehifadhiwa — itasawazishwa"
          : lang === "en"
            ? "Payment recorded"
            : "Malipo yamehifadhiwa",
      );
      onSaved();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
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
          <button
            type="button"
            onClick={onClose}
            className="tap-target flex-1 rounded-2xl border border-border font-semibold"
          >
            {t("cancel")}
          </button>
          <button
            disabled={saving}
            className="tap-target flex-1 rounded-2xl bg-primary font-bold text-primary-foreground"
          >
            {t("save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MpesaPaymentDialog({
  row,
  onClose,
  onUpdated,
}: {
  row: CreditRow;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { lang } = useI18n();
  const [amount, setAmount] = useState<number>(Math.round(row.balance));
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "pending" | "sent" | "success" | "failed">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!paymentId || state !== "pending") return;
    let active = true;
    let attempts = 0;
    const poll = async () => {
      attempts++;
      const { data, error } = await supabase
        .from("credit_payments")
        .select("status, result_description")
        .eq("id", paymentId)
        .maybeSingle();
      if (!active) return;
      const status = (data as any)?.status;
      if (error) {
        setState("failed");
        setMessage(
          lang === "en" ? "Could not check payment status." : "Hali ya malipo haikupatikana.",
        );
        return;
      }
      if (status === "SUCCESS") {
        setState("success");
        setMessage(lang === "en" ? "Payment confirmed." : "Malipo yamethibitishwa.");
        onUpdated();
        return;
      }
      if (status === "FAILED" || status === "CANCELLED") {
        setState("failed");
        setMessage(
          (data as any)?.result_description ??
            (lang === "en" ? "Payment was not completed." : "Malipo hayakukamilika."),
        );
        onUpdated();
        return;
      }
      if (attempts >= 40) {
        setState("failed");
        setMessage(
          lang === "en"
            ? "We have not received confirmation yet. Check again shortly."
            : "Bado hatujapokea uthibitisho. Jaribu tena baadaye.",
        );
        return;
      }
      window.setTimeout(poll, 3000);
    };
    poll();
    return () => {
      active = false;
    };
  }, [paymentId, state, lang, onUpdated]);

  const initiate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!Number.isInteger(amount) || amount <= 0 || amount > row.balance) {
      setMessage(
        lang === "en"
          ? "Enter a whole-KES amount up to the outstanding balance."
          : "Weka kiasi kamili cha KES kisichozidi salio.",
      );
      return;
    }
    setState("sending");
    setMessage("");
    const { data, error } = await supabase.functions.invoke("daraja-stk-push", {
      body: {
        phoneNumber: row.customers?.phone,
        amount,
        accountReference: `VH-${row.id.slice(0, 8)}`,
        transactionDesc: "Debt payment",
      },
    });
    const functionErrorMessage = error ? await getEdgeFunctionErrorMessage(error) : null;
    const response = data as any;
    if (error || response?.error) {
      setState("failed");
      setMessage(
        response?.error ??
          functionErrorMessage ??
          (lang === "en" ? "Could not start M-Pesa." : "M-Pesa haikuanza."),
      );
      return;
    }
    const returnedPaymentId = response?.payment_id ?? response?.paymentId ?? response?.id;
    const canTrackPayment = Boolean(returnedPaymentId);
    if (canTrackPayment) {
      setPaymentId(String(returnedPaymentId));
      setState("pending");
    } else {
      setState("sent");
    }
    setMessage(
      lang === "en"
        ? canTrackPayment
          ? "Check the customer phone and enter the M-Pesa PIN. We will confirm the result here."
          : "Prompt sent. Ask the customer to check their phone and enter the M-Pesa PIN."
        : canTrackPayment
          ? "Angalia simu ya mteja na uweke PIN ya M-Pesa. Tutathibitisha hapa."
          : "Ombi limetumwa. Mwambie mteja aangalie simu yake na aweke PIN ya M-Pesa.",
    );
  };

  return (
    <Modal onClose={onClose} title="M-Pesa STK Push">
      <form onSubmit={initiate} className="flex flex-col gap-3">
        <div className="card-soft flex items-center justify-between bg-secondary p-4">
          <span className="text-sm font-semibold">
            {lang === "en" ? "Outstanding balance" : "Salio"}
          </span>
          <span className="text-xl font-extrabold text-primary">{formatKsh(row.balance)}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {row.customers?.phone ??
            (lang === "en"
              ? "No customer phone number is saved."
              : "Namba ya simu ya mteja haijahifadhiwa.")}
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">
            {lang === "en" ? "Amount (KES)" : "Kiasi (KES)"}
          </span>
          <input
            type="number"
            min="1"
            step="1"
            required
            disabled={state === "sending" || state === "pending" || state === "sent"}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="tap-target rounded-xl border border-input bg-card px-4 text-xl font-bold"
          />
        </label>
        {message && (
          <p
            className={`rounded-xl p-3 text-sm font-semibold ${state === "failed" ? "bg-danger/10 text-danger" : state === "success" || state === "sent" ? "bg-primary/10 text-primary" : "bg-secondary"}`}
          >
            {message}
          </p>
        )}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="tap-target flex-1 rounded-2xl border border-border font-semibold"
          >
            {state === "success" || state === "failed" || state === "sent"
              ? lang === "en"
                ? "Close"
                : "Funga"
              : tCancel(lang)}
          </button>
          {state !== "success" && state !== "pending" && state !== "sent" && (
            <button
              disabled={state === "sending" || !row.customers?.phone}
              className="tap-target flex-1 rounded-2xl bg-primary font-bold text-primary-foreground disabled:opacity-60"
            >
              {state === "sending"
                ? lang === "en"
                  ? "Sending..."
                  : "Inatuma..."
                : lang === "en"
                  ? "Pay now"
                  : "Lipa sasa"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function tCancel(lang: string) {
  return lang === "en" ? "Cancel" : "Ghairi";
}
