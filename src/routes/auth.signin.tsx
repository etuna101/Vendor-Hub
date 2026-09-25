import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import showcase2 from "@/assets/vendor-showcase-2.jpg";

export const Route = createFileRoute("/auth/signin")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => {
    const next =
      typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//")
        ? s.next
        : undefined;
    return next ? { next } : {};
  },
  component: SignIn,
});

function SignIn() {
  const { t } = useI18n();
  const { signIn, resendVerification } = useAuth();
  const nav = useNavigate();
  const { next } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error, requiresEmailVerification } = await signIn({ email, password });
    if (error) {
      setLoading(false);
      setNeedsVerification(Boolean(requiresEmailVerification));
      return toast.error(error);
    }
    if (next) {
      setLoading(false);
      window.location.href = next;
      return;
    }
    // Route based on role
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    let isAdmin = false;
    if (uid) {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      if (rolesError) console.error("[Auth] Failed to load user role:", rolesError);
      isAdmin = (roles ?? []).some((role) => role.role === "admin");
    }
    setLoading(false);
    nav({ to: isAdmin ? "/admin" : "/app/dashboard" });
  };

  const resend = async () => {
    setResending(true);
    const { error } = await resendVerification(email);
    setResending(false);
    if (error) return toast.error(error);
    toast.success("Verification email sent. Check your inbox and spam folder.");
  };

  return (
    <div className="relative isolate min-h-screen">
      <img
        src={showcase2}
        alt="Fresh produce vendor holding a crate of green peppers at a market stall"
        className="fixed inset-0 -z-10 h-full w-full object-cover object-center"
      />
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-foreground/80 via-foreground/70 to-foreground/90" />
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 pt-8 pb-10">
        <Logo />
        <div className="mt-8 rounded-3xl border border-primary-foreground/20 bg-card/95 p-5 shadow-lg backdrop-blur-md">
          <h1 className="text-3xl font-extrabold">{t("signIn")}</h1>
          <p className="mt-1 text-muted-foreground">{t("tagline")}</p>
        </div>
        <form
          onSubmit={submit}
          className="mt-4 flex flex-col gap-4 rounded-3xl border border-primary-foreground/20 bg-card/95 p-5 shadow-lg backdrop-blur-md"
        >
          <Field label="Email address">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="tap-target w-full rounded-2xl border border-input bg-background px-4 text-base"
            />
          </Field>
          <Field label={t("password")}>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="tap-target w-full rounded-2xl border border-input bg-background px-4 pr-12 text-base"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
          <button
            type="submit"
            disabled={loading}
            className="tap-target mt-2 rounded-2xl bg-primary font-bold text-primary-foreground disabled:opacity-60"
          >
            {loading ? "…" : t("signIn")}
          </button>
          <Link to="/auth/forgot" className="text-center text-sm font-semibold text-primary">
            {t("forgotPassword")}
          </Link>
          {needsVerification && (
            <button
              type="button"
              onClick={resend}
              disabled={resending || !email.trim()}
              className="text-center text-sm font-semibold text-primary disabled:opacity-60"
            >
              {resending ? "Sending verification email..." : "Resend verification email"}
            </button>
          )}
          <div className="text-center text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link to="/auth/signup" className="font-bold text-primary">
              {t("signUp")}
            </Link>
          </div>
        </form>
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
