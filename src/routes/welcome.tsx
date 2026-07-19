import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Sprout, Scale, Handshake } from "lucide-react";

export const Route = createFileRoute("/welcome")({ component: Welcome });

function Welcome() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [i, setI] = useState(0);

  const slides = [
    { Icon: Sprout, title: t("welcome1_title"), body: t("welcome1_body") },
    { Icon: Scale, title: t("welcome2_title"), body: t("welcome2_body") },
    { Icon: Handshake, title: t("welcome3_title"), body: t("welcome3_body") },
  ];

  const finish = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from("profiles").update({ has_seen_welcome: true }).eq("id", data.user.id);
    }
    nav({ to: "/app/dashboard" });
  };

  const s = slides[i];
  const S = s.Icon;
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-between px-6 pt-10 pb-8">
      <div className="flex justify-end">
        <button onClick={finish} className="text-sm font-semibold text-muted-foreground">{t("skip")}</button>
      </div>
      <div className="flex flex-col items-center text-center">
        <div className="grid h-40 w-40 place-items-center rounded-full bg-secondary">
          <S size={80} strokeWidth={1.6} className="text-primary" />
        </div>
        <h2 className="mt-8 text-3xl font-extrabold">{s.title}</h2>
        <p className="mt-3 text-lg text-muted-foreground">{s.body}</p>
      </div>
      <div className="flex flex-col items-center gap-5">
        <div className="flex gap-2">
          {slides.map((_, idx) => (
            <span key={idx} className={`h-2 rounded-full transition-all ${idx === i ? "w-8 bg-primary" : "w-2 bg-border"}`} />
          ))}
        </div>
        {i < slides.length - 1 ? (
          <button onClick={() => setI(i + 1)} className="tap-target w-full rounded-2xl bg-primary font-bold text-primary-foreground">{t("next")}</button>
        ) : (
          <button onClick={finish} className="tap-target w-full rounded-2xl bg-primary font-bold text-primary-foreground">{t("getStarted")}</button>
        )}
      </div>
    </div>
  );
}
