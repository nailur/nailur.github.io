import { supabase } from './supabase.js';
import { setState, getState } from './state.js';
import { showToast, formatRupiah } from './utils.js';

export const WALLET_TYPES = [
    { type: 'cash', name: 'Uang Tunai / Cash', icon: 'ph-money' },
    { type: 'bank', name: 'Rekening Bank', icon: 'ph-bank' },
    { type: 'ewallet', name: 'E-Wallet (GoPay, OVO, ShopeePay)', icon: 'ph-device-mobile' },
    { type: 'savings', name: 'Tabungan / Deposito', icon: 'ph-piggy-bank' },
    { type: 'credit', name: 'Kartu Kredit', icon: 'ph-credit-card' }
];

export async function loadWallets() {
    const user = getState().user;
    if (!user) return [];

    try {
        const { data, error } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', user.id)
            .order('is_default', { ascending: false })
            .order('name');

        if (error) throw error;

        if (!data || data.length === 0) {
            // Seed default wallet
            await seedDefaultWallet(user.id);
            return loadWallets();
        }

        setState('wallets', data || []);
        return data || [];
    } catch (err) {
        console.error('Error loading wallets:', err);
        showToast('Gagal memuat daftar dompet', 'error');
        return [];
    }
}

async function seedDefaultWallet(userId) {
    try {
        await supabase.from('wallets').insert({
            user_id: userId,
            name: 'Dompet Utama (Cash)',
            type: 'cash',
            balance: 0,
            color: '#10B981',
            icon: 'ph-wallet',
            is_default: true
        });
    } catch (e) {
        console.error('Error seeding default wallet:', e);
    }
}

export async function createWallet({ name, type, balance, color, icon, is_default }) {
    const user = getState().user;
    if (!user) return false;

    try {
        const numBalance = Number(balance) || 0;

        if (is_default) {
            // Unset current default wallet
            await supabase
                .from('wallets')
                .update({ is_default: false })
                .eq('user_id', user.id);
        }

        const { data, error } = await supabase
            .from('wallets')
            .insert({
                user_id: user.id,
                name: name.trim(),
                type: type || 'cash',
                balance: numBalance,
                color: color || '#10B981',
                icon: icon || 'ph-wallet',
                is_default: !!is_default
            })
            .select()
            .single();

        if (error) throw error;

        showToast(`Dompet "${name}" berhasil dibuat`, 'success');
        await loadWallets();
        return data;
    } catch (err) {
        console.error('Create wallet error:', err);
        showToast(err.message || 'Gagal membuat dompet', 'error');
        return false;
    }
}

export async function updateWallet(id, { name, type, color, icon, is_default }) {
    const user = getState().user;
    if (!user) return false;

    try {
        if (is_default) {
            await supabase
                .from('wallets')
                .update({ is_default: false })
                .eq('user_id', user.id);
        }

        const { data, error } = await supabase
            .from('wallets')
            .update({
                name: name.trim(),
                type: type,
                color: color,
                icon: icon,
                is_default: !!is_default
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        showToast('Dompet berhasil diperbarui', 'success');
        await loadWallets();
        return data;
    } catch (err) {
        console.error('Update wallet error:', err);
        showToast(err.message || 'Gagal memperbarui dompet', 'error');
        return false;
    }
}

export async function adjustWalletBalance(walletId, newBalance, reason = 'Penyesuaian Saldo') {
    const user = getState().user;
    if (!user) return false;

    try {
        const wallets = getState().wallets;
        const target = wallets.find(w => w.id === walletId);
        if (!target) throw new Error('Dompet tidak ditemukan');

        const diff = Number(newBalance) - Number(target.balance);
        if (diff === 0) {
            showToast('Saldo tidak berubah', 'info');
            return true;
        }

        // Update wallet balance
        const { error: wErr } = await supabase
            .from('wallets')
            .update({ balance: newBalance })
            .eq('id', walletId);

        if (wErr) throw wErr;

        // Log an adjustment transaction
        await supabase.from('transactions').insert({
            user_id: user.id,
            wallet_id: walletId,
            type: diff > 0 ? 'income' : 'expense',
            amount: Math.abs(diff),
            description: `${reason} (${diff > 0 ? '+' : '-'}${formatRupiah(Math.abs(diff))})`,
            transaction_date: new Date().toISOString(),
            source: 'web'
        });

        showToast('Saldo berhasil disesuaikan', 'success');
        await loadWallets();
        return true;
    } catch (err) {
        console.error('Adjust balance error:', err);
        showToast(err.message || 'Gagal menyesuaikan saldo', 'error');
        return false;
    }
}

export async function transferBetweenWallets({ fromWalletId, toWalletId, amount, notes, transaction_date }) {
    const user = getState().user;
    if (!user) return false;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
        showToast('Nominal transfer harus lebih dari 0', 'warning');
        return false;
    }

    if (fromWalletId === toWalletId) {
        showToast('Dompet asal dan tujuan tidak boleh sama', 'warning');
        return false;
    }

    try {
        const wallets = getState().wallets;
        const fromWallet = wallets.find(w => w.id === fromWalletId);
        const toWallet = wallets.find(w => w.id === toWalletId);

        if (!fromWallet || !toWallet) {
            throw new Error('Dompet tidak valid');
        }

        // Deduct from source, add to target
        const newFromBalance = Number(fromWallet.balance) - numAmount;
        const newToBalance = Number(toWallet.balance) + numAmount;

        const { error: err1 } = await supabase
            .from('wallets')
            .update({ balance: newFromBalance })
            .eq('id', fromWalletId);
        if (err1) throw err1;

        const { error: err2 } = await supabase
            .from('wallets')
            .update({ balance: newToBalance })
            .eq('id', toWalletId);
        if (err2) throw err2;

        // Record transfer transaction
        const { error: tErr } = await supabase.from('transactions').insert({
            user_id: user.id,
            wallet_id: fromWalletId,
            to_wallet_id: toWalletId,
            type: 'transfer',
            amount: numAmount,
            description: `Transfer ke ${toWallet.name}`,
            notes: notes || null,
            transaction_date: transaction_date ? new Date(transaction_date).toISOString() : new Date().toISOString(),
            source: 'web'
        });

        if (tErr) throw tErr;

        showToast(`Berhasil transfer ${formatRupiah(numAmount)} ke ${toWallet.name}`, 'success');
        await loadWallets();
        return true;
    } catch (err) {
        console.error('Transfer error:', err);
        showToast(err.message || 'Gagal melakukan transfer', 'error');
        return false;
    }
}

export async function deleteWallet(id) {
    try {
        const wallets = getState().wallets;
        if (wallets.length <= 1) {
            showToast('Tidak bisa menghapus satu-satunya dompet Anda', 'warning');
            return false;
        }

        const { error } = await supabase
            .from('wallets')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showToast('Dompet berhasil dihapus', 'success');
        await loadWallets();
        return true;
    } catch (err) {
        console.error('Delete wallet error:', err);
        showToast(err.message || 'Gagal menghapus dompet', 'error');
        return false;
    }
}

