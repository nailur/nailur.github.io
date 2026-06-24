import type { UserRole } from './types';
import { supabase } from './supabase';

export const loadUsers = async (): Promise<UserRole[]> => {
  try {
    const { data, error } = await supabase
      .from('user_roles_with_email')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to load users:', error);
    return [];
  }
};

export const loadOutletUsers = async (outletId: string): Promise<UserRole[]> => {
  try {
    const { data, error } = await supabase
      .from('user_roles_with_email')
      .select('*')
      .eq('outlet_id', outletId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to load outlet users:', error);
    return [];
  }
};

export const createUserWithRole = async (
  email: string,
  password: string,
  role: 'superadmin' | 'admin',
  outletId: string | null
): Promise<void> => {
  try {
    // Use Supabase admin API to create user
    // Note: In production, this should be done via Edge Function
    // For now, we create via signUp and then assign role
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    // Assign role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert([{
        user_id: authData.user.id,
        role,
        outlet_id: outletId,
      }]);

    if (roleError) throw roleError;
  } catch (error) {
    console.error('Failed to create user:', error);
    throw error;
  }
};

export const assignUserRole = async (
  userId: string,
  role: 'superadmin' | 'admin',
  outletId: string | null
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('user_roles')
      .upsert([{
        user_id: userId,
        role,
        outlet_id: outletId,
      }], {
        onConflict: 'user_id,outlet_id',
      });

    if (error) throw error;
  } catch (error) {
    console.error('Failed to assign role:', error);
    throw error;
  }
};

export const removeUserRole = async (roleId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('id', roleId);

    if (error) throw error;
  } catch (error) {
    console.error('Failed to remove role:', error);
    throw error;
  }
};

export const subscribeToUserRoles = (callback: (users: UserRole[]) => void) => {
  const channel = supabase
    .channel('user-roles-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_roles',
      },
      async () => {
        const users = await loadUsers();
        callback(users);
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
};
