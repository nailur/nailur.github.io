import { supabase } from './supabase.js';
import { setState, getState } from './state.js';
import { showToast } from './utils.js';

export const DEFAULT_CATEGORY_ICONS = [
    { icon: 'ph-hamburger', name: 'Makanan' },
    { icon: 'ph-coffee', name: 'Kopi / Minuman' },
    { icon: 'ph-gas-pump', name: 'Bensin / Transport' },
    { icon: 'ph-shopping-bag', name: 'Belanja' },
    { icon: 'ph-shopping-cart', name: 'Supermarket' },
    { icon: 'ph-receipt', name: 'Tagihan' },
    { icon: 'ph-house', name: 'Tempat Tinggal' },
    { icon: 'ph-game-controller', name: 'Hiburan' },
    { icon: 'ph-first-aid', name: 'Kesehatan' },
    { icon: 'ph-graduation-cap', name: 'Pendidikan' },
    { icon: 'ph-money', name: 'Gaji' },
    { icon: 'ph-storefront', name: 'Bisnis' },
    { icon: 'ph-gift', name: 'Hadiah / Bonus' },
    { icon: 'ph-chart-line-up', name: 'Investasi' },
    { icon: 'ph-airplane-tilt', name: 'Travel' },
    { icon: 'ph-tag', name: 'Lainnya' }
];

export const CATEGORY_COLORS = [
    '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4',
    '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#6B7280'
];

export async function loadCategories() {
    const user = getState().user;
    if (!user) return [];

    try {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .or(`user_id.eq.${user.id},user_id.is.null`)
            .order('name');

        if (error) throw error;

        if (!data || data.length === 0) {
            // Seed initial categories if none exist
            await seedDefaultCategories(user.id);
            return loadCategories();
        }

        setState('categories', data || []);
        return data || [];
    } catch (err) {
        console.error('Error loading categories:', err);
        showToast('Gagal memuat kategori', 'error');
        return [];
    }
}

export async function seedDefaultCategories(userId) {
    const defaultExpense = [
        { user_id: userId, name: 'Makanan & Minuman', type: 'expense', icon: 'ph-hamburger', color: '#EF4444', is_default: true },
        { user_id: userId, name: 'Transportasi & Bensin', type: 'expense', icon: 'ph-gas-pump', color: '#F59E0B', is_default: true },
        { user_id: userId, name: 'Belanja & Kebutuhan', type: 'expense', icon: 'ph-shopping-bag', color: '#3B82F6', is_default: true },
        { user_id: userId, name: 'Tagihan & Utilitas', type: 'expense', icon: 'ph-receipt', color: '#8B5CF6', is_default: true },
        { user_id: userId, name: 'Hiburan & Hobi', type: 'expense', icon: 'ph-game-controller', color: '#EC4899', is_default: true },
        { user_id: userId, name: 'Kesehatan', type: 'expense', icon: 'ph-first-aid', color: '#10B981', is_default: true },
        { user_id: userId, name: 'Pendidikan', type: 'expense', icon: 'ph-graduation-cap', color: '#6366F1', is_default: true },
        { user_id: userId, name: 'Lain-lain', type: 'expense', icon: 'ph-tag', color: '#6B7280', is_default: true }
    ];

    const defaultIncome = [
        { user_id: userId, name: 'Gaji / Penghasilan', type: 'income', icon: 'ph-money', color: '#10B981', is_default: true },
        { user_id: userId, name: 'Bisnis / Usaha', type: 'income', icon: 'ph-storefront', color: '#3B82F6', is_default: true },
        { user_id: userId, name: 'Bonus / THR', type: 'income', icon: 'ph-gift', color: '#F59E0B', is_default: true },
        { user_id: userId, name: 'Investasi & Dividen', type: 'income', icon: 'ph-chart-line-up', color: '#8B5CF6', is_default: true },
        { user_id: userId, name: 'Pemasukan Lainnya', type: 'income', icon: 'ph-tag', color: '#6B7280', is_default: true }
    ];

    try {
        await supabase.from('categories').insert([...defaultExpense, ...defaultIncome]);
    } catch (e) {
        console.error('Error seeding categories:', e);
    }
}

export async function createCategory({ name, type, icon, color }) {
    const user = getState().user;
    if (!user) return false;

    try {
        const { data, error } = await supabase
            .from('categories')
            .insert({
                user_id: user.id,
                name: name.trim(),
                type: type || 'expense',
                icon: icon || 'ph-tag',
                color: color || '#6366F1'
            })
            .select()
            .single();

        if (error) throw error;

        showToast(`Kategori "${name}" berhasil ditambahkan`, 'success');
        await loadCategories();
        return data;
    } catch (err) {
        console.error('Create category error:', err);
        showToast(err.message || 'Gagal menambahkan kategori', 'error');
        return false;
    }
}

export async function updateCategory(id, { name, type, icon, color }) {
    try {
        const updatePayload = {
            name: name.trim(),
            icon: icon,
            color: color
        };
        if (type) updatePayload.type = type;

        const { data, error } = await supabase
            .from('categories')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        showToast('Kategori berhasil diperbarui', 'success');
        await loadCategories();
        return data;
    } catch (err) {
        console.error('Update category error:', err);
        showToast(err.message || 'Gagal memperbarui kategori', 'error');
        return false;
    }
}

export async function deleteCategory(id) {
    try {
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showToast('Kategori berhasil dihapus', 'success');
        await loadCategories();
        return true;
    } catch (err) {
        console.error('Delete category error:', err);
        showToast(err.message || 'Gagal menghapus kategori', 'error');
        return false;
    }
}

