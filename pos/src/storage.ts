import type { Transaction } from './types';
import { supabase } from './supabase';

export const loadTransactions = async (outletId?: string): Promise<Transaction[]> => {
  try {
    let query = supabase
      .from('transactions')
      .select('*')
      .order('timestamp', { ascending: false });

    if (outletId) {
      query = query.eq('outlet_id', outletId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to load transactions:', error);
    return [];
  }
};

export const saveTransaction = async (transaction: Transaction): Promise<void> => {
  try {
    const { error } = await supabase
      .from('transactions')
      .insert([transaction]);

    if (error) throw error;
  } catch (error) {
    console.error('Failed to save transaction:', error);
    throw error;
  }
};

export const deleteAllTransactions = async (outletId?: string): Promise<void> => {
  try {
    let query = supabase
      .from('transactions')
      .delete();

    if (outletId) {
      query = query.eq('outlet_id', outletId);
    } else {
      query = query.neq('id', '');
    }

    const { error } = await query;

    if (error) throw error;
  } catch (error) {
    console.error('Failed to delete transactions:', error);
    throw error;
  }
};

export const subscribeToTransactions = (callback: (transactions: Transaction[]) => void, outletId?: string) => {
  const channel = supabase
    .channel('transactions-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'transactions',
      },
      async () => {
        const transactions = await loadTransactions(outletId);
        callback(transactions);
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
};
