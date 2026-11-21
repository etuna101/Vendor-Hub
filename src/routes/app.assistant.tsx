import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { aiChat, getChatHistory } from "@/lib/ai.functions";
import { Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/assistant")({ component: Assistant });

type Msg = { role: "user" | "assistant"; content: string };

function Assistant() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const chat = useServerFn(aiChat);
  const history = useServerFn(getChatHistory);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: historyMessages = [], isLoading: historyLoading, error: historyError, refetch: retryHistory } = useQuery({
    queryKey: ["assistant-history", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => (await history()).messages.flatMap((message: { query: string; response: string }) => [
      { role: "user" as const, content: message.query },
      { role: "assistant" as const, content: message.response },
    ]),
    staleTime: 60_000,
  });
  const allMessages = [...historyMessages, ...messages];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [allMessages.length, busy]);

  const suggestions =
    lang === "sw"
      ? ["Ninunue bidhaa gani leo?", "Ni nani ananidai zaidi?", "Faida yangu ikoje mwezi huu?", "Bidhaa zipi zinaisha?"]
      : ["What should I restock?", "Who owes me the most?", "How is my profit this month?", "Which products are running low?"];

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const question = text.trim();
    setMessages((m) => [...m, { role: "user", content: question }]);
    setInput("");
    setBusy(true);
    try {
      const res = await chat({ data: { question, language: lang } });
      setMessages((m) => [...m, { role: "assistant", content: res.answer }]);
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      const failure = msg.match(/AI_SERVICE_ERROR:([A-Z_]+):([\w-]+)/);
      const code = failure?.[1];
      const requestId = failure?.[2];
      const reference = requestId ? ` (${code}; ref ${requestId})` : "";
      if (code === "RATE_LIMIT") toast.error((lang === "sw" ? "Gemini ina maombi mengi kwa sasa. Jaribu tena baadaye." : "Gemini is receiving too many requests. Try again shortly.") + reference);
      else if (code === "CONFIG") toast.error((lang === "sw" ? "GEMINI_API_KEY haikupatikana kwenye mazingira ya seva. Anzisha seva upya." : "GEMINI_API_KEY was not found in the server environment. Restart the dev server.") + reference);
      else if (code === "AUTH") toast.error((lang === "sw" ? "Gemini haikukubali API key. Hakikisha ni key mpya na sahihi." : "Gemini rejected the API key. Check that the replacement key is valid.") + reference);
      else if (code === "PERMISSION") toast.error((lang === "sw" ? "Google imezuia mradi au key hii. Angalia ruhusa za Gemini API, uthibitishaji na vizuizi vya key." : "Google denied access for this project or key. Check Gemini API access, project verification, and key restrictions.") + reference);
      else if (code === "BILLING") toast.error((lang === "sw" ? "Mradi unahitaji mipangilio ya malipo ili kutumia Gemini API." : "This project needs billing configured to use the Gemini API.") + reference);
      else if (code === "MODEL") toast.error((lang === "sw" ? "Gemini haikupata modeli iliyowekwa." : "Gemini could not find the configured model.") + reference);
      else if (code === "API") toast.error((lang === "sw" ? "Gemini ilikataa muundo wa ombi." : "Gemini rejected the request format.") + reference);
      else if (code === "QUOTA") toast.error((lang === "sw" ? "Kiwango cha matumizi ya Gemini kimefika. Angalia matumizi katika Google AI Studio." : "The Gemini API quota is exhausted. Check Google AI Studio usage.") + reference);
      else toast.error((lang === "sw" ? "Msaidizi hakuweza kujibu. Jaribu tena." : "The assistant couldn't answer. Please try again.") + reference);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10">
          <Sparkles size={18} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold leading-none">{t("assistant")}</h1>
          <p className="text-xs text-muted-foreground">{lang === "sw" ? "Ushauri kutoka kwa data yako mwenyewe" : "Advice from your own business data"}</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1">
        {historyError && <div role="alert" className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <p>{lang === "sw" ? "Historia ya mazungumzo haikupakiwa." : "Chat history could not be loaded."}</p>
          <button type="button" className="mt-1 font-semibold underline" onClick={() => void retryHistory()}>{lang === "sw" ? "Jaribu tena" : "Try again"}</button>
        </div>}
        {historyLoading ? <div className="space-y-3" aria-label={lang === "sw" ? "Inapakia" : "Loading"}><div className="h-16 w-3/4 animate-pulse rounded-2xl bg-primary/10" /><div className="ml-auto h-16 w-2/3 animate-pulse rounded-2xl bg-primary/10" /></div> : allMessages.length === 0 ? (
          <div className="card-soft p-5">
            <p className="text-sm text-muted-foreground">
              {lang === "sw"
                ? "Uliza swali kuhusu biashara yako — mauzo, bidhaa, deni au matumizi."
                : "Ask a question about your business — sales, stock, credit, or expenses."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {allMessages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-primary-foreground"
                      : "max-w-[90%] rounded-2xl rounded-tl-md bg-card border border-border px-4 py-2.5 text-foreground"
                  }
                >
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{m.content}</p>
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">
                  {lang === "sw" ? "Ninafikiria…" : "Thinking…"}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            disabled={busy}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={lang === "sw" ? "Andika swali lako…" : "Ask your question…"}
          className="tap-target flex-1 rounded-2xl border border-input bg-card px-4 text-base"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send"
          className="tap-target grid aspect-square w-12 place-items-center rounded-2xl bg-primary text-primary-foreground disabled:opacity-50"
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
