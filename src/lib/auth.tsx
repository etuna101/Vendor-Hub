import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Phone-only auth: we synthesize a stable email from the phone number so
// Supabase's email/password auth works without SMS/email delivery.
export function phoneToEmail(phone: string) {
  const clean = phone.replace(/[^0-9+]/g, "");
  return `${clean}@vendor.vendorhub.app`;
}

type Ctx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (p: { phone: string; password: string; fullName: string; businessName: string; preferredLanguage: "en" | "sw" }) => Promise<{ error?: string }>;
  signIn: (p: { phone: string; password: string }) => Promise<{ error?: string }>;
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

  const signUp: Ctx["signUp"] = async ({ phone, password, fullName, businessName, preferredLanguage }) => {
    const email = phoneToEmail(phone);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, business_name: businessName, phone, preferred_language: preferredLanguage },
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    if (error) return { error: error.message };
    return {};
  };

  const signIn: Ctx["signIn"] = async ({ phone, password }) => {
    const email = phoneToEmail(phone);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "Wrong phone number or password" };
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
