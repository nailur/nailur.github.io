import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../supabase';
import { getAuthUser, signIn, signOut, signUp } from '../auth';
import type { AuthUser } from '../auth';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = async () => {
    try {
      const authUser = await getAuthUser();
      setUser(authUser);
      setError(null);
    } catch (err) {
      console.error('Failed to refresh user:', err);
      setUser(null);
    }
  };

  useEffect(() => {
    // Initial load
    const init = async () => {
      setLoading(true);
      await refreshUser();
      setLoading(false);
    };

    init();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          await refreshUser();
        } else {
          setUser(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      await signIn(email, password);
      await refreshUser();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    }
  };

  const register = async (email: string, password: string) => {
    setError(null);
    try {
      await signUp(email, password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await signOut();
      setUser(null);
    } catch (err: unknown) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
