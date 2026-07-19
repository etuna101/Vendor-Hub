import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/app/assistant")({ component: Assistant });

function Assistant() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">{t("assistant")}</h1>
      <div className="card-soft flex flex-col items-center gap-4 p-8 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-accent/40">
          <Sparkles size={36} className="text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold">{t("assistant_coming")}</h2>
          <p className="mt-2 text-muted-foreground">{t("assistant_desc")}</p>
        </div>
      </div>
    </div>
  );
}
