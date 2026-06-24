import type { Outlet } from './types';
import { supabase } from './supabase';

export const loadOutlets = async (): Promise<Outlet[]> => {
  try {
    const { data, error } = await supabase
      .from('outlets')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to load outlets:', error);
    return [];
  }
};

export const loadOutlet = async (id: string): Promise<Outlet | null> => {
  try {
    const { data, error } = await supabase
      .from('outlets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to load outlet:', error);
    return null;
  }
};

export const createOutlet = async (outlet: Omit<Outlet, 'id' | 'created_at' | 'is_active'>): Promise<Outlet | null> => {
  try {
    const { data, error } = await supabase
      .from('outlets')
      .insert([{ ...outlet, is_active: true }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to create outlet:', error);
    throw error;
  }
};

export const updateOutlet = async (id: string, updates: Partial<Pick<Outlet, 'name' | 'address' | 'phone' | 'is_active'>>): Promise<Outlet | null> => {
  try {
    const { data, error } = await supabase
      .from('outlets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to update outlet:', error);
    throw error;
  }
};

export const deleteOutlet = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('outlets')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Failed to delete outlet:', error);
    throw error;
  }
};

export const getOutletStats = async (outletId: string): Promise<{ productCount: number; transactionCount: number; totalSales: number }> => {
  try {
    const [productsRes, transactionsRes] = await Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('outlet_id', outletId),
      supabase.from('transactions').select('total').eq('outlet_id', outletId),
    ]);

    const productCount = productsRes.count || 0;
    const transactions = transactionsRes.data || [];
    const transactionCount = transactions.length;
    const totalSales = transactions.reduce((sum, t) => sum + Number(t.total), 0);

    return { productCount, transactionCount, totalSales };
  } catch (error) {
    console.error('Failed to get outlet stats:', error);
    return { productCount: 0, transactionCount: 0, totalSales: 0 };
  }
};

export const subscribeToOutlets = (callback: (outlets: Outlet[]) => void) => {
  const channel = supabase
    .channel('outlets-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'outlets',
      },
      async () => {
        const outlets = await loadOutlets();
        callback(outlets);
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
};
