import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// NTWallet Supabase (nnizooudxhvjyfaahydc)
const NTWALLET_URL = process.env.NTWALLET_SUPABASE_URL || 'https://nnizooudxhvjyfaahydc.supabase.co';
const NTWALLET_KEY = process.env.NTWALLET_SERVICE_ROLE || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uaXpvb3VkeGh2anlmYWFoeWRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzcyODE1NywiZXhwIjoyMTAzMzA0MTU3fQ.8CjJAPFkJbFfo5Hrn1eOU3u8AnFSmx-KCnE0L2xAVnE';

// NTGold Supabase (iwsacljessokrqhfmdbv)
const NTGOLD_URL = process.env.NTGOLD_SUPABASE_URL || 'https://iwsacljessokrqhfmdbv.supabase.co';
const NTGOLD_KEY = process.env.NTGOLD_SERVICE_ROLE_KEY || process.env.NTGOLD_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3c2FjbGplc3Nva3JxaGZtZGJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxODcyNTMsImV4cCI6MjA4Mzc2MzI1M30.jQ_8KR76Xbbn1Heest75p3I78J6oiSt9V-H31cWWLOo';

const supabaseWallet = createClient(NTWALLET_URL, NTWALLET_KEY);
const supabaseGold = createClient(NTGOLD_URL, NTGOLD_KEY);

const SSO_SECRET = process.env.SSO_SECRET || 'ntlink_sso_secret_key_ecosystem_2026_unified';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const action = (req.query.action || '').toLowerCase();

    try {
        // 1. ACTION: REGISTER UNIFIED NTLINK ACCOUNT
        if (action === 'register' && req.method === 'POST') {
            const { email, password, fullName } = req.body || {};
            if (!email || !password) {
                return res.status(400).json({ error: 'Email dan password wajib diisi' });
            }

            const cleanEmail = email.trim().toLowerCase();
            const name = (fullName || cleanEmail.split('@')[0]).trim();

            // Register in NTWallet Supabase
            let walletUserId = null;
            try {
                const { data: wUser, error: wErr } = await supabaseWallet.auth.admin.createUser({
                    email: cleanEmail,
                    password: password,
                    email_confirm: true,
                    user_metadata: { full_name: name }
                });
                if (!wErr && wUser?.user) {
                    walletUserId = wUser.user.id;
                }
            } catch (e) {
                console.warn('Wallet registration note:', e);
            }

            // Register in NTGold Supabase
            let goldUserId = null;
            try {
                const { data: gUser, error: gErr } = await supabaseGold.auth.admin.createUser({
                    email: cleanEmail,
                    password: password,
                    email_confirm: true,
                    user_metadata: { full_name: name }
                });
                if (!gErr && gUser?.user) {
                    goldUserId = gUser.user.id;
                }
            } catch (e) {
                console.warn('Gold registration note:', e);
            }

            const token = generateSsoToken(cleanEmail, name, 'free');

            return res.status(200).json({
                success: true,
                message: 'Akun NTLink berhasil dibuat!',
                email: cleanEmail,
                fullName: name,
                tier: 'free',
                token
            });
        }

        // 2. ACTION: LOGIN NTLINK ACCOUNT
        if (action === 'login' && req.method === 'POST') {
            const { email, password } = req.body || {};
            if (!email || !password) {
                return res.status(400).json({ error: 'Email dan password wajib diisi' });
            }

            const cleanEmail = email.trim().toLowerCase();

            // Try to authenticate against NTWallet or NTGold Supabase
            let authenticatedUser = null;

            const { data: wAuth, error: wErr } = await supabaseWallet.auth.signInWithPassword({
                email: cleanEmail,
                password: password
            });

            if (!wErr && wAuth?.user) {
                authenticatedUser = wAuth.user;
            } else {
                const { data: gAuth, error: gErr } = await supabaseGold.auth.signInWithPassword({
                    email: cleanEmail,
                    password: password
                });
                if (!gErr && gAuth?.user) {
                    authenticatedUser = gAuth.user;
                }
            }

            if (!authenticatedUser) {
                return res.status(401).json({ error: 'Email atau password salah' });
            }

            // Fetch ecosystem profile & tier
            const { data: profile } = await supabaseWallet
                .from('profiles')
                .select('*')
                .eq('email', cleanEmail)
                .maybeSingle();

            const isPro = profile?.tier === 'pro';
            const fullName = profile?.full_name || authenticatedUser.user_metadata?.full_name || cleanEmail.split('@')[0];
            const token = generateSsoToken(cleanEmail, fullName, isPro ? 'pro' : 'free');

            return res.status(200).json({
                success: true,
                email: cleanEmail,
                fullName: fullName,
                tier: isPro ? 'pro' : 'free',
                telegramChatId: profile?.telegram_chat_id || null,
                telegramLinkCode: profile?.telegram_link_code || null,
                token
            });
        }

        // 3. ACTION: VERIFY SSO HANDOFF TOKEN
        if (action === 'verify-token' && req.method === 'GET') {
            const token = req.query.token;
            if (!token) {
                return res.status(400).json({ error: 'Token SSO diperlukan' });
            }

            const verified = verifySsoToken(token);
            if (!verified) {
                return res.status(401).json({ error: 'Token SSO tidak valid atau sudah kedaluwarsa' });
            }

            return res.status(200).json({
                success: true,
                data: verified
            });
        }

        // 4. ACTION: CHECK USER STATUS
        if (action === 'status' && req.method === 'GET') {
            const email = (req.query.email || '').trim().toLowerCase();
            if (!email) {
                return res.status(400).json({ error: 'Parameter email diperlukan' });
            }

            const { data: profile } = await supabaseWallet
                .from('profiles')
                .select('id, email, full_name, tier, telegram_chat_id, telegram_username, telegram_link_code')
                .eq('email', email)
                .maybeSingle();

            return res.status(200).json({
                email,
                exists: !!profile,
                profile: profile || null,
                tier: profile?.tier || 'free'
            });
        }

        return res.status(405).json({ error: 'Aksi tidak didukung' });
    } catch (err) {
        console.error('NTLink Auth error:', err);
        return res.status(500).json({ error: err.message || 'Terjadi kesalahan pada server NTLink' });
    }
}

// ==========================================
// TOKEN HELPERS (HMAC-SHA256 SIGNED)
// ==========================================
function generateSsoToken(email, fullName, tier) {
    const payload = {
        email,
        fullName,
        tier,
        exp: Date.now() + (1000 * 60 * 30), // 30 mins validity
        nonce: Math.random().toString(36).substring(2, 10)
    };

    const strPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', SSO_SECRET).update(strPayload).digest('base64url');
    return `${strPayload}.${signature}`;
}

function verifySsoToken(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 2) return null;

        const [strPayload, signature] = parts;
        const expectedSig = crypto.createHmac('sha256', SSO_SECRET).update(strPayload).digest('base64url');

        if (signature !== expectedSig) return null;

        const jsonStr = Buffer.from(strPayload, 'base64url').toString('utf8');
        const payload = JSON.parse(jsonStr);

        if (payload.exp && Date.now() > payload.exp) {
            return null; // Expired
        }

        return payload;
    } catch (e) {
        return null;
    }
}
