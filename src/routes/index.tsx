import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { Sprout, Scale, Handshake, type LucideIcon } from "lucide-react";

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
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-5 py-4">
        <Logo />
        <div className="flex rounded-full border border-border bg-card p-0.5 text-sm font-semibold">
          {(["en", "sw"] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} className={`rounded-full px-3 py-1 uppercase ${lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{l}</button>
          ))}
        </div>
      </header>
      <main className="mx-auto flex max-w-xl flex-col gap-8 px-5 pt-6 pb-16">
        <div>
          <h1 className="text-4xl font-extrabold leading-tight text-foreground sm:text-5xl">
            {lang === "en"
              ? <>Your stall, <span className="text-primary">organised.</span></>
              : <>Kibanda chako, <span className="text-primary">kimepangwa.</span></>}
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            {lang === "en"
              ? "Track sales, stock, deni and profit — right from your phone. Built for Mama Mboga."
              : "Fuatilia mauzo, bidhaa, deni na faida — kutoka simu yako. Kwa Mama Mboga."}
          </p>
        </div>
        <div className="card-soft grid gap-3 p-5">
          <FeatureRow Icon={Sprout} title={t("welcome1_title")} body={t("welcome1_body")} />
          <FeatureRow Icon={Scale} title={t("welcome2_title")} body={t("welcome2_body")} />
          <FeatureRow Icon={Handshake} title={t("welcome3_title")} body={t("welcome3_body")} />
        </div>
        <div className="flex flex-col gap-3">
          <Link to="/auth/signup" className="tap-target inline-flex items-center justify-center rounded-2xl bg-primary px-6 text-base font-bold text-primary-foreground shadow-sm">
            {t("signUp")}
          </Link>
          <Link to="/auth/signin" className="tap-target inline-flex items-center justify-center rounded-2xl border border-border bg-card px-6 text-base font-bold text-foreground">
            {t("signIn")}
          </Link>
        </div>
      </main>
    </div>
  );
}

function FeatureRow({ Icon, title, body }: { Icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
        <Icon size={22} strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <div className="font-bold text-foreground">{title}</div>
        <div className="text-sm text-muted-foreground">{body}</div>
      </div>
    </div>
  );
}
