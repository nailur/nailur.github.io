import { supabase } from './supabase.js';
import { setState, getState } from './state.js';
import { showToast, formatRupiah } from './utils.js';

export async function loadBudgets(month, year) {
    const user = getState().user;
    if (!user) return [];

    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1);
    const targetYear = year || now.getFullYear();

    try {
        const { data, error } = await supabase
            .from('budgets')
            .select(`
                *,
                category:categories(id, name, color, icon, type)
            `)
            .eq('user_id', user.id)
            .eq('month', targetMonth)
            .eq('year', targetYear);

        if (error) throw error;

        setState('budgets', data || []);
        return data || [];
    } catch (err) {
        console.error('Error loading budgets:', err);
        showToast('Gagal memuat anggaran', 'error');
        return [];
    }
}

export async function setBudget({ category_id, amount, month, year }) {
    const user = getState().user;
    if (!user) return false;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
        showToast('Nominal anggaran harus lebih dari 0', 'warning');
        return false;
    }

    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1);
    const targetYear = year || now.getFullYear();

    try {
        const { data, error } = await supabase
            .from('budgets')
            .upsert({
                user_id: user.id,
                category_id: category_id,
                amount: numAmount,
                month: targetMonth,
                year: targetYear
            }, {
                onConflict: 'user_id, category_id, month, year'
            })
            .select()
            .single();

        if (error) throw error;

        showToast('Anggaran berhasil disimpan', 'success');
        await loadBudgets(targetMonth, targetYear);
        return data;
    } catch (err) {
        console.error('Save budget error:', err);
        showToast(err.message || 'Gagal menyimpan anggaran', 'error');
        return false;
    }
}

export async function deleteBudget(id, month, year) {
    try {
        const { error } = await supabase
            .from('budgets')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showToast('Anggaran berhasil dihapus', 'success');
        await loadBudgets(month, year);
        return true;
    } catch (err) {
        console.error('Delete budget error:', err);
        showToast(err.message || 'Gagal menghapus anggaran', 'error');
        return false;
    }
}

export function computeBudgetProgress(budgets, transactions, month, year) {
    const now = new Date();
    const targetMonth = month || (now.getMonth() + 1);
    const targetYear = year || now.getFullYear();

    // Sum transactions for the selected month and year
    const spentByCategory = new Map();

    transactions.forEach(t => {
        if (t.type !== 'expense' || !t.category_id) return;
        const d = new Date(t.transaction_date);
        if (d.getMonth() + 1 === targetMonth && d.getFullYear() === targetYear) {
            const current = spentByCategory.get(t.category_id) || 0;
            spentByCategory.set(t.category_id, current + Number(t.amount));
        }
    });

    return budgets.map(b => {
        const spent = spentByCategory.get(b.category_id) || 0;
        const budgetAmount = Number(b.amount);
        const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
        const remaining = budgetAmount - spent;
        const isOver = spent > budgetAmount;

        return {
            ...b,
            spent,
            percentage: Math.min(100, percentage),
            rawPercentage: percentage,
            remaining,
            isOver
        };
    });
}

