import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { Sprout, Scale, Handshake, type LucideIcon } from "lucide-react";
import showcase1 from "@/assets/vendor-showcase-1.jpg";
import showcase2 from "@/assets/vendor-showcase-2.jpg";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app/dashboard" });
  },
  component: Landing,
});

function Landing() {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="relative isolate min-h-screen">
      <img
        src={showcase1}
        alt="Mama Mboga vendor seated at her open-air fruit and vegetable stall"
        className="fixed inset-0 -z-10 h-full w-full object-cover object-center"
      />
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-foreground/80 via-foreground/70 to-foreground/90" />

      <header className="flex items-center justify-between px-5 py-4">
        <Logo />
        <div className="flex rounded-full border border-primary-foreground/40 bg-foreground/40 p-0.5 text-sm font-semibold backdrop-blur">
          {(["en", "sw"] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} className={`rounded-full px-3 py-1 uppercase ${lang === l ? "bg-primary text-primary-foreground" : "text-primary-foreground/80"}`}>{l}</button>
          ))}
        </div>
      </header>
      <main className="mx-auto flex max-w-xl flex-col gap-8 px-5 pt-6 pb-16 lg:max-w-5xl">
        <div className="lg:max-w-2xl">
          <h1 className="text-4xl font-extrabold leading-tight text-primary-foreground drop-shadow sm:text-5xl lg:text-6xl">
            {lang === "en"
              ? <>Your stall, <span className="text-accent">organised.</span></>
              : <>Kibanda chako, <span className="text-accent">kimepangwa.</span></>}
          </h1>
          <p className="mt-3 text-lg text-primary-foreground/90">
            {lang === "en"
              ? "Track sales, stock, deni and profit — right from your phone. Built for Mama Mboga."
              : "Fuatilia mauzo, bidhaa, deni na faida — kutoka simu yako. Kwa Mama Mboga."}
          </p>
        </div>
        <div className="grid gap-3 rounded-3xl border border-primary-foreground/20 bg-foreground/45 p-5 backdrop-blur-md lg:grid-cols-3">
          <FeatureRow Icon={Sprout} title={t("welcome1_title")} body={t("welcome1_body")} />
          <FeatureRow Icon={Scale} title={t("welcome2_title")} body={t("welcome2_body")} />
          <FeatureRow Icon={Handshake} title={t("welcome3_title")} body={t("welcome3_body")} />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link to="/auth/signup" className="tap-target inline-flex flex-1 items-center justify-center rounded-2xl bg-primary px-6 text-base font-bold text-primary-foreground shadow-sm">
            {t("signUp")}
          </Link>
          <Link to="/auth/signin" className="tap-target inline-flex flex-1 items-center justify-center rounded-2xl border-2 border-primary-foreground/60 bg-foreground/30 px-6 text-base font-bold text-primary-foreground backdrop-blur">
            {t("signIn")}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <img src={showcase2} alt="Vendor holding a crate of fresh green peppers" className="h-32 w-full rounded-2xl object-cover sm:h-44" loading="lazy" />
          <img src={showcase1} alt="Fruits and vegetables displayed at a market stall" className="h-32 w-full rounded-2xl object-cover sm:h-44" loading="lazy" />
        </div>
      </main>
    </div>
  );
}

function FeatureRow({ Icon, title, body }: { Icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
        <Icon size={22} strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <div className="font-bold text-primary-foreground">{title}</div>
        <div className="text-sm text-primary-foreground/80">{body}</div>
      </div>
    </div>
  );
}
