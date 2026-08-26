import { supabase } from './supabase.js';
import { setState, getState } from './state.js';
import { showToast, formatRupiah } from './utils.js';
import { loadWallets } from './wallets.js';

export async function loadTransactions() {
    const user = getState().user;
    if (!user) return [];

    try {
        const filters = getState().filters;
        let query = supabase
            .from('transactions')
            .select(`
                *,
                wallet:wallets!transactions_wallet_id_fkey(id, name, color, icon, type),
                to_wallet:wallets!transactions_to_wallet_id_fkey(id, name, color, icon, type),
                category:categories(id, name, color, icon, type)
            `)
            .eq('user_id', user.id)
            .order('transaction_date', { ascending: false })
            .order('created_at', { ascending: false });

        if (filters.type && filters.type !== 'all') {
            query = query.eq('type', filters.type);
        }

        if (filters.walletId && filters.walletId !== 'all') {
            query = query.or(`wallet_id.eq.${filters.walletId},to_wallet_id.eq.${filters.walletId}`);
        }

        if (filters.categoryId && filters.categoryId !== 'all') {
            query = query.eq('category_id', filters.categoryId);
        }

        if (filters.startDate) {
            query = query.gte('transaction_date', new Date(filters.startDate).toISOString());
        }

        if (filters.endDate) {
            const end = new Date(filters.endDate);
            end.setHours(23, 59, 59, 999);
            query = query.lte('transaction_date', end.toISOString());
        }

        if (filters.searchQuery) {
            query = query.ilike('description', `%${filters.searchQuery}%`);
        }

        const { data, error } = await query.limit(200);

        if (error) throw error;

        setState('transactions', data || []);
        return data || [];
    } catch (err) {
        console.error('Error loading transactions:', err);
        showToast('Gagal memuat daftar transaksi', 'error');
        return [];
    }
}

export async function createTransaction({
    type,
    amount,
    description,
    wallet_id,
    to_wallet_id,
    category_id,
    transaction_date,
    notes,
    source = 'web'
}) {
    const user = getState().user;
    if (!user) return false;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
        showToast('Nominal transaksi harus lebih dari 0', 'warning');
        return false;
    }

    if (!description || !description.trim()) {
        showToast('Keterangan transaksi harus diisi', 'warning');
        return false;
    }

    if (!wallet_id) {
        showToast('Pilih dompet terlebih dahulu', 'warning');
        return false;
    }

    try {
        const wallets = getState().wallets;
        const fromWallet = wallets.find(w => w.id === wallet_id);
        if (!fromWallet) throw new Error('Dompet tidak ditemukan');

        // Calculate new balance
        let newFromBalance = Number(fromWallet.balance);
        if (type === 'expense') {
            newFromBalance -= numAmount;
        } else if (type === 'income') {
            newFromBalance += numAmount;
        } else if (type === 'transfer') {
            newFromBalance -= numAmount;
        }

        // 1. Update wallet balance
        const { error: wErr } = await supabase
            .from('wallets')
            .update({ balance: newFromBalance })
            .eq('id', wallet_id);

        if (wErr) throw wErr;

        // If transfer, update target wallet
        if (type === 'transfer' && to_wallet_id) {
            const toWallet = wallets.find(w => w.id === to_wallet_id);
            if (toWallet) {
                const newToBalance = Number(toWallet.balance) + numAmount;
                await supabase
                    .from('wallets')
                    .update({ balance: newToBalance })
                    .eq('id', to_wallet_id);
            }
        }

        // 2. Insert transaction
        const { data, error } = await supabase
            .from('transactions')
            .insert({
                user_id: user.id,
                wallet_id: wallet_id,
                to_wallet_id: type === 'transfer' ? to_wallet_id : null,
                category_id: type === 'transfer' ? null : (category_id || null),
                type: type,
                amount: numAmount,
                description: description.trim(),
                transaction_date: transaction_date ? new Date(transaction_date).toISOString() : new Date().toISOString(),
                notes: notes ? notes.trim() : null,
                source: source
            })
            .select()
            .single();

        if (error) throw error;

        const label = type === 'expense' ? 'Pengeluaran' : (type === 'income' ? 'Pemasukan' : 'Transfer');
        showToast(`Catatan ${label} ${formatRupiah(numAmount)} berhasil disimpan`, 'success');

        await Promise.all([loadWallets(), loadTransactions()]);
        return data;
    } catch (err) {
        console.error('Create transaction error:', err);
        showToast(err.message || 'Gagal menyimpan transaksi', 'error');
        return false;
    }
}

export async function deleteTransaction(id) {
    const user = getState().user;
    if (!user) return false;

    try {
        const transactions = getState().transactions;
        const tx = transactions.find(t => t.id === id);
        if (!tx) throw new Error('Transaksi tidak ditemukan');

        const wallets = getState().wallets;
        const fromWallet = wallets.find(w => w.id === tx.wallet_id);

        // Revert wallet balance
        if (fromWallet) {
            let restoredBalance = Number(fromWallet.balance);
            if (tx.type === 'expense') {
                restoredBalance += Number(tx.amount);
            } else if (tx.type === 'income') {
                restoredBalance -= Number(tx.amount);
            } else if (tx.type === 'transfer') {
                restoredBalance += Number(tx.amount);
            }

            await supabase
                .from('wallets')
                .update({ balance: restoredBalance })
                .eq('id', tx.wallet_id);
        }

        // If transfer, revert target wallet
        if (tx.type === 'transfer' && tx.to_wallet_id) {
            const toWallet = wallets.find(w => w.id === tx.to_wallet_id);
            if (toWallet) {
                const restoredToBalance = Number(toWallet.balance) - Number(tx.amount);
                await supabase
                    .from('wallets')
                    .update({ balance: restoredToBalance })
                    .eq('id', tx.to_wallet_id);
            }
        }

        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showToast('Transaksi berhasil dihapus & saldo dikembalikan', 'info');
        await Promise.all([loadWallets(), loadTransactions()]);
        return true;
    } catch (err) {
        console.error('Delete transaction error:', err);
        showToast(err.message || 'Gagal menghapus transaksi', 'error');
        return false;
    }
}

