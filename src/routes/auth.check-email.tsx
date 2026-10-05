import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/auth/check-email")({ component: CheckEmail });
function CheckEmail() {
  const { lang } = useI18n();
  const sw = lang === "sw";
  const { resendVerification } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const resend = async () => {
    setBusy(true);
    try { const result = await resendVerification(email); if (result.error) toast.error(result.error); else toast.success(sw ? "Angalia barua pepe yako kwa kiungo kipya." : "Check your inbox for a new link."); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6 text-center">
    <h1 className="text-3xl font-extrabold">{sw ? "Thibitisha barua pepe yako" : "Check your email"}</h1>
    <p className="text-muted-foreground">{sw ? "Fungua kiungo tulichotuma kabla ya kuingia." : "Open the verification link we sent before signing in."}</p>
    <label className="text-left text-sm font-semibold">{sw ? "Barua pepe" : "Email"}<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="tap-target mt-1 w-full rounded-xl border bg-background px-4"/></label>
    <Button onClick={resend} disabled={busy || !email.includes("@")}>{busy ? (sw ? "Inatuma…" : "Sending…") : (sw ? "Tuma kiungo kingine" : "Resend verification email")}</Button>
    <Link to="/auth/signin" className="text-primary">{sw ? "Rudi kuingia" : "Back to sign in"}</Link>
  </main>;
}
