import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { formatKsh } from "@/lib/format";
import { Modal } from "@/routes/app.inventory";
import { Smartphone } from "lucide-react";

/**
 * Ask a customer to pay by sending an M-Pesa prompt (STK push) to their phone.
 * Works for a fresh cash sale as well as a credit repayment: the vendor types
 * the amount and the customer's number, and the money lands on the vendor's
 * M-Pesa account.
 */
export function AskPaymentDialog({
  saleId,
  defaultAmount,
  defaultPhone,
  maxAmount,
  onClose,
  onPaid,
}: {
  saleId: string;
  defaultAmount: number;
  defaultPhone?: string | null;
  maxAmount?: number;
  onClose: () => void;
  onPaid?: () => void;
}) {
  const { lang } = useI18n();
  const [amount, setAmount] = useState<number>(Math.max(1, Math.round(defaultAmount)));
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "pending" | "success" | "failed">("idle");
  const [message, setMessage] = useState("");
  const ceiling = maxAmount ?? defaultAmount;

  useEffect(() => {
    if (!paymentId || state !== "pending") return;
    let active = true;
    let attempts = 0;
    const poll = async () => {
      attempts++;
      const { data, error } = await supabase
        .from("credit_payments")
        .select("status, result_description, mpesa_receipt_number")
        .eq("id", paymentId)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setState("failed");
        setMessage(
          lang === "en" ? "Could not check payment status." : "Hali ya malipo haikupatikana.",
        );
        return;
      }
      const status = (data as any)?.status;
      if (status === "SUCCESS") {
        setState("success");
        setMessage(
          lang === "en"
            ? `Payment received${(data as any)?.mpesa_receipt_number ? ` — receipt ${(data as any).mpesa_receipt_number}` : ""}.`
            : `Malipo yamepokelewa${(data as any)?.mpesa_receipt_number ? ` — risiti ${(data as any).mpesa_receipt_number}` : ""}.`,
        );
        onPaid?.();
        return;
      }
      if (status === "FAILED" || status === "CANCELLED") {
        setState("failed");
        setMessage(
          (data as any)?.result_description ??
            (lang === "en" ? "Payment was not completed." : "Malipo hayakukamilika."),
        );
        return;
      }
      if (attempts >= 40) {
        setState("failed");
        setMessage(
          lang === "en"
            ? "No confirmation yet. Check again shortly."
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
  }, [paymentId, state, lang, onPaid]);

  const initiate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!Number.isInteger(amount) || amount <= 0 || amount > Math.round(ceiling)) {
      setMessage(
        lang === "en"
          ? `Enter a whole-KES amount up to ${formatKsh(ceiling)}.`
          : `Weka kiasi kamili cha KES kisichozidi ${formatKsh(ceiling)}.`,
      );
      return;
    }
    if (!/^(?:\+?254|0)?[71]\d{8}$/.test(phone.replace(/\s|-/g, ""))) {
      setMessage(
        lang === "en"
          ? "Enter a valid Kenyan mobile number, e.g. 0712345678."
          : "Weka nambari sahihi ya simu, mfano 0712345678.",
      );
      return;
    }
    setState("sending");
    setMessage("");
    const { data, error } = await supabase.functions.invoke("mpesa-stk", {
      body: { sale_id: saleId, amount, phone_number: phone.replace(/\s|-/g, "") },
    });
    if (error || !(data as any)?.payment_id) {
      setState("failed");
      setMessage(
        (data as any)?.error ??
          error?.message ??
          (lang === "en" ? "Could not start M-Pesa." : "M-Pesa haikuanza."),
      );
      return;
    }
    setPaymentId((data as any).payment_id);
    setState("pending");
    setMessage(
      lang === "en"
        ? "Tell the customer to check their phone and enter the M-Pesa PIN. The result shows here."
        : "Mwambie mteja aangalie simu yake na aweke PIN ya M-Pesa. Jibu litaonekana hapa.",
    );
  };

  const busy = state === "sending" || state === "pending";

  return (
    <Modal onClose={onClose} title={lang === "en" ? "Ask customer to pay" : "Omba mteja alipe"}>
      <form onSubmit={initiate} className="flex flex-col gap-3">
        <div className="card-soft flex items-center justify-between bg-secondary p-4">
          <span className="text-sm font-semibold">{lang === "en" ? "Amount due" : "Kiasi"}</span>
          <span className="text-xl font-extrabold text-primary">{formatKsh(ceiling)}</span>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">
            {lang === "en" ? "Amount to request (KES)" : "Kiasi cha kuomba (KES)"}
          </span>
          <input
            type="number"
            min="1"
            step="1"
            required
            disabled={busy}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="tap-target rounded-xl border border-input bg-card px-4 text-xl font-bold"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">
            {lang === "en" ? "Customer phone number" : "Nambari ya simu ya mteja"}
          </span>
          <input
            type="tel"
            required
            disabled={busy}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07XX XXX XXX"
            className="tap-target rounded-xl border border-input bg-card px-4 text-lg font-bold"
          />
        </label>
        {message && (
          <p
            className={`rounded-xl p-3 text-sm font-semibold ${
              state === "failed"
                ? "bg-danger/10 text-danger"
                : state === "success"
                  ? "bg-primary/10 text-primary"
                  : "bg-secondary"
            }`}
          >
            {message}
          </p>
        )}
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="tap-target flex-1 rounded-2xl border border-border font-semibold"
          >
            {state === "success"
              ? lang === "en"
                ? "Done"
                : "Imekamilika"
              : lang === "en"
                ? "Not now"
                : "Baadaye"}
          </button>
          {state !== "success" && (
            <button
              disabled={busy}
              className="tap-target flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary font-bold text-primary-foreground disabled:opacity-60"
            >
              <Smartphone size={18} />
              {state === "sending"
                ? lang === "en"
                  ? "Sending…"
                  : "Inatuma…"
                : state === "pending"
                  ? lang === "en"
                    ? "Waiting…"
                    : "Inasubiri…"
                  : lang === "en"
                    ? "Send prompt"
                    : "Tuma ombi"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
