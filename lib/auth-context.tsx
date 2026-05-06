"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient, type User } from "@supabase/supabase-js";

let _client: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder"
    );
  }
  return _client;
}
export const supabaseBrowser = { get auth() { return getSupabase().auth; } };

interface AuthCtx {
  user: User | null;
  loading: boolean;
  signIn: (email: string, pw: string) => Promise<string | null>;
  signUp: (email: string, pw: string, name?: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  signIn:  async () => null,
  signUp:  async () => null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabaseBrowser.auth
      .getSession()
      .then(({ data }) => {
        setUser(data.session?.user ?? null);
      })
      .catch(() => { /* no Supabase URL configured yet */ })
      .finally(() => setLoading(false));

    let subscription: { unsubscribe: () => void } = { unsubscribe: () => {} };
    try {
      const { data } = supabaseBrowser.auth.onAuthStateChange((_, s) => {
        setUser(s?.user ?? null);
      });
      subscription = data.subscription;
    } catch { /* no-op */ }
    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, pw: string) => {
    const { error } = await supabaseBrowser.auth.signInWithPassword({ email, password: pw });
    return error?.message ?? null;
  };

  const signUp = async (email: string, pw: string, name?: string) => {
    const { error } = await supabaseBrowser.auth.signUp({
      email, password: pw,
      options: { data: { display_name: name ?? email.split("@")[0] } },
    });
    return error?.message ?? null;
  };

  const signOut = async () => { await supabaseBrowser.auth.signOut(); };

  return (
    <Ctx.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
