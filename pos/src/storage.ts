import type { Transaction } from './types';
import { supabase } from './supabase';

export const loadTransactions = async (): Promise<Transaction[]> => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('timestamp', { ascending: false });

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

export const deleteAllTransactions = async (): Promise<void> => {
  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .neq('id', '');

    if (error) throw error;
  } catch (error) {
    console.error('Failed to delete transactions:', error);
    throw error;
  }
};

export const subscribeToTransactions = (callback: (transactions: Transaction[]) => void) => {
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
        const transactions = await loadTransactions();
        callback(transactions);
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
};

