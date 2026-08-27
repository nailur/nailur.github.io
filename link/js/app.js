// State
let currentUser = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    checkSavedSession();
    setupEventListeners();
});

// Theme Management
function initTheme() {
    const saved = localStorage.getItem('ntlink_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
}

window.toggleTheme = function () {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ntlink_theme', next);
};

// Check local saved session
function checkSavedSession() {
    const saved = localStorage.getItem('ntlink_user_session');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            renderDashboard(currentUser);
        } catch (e) {
            localStorage.removeItem('ntlink_user_session');
            renderAuth();
        }
    } else {
        renderAuth();
    }
}

// Switch between Login and Register tabs
window.switchAuthTab = function (tab) {
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    const tabLogin = document.getElementById('tab-login-btn');
    const tabRegister = document.getElementById('tab-register-btn');

    if (tab === 'login') {
        formLogin.classList.remove('hidden');
        formRegister.classList.add('hidden');
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
    } else {
        formLogin.classList.add('hidden');
        formRegister.classList.remove('hidden');
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
    }
};

// Event Listeners
function setupEventListeners() {
    // Form Login
    const formLogin = document.getElementById('form-login');
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const submitBtn = document.getElementById('btn-submit-login');

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="ph-bold ph-spinner ph-spin"></i> Menghubungkan...`;

            try {
                const res = await fetch('/api/ntlink-auth?action=login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.error || 'Login gagal');
                }

                currentUser = data;
                localStorage.setItem('ntlink_user_session', JSON.stringify(data));
                showToast(`Selamat datang di NTLink, ${data.fullName || data.email}!`, 'success');
                renderDashboard(data);
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="ph-bold ph-sign-in"></i> Masuk ke Ekosistem NT`;
            }
        });
    }

    // Form Register
    const formRegister = document.getElementById('form-register');
    if (formRegister) {
        formRegister.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const submitBtn = document.getElementById('btn-submit-register');

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="ph-bold ph-spinner ph-spin"></i> Mendaftarkan akun...`;

            try {
                const res = await fetch('/api/ntlink-auth?action=register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fullName, email, password })
                });

                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.error || 'Pendaftaran gagal');
                }

                currentUser = data;
                localStorage.setItem('ntlink_user_session', JSON.stringify(data));
                showToast('Akun NTLink berhasil dibuat!', 'success');
                renderDashboard(data);
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="ph-bold ph-user-plus"></i> Buat Akun NTLink Terpadu`;
            }
        });
    }
}

// Render Dashboard
function renderDashboard(user) {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
    document.getElementById('header-logout-btn').classList.remove('hidden');

    const nameEl = document.getElementById('user-display-name');
    const emailEl = document.getElementById('user-display-email');
    const badgeEl = document.getElementById('user-tier-badge');
    const upgradeBtn = document.getElementById('btn-upgrade-pro');

    if (nameEl) nameEl.textContent = user.fullName || user.email.split('@')[0];
    if (emailEl) emailEl.textContent = user.email;

    const isPro = user.tier === 'pro';
    if (badgeEl) {
        badgeEl.className = isPro ? 'badge-pro' : 'badge-free';
        badgeEl.innerHTML = isPro ? `<i class="ph-fill ph-crown"></i> NT PRO` : 'FREE';
    }

    if (upgradeBtn) {
        upgradeBtn.style.display = isPro ? 'none' : 'inline-flex';
    }

    renderTelegramBox(user);
}

function renderAuth() {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
    document.getElementById('header-logout-btn').classList.add('hidden');
}

function renderTelegramBox(user) {
    const box = document.getElementById('telegram-box-content');
    if (!box) return;

    if (user.telegramChatId) {
        box.innerHTML = `
            <div class="flex items-center justify-between">
                <div>
                    <span style="color: var(--success); font-weight: 600;">● Terhubung</span>
                    <span class="text-xs text-muted ml-2">ID Chat: ${user.telegramChatId}</span>
                </div>
            </div>
        `;
    } else {
        box.innerHTML = `
            <div>
                <p class="text-xs text-muted">Tautkan Telegram untuk mencatat otomatis dari chat:</p>
                <div style="background: #000000; border: 1px solid var(--border); padding: 6px 10px; border-radius: var(--radius-sm); margin-top: 6px; font-family: monospace; display: flex; justify-content: space-between; align-items: center;">
                    <code>/link ${user.telegramLinkCode || 'PAIR12'}</code>
                    <span class="text-xs text-muted" style="cursor: pointer;" onclick="navigator.clipboard.writeText('/link ${user.telegramLinkCode || 'PAIR12'}'); alert('Disalin!')">Salin</span>
                </div>
            </div>
        `;
    }
}

// App Launcher with Single Sign-On Token Handoff
window.launchApp = function (appName) {
    if (!currentUser || !currentUser.token) {
        showToast('Sesi Anda berakhir, silakan login ulang', 'warning');
        return;
    }

    const token = encodeURIComponent(currentUser.token);

    if (appName === 'ntwallet') {
        window.location.href = `../dompetku/?sso_token=${token}`;
    } else if (appName === 'ntgold') {
        window.location.href = `../goldapp/?sso_token=${token}`;
    } else if (appName === 'ntpos') {
        window.location.href = `../pos/`;
    }
};

window.handleUpgradePro = async function () {
    if (!currentUser) return;
    try {
        const res = await fetch('/api/sync-ecosystem-tier', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentUser.email, targetTier: 'pro' })
        });
        const data = await res.json();
        if (data.success) {
            currentUser.tier = 'pro';
            localStorage.setItem('ntlink_user_session', JSON.stringify(currentUser));
            showToast('Selamat! Status NT PRO aktif di seluruh ekosistem!', 'success');
            renderDashboard(currentUser);
        }
    } catch (e) {
        showToast('Gagal memproses upgrade PRO', 'error');
    }
};

window.handleLogout = function () {
    localStorage.removeItem('ntlink_user_session');
    currentUser = null;
    showToast('Anda telah keluar dari NTLink', 'info');
    renderAuth();
};

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toast-message');
    if (!toast || !msgEl) return;

    msgEl.textContent = message;
    toast.className = 'toast show';
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}
