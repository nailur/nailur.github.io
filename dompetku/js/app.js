import { checkSession, login, register, logout, updateProfile, isPro, toggleUserTier } from './auth.js';
import { getState, setState, subscribe, updateFilters } from './state.js';
import { loadWallets, createWallet, updateWallet, adjustWalletBalance, deleteWallet, WALLET_TYPES, FREE_TIER_MAX_WALLETS } from './wallets.js';
import { loadCategories, createCategory, updateCategory, deleteCategory, DEFAULT_CATEGORY_ICONS, CATEGORY_COLORS } from './categories.js';
import { loadTransactions, createTransaction, deleteTransaction } from './transactions.js';
import { loadBudgets, setBudget, deleteBudget, computeBudgetProgress, FREE_TIER_MAX_BUDGETS } from './budgets.js';
import { renderDashboard } from './dashboard.js';
import { renderReports, handleExportExcel } from './reports.js';
import { renderTelegramSettings, regenerateTelegramCode, disconnectTelegram } from './telegram.js';
import { formatRupiah, formatDate, parseRupiahInput, showToast, escapeHtml } from './utils.js';

// ==========================================
// APP INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    setupEventListeners();
    setupModals();

    const user = await checkSession();
    if (user) {
        showAppScreen();
        await loadInitialData();
    } else {
        showAuthScreen();
    }

    registerServiceWorker();
});

async function loadInitialData() {
    showLoading(true);
    await Promise.all([
        loadWallets(),
        loadCategories(),
        loadTransactions(),
        loadBudgets()
    ]);
    showLoading(false);
    updateUserTierBadges();
    switchView('dashboard');
}

function updateUserTierBadges() {
    const profile = getState().profile;
    const proStatus = isPro();
    
    // Sidebar & Topbar Badges
    const badgeSidebar = document.getElementById('user-tier-badge-sidebar');
    if (badgeSidebar) {
        badgeSidebar.innerHTML = proStatus 
            ? `<span class="badge-pro-pill"><i class="ph-fill ph-crown"></i> PRO</span>` 
            : `<span class="badge-free-pill">FREE</span>`;
    }

    const badgeTopbar = document.getElementById('user-tier-badge-topbar');
    if (badgeTopbar) {
        badgeTopbar.innerHTML = proStatus 
            ? `<span class="badge-pro-pill"><i class="ph-fill ph-crown"></i> PRO</span>` 
            : `<span class="badge-free-pill">FREE</span>`;
    }

    // Upgrade Banner & Buttons
    const sidebarBanner = document.getElementById('sidebar-upgrade-banner');
    if (sidebarBanner) {
        sidebarBanner.style.display = proStatus ? 'none' : 'block';
    }

    const mobileUpgradeBtn = document.getElementById('mobile-upgrade-btn');
    if (mobileUpgradeBtn) {
        mobileUpgradeBtn.style.display = proStatus ? 'none' : 'inline-flex';
    }
}

// ==========================================
// THEME & VIEW MANAGEMENT
// ==========================================
function initTheme() {
    const saved = localStorage.getItem('ntwallet_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeToggleIcon(saved);
}

window.toggleTheme = function () {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ntwallet_theme', next);
    updateThemeToggleIcon(next);
};

function updateThemeToggleIcon(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
        btn.innerHTML = theme === 'dark' ? '<i class="ph-bold ph-sun"></i>' : '<i class="ph-bold ph-moon"></i>';
    }
}

export function switchView(viewName) {
    setState('activeTab', viewName);

    // Hide all view panels
    document.querySelectorAll('.view-panel').forEach(el => el.classList.remove('active'));

    // Show target view panel
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
        target.classList.add('active');
    }

    // Update bottom nav & sidebar active class
    document.querySelectorAll('.nav-item, .sidebar-link').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-view') === viewName);
    });

    updateUserTierBadges();

    // Render corresponding view data
    if (viewName === 'dashboard') {
        renderDashboard();
    } else if (viewName === 'transactions') {
        renderTransactionsView();
    } else if (viewName === 'wallets') {
        renderWalletsView();
    } else if (viewName === 'budgets') {
        renderBudgetsView();
    } else if (viewName === 'categories') {
        renderCategoriesView();
    } else if (viewName === 'reports') {
        renderReports();
    } else if (viewName === 'settings') {
        renderTelegramSettings();
        renderProfileSettings();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.switchView = switchView;

function showAuthScreen() {
    document.getElementById('auth-container')?.classList.remove('hidden');
    document.getElementById('app-container')?.classList.add('hidden');
}

function showAppScreen() {
    document.getElementById('auth-container')?.classList.add('hidden');
    document.getElementById('app-container')?.classList.remove('hidden');
}

function showLoading(isLoading) {
    const spinner = document.getElementById('global-loader');
    if (spinner) {
        spinner.classList.toggle('active', isLoading);
    }
}

// ==========================================
// TRANSACTIONS VIEW RENDERER
// ==========================================
function renderTransactionsView() {
    const { transactions, wallets, categories, filters } = getState();

    // Populate filter dropdowns
    const walletSelect = document.getElementById('tx-filter-wallet');
    if (walletSelect) {
        walletSelect.innerHTML = `<option value="all">Semua Dompet</option>` +
            wallets.map(w => `<option value="${w.id}" ${filters.walletId === w.id ? 'selected' : ''}>${escapeHtml(w.name)}</option>`).join('');
    }

    const categorySelect = document.getElementById('tx-filter-category');
    if (categorySelect) {
        categorySelect.innerHTML = `<option value="all">Semua Kategori</option>` +
            categories.map(c => `<option value="${c.id}" ${filters.categoryId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
    }

    const container = document.getElementById('transactions-list-container');
    if (!container) return;

    if (!transactions || transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="ph-bold ph-receipt text-muted" style="font-size: 2.75rem;"></i>
                <p class="font-medium mt-2">Belum ada riwayat transaksi.</p>
                <button class="btn btn-primary btn-sm mt-3" onclick="window.openTransactionModal('expense')">
                    <i class="ph-bold ph-plus"></i> Tambah Transaksi
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="transactions-full-list">
            ${transactions.map(t => {
                const isExp = t.type === 'expense';
                const isInc = t.type === 'income';
                const icon = t.category?.icon || (isExp ? 'ph-arrow-up-right' : (isInc ? 'ph-arrow-down-left' : 'ph-arrows-left-right'));
                const color = t.category?.color || (isExp ? '#F43F5E' : (isInc ? '#10B981' : '#38BDF8'));
                const sign = isExp ? '-' : (isInc ? '+' : '');
                const amountClass = isExp ? 'text-danger' : (isInc ? 'text-success' : 'text-primary');

                return `
                    <div class="transaction-card-item">
                        <div class="tx-left">
                            <div class="tx-icon-box" style="background: ${color}18; color: ${color};">
                                <i class="ph-bold ${escapeHtml(icon)}"></i>
                            </div>
                            <div class="tx-details">
                                <div class="tx-title">${escapeHtml(t.description)}</div>
                                <div class="tx-meta">
                                    <span class="badge badge-subtle">${escapeHtml(t.category?.name || (t.type === 'transfer' ? 'Transfer' : 'Umum'))}</span>
                                    <span>• ${escapeHtml(t.wallet?.name || 'Dompet')}${t.to_wallet ? ' ➔ ' + escapeHtml(t.to_wallet.name) : ''}</span>
                                    <span>• ${formatDate(t.transaction_date, 'short')}</span>
                                    ${t.source === 'telegram' ? '<span class="badge-source-bot"><i class="ph-bold ph-telegram-logo"></i> Bot</span>' : ''}
                                </div>
                                ${t.notes ? `<div class="tx-notes text-xs text-muted mt-1">${escapeHtml(t.notes)}</div>` : ''}
                            </div>
                        </div>
                        <div class="tx-right">
                            <div class="tx-amount ${amountClass}">
                                ${sign}${formatRupiah(t.amount)}
                            </div>
                            <button class="btn-icon text-muted hover-danger" onclick="window.handleDeleteTransaction('${t.id}')" title="Hapus">
                                <i class="ph-bold ph-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ==========================================
// WALLETS VIEW RENDERER
// ==========================================
function renderWalletsView() {
    const { wallets } = getState();
    const container = document.getElementById('wallets-grid-container');
    if (!container) return;

    const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance || 0), 0);
    const totalEl = document.getElementById('wallets-total-balance');
    if (totalEl) totalEl.textContent = formatRupiah(totalBalance);

    const proStatus = isPro();
    const limitInfoEl = document.getElementById('wallets-limit-info');
    if (limitInfoEl) {
        limitInfoEl.innerHTML = proStatus 
            ? `<span class="badge-pro-pill"><i class="ph-fill ph-crown"></i> Unlimited Wallets</span>` 
            : `<span class="text-xs text-muted">Free Tier: <strong>${wallets.length}/${FREE_TIER_MAX_WALLETS}</strong> Dompet</span>`;
    }

    container.innerHTML = wallets.map(w => `
        <div class="wallet-card-full glass-panel" style="border-top: 3px solid ${escapeHtml(w.color || '#10B981')}">
            <div class="wallet-card-header">
                <div class="wallet-icon-box-lg" style="background: ${escapeHtml(w.color || '#10B981')}18; color: ${escapeHtml(w.color || '#10B981')}">
                    <i class="ph-bold ${escapeHtml(w.icon || 'ph-wallet')}"></i>
                </div>
                <div class="flex items-center gap-1">
                    <button class="btn-icon" onclick="window.openEditWalletModal('${w.id}')" title="Edit Dompet">
                        <i class="ph-bold ph-pencil-simple"></i>
                    </button>
                    <button class="btn-icon hover-danger" onclick="window.handleDeleteWallet('${w.id}')" title="Hapus Dompet">
                        <i class="ph-bold ph-trash"></i>
                    </button>
                </div>
            </div>
            <div class="wallet-card-body">
                <div class="wallet-type-badge">${escapeHtml(w.type.toUpperCase())} ${w.is_default ? '<span class="badge-default">Utama</span>' : ''}</div>
                <div class="wallet-title">${escapeHtml(w.name)}</div>
                <div class="wallet-amount-lg">${formatRupiah(w.balance)}</div>
            </div>
            <div class="wallet-card-footer">
                <button class="btn btn-sm btn-outline w-full" onclick="window.openAdjustBalanceModal('${w.id}')">
                    <i class="ph-bold ph-arrows-clockwise"></i> Sesuaikan Saldo
                </button>
            </div>
        </div>
    `).join('');
}

// ==========================================
// BUDGETS VIEW RENDERER
// ==========================================
function renderBudgetsView() {
    const { budgets, transactions } = getState();
    const now = new Date();
    const progressList = computeBudgetProgress(budgets, transactions, now.getMonth() + 1, now.getFullYear());

    const container = document.getElementById('budgets-list-container');
    if (!container) return;

    const proStatus = isPro();
    const limitInfoEl = document.getElementById('budgets-limit-info');
    if (limitInfoEl) {
        limitInfoEl.innerHTML = proStatus 
            ? `<span class="badge-pro-pill"><i class="ph-fill ph-crown"></i> Unlimited Budgets</span>` 
            : `<span class="text-xs text-muted">Free Tier: <strong>${budgets.length}/${FREE_TIER_MAX_BUDGETS}</strong> Anggaran</span>`;
    }

    if (!progressList || progressList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="ph-bold ph-chart-pie-slice text-muted" style="font-size: 2.75rem;"></i>
                <p class="font-medium mt-2">Belum ada target anggaran bulanan.</p>
                <p class="text-xs text-muted">Atur batas anggaran per kategori pengeluaran Anda.</p>
                <button class="btn btn-primary btn-sm mt-3" onclick="window.openBudgetModal()">
                    <i class="ph-bold ph-plus"></i> Atur Anggaran
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = progressList.map(b => {
        const cat = b.category || { name: 'Kategori', color: '#6366F1', icon: 'ph-tag' };
        const statusClass = b.isOver ? 'text-danger font-semibold' : 'text-muted';

        return `
            <div class="budget-card glass-panel">
                <div class="budget-card-header">
                    <div class="flex items-center gap-3">
                        <div class="category-icon-sm" style="background: ${cat.color}18; color: ${cat.color}">
                            <i class="ph-bold ${escapeHtml(cat.icon)}"></i>
                        </div>
                        <div>
                            <div class="font-semibold text-sm">${escapeHtml(cat.name)}</div>
                            <div class="text-xs text-muted">Bulan Ini (${now.toLocaleString('id-ID', { month: 'short', year: 'numeric' })})</div>
                        </div>
                    </div>
                    <button class="btn-icon hover-danger" onclick="window.handleDeleteBudget('${b.id}')" title="Hapus Anggaran">
                        <i class="ph-bold ph-trash"></i>
                    </button>
                </div>
                <div class="budget-amounts mt-3">
                    <div>
                        <div class="text-xs text-muted">Terpakai</div>
                        <div class="font-bold ${b.isOver ? 'text-danger' : ''}">${formatRupiah(b.spent)}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-xs text-muted">Batas Anggaran</div>
                        <div class="font-bold">${formatRupiah(b.amount)}</div>
                    </div>
                </div>
                <div class="budget-progress-bar-wrapper mt-2">
                    <div class="budget-progress-bar" style="width: ${b.percentage}%; background: ${b.isOver ? '#F43F5E' : cat.color}"></div>
                </div>
                <div class="budget-card-footer mt-2">
                    <span class="text-xs ${statusClass}">
                        ${b.isOver ? `⚠️ Melebihi ${formatRupiah(Math.abs(b.remaining))}` : `Sisa ${formatRupiah(b.remaining)} (${(100 - b.percentage).toFixed(0)}%)`}
                    </span>
                    <span class="text-xs font-semibold">${b.rawPercentage.toFixed(1)}%</span>
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================
// CATEGORIES VIEW RENDERER
// ==========================================
function renderCategoriesView() {
    const { categories } = getState();
    const expenseContainer = document.getElementById('categories-expense-list');
    const incomeContainer = document.getElementById('categories-income-list');

    const expenseList = categories.filter(c => c.type === 'expense');
    const incomeList = categories.filter(c => c.type === 'income');

    if (expenseContainer) {
        expenseContainer.innerHTML = expenseList.map(c => renderCategoryCard(c)).join('');
    }

    if (incomeContainer) {
        incomeContainer.innerHTML = incomeList.map(c => renderCategoryCard(c)).join('');
    }
}

function renderCategoryCard(cat) {
    return `
        <div class="category-item-card glass-panel flex items-center justify-between p-3" style="padding: 0.75rem 1rem;">
            <div class="flex items-center gap-3">
                <div class="category-icon-sm" style="background: ${escapeHtml(cat.color)}18; color: ${escapeHtml(cat.color)}">
                    <i class="ph-bold ${escapeHtml(cat.icon || 'ph-tag')}"></i>
                </div>
                <span class="font-semibold text-sm">${escapeHtml(cat.name)}</span>
            </div>
            <div class="flex items-center gap-1">
                <button class="btn-icon" onclick="window.openEditCategoryModal('${cat.id}')" title="Edit Kategori">
                    <i class="ph-bold ph-pencil-simple"></i>
                </button>
                <button class="btn-icon hover-danger" onclick="window.handleDeleteCategory('${cat.id}')" title="Hapus Kategori">
                    <i class="ph-bold ph-trash"></i>
                </button>
            </div>
        </div>
    `;
}

// ==========================================
// PROFILE & TIER SETTINGS
// ==========================================
function renderProfileSettings() {
    const profile = getState().profile;
    const emailEl = document.getElementById('profile-email-input');
    const nameEl = document.getElementById('profile-name-input');
    const tierBadgeEl = document.getElementById('profile-tier-badge-card');

    if (profile) {
        if (emailEl) emailEl.value = profile.email || '';
        if (nameEl) nameEl.value = profile.full_name || '';
        if (tierBadgeEl) {
            const proStatus = isPro();
            tierBadgeEl.innerHTML = proStatus
                ? `<span class="badge-pro-pill" style="font-size: 0.8rem; padding: 4px 10px;"><i class="ph-fill ph-crown"></i> AKUN PRO AKTIF</span>`
                : `<span class="badge-free-pill" style="font-size: 0.8rem; padding: 4px 10px;">AKUN FREE TIER</span>`;
        }
    }
}

// ==========================================
// UPGRADE TO PRO MODAL
// ==========================================
window.openUpgradeModal = function (title = 'Upgrade ke NTWallet PRO', desc = '') {
    const modalTitleEl = document.getElementById('upgrade-modal-title');
    const modalDescEl = document.getElementById('upgrade-modal-desc');

    if (modalTitleEl) modalTitleEl.textContent = title;
    if (modalDescEl && desc) modalDescEl.textContent = desc;

    openModal('modal-upgrade-pro');
};

// ==========================================
// MODAL MANAGEMENT & EVENT HANDLERS
// ==========================================
function setupModals() {
    // Transaction Modal
    window.openTransactionModal = function (type = 'expense') {
        const { wallets, categories } = getState();
        const form = document.getElementById('form-transaction');
        if (!form) return;

        form.reset();
        document.getElementById('tx-type-input').value = type;
        setTransactionTypeTab(type);

        const walletSelect = document.getElementById('tx-wallet-select');
        const toWalletSelect = document.getElementById('tx-to-wallet-select');
        if (walletSelect) {
            walletSelect.innerHTML = wallets.map(w => `<option value="${w.id}" ${w.is_default ? 'selected' : ''}>${escapeHtml(w.name)} (${formatRupiah(w.balance)})</option>`).join('');
        }
        if (toWalletSelect) {
            toWalletSelect.innerHTML = wallets.map(w => `<option value="${w.id}">${escapeHtml(w.name)} (${formatRupiah(w.balance)})</option>`).join('');
        }

        populateTransactionCategorySelect(type);
        document.getElementById('tx-date-input').value = new Date().toISOString().slice(0, 16);
        openModal('modal-transaction');
    };

    window.populateTransactionCategorySelect = function (type) {
        const { categories } = getState();
        const catSelect = document.getElementById('tx-category-select');
        if (!catSelect) return;

        const filtered = categories.filter(c => c.type === type);
        catSelect.innerHTML = filtered.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    };

    window.setTransactionTypeTab = function (type) {
        document.getElementById('tx-type-input').value = type;
        document.querySelectorAll('.tab-btn-type').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-type') === type);
        });

        const catGroup = document.getElementById('tx-category-group');
        const toWalletGroup = document.getElementById('tx-to-wallet-group');

        if (type === 'transfer') {
            if (catGroup) catGroup.style.display = 'none';
            if (toWalletGroup) toWalletGroup.style.display = 'block';
        } else {
            if (catGroup) catGroup.style.display = 'block';
            if (toWalletGroup) toWalletGroup.style.display = 'none';
            populateTransactionCategorySelect(type);
        }
    };

    // Wallet Modals
    window.openCreateWalletModal = function () {
        const form = document.getElementById('form-wallet');
        if (form) form.reset();
        document.getElementById('wallet-id-input').value = '';
        document.getElementById('wallet-modal-title').textContent = 'Tambah Dompet Baru';
        renderWalletIconPicker('ph-wallet');
        renderWalletColorPicker('#10B981');
        openModal('modal-wallet');
    };

    window.openEditWalletModal = function (id) {
        const wallet = getState().wallets.find(w => w.id === id);
        if (!wallet) return;

        document.getElementById('wallet-id-input').value = wallet.id;
        document.getElementById('wallet-modal-title').textContent = 'Edit Dompet';
        document.getElementById('wallet-name-input').value = wallet.name;
        document.getElementById('wallet-type-select').value = wallet.type;
        document.getElementById('wallet-balance-group').style.display = 'none';
        document.getElementById('wallet-default-check').checked = !!wallet.is_default;

        renderWalletIconPicker(wallet.icon || 'ph-wallet');
        renderWalletColorPicker(wallet.color || '#10B981');
        openModal('modal-wallet');
    };

    window.openAdjustBalanceModal = function (id) {
        const wallet = getState().wallets.find(w => w.id === id);
        if (!wallet) return;

        document.getElementById('adjust-wallet-id').value = wallet.id;
        document.getElementById('adjust-wallet-name').textContent = wallet.name;
        document.getElementById('adjust-current-balance').textContent = formatRupiah(wallet.balance);
        document.getElementById('adjust-new-balance-input').value = '';
        openModal('modal-adjust-balance');
    };

    // Category Modals
    window.openCreateCategoryModal = function (defaultType = 'expense') {
        const form = document.getElementById('form-category');
        if (form) form.reset();
        document.getElementById('category-id-input').value = '';
        document.getElementById('category-modal-title').textContent = 'Tambah Kategori Baru';
        document.getElementById('category-type-select').value = defaultType;
        renderCategoryIconPicker('ph-tag');
        renderCategoryColorPicker('#6366F1');
        openModal('modal-category');
    };

    window.openEditCategoryModal = function (id) {
        const cat = getState().categories.find(c => c.id === id);
        if (!cat) return;

        document.getElementById('category-id-input').value = cat.id;
        document.getElementById('category-modal-title').textContent = 'Edit Kategori';
        document.getElementById('category-name-input').value = cat.name;
        document.getElementById('category-type-select').value = cat.type;
        document.getElementById('category-type-select').disabled = true;

        renderCategoryIconPicker(cat.icon || 'ph-tag');
        renderCategoryColorPicker(cat.color || '#6366F1');
        openModal('modal-category');
    };

    // Budget Modal
    window.openBudgetModal = function () {
        const { categories } = getState();
        const select = document.getElementById('budget-category-select');
        if (select) {
            const expenses = categories.filter(c => c.type === 'expense');
            select.innerHTML = expenses.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
        }
        document.getElementById('budget-amount-input').value = '';
        openModal('modal-budget');
    };
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.classList.add('modal-open');
    }
}

window.closeModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
    }
};

// ==========================================
// ICON & COLOR PICKERS
// ==========================================
function renderWalletIconPicker(selected) {
    const container = document.getElementById('wallet-icon-picker');
    if (!container) return;

    const icons = ['ph-wallet', 'ph-money', 'ph-bank', 'ph-device-mobile', 'ph-credit-card', 'ph-piggy-bank', 'ph-vault', 'ph-safe'];
    container.innerHTML = icons.map(ic => `
        <div class="picker-icon ${ic === selected ? 'selected' : ''}" onclick="window.selectWalletIcon('${ic}', this)">
            <i class="ph-bold ${ic}"></i>
        </div>
    `).join('');
    document.getElementById('wallet-icon-input').value = selected;
}

window.selectWalletIcon = function (icon, el) {
    document.getElementById('wallet-icon-input').value = icon;
    el.parentElement.querySelectorAll('.picker-icon').forEach(i => i.classList.remove('selected'));
    el.classList.add('selected');
};

function renderWalletColorPicker(selected) {
    const container = document.getElementById('wallet-color-picker');
    if (!container) return;

    container.innerHTML = CATEGORY_COLORS.map(c => `
        <div class="picker-color ${c === selected ? 'selected' : ''}" style="background: ${c}" onclick="window.selectWalletColor('${c}', this)"></div>
    `).join('');
    document.getElementById('wallet-color-input').value = selected;
}

window.selectWalletColor = function (color, el) {
    document.getElementById('wallet-color-input').value = color;
    el.parentElement.querySelectorAll('.picker-color').forEach(i => i.classList.remove('selected'));
    el.classList.add('selected');
};

function renderCategoryIconPicker(selected) {
    const container = document.getElementById('category-icon-picker');
    if (!container) return;

    container.innerHTML = DEFAULT_CATEGORY_ICONS.map(item => `
        <div class="picker-icon ${item.icon === selected ? 'selected' : ''}" title="${item.name}" onclick="window.selectCategoryIcon('${item.icon}', this)">
            <i class="ph-bold ${item.icon}"></i>
        </div>
    `).join('');
    document.getElementById('category-icon-input').value = selected;
}

window.selectCategoryIcon = function (icon, el) {
    document.getElementById('category-icon-input').value = icon;
    el.parentElement.querySelectorAll('.picker-icon').forEach(i => i.classList.remove('selected'));
    el.classList.add('selected');
};

function renderCategoryColorPicker(selected) {
    const container = document.getElementById('category-color-picker');
    if (!container) return;

    container.innerHTML = CATEGORY_COLORS.map(c => `
        <div class="picker-color ${c === selected ? 'selected' : ''}" style="background: ${c}" onclick="window.selectCategoryColor('${c}', this)"></div>
    `).join('');
    document.getElementById('category-color-input').value = selected;
}

window.selectCategoryColor = function (color, el) {
    document.getElementById('category-color-input').value = color;
    el.parentElement.querySelectorAll('.picker-color').forEach(i => i.classList.remove('selected'));
    el.classList.add('selected');
};

// ==========================================
// FORM SUBMITS & EVENT LISTENERS
// ==========================================
function setupEventListeners() {
    // Auth Form
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const mode = document.getElementById('auth-mode-input').value;
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            const fullName = document.getElementById('auth-name')?.value || '';

            showLoading(true);
            let ok = false;
            if (mode === 'login') {
                ok = await login(email, password);
            } else {
                ok = await register(email, password, fullName);
            }
            showLoading(false);

            if (ok) {
                showAppScreen();
                await loadInitialData();
            }
        });
    }

    // Toggle Login / Register
    window.setAuthMode = function (mode) {
        document.getElementById('auth-mode-input').value = mode;
        const nameGroup = document.getElementById('auth-name-group');
        const submitBtn = document.getElementById('auth-submit-btn');
        const switchText = document.getElementById('auth-switch-text');

        if (mode === 'register') {
            if (nameGroup) nameGroup.style.display = 'block';
            if (submitBtn) submitBtn.textContent = 'Daftar Akun Baru';
            if (switchText) switchText.innerHTML = `Sudah punya akun? <a href="javascript:void(0)" onclick="window.setAuthMode('login')">Masuk disini</a>`;
        } else {
            if (nameGroup) nameGroup.style.display = 'none';
            if (submitBtn) submitBtn.textContent = 'Masuk ke NTWallet';
            if (switchText) switchText.innerHTML = `Belum punya akun? <a href="javascript:void(0)" onclick="window.setAuthMode('register')">Daftar sekarang</a>`;
        }
    };

    // Transaction Form Submit
    const txForm = document.getElementById('form-transaction');
    if (txForm) {
        txForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const type = document.getElementById('tx-type-input').value;
            const amount = parseRupiahInput(document.getElementById('tx-amount-input').value);
            const description = document.getElementById('tx-desc-input').value;
            const wallet_id = document.getElementById('tx-wallet-select').value;
            const to_wallet_id = document.getElementById('tx-to-wallet-select').value;
            const category_id = document.getElementById('tx-category-select').value;
            const transaction_date = document.getElementById('tx-date-input').value;
            const notes = document.getElementById('tx-notes-input').value;

            showLoading(true);
            const res = await createTransaction({
                type,
                amount,
                description,
                wallet_id,
                to_wallet_id,
                category_id,
                transaction_date,
                notes,
                source: 'web'
            });
            showLoading(false);

            if (res) {
                closeModal('modal-transaction');
                switchView(getState().activeTab);
            }
        });
    }

    // Wallet Form Submit
    const walletForm = document.getElementById('form-wallet');
    if (walletForm) {
        walletForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('wallet-id-input').value;
            const name = document.getElementById('wallet-name-input').value;
            const type = document.getElementById('wallet-type-select').value;
            const balance = parseRupiahInput(document.getElementById('wallet-balance-input').value);
            const icon = document.getElementById('wallet-icon-input').value;
            const color = document.getElementById('wallet-color-input').value;
            const is_default = document.getElementById('wallet-default-check').checked;

            showLoading(true);
            let res;
            if (id) {
                res = await updateWallet(id, { name, type, color, icon, is_default });
            } else {
                res = await createWallet({ name, type, balance, color, icon, is_default });
            }
            showLoading(false);

            if (res) {
                closeModal('modal-wallet');
                switchView(getState().activeTab);
            }
        });
    }

    // Adjust Balance Submit
    const adjustForm = document.getElementById('form-adjust-balance');
    if (adjustForm) {
        adjustForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const walletId = document.getElementById('adjust-wallet-id').value;
            const newBalance = parseRupiahInput(document.getElementById('adjust-new-balance-input').value);
            const reason = document.getElementById('adjust-reason-input').value || 'Penyesuaian Saldo';

            showLoading(true);
            const ok = await adjustWalletBalance(walletId, newBalance, reason);
            showLoading(false);

            if (ok) {
                closeModal('modal-adjust-balance');
                switchView(getState().activeTab);
            }
        });
    }

    // Category Form Submit
    const categoryForm = document.getElementById('form-category');
    if (categoryForm) {
        categoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('category-id-input').value;
            const name = document.getElementById('category-name-input').value;
            const type = document.getElementById('category-type-select').value;
            const icon = document.getElementById('category-icon-input').value;
            const color = document.getElementById('category-color-input').value;

            showLoading(true);
            let res;
            if (id) {
                res = await updateCategory(id, { name, icon, color });
            } else {
                res = await createCategory({ name, type, icon, color });
            }
            showLoading(false);

            if (res) {
                closeModal('modal-category');
                switchView(getState().activeTab);
            }
        });
    }

    // Budget Form Submit
    const budgetForm = document.getElementById('form-budget');
    if (budgetForm) {
        budgetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const category_id = document.getElementById('budget-category-select').value;
            const amount = parseRupiahInput(document.getElementById('budget-amount-input').value);

            showLoading(true);
            const res = await setBudget({ category_id, amount });
            showLoading(false);

            if (res) {
                closeModal('modal-budget');
                renderBudgetsView();
            }
        });
    }

    // Profile Update Form
    const profileForm = document.getElementById('form-profile');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const full_name = document.getElementById('profile-name-input').value;

            showLoading(true);
            await updateProfile({ full_name });
            showLoading(false);
        });
    }

    // Filters for Transactions
    const filterType = document.getElementById('tx-filter-type');
    if (filterType) {
        filterType.addEventListener('change', async (e) => {
            updateFilters({ type: e.target.value });
            await loadTransactions();
            renderTransactionsView();
        });
    }

    const filterWallet = document.getElementById('tx-filter-wallet');
    if (filterWallet) {
        filterWallet.addEventListener('change', async (e) => {
            updateFilters({ walletId: e.target.value });
            await loadTransactions();
            renderTransactionsView();
        });
    }

    const filterCategory = document.getElementById('tx-filter-category');
    if (filterCategory) {
        filterCategory.addEventListener('change', async (e) => {
            updateFilters({ categoryId: e.target.value });
            await loadTransactions();
            renderTransactionsView();
        });
    }

    const searchInput = document.getElementById('tx-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', async (e) => {
            updateFilters({ searchQuery: e.target.value });
            await loadTransactions();
            renderTransactionsView();
        });
    }

    // Rupiah input live formatters
    document.querySelectorAll('.input-rupiah').forEach(input => {
        input.addEventListener('input', (e) => {
            const raw = parseRupiahInput(e.target.value);
            e.target.value = raw > 0 ? formatRupiah(raw, false) : '';
        });
    });

    // Global Action Helpers
    window.handleLogout = logout;
    window.handleExportExcel = handleExportExcel;
    window.handleToggleTier = async () => {
        showLoading(true);
        const ok = await toggleUserTier();
        showLoading(false);
        if (ok) {
            updateUserTierBadges();
            switchView(getState().activeTab);
            closeModal('modal-upgrade-pro');
        }
    };

    window.handleDeleteTransaction = async (id) => {
        if (confirm('Hapus transaksi ini? Saldo dompet akan disesuaikan kembali.')) {
            showLoading(true);
            await deleteTransaction(id);
            showLoading(false);
            switchView(getState().activeTab);
        }
    };
    window.handleDeleteWallet = async (id) => {
        if (confirm('Hapus dompet ini?')) {
            showLoading(true);
            await deleteWallet(id);
            showLoading(false);
            renderWalletsView();
        }
    };
    window.handleDeleteCategory = async (id) => {
        if (confirm('Hapus kategori ini?')) {
            showLoading(true);
            await deleteCategory(id);
            showLoading(false);
            renderCategoriesView();
        }
    };
    window.handleDeleteBudget = async (id) => {
        if (confirm('Hapus anggaran ini?')) {
            showLoading(true);
            await deleteBudget(id);
            showLoading(false);
            renderBudgetsView();
        }
    };

    window.copyLinkCommand = () => {
        const text = document.getElementById('telegram-link-command')?.innerText;
        if (text) {
            navigator.clipboard.writeText(text);
            showToast('Perintah pairing disalin!', 'success');
        }
    };
    window.regenerateTelegramCode = regenerateTelegramCode;
    window.handleDisconnectTelegram = disconnectTelegram;
}

// ==========================================
// PWA SERVICE WORKER
// ==========================================
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('NTWallet Service Worker Registered'))
            .catch(err => console.error('SW error:', err));
    }
}
