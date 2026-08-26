import { supabase } from './supabase.js';
import { setState, getState } from './state.js';
import { showToast } from './utils.js';

export function isPro() {
    const profile = getState().profile;
    return profile && profile.tier === 'pro';
}

export async function checkSession() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session && session.user) {
            setState('user', session.user);
            await loadProfile(session.user.id);
            // Background sync ecosystem PRO tier (NTWallet <-> NTGold)
            syncEcosystemTierInBackground(session.user.email);
            return session.user;
        } else {
            setState('user', null);
            setState('profile', null);
            return null;
        }
    } catch (err) {
        console.error('Session check failed:', err);
        return null;
    }
}

export async function loadProfile(userId) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            setState('profile', data);
            return data;
        } else {
            const user = getState().user;
            const linkCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            
            // Check if user is already PRO in NTGold
            let initialTier = 'free';
            try {
                const checkRes = await fetch(`/api/sync-ecosystem-tier?email=${encodeURIComponent(user?.email || '')}`);
                if (checkRes.ok) {
                    const checkData = await checkRes.json();
                    if (checkData.isPro) initialTier = 'pro';
                }
            } catch (e) {
                console.warn('Could not verify ecosystem tier:', e);
            }

            const newProfile = {
                id: userId,
                email: user?.email || '',
                full_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User',
                tier: initialTier,
                telegram_link_code: linkCode,
                currency: 'IDR'
            };

            const { data: inserted, error: insErr } = await supabase
                .from('profiles')
                .upsert(newProfile)
                .select()
                .single();

            if (!insErr && inserted) {
                setState('profile', inserted);
                return inserted;
            }
        }
    } catch (err) {
        console.error('Error loading profile:', err);
    }
    return null;
}

async function syncEcosystemTierInBackground(email) {
    if (!email) return;
    try {
        const res = await fetch(`/api/sync-ecosystem-tier?email=${encodeURIComponent(email)}`);
        if (res.ok) {
            const data = await res.json();
            const currentProfile = getState().profile;
            if (data.isPro && currentProfile && currentProfile.tier !== 'pro') {
                currentProfile.tier = 'pro';
                setState('profile', currentProfile);
            }
        }
    } catch (e) {
        console.warn('Background ecosystem sync failed:', e);
    }
}

export async function login(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password
        });

        if (error) {
            showToast(error.message || 'Email atau password salah', 'error');
            return false;
        }

        if (data?.user) {
            setState('user', data.user);
            await loadProfile(data.user.id);
            syncEcosystemTierInBackground(data.user.email);
            showToast('Selamat datang di NTWallet!', 'success');
            return true;
        }
    } catch (err) {
        console.error('Login error:', err);
        showToast(err.message || 'Gagal login', 'error');
    }
    return false;
}

export async function register(email, password, fullName) {
    try {
        const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password: password,
            options: {
                data: {
                    full_name: fullName.trim()
                }
            }
        });

        if (error) {
            showToast(error.message || 'Pendaftaran gagal', 'error');
            return false;
        }

        if (data?.user) {
            setState('user', data.user);
            await loadProfile(data.user.id);
            syncEcosystemTierInBackground(data.user.email);
            showToast('Akun NTWallet berhasil dibuat!', 'success');
            return true;
        }
    } catch (err) {
        console.error('Register error:', err);
        showToast(err.message || 'Pendaftaran gagal', 'error');
    }
    return false;
}

export async function logout() {
    try {
        await supabase.auth.signOut();
        setState('user', null);
        setState('profile', null);
        setState('wallets', []);
        setState('categories', []);
        setState('transactions', []);
        setState('budgets', []);
        showToast('Anda telah keluar', 'info');
        window.location.reload();
    } catch (err) {
        console.error('Logout error:', err);
    }
}

export async function updateProfile(updateData) {
    const user = getState().user;
    if (!user) return false;

    try {
        const { data, error } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', user.id)
            .select()
            .single();

        if (error) throw error;

        setState('profile', data);
        showToast('Profil berhasil diperbarui', 'success');
        return true;
    } catch (err) {
        console.error('Update profile error:', err);
        showToast(err.message || 'Gagal memperbarui profil', 'error');
        return false;
    }
}

export async function toggleUserTier(targetTier) {
    const user = getState().user;
    if (!user) return false;

    try {
        const newTier = targetTier || (isPro() ? 'free' : 'pro');

        // 1. Call Ecosystem Sync API to update both NTWallet & NTGold
        try {
            await fetch('/api/sync-ecosystem-tier', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, targetTier: newTier })
            });
        } catch (e) {
            console.warn('API sync warning:', e);
        }

        // 2. Update local NTWallet database
        const { data, error } = await supabase
            .from('profiles')
            .update({ tier: newTier })
            .eq('id', user.id)
            .select()
            .single();

        if (error) throw error;

        setState('profile', data);
        showToast(`Status ${newTier.toUpperCase()} berhasil disinkronkan ke NTWallet & NTGold!`, 'success');
        return true;
    } catch (err) {
        console.error('Error toggling tier:', err);
        showToast('Gagal mengubah tier', 'error');
        return false;
    }
}
