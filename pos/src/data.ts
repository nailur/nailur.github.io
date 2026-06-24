import type { Product } from './types';
import { supabase } from './supabase';

export const TAX_RATE = 0.08;

export const loadProducts = async (outletId?: string): Promise<Product[]> => {
  try {
    let query = supabase
      .from('products')
      .select('*')
      .order('category', { ascending: true });

    if (outletId) {
      query = query.eq('outlet_id', outletId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to load products:', error);
    return [];
  }
};

export const addProduct = async (product: Omit<Product, 'id'>, outletId: string): Promise<Product | null> => {
  try {
    const id = Date.now().toString();
    const { data, error } = await supabase
      .from('products')
      .insert([{ id, ...product, outlet_id: outletId }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to add product:', error);
    throw error;
  }
};

export const updateProduct = async (id: string, updates: Partial<Pick<Product, 'name' | 'price' | 'category'>>): Promise<Product | null> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to update product:', error);
    throw error;
  }
};

export const deleteProduct = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Failed to delete product:', error);
    throw error;
  }
};

export const subscribeToProducts = (callback: (products: Product[]) => void, outletId?: string) => {
  const channel = supabase
    .channel('products-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'products',
      },
      async () => {
        const products = await loadProducts(outletId);
        callback(products);
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
};
