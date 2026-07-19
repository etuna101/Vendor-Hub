import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/signin")({ component: SignIn });

function SignIn() {
  const { t } = useI18n();
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn({ phone, password });
    setLoading(false);
    if (error) return toast.error(error);
    nav({ to: "/app/dashboard" });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pt-8 pb-10">
      <Logo />
      <div className="mt-8">
        <h1 className="text-3xl font-extrabold">{t("signIn")}</h1>
        <p className="mt-1 text-muted-foreground">{t("tagline")}</p>
      </div>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <Field label={t("phone")}>
          <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="07XX XXX XXX"
            className="tap-target w-full rounded-2xl border border-input bg-card px-4 text-base" />
        </Field>
        <Field label={t("password")}>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="tap-target w-full rounded-2xl border border-input bg-card px-4 text-base" />
        </Field>
        <button type="submit" disabled={loading} className="tap-target mt-2 rounded-2xl bg-primary font-bold text-primary-foreground disabled:opacity-60">
          {loading ? "…" : t("signIn")}
        </button>
        <Link to="/auth/forgot" className="text-center text-sm font-semibold text-primary">
          {t("forgotPassword")}
        </Link>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          {t("noAccount")} <Link to="/auth/signup" className="font-bold text-primary">{t("signUp")}</Link>
        </div>
      </form>
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
