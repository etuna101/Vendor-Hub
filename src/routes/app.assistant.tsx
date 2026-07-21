import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { aiChat, getChatHistory } from "@/lib/ai.functions";
import { Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/assistant")({ component: Assistant });

type Msg = { role: "user" | "assistant"; content: string };

function Assistant() {
  const { t, lang } = useI18n();
  const chat = useServerFn(aiChat);
  const history = useServerFn(getChatHistory);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    history()
      .then((r) => {
        const past: Msg[] = [];
        for (const m of r.messages) {
          past.push({ role: "user", content: m.query });
          past.push({ role: "assistant", content: m.response });
        }
        setMessages(past);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

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
      if (msg.includes("RATE_LIMIT")) toast.error(lang === "sw" ? "Umeuliza mara nyingi mno. Jaribu tena baadaye." : "Too many requests — try again in a moment.");
      else if (msg.includes("CREDITS")) toast.error(lang === "sw" ? "Msaidizi hakuna salio. Wasiliana na msimamizi." : "The assistant is out of credits — please contact support.");
      else toast.error(lang === "sw" ? "Msaidizi hakuweza kujibu. Jaribu tena." : "The assistant couldn't answer. Please try again.");
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
        {messages.length === 0 ? (
          <div className="card-soft p-5">
            <p className="text-sm text-muted-foreground">
              {lang === "sw"
                ? "Uliza swali kuhusu biashara yako — mauzo, bidhaa, deni au matumizi."
                : "Ask a question about your business — sales, stock, credit, or expenses."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((m, i) => (
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
