import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import showcase1 from "@/assets/vendor-showcase-1.jpg.asset.json";
import showcase2 from "@/assets/vendor-showcase-2.jpg.asset.json";

export const Route = createFileRoute("/auth/signup")({
  component: SignUp,
  head: () => ({
    meta: [
      { title: "Create your VendorHub account — Mama Mboga records" },
      { name: "description", content: "Sign up for VendorHub to record daily sales, stock, expenses and customer credit for your fresh produce stall." },
      { property: "og:title", content: "Create your VendorHub account" },
      { property: "og:description", content: "Sign up for VendorHub to track sales, stock, expenses and deni from your phone." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

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
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Showcase side */}
      <aside className="relative hidden overflow-hidden bg-primary lg:block">
        <img
          src={showcase2.url}
          alt="Fresh produce vendor holding a crate of green peppers at a market stall"
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/60 to-primary/20" />
        <div className="relative flex h-full flex-col justify-between p-10 text-primary-foreground">
          <Logo size={44} />
          <div className="flex flex-col gap-6">
            <img
              src={showcase1.url}
              alt="Mama Mboga vendor seated at her open-air fruit and vegetable stall"
              className="h-44 w-40 rounded-2xl border-4 border-primary-foreground/70 object-cover shadow-xl"
              loading="lazy"
            />
            <div>
              <h2 className="text-3xl font-extrabold leading-tight">
                {lang === "en" ? "Record. Track. Grow." : "Rekodi. Fuatilia. Kua."}
              </h2>
              <p className="mt-2 max-w-sm text-primary-foreground/90">
                {lang === "en"
                  ? "Built for Mama Mboga — daily sales, stock, expenses and deni in one place, even offline."
                  : "Imeundwa kwa Mama Mboga — mauzo, bidhaa, matumizi na deni sehemu moja, hata bila mtandao."}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Form side */}
      <div className="flex flex-col justify-center px-5 py-8">
        <div className="mx-auto w-full max-w-md">
          <div className="lg:hidden">
            <Logo size={40} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <img src={showcase1.url} alt="Mama Mboga vendor at her produce stall" className="h-28 w-full rounded-2xl object-cover" loading="lazy" />
              <img src={showcase2.url} alt="Vendor holding a crate of fresh green peppers" className="h-28 w-full rounded-2xl object-cover" loading="lazy" />
            </div>
          </div>
          <div className="mt-6 lg:mt-0">
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
