import { getState } from './state.js';
import { supabase } from './supabase.js';
import { showToast, escapeHtml } from './utils.js';
import { loadProfile, isPro } from './auth.js';

export async function renderTelegramSettings() {
    const { user, profile } = getState();
    const container = document.getElementById('telegram-status-container');
    if (!container) return;

    if (!profile) {
        container.innerHTML = `<div class="text-muted text-xs">Memuat status Telegram...</div>`;
        return;
    }

    // Restriction: Free Tier cannot use Telegram Bot integration
    if (!isPro()) {
        container.innerHTML = `
            <div class="pro-card-glow text-center p-4">
                <div class="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3" style="background: rgba(245, 158, 11, 0.15); color: var(--gold); font-size: 1.5rem; width: 48px; height: 48px; margin: 0 auto; border-radius: 9999px; display: flex; align-items: center; justify-content: center;">
                    <i class="ph-fill ph-lock-key"></i>
                </div>
                <h4 class="font-bold text-base">Fitur Eksklusif NTWallet PRO</h4>
                <p class="text-xs text-muted mt-1 max-w-md mx-auto">
                    Integrasi Bot Telegram (pencatatan instan via chat & sinkronisasi portofolio NTGold) hanya tersedia untuk pengguna <strong>NTWallet PRO</strong>.
                </p>
                <div class="mt-3">
                    <button class="btn btn-gold btn-sm" onclick="window.openUpgradeModal('Buka Akses Bot Telegram PRO', 'Upgrade ke NTWallet PRO untuk menghubungkan Telegram dan menikmati asisten keuangan AI!')">
                        <i class="ph-fill ph-crown"></i> Upgrade ke PRO Sekarang
                    </button>
                </div>
            </div>
        `;
        return;
    }

    const isConnected = !!profile.telegram_chat_id;
    const linkCode = profile.telegram_link_code || '---';

    if (isConnected) {
        container.innerHTML = `
            <div class="telegram-connected-box">
                <div class="telegram-status-header">
                    <div class="status-indicator online"></div>
                    <div>
                        <div class="font-semibold text-sm">Terhubung ke Telegram <span class="badge-pro-pill" style="font-size: 0.6rem;"><i class="ph-fill ph-crown"></i> PRO ACTIVE</span></div>
                        <div class="text-xs text-muted">ID Chat: ${escapeHtml(profile.telegram_chat_id)} ${profile.telegram_username ? '(@' + escapeHtml(profile.telegram_username) + ')' : ''}</div>
                    </div>
                </div>
                <p class="text-xs text-muted mt-2">
                    Akun Telegram Anda aktif. Anda bisa langsung chat bot untuk mencatat transaksi atau mengecek target emas NTGold.
                </p>
                <div class="mt-3 flex gap-2">
                    <button class="btn btn-outline-danger btn-sm" onclick="window.handleDisconnectTelegram()">
                        <i class="ph-bold ph-plugs"></i> Putuskan Koneksi
                    </button>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="telegram-disconnected-box">
                <div class="telegram-status-header">
                    <div class="status-indicator offline"></div>
                    <div>
                        <div class="font-semibold text-sm">Belum Terhubung ke Bot Telegram</div>
                        <div class="text-xs text-muted">Tautkan akun PRO Anda untuk mencatat via chat Telegram</div>
                    </div>
                </div>

                <div class="telegram-pairing-card mt-3">
                    <div class="font-semibold text-xs text-primary">Cara 1: Kirim Kode Pairing ke Bot</div>
                    <p class="text-xs text-muted mt-1">Buka Bot Telegram Anda dan ketik perintah berikut:</p>
                    <div class="code-box">
                        <code id="telegram-link-command">/link ${linkCode}</code>
                        <button class="btn-copy" onclick="window.copyLinkCommand()">
                            <i class="ph-bold ph-copy"></i> Salin
                        </button>
                    </div>
                </div>

                <div class="telegram-pairing-card mt-3">
                    <div class="font-semibold text-xs text-primary">Cara 2: Login Langsung di Chat Bot</div>
                    <p class="text-xs text-muted mt-1">Anda juga bisa login langsung di chat bot dengan mengetik:</p>
                    <div class="code-box">
                        <code>/login ${escapeHtml(profile.email || 'email-anda@domain.com')} password_anda</code>
                    </div>
                    <p class="text-xs text-muted mt-1">*(Pesan password Anda akan otomatis dihapus bot seketika demi keamanan)*</p>
                </div>

                <div class="mt-3">
                    <button class="btn btn-primary btn-sm w-full" onclick="window.regenerateTelegramCode()">
                        <i class="ph-bold ph-arrows-clockwise"></i> Buat Kode Pairing Baru
                    </button>
                </div>
            </div>
        `;
    }
}

export async function regenerateTelegramCode() {
    const user = getState().user;
    if (!user) return;

    try {
        const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const { error } = await supabase
            .from('profiles')
            .update({ telegram_link_code: newCode })
            .eq('id', user.id);

        if (error) throw error;

        showToast('Kode pairing baru berhasil dibuat', 'success');
        await loadProfile(user.id);
        renderTelegramSettings();
    } catch (err) {
        console.error('Error generating code:', err);
        showToast('Gagal membuat kode baru', 'error');
    }
}

export async function disconnectTelegram() {
    const user = getState().user;
    if (!user) return;

    try {
        const { error } = await supabase
            .from('profiles')
            .update({
                telegram_chat_id: null,
                telegram_username: null
            })
            .eq('id', user.id);

        if (error) throw error;

        showToast('Koneksi Telegram berhasil diputus', 'info');
        await loadProfile(user.id);
        renderTelegramSettings();
    } catch (err) {
        console.error('Error disconnecting telegram:', err);
        showToast('Gagal memutus Telegram', 'error');
    }
}
