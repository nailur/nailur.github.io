import { supabase } from './supabase';
import type { UserRole, AppRole } from './types';

export interface AuthUser {
  id: string;
  email: string;
  role: AppRole;
  outletId: string | null;
  outletName: string | null;
}

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
};

export const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getCurrentSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

export const getUserRole = async (userId: string): Promise<UserRole | null> => {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (error) {
      // No role found
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to get user role:', error);
    return null;
  }
};

export const getAuthUser = async (): Promise<AuthUser | null> => {
  const session = await getCurrentSession();
  if (!session?.user) return null;

  const role = await getUserRole(session.user.id);
  if (!role) return null;

  let outletName: string | null = null;
  if (role.outlet_id) {
    const { data } = await supabase
      .from('outlets')
      .select('name')
      .eq('id', role.outlet_id)
      .single();
    outletName = data?.name || null;
  }

  return {
    id: session.user.id,
    email: session.user.email || '',
    role: role.role,
    outletId: role.outlet_id,
    outletName,
  };
};
