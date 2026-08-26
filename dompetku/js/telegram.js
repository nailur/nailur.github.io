import { getState } from './state.js';
import { supabase } from './supabase.js';
import { showToast, escapeHtml } from './utils.js';
import { loadProfile } from './auth.js';

export async function renderTelegramSettings() {
    const { user, profile } = getState();
    const container = document.getElementById('telegram-status-container');
    if (!container) return;

    if (!profile) {
        container.innerHTML = `<div class="text-muted">Memuat status Telegram...</div>`;
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
                        <div class="font-semibold">Terhubung ke Telegram</div>
                        <div class="text-xs text-muted">ID Chat: ${escapeHtml(profile.telegram_chat_id)} ${profile.telegram_username ? '(@' + escapeHtml(profile.telegram_username) + ')' : ''}</div>
                    </div>
                </div>
                <p class="text-sm text-muted mt-3">
                    Akun Telegram Anda sudah aktif dan siap menerima input pengeluaran serta menjawab kueri NTGold secara otomatis.
                </p>
                <div class="mt-4 flex gap-2">
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
                        <div class="font-semibold">Belum Terhubung ke Bot Telegram</div>
                        <div class="text-xs text-muted">Hubungkan untuk mencatat pengeluaran & kueri NTGold via chat</div>
                    </div>
                </div>

                <div class="telegram-pairing-card mt-4">
                    <div class="pairing-title">Cara 1: Kirim Kode Pairing ke Bot</div>
                    <p class="text-sm text-muted">Buka Bot Telegram Anda dan ketik perintah berikut:</p>
                    <div class="code-box">
                        <code id="telegram-link-command">/link ${linkCode}</code>
                        <button class="btn-copy" onclick="window.copyLinkCommand()">
                            <i class="ph-bold ph-copy"></i> Salin
                        </button>
                    </div>
                </div>

                <div class="telegram-pairing-card mt-3">
                    <div class="pairing-title">Cara 2: Login Langsung di Chat Bot</div>
                    <p class="text-sm text-muted">Anda juga bisa login langsung di Telegram dengan mengetik:</p>
                    <div class="code-box">
                        <code>/login ${escapeHtml(profile.email || 'email-anda@domain.com')} password_anda</code>
                    </div>
                    <p class="text-xs text-muted mt-1">*(Pesan password Anda akan otomatis dihapus bot seketika demi keamanan)*</p>
                </div>

                <div class="mt-4">
                    <button class="btn btn-primary w-full" onclick="window.regenerateTelegramCode()">
                        <i class="ph-bold ph-arrows-clockwise"></i> Buat Kode Baru
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

