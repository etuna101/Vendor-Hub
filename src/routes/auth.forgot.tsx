import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/auth/forgot")({ component: Forgot });

function Forgot() {
  const { t, lang } = useI18n();
  const [channel, setChannel] = useState<"email" | "phone">("email");
  const [step, setStep] = useState<"request" | "verify" | "update" | "done">("request");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") !== "update") return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStep("update");
    });
    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (sessionData.session) setStep("update");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const sendReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    if (channel === "email") {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/forgot?mode=update`,
      });
      setLoading(false);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.functions.invoke("password-reset", {
        body: { action: "request", phone },
      });
      setLoading(false);
      if (error)
        return toast.error(
          lang === "en"
            ? "Unable to send a reset code. Try again later."
            : "Imeshindikana kutuma msimbo. Jaribu tena baadaye.",
        );
      setStep("verify");
    }
    toast.success(
      lang === "en"
        ? "If an account matches those details, reset instructions will arrive shortly."
        : "Ikiwa akaunti inalingana na taarifa hizo, utapokea maelekezo hivi karibuni.",
    );
  };

  const verifyPhoneReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.functions.invoke("password-reset", {
      body: { action: "verify", phone, code, password },
    });
    setLoading(false);
    if (error)
      return toast.error(
        lang === "en"
          ? "The code is invalid or expired. Request a new one."
          : "Msimbo si sahihi au umeisha muda. Omba mwingine.",
      );
    setStep("done");
  };

  const updateEmailPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    setStep("done");
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pt-8 pb-10">
      <Logo />
      <h1 className="mt-8 text-3xl font-extrabold">{t("resetPassword")}</h1>
      <p className="mt-1 text-muted-foreground">
        {step === "request"
          ? lang === "en"
            ? "Choose where to receive your password reset instructions."
            : "Chagua mahali pa kupokea maelekezo ya kubadilisha nywila."
          : step === "verify"
            ? lang === "en"
              ? "Enter the code sent to your phone and choose a new password."
              : "Weka msimbo uliotumwa kwa simu yako na uchague nywila mpya."
            : step === "update"
              ? lang === "en"
                ? "Choose a new password for your account."
                : "Chagua nywila mpya ya akaunti yako."
              : ""}
      </p>

      {step === "request" && (
        <form onSubmit={sendReset} className="mt-6 flex flex-col gap-4">
          <fieldset className="grid grid-cols-2 rounded-2xl border border-input p-1">
            <legend className="sr-only">
              {lang === "en" ? "Reset method" : "Njia ya kurejesha akaunti"}
            </legend>
            {(["email", "phone"] as const).map((method) => (
              <label
                key={method}
                className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold ${channel === method ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                <input
                  type="radio"
                  name="reset-channel"
                  value={method}
                  checked={channel === method}
                  onChange={() => setChannel(method)}
                />
                {method === "email"
                  ? lang === "en"
                    ? "Email"
                    : "Barua pepe"
                  : lang === "en"
                    ? "Phone / SMS"
                    : "Simu / SMS"}
              </label>
            ))}
          </fieldset>
          {channel === "email" ? (
            <Field label={lang === "en" ? "Email address" : "Anwani ya barua pepe"}>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="tap-target w-full rounded-2xl border border-input bg-card px-4 text-base"
              />
            </Field>
          ) : (
            <Field label={t("phone")}>
              <input
                type="tel"
                required
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XX XXX XXX"
                className="tap-target w-full rounded-2xl border border-input bg-card px-4 text-base"
              />
            </Field>
          )}
          <button
            disabled={loading}
            className="tap-target rounded-2xl bg-primary font-bold text-primary-foreground disabled:opacity-60"
          >
            {loading
              ? "…"
              : channel === "email"
                ? lang === "en"
                  ? "Send reset email"
                  : "Tuma barua pepe"
                : t("sendCode")}
          </button>
        </form>
      )}

      {step === "verify" && (
        <form onSubmit={verifyPhoneReset} className="mt-6 flex flex-col gap-4">
          <Field label={t("resetCode")}>
            <input
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="tap-target w-full rounded-2xl border border-input bg-card px-4 text-base"
            />
          </Field>
          <Field label={t("newPassword")}>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="tap-target w-full rounded-2xl border border-input bg-card px-4 pr-12 text-base"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
          <button
            disabled={loading}
            className="tap-target rounded-2xl bg-primary font-bold text-primary-foreground disabled:opacity-60"
          >
            {loading ? "…" : t("verifyCode")}
          </button>
        </form>
      )}

      {step === "update" && (
        <form onSubmit={updateEmailPassword} className="mt-6 flex flex-col gap-4">
          <Field label={t("newPassword")}>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="tap-target w-full rounded-2xl border border-input bg-card px-4 pr-12 text-base"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
          <button
            disabled={loading}
            className="tap-target rounded-2xl bg-primary font-bold text-primary-foreground disabled:opacity-60"
          >
            {loading ? "…" : t("newPassword")}
          </button>
        </form>
      )}

      {step === "done" && (
        <div className="mt-8 card-soft p-5">
          <p className="font-semibold">
            {lang === "en"
              ? "Password updated. Sign in with your new password."
              : "Nywila imebadilishwa. Ingia kwa kutumia nywila yako mpya."}
          </p>
          <Link
            to="/auth/signin"
            className="mt-4 inline-flex tap-target items-center justify-center rounded-2xl bg-primary px-6 font-bold text-primary-foreground"
          >
            {t("signIn")}
          </Link>
        </div>
      )}

      <div className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/auth/signin" className="font-bold text-primary">
          ← {t("signIn")}
        </Link>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {children}
    </label>
  );
}
