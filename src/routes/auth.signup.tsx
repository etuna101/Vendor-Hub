import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/signup")({ component: SignUp });

function SignUp() {
  const { t, lang } = useI18n();
  const { signUp } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ fullName: "", businessName: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) return toast.error("Password must be at least 6 characters");
    setLoading(true);
    const { error } = await signUp({ ...form, preferredLanguage: lang });
    setLoading(false);
    if (error) return toast.error(error);
    toast.success("Account created!");
    nav({ to: "/welcome" });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pt-8 pb-10">
      <Logo />
      <div className="mt-8">
        <h1 className="text-3xl font-extrabold">{t("signUp")}</h1>
        <p className="mt-1 text-muted-foreground">{t("tagline")}</p>
      </div>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <Field label={t("fullName")}>
          <input required value={form.fullName} onChange={set("fullName")}
            className="tap-target w-full rounded-2xl border border-input bg-card px-4 text-base" />
        </Field>
        <Field label={t("businessName")}>
          <input required value={form.businessName} onChange={set("businessName")}
            placeholder={lang === "en" ? "e.g. Mama Njeri Fresh Produce" : "mfano: Mama Njeri Mboga Freshi"}
            className="tap-target w-full rounded-2xl border border-input bg-card px-4 text-base" />
        </Field>
        <Field label={t("phone")}>
          <input type="tel" required value={form.phone} onChange={set("phone")}
            placeholder="07XX XXX XXX"
            className="tap-target w-full rounded-2xl border border-input bg-card px-4 text-base" />
        </Field>
        <Field label={t("password")}>
          <input type="password" required minLength={6} value={form.password} onChange={set("password")}
            className="tap-target w-full rounded-2xl border border-input bg-card px-4 text-base" />
        </Field>
        <button type="submit" disabled={loading} className="tap-target mt-2 rounded-2xl bg-primary font-bold text-primary-foreground disabled:opacity-60">
          {loading ? "…" : t("signUp")}
        </button>
        <div className="mt-2 text-center text-sm text-muted-foreground">
          {t("haveAccount")} <Link to="/auth/signin" className="font-bold text-primary">{t("signIn")}</Link>
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
