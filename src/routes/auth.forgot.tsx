import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/auth/forgot")({ component: Forgot });

function Forgot() {
  const { t, lang } = useI18n();
  const [step, setStep] = useState<"phone" | "code" | "done">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pt-8 pb-10">
      <Logo />
      <h1 className="mt-8 text-3xl font-extrabold">{t("resetPassword")}</h1>
      <p className="mt-1 text-muted-foreground">
        {lang === "en" ? "We'll send a code to your phone." : "Tutakutumia msimbo kwa simu yako."}
      </p>

      {step === "phone" && (
        <form onSubmit={(e) => { e.preventDefault(); setStep("code"); toast.success(lang === "en" ? "Reset code sent (demo)" : "Msimbo umetumwa (demo)"); }} className="mt-6 flex flex-col gap-4">
          <Field label={t("phone")}>
            <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="tap-target w-full rounded-2xl border border-input bg-card px-4 text-base" />
          </Field>
          <button className="tap-target rounded-2xl bg-primary font-bold text-primary-foreground">{t("sendCode")}</button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={(e) => { e.preventDefault(); if (code.length < 4 || pw.length < 6) return toast.error("Check code and password"); setStep("done"); }} className="mt-6 flex flex-col gap-4">
          <Field label={t("resetCode")}>
            <input required value={code} onChange={(e) => setCode(e.target.value)} className="tap-target w-full rounded-2xl border border-input bg-card px-4 text-base" />
          </Field>
          <Field label={t("newPassword")}>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" className="tap-target w-full rounded-2xl border border-input bg-card px-4 pr-12 text-base" />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
          <button className="tap-target rounded-2xl bg-primary font-bold text-primary-foreground">{t("verifyCode")}</button>
          <p className="text-xs text-muted-foreground">
            {lang === "en"
              ? "SMS delivery is not connected yet — this is a research-stage flow."
              : "Utumaji wa SMS haujaunganishwa bado — huu ni mtiririko wa utafiti."}
          </p>
        </form>
      )}

      {step === "done" && (
        <div className="mt-8 card-soft p-5">
          <p className="font-semibold">{lang === "en" ? "Password updated." : "Nywila imebadilishwa."}</p>
          <Link to="/auth/signin" className="mt-4 inline-flex tap-target items-center justify-center rounded-2xl bg-primary px-6 font-bold text-primary-foreground">{t("signIn")}</Link>
        </div>
      )}

      <div className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/auth/signin" className="font-bold text-primary">← {t("signIn")}</Link>
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
