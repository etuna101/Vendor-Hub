import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import showcase1 from "@/assets/vendor-showcase-1.jpg";

export const Route = createFileRoute("/auth/signup")({
  component: SignUp,
  head: () => ({
    meta: [
      { title: "Create your VendorHub account" },
      { name: "description", content: "Sign up for VendorHub to record daily sales, stock, expenses and customer credit for your fresh produce stall." },
    ],
  }),
});

function SignUp() {
  const { t, lang } = useI18n();
  const { signUp } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ fullName: "", businessName: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.password.length < 6) return toast.error("Password must be at least 6 characters");
    setLoading(true);
    const { error, requiresEmailVerification } = await signUp({ ...form, preferredLanguage: lang });
    setLoading(false);
    if (error) return toast.error(error);
    if (requiresEmailVerification) {
      toast.success("Account created. Check your email to verify it before signing in.");
      nav({ to: "/auth/signin" });
      return;
    }
    toast.success("Account created!");
    nav({ to: "/welcome" });
  };

  return (
    <div className="relative isolate min-h-screen">
      <img
        src={showcase1}
        alt="Mama Mboga vendor seated at her open-air fruit and vegetable stall"
        className="fixed inset-0 -z-10 h-full w-full object-cover object-center"
      />
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-foreground/85 via-foreground/75 to-foreground/90" />
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
        <Logo size={40} />
        <div className="mt-8 w-full rounded-3xl border border-primary-foreground/20 bg-card/95 p-5 shadow-lg backdrop-blur-md">
          <h1 className="text-2xl font-extrabold sm:text-3xl">{t("signUp")}</h1>
          <p className="mt-1 text-muted-foreground">{t("tagline")}</p>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <Field label={t("fullName")}>
              <input required value={form.fullName} onChange={set("fullName")} className="tap-target w-full rounded-2xl border border-input bg-card px-4 text-base" />
            </Field>
            <Field label={t("businessName")}>
              <input required value={form.businessName} onChange={set("businessName")} placeholder={lang === "en" ? "e.g. Mama Njeri Fresh Produce" : "mfano: Mama Njeri Mboga Freshi"} className="tap-target w-full rounded-2xl border border-input bg-card px-4 text-base" />
            </Field>
            <Field label="Email address">
              <input type="email" required value={form.email} onChange={set("email")} placeholder="you@example.com" className="tap-target w-full rounded-2xl border border-input bg-card px-4 text-base" />
            </Field>
            <Field label={t("phone")}>
              <input type="tel" required value={form.phone} onChange={set("phone")} placeholder="07XX XXX XXX" className="tap-target w-full rounded-2xl border border-input bg-card px-4 text-base" />
            </Field>
            <Field label={t("password")}>
              <input type="password" required minLength={6} value={form.password} onChange={set("password")} className="tap-target w-full rounded-2xl border border-input bg-card px-4 text-base" />
            </Field>
            <p className="-mt-1 text-xs text-muted-foreground">We will send a verification link to this email before you can sign in.</p>
            <button type="submit" disabled={loading} className="tap-target mt-2 rounded-2xl bg-primary font-bold text-primary-foreground disabled:opacity-60">
              {loading ? "..." : t("signUp")}
            </button>
            <div className="mt-2 text-center text-sm text-muted-foreground">
              {t("haveAccount")} <Link to="/auth/signin" className="font-bold text-primary">{t("signIn")}</Link>
            </div>
          </form>
        </div>
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
