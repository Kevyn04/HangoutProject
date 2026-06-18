import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

type AuthContextType = {
  user: string | null;
  loading: boolean;
  needsUsername: boolean;
  login: (username: string) => Promise<void>;
  logout: () => Promise<void>;
  createProfile: (username: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  needsUsername: false,
  login: async () => {},
  logout: async () => {},
  createProfile: async () => {},
});

async function fetchUsername(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  return data?.username ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsUsername, setNeedsUsername] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const username = await fetchUsername(session.user.id);
        if (username) {
          setUser(username);
        } else {
          setNeedsUsername(true);
        }
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          const username = await fetchUsername(session.user.id);
          if (username) {
            setUser(username);
            setNeedsUsername(false);
          } else {
            setUser(null);
            setNeedsUsername(true);
          }
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setNeedsUsername(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Called by signin.tsx after email/password signIn — sets user immediately
  const login = async (username: string) => {
    setUser(username);
    setNeedsUsername(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setNeedsUsername(false);
  };

  // Called by choose-username screen after OAuth sign-in
  const createProfile = async (username: string) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new Error("Not authenticated");

    const { data: existing } = await supabase
      .from("profiles")
      .select("username")
      .eq("username", username)
      .maybeSingle();

    if (existing) throw new Error("Username already taken");

    const { error } = await supabase
      .from("profiles")
      .upsert({ id: authUser.id, username });

    if (error) throw new Error(error.message);

    setUser(username);
    setNeedsUsername(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, needsUsername, login, logout, createProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
