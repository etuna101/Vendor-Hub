import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Ctx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (p: { email: string; phone: string; password: string; fullName: string; businessName: string; preferredLanguage: "en" | "sw" }) => Promise<{ error?: string; requiresEmailVerification?: boolean }>;
  signIn: (p: { email: string; password: string }) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>({
  user: null, session: null, loading: true,
  signUp: async () => ({}), signIn: async () => ({}), signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signUp: Ctx["signUp"] = async ({ email, phone, password, fullName, businessName, preferredLanguage }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, business_name: businessName, phone, preferred_language: preferredLanguage },
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    if (error) return { error: error.message };
    return { requiresEmailVerification: !data.session };
  };

  const signIn: Ctx["signIn"] = async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (/email not confirmed/i.test(error.message)) return { error: "Please verify your email before signing in." };
      return { error: "Wrong email or password" };
    }
    return {};
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AuthCtx.Provider value={{ user: session?.user ?? null, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
