import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Ctx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (p: {
    email: string;
    phone: string;
    password: string;
    fullName: string;
    businessName: string;
    preferredLanguage: "en" | "sw";
  }) => Promise<{ error?: string; requiresEmailVerification?: boolean }>;
  signIn: (p: {
    email: string;
    password: string;
  }) => Promise<{ error?: string; requiresEmailVerification?: boolean }>;
  resendVerification: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>({
  user: null,
  session: null,
  loading: true,
  signUp: async () => ({}),
  signIn: async () => ({}),
  resendVerification: async () => ({}),
  signOut: async () => {},
});

function signInErrorMessage(message: string) {
  if (/email not confirmed/i.test(message)) {
    return "Please verify your email before signing in.";
  }
  if (/invalid login credentials/i.test(message)) {
    return "Incorrect email or password. Check your details or reset your password.";
  }
  if (/email.*disabled|provider.*disabled/i.test(message)) {
    return "Email and password sign-in is disabled for this Supabase project.";
  }
  if (/rate limit|too many requests/i.test(message)) {
    return "Too many sign-in attempts. Please wait a few minutes and try again.";
  }
  return "Unable to sign in right now. Please try again.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) console.error("[Auth] Failed to restore session:", error);
        setSession(data.session);
      })
      .catch((error) => console.error("[Auth] Failed to restore session:", error))
      .finally(() => setLoading(false));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signUp: Ctx["signUp"] = async ({
    email,
    phone,
    password,
    fullName,
    businessName,
    preferredLanguage,
  }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          business_name: businessName,
          phone,
          preferred_language: preferredLanguage,
        },
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    if (error) return { error: error.message };
    return { requiresEmailVerification: !data.session };
  };

  const signIn: Ctx["signIn"] = async ({ email, password }) => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      return { error: "Enter your email address and password." };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error) {
      return {
        error: signInErrorMessage(error.message),
        requiresEmailVerification: /email not confirmed/i.test(error.message),
      };
    }
    return {};
  };

  const resendVerification: Ctx["resendVerification"] = async (email) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    return error ? { error: signInErrorMessage(error.message) } : {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthCtx.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signUp,
        signIn,
        resendVerification,
        signOut,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
