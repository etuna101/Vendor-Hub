import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

const VERIFICATION_EMAIL_KEY = "vendorhub:verification-email";

export const Route = createFileRoute("/auth/check-email")({ component: CheckEmail });

function CheckEmail() {
  const { lang } = useI18n();
  const sw = lang === "sw";
  const { resendVerification } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEmail(window.sessionStorage.getItem(VERIFICATION_EMAIL_KEY) ?? "");
  }, []);

  const resend = async () => {
    setBusy(true);
    try {
      const result = await resendVerification(email);
      if (result.error) toast.error(result.error);
      else toast.success(sw ? "Angalia barua pepe yako kwa kiungo kipya." : "Check your inbox for a new link.");
    } catch {
      toast.error(sw ? "Kiungo hakikutumwa. Jaribu tena." : "Could not send the link. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-extrabold">{sw ? "Thibitisha barua pepe yako" : "Check your email"}</h1>
      <p className="text-muted-foreground">
        {sw
          ? "Fungua kiungo tulichotuma kwa barua pepe uliyotumia kujisajili. Baada ya kuthibitisha, akaunti yako itasubiri idhini ya msimamizi."
          : "Open the verification link sent to the email address you used to sign up. After verification, your account will wait for admin approval."}
      </p>
      {email && <p className="font-semibold">{email}</p>}
      <Button onClick={resend} disabled={busy || !email.includes("@")}>
        {busy ? (sw ? "Inatuma..." : "Sending...") : (sw ? "Tuma kiungo kingine" : "Resend verification email")}
      </Button>
      <Link to="/auth/signin" className="text-primary">{sw ? "Rudi kuingia" : "Back to sign in"}</Link>
    </main>
  );
}
