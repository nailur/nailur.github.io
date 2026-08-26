import { createClient } from '@supabase/supabase-js';

// NTWallet Supabase Credentials
const NTWALLET_URL = process.env.NTWALLET_SUPABASE_URL || 'https://nnizooudxhvjyfaahydc.supabase.co';
const NTWALLET_KEY = process.env.NTWALLET_SERVICE_ROLE || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uaXpvb3VkeGh2anlmYWFoeWRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzcyODE1NywiZXhwIjoyMTAzMzA0MTU3fQ.8CjJAPFkJbFfo5Hrn1eOU3u8AnFSmx-KCnE0L2xAVnE';

// NTGold Supabase Credentials
const NTGOLD_URL = process.env.NTGOLD_SUPABASE_URL || 'https://iwsacljessokrqhfmdbv.supabase.co';
const NTGOLD_KEY = process.env.NTGOLD_SERVICE_ROLE_KEY || process.env.NTGOLD_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3c2FjbGplc3Nva3JxaGZtZGJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxODcyNTMsImV4cCI6MjA4Mzc2MzI1M30.jQ_8KR76Xbbn1Heest75p3I78J6oiSt9V-H31cWWLOo';

const supabaseWallet = createClient(NTWALLET_URL, NTWALLET_KEY);
const supabaseGold = createClient(NTGOLD_URL, NTGOLD_KEY);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        // GET: Check and Auto-Sync PRO status across both databases
        if (req.method === 'GET') {
            const email = (req.query.email || '').trim().toLowerCase();
            if (!email) {
                return res.status(400).json({ error: 'Parameter email required' });
            }

            const syncResult = await checkAndSyncEcosystemTier(email);
            return res.status(200).json(syncResult);
        }

        // POST: Explicitly set tier across both databases (e.g. on Purchase / Upgrade)
        if (req.method === 'POST') {
            const { email, targetTier } = req.body || {};
            if (!email) {
                return res.status(400).json({ error: 'Field email required' });
            }

            const tier = (targetTier || 'pro').toLowerCase();
            const result = await setEcosystemTier(email.trim().toLowerCase(), tier);
            return res.status(200).json(result);
        }

        return res.status(405).json({ error: 'Method Not Allowed' });
    } catch (err) {
        console.error('Ecosystem tier sync error:', err);
        return res.status(500).json({ error: err.message });
    }
}

/**
 * Checks PRO status on both databases. If either is PRO, upgrades the other automatically.
 */
async function checkAndSyncEcosystemTier(email) {
    let walletUser = null;
    let goldUser = null;
    let isWalletPro = false;
    let isGoldPro = false;

    // 1. Check NTWallet Database
    try {
        const { data: wProfile } = await supabaseWallet
            .from('profiles')
            .select('id, email, tier')
            .eq('email', email)
            .maybeSingle();

        if (wProfile) {
            walletUser = wProfile;
            isWalletPro = wProfile.tier === 'pro';
        }
    } catch (e) {
        console.error('Error fetching NTWallet profile:', e);
    }

    // 2. Check NTGold Database (via auth user & tbluser)
    try {
        const { data: gUsers } = await supabaseGold.auth.admin.listUsers();
        const matchedAuth = (gUsers?.users || []).find(u => u.email?.toLowerCase() === email);

        if (matchedAuth) {
            const { data: gProfile } = await supabaseGold
                .from('tbluser')
                .select('id, user_type')
                .eq('id', matchedAuth.id)
                .maybeSingle();

            if (gProfile) {
                goldUser = { ...gProfile, email };
                isGoldPro = gProfile.user_type === 'pro';
            }
        }
    } catch (e) {
        console.error('Error fetching NTGold user:', e);
    }

    const shouldBePro = isWalletPro || isGoldPro;

    // 3. Auto-synchronize if mismatch
    if (shouldBePro) {
        // Upgrade NTWallet if not yet pro
        if (walletUser && !isWalletPro) {
            await supabaseWallet.from('profiles').update({ tier: 'pro' }).eq('id', walletUser.id);
            isWalletPro = true;
        }

        // Upgrade NTGold if not yet pro
        if (goldUser && !isGoldPro) {
            await supabaseGold.from('tbluser').update({ user_type: 'pro' }).eq('id', goldUser.id);
            isGoldPro = true;
        }
    }

    return {
        email,
        isPro: shouldBePro,
        tier: shouldBePro ? 'pro' : 'free',
        walletExists: !!walletUser,
        walletPro: isWalletPro,
        goldExists: !!goldUser,
        goldPro: isGoldPro,
        synced: true
    };
}

/**
 * Sets the tier to 'pro' or 'free' on both NTWallet and NTGold databases.
 */
async function setEcosystemTier(email, targetTier) {
    const isProTarget = targetTier === 'pro';
    const syncedApps = [];

    // 1. Update NTWallet
    try {
        const { data: wProfile } = await supabaseWallet
            .from('profiles')
            .update({ tier: targetTier })
            .eq('email', email)
            .select();

        if (wProfile && wProfile.length > 0) {
            syncedApps.push('NTWallet');
        }
    } catch (e) {
        console.error('Failed to update NTWallet tier:', e);
    }

    // 2. Update NTGold
    try {
        const { data: gUsers } = await supabaseGold.auth.admin.listUsers();
        const matchedAuth = (gUsers?.users || []).find(u => u.email?.toLowerCase() === email);

        if (matchedAuth) {
            await supabaseGold
                .from('tbluser')
                .update({ user_type: targetTier })
                .eq('id', matchedAuth.id);
            syncedApps.push('NTGold');
        }
    } catch (e) {
        console.error('Failed to update NTGold tier:', e);
    }

    return {
        success: true,
        email,
        tier: targetTier,
        isPro: isProTarget,
        syncedApps,
        message: `Status ${targetTier.toUpperCase()} berhasil disinkronkan ke seluruh ekosistem NT.`
    };
}
