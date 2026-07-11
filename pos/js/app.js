/* global XLSX */
import { supabase } from './supabase.js';
import { checkSession, login, logout, getCurrentUser, getCurrentProfile } from './auth.js';
import { connectPrinter } from './printer.js';
import { startAttendanceClock, checkAttendanceStatus } from './attendance.js';
import { syncOfflineTransactions, initDB } from './offline.js';
import { products, loadProducts, renderProducts, handleSaveProduct, editProduct, deleteProduct, showAllProducts } from './products.js';
import { cart, addToCart, updateQty, emptyCart, renderCart, calculateChange, openCheckoutModal, finalizeCheckout, printReceipt, printReceiptRawBT } from './cart.js';
import { loadHistory, exportToExcel, changeHistoryPage, viewTransactionDetails } from './history.js';
import { 
    initManagement, loadBranches, loadOutlets, loadUsers, 
    handleAddBranch, editBranch, deleteBranch, 
    handleAddOutlet, editOutlet, deleteOutlet, 
    handleAddUser, editUser, deleteUser 
} from './management.js';
import { 
    branchesList, outletsList, posOutletsList, activeOutletId, 
    setPosOutletsList, setActiveOutletId 
} from './state.js';
import { checkActiveShift, handleOpenShift, handleCloseShift } from './shift.js';
import { loadInventory, handleSaveInventory, loadStockPostings } from './inventory.js';
import { loadExpenses, loadExpenseMaster, handleSaveExpense, handleSaveExpenseMaster, openAddExpenseMaster } from './expenses.js';
import { loadDeposits, handleSaveDeposit } from './deposits.js';
import { loadShifts, handleSaveShift, openShiftModal } from './shift-master.js';

window.loadInventoryForManagement = function() { loadInventory(); loadStockPostings(); };
window.loadExpensesForManagement = loadExpenses;
window.loadDepositsForManagement = loadDeposits;
window.loadShifts = loadShifts;

window.getCurrentProfile = getCurrentProfile;
window.getCurrentUser = getCurrentUser;
window.supabase = supabase;
window.showToast = showToast;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.showAllProducts = showAllProducts;
window.addToCart = addToCart;
window.updateQty = updateQty;
window.emptyCart = emptyCart;
window.openCheckoutModal = openCheckoutModal;
window.finalizeCheckout = finalizeCheckout;
window.printReceipt = printReceipt;
window.printReceiptRawBT = printReceiptRawBT;
window.calculateChange = calculateChange;
window.loadHistory = loadHistory;
window.exportToExcel = exportToExcel;
window.changeHistoryPage = changeHistoryPage;
window.viewTransactionDetails = viewTransactionDetails;
window.initManagement = initManagement;
window.loadBranches = loadBranches;
window.loadOutlets = loadOutlets;
window.loadUsers = loadUsers;
window.handleAddBranch = handleAddBranch;
window.editBranch = editBranch;
window.deleteBranch = deleteBranch;
window.handleAddOutlet = handleAddOutlet;
window.editOutlet = editOutlet;
window.deleteOutlet = deleteOutlet;
window.handleAddUser = handleAddUser;
window.editUser = editUser;
window.deleteUser = deleteUser;

Object.defineProperty(window, 'branchesList', { get: () => branchesList });
Object.defineProperty(window, 'posOutletsList', { get: () => posOutletsList });
Object.defineProperty(window, 'outletsList', { get: () => outletsList });
Object.defineProperty(window, 'activeOutletId', { get: () => activeOutletId });

// DOM Elements
const loginView = document.getElementById('login-view');
const superadminView = document.getElementById('superadmin-view');
const posView = document.getElementById('pos-view');

export function getLocalToday() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().split('T')[0];
}

// Toasts
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    if (type === 'error') toast.style.background = 'var(--danger)';
    if (type === 'success') toast.style.background = 'var(--success)';
    
    toast.innerHTML = `
        <i class="ph-fill ph-${type === 'success' ? 'check-circle' : type === 'error' ? 'warning-circle' : 'info'}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Debounce Utility
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// HTML Escape (XSS Protection)
export function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;

// Global State
// products state moved to products.js
// cart state moved to cart.js
// State variables moved to state.jsexternal scripts (e.g. dashboard.js)
Object.defineProperty(window, 'products', { get: () => products });

// History pagination state moved to history.js

// Products variables moved to products.js

// Initialize
async function init() {
    initDB(); // Pre-warm the offline database to prevent race conditions during offline transactions
    
    supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
            document.getElementById('login-view').classList.add('hidden');
            document.getElementById('login-view').classList.remove('active');
            document.getElementById('forgot-password-view').classList.add('hidden');
            document.getElementById('superadmin-view').classList.add('hidden');
            document.getElementById('pos-view').classList.add('hidden');
            document.getElementById('reset-password-view').classList.remove('hidden');
        }
    });

    const sessionData = await checkSession();
    if (sessionData) {
        routeUser(sessionData.profile);
    } else {
        showView('login');
    }
    setupEventListeners();
}

function showView(viewName) {
    loginView.classList.add('hidden');
    superadminView.classList.add('hidden');
    posView.classList.add('hidden');
    
    if (viewName === 'login') {
        loginView.classList.remove('hidden');
    } else if (viewName === 'superadmin') {
        superadminView.classList.remove('hidden');
    } else if (viewName === 'pos') {
        posView.classList.remove('hidden');
    }
}

async function routeUser(profile) {
    if (!profile) {
        showToast('Profil tidak ditemukan', 'error');
        logout();
        return;
    }
    
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
    
    if (profile.role === 'superadmin' || profile.role === 'owner') {
        showView('pos');
        await initPosMultiOutlet(profile);
    } else if (profile.role === 'kepala_cabang') {
        showView('pos');
        await initPosMultiOutlet(profile);
    } else if (profile.role === 'kepala_toko' || profile.role === 'kasir') {
        showView('pos');
        setActiveOutletId(profile.outlet_id);
        document.getElementById('pos-outlet-name').textContent = profile.outlets?.name || 'Toko';
        document.getElementById('mobile-pos-outlet-name').textContent = profile.outlets?.name || 'Toko';
        if (profile.role === 'kepala_toko') {
            document.getElementById('btn-add-product').classList.remove('hidden');
        } else {
            document.getElementById('btn-add-product').classList.add('hidden');
        }
        initPos();
    } else {
        showToast('Role tidak valid', 'error');
        logout();
    }
    
    // Tampilkan tombol manajemen untuk role manajerial
    if (['superadmin', 'owner', 'kepala_cabang', 'kepala_toko'].includes(profile.role)) {
        const btnMgmt = document.getElementById('btn-management');
        if (btnMgmt) btnMgmt.classList.remove('hidden');
    } else {
        const btnMgmt = document.getElementById('btn-management');
        if (btnMgmt) btnMgmt.classList.add('hidden');
    }
    
    // Sembunyikan tab POS tertentu untuk kasir
    const posStockBtn = document.querySelector('.pos-nav-btn[data-target="stock-tab-content"]');
    const posExpensesBtn = document.querySelector('.pos-nav-btn[data-target="expenses-tab-content"]');
    const posDepositsBtn = document.querySelector('.pos-nav-btn[data-target="deposits-tab-content"]');
    if (profile.role === 'kasir') {
        if(posStockBtn) posStockBtn.classList.add('hidden');
        if(posExpensesBtn) posExpensesBtn.classList.add('hidden');
        if(posDepositsBtn) posDepositsBtn.classList.add('hidden');
    } else {
        if(posStockBtn) posStockBtn.classList.remove('hidden');
        if(posExpensesBtn) posExpensesBtn.classList.remove('hidden');
        if(posDepositsBtn) posDepositsBtn.classList.remove('hidden');
    }

    // Absensi selalu tampil untuk semua role yang masuk POS view
    document.getElementById('nav-attendance').classList.remove('hidden');
}

async function initPosMultiOutlet(profile) {
    document.getElementById('btn-add-product').classList.remove('hidden');
    
    // Load accessible outlets
    let query = supabase.from('outlets').select('id, name, branch_id, address, phone, tax_rate_percent').order('name');
    if (profile.role === 'kepala_cabang') {
        query = query.eq('branch_id', profile.branch_id);
    }
    const { data } = await query;
    setPosOutletsList(data || []);
    // RESOLVE ACTIVE OUTLET ID FIRST
    const savedOutletId = localStorage.getItem('pos_active_outlet_id');
    if (savedOutletId && posOutletsList.find(o => o.id === savedOutletId)) {
        setActiveOutletId(savedOutletId);
    } else if (posOutletsList.length > 0) {
        setActiveOutletId(posOutletsList[0].id);
        localStorage.setItem('pos_active_outlet_id', activeOutletId);
    }

    const nameLabel = document.getElementById('pos-outlet-name');
    const mobileNameLabel = document.getElementById('mobile-pos-outlet-name');
    const selector = document.getElementById('active-outlet-selector');
    const mobileSelector = document.getElementById('mobile-active-outlet-selector');
    const opSelector = document.getElementById('op-active-outlet-selector');
    
    if (posOutletsList.length > 1) {
        nameLabel.classList.add('hidden');
        if(mobileNameLabel) mobileNameLabel.classList.add('hidden'); // Also hide mobile label if using dropdown
        selector.classList.remove('hidden');
        if(mobileSelector) mobileSelector.classList.remove('hidden');
        if(opSelector) opSelector.classList.remove('hidden');
        
        const optionsHtml = posOutletsList.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
        selector.innerHTML = optionsHtml;
        if(mobileSelector) mobileSelector.innerHTML = optionsHtml;
        if(opSelector) opSelector.innerHTML = optionsHtml;
        
        selector.value = activeOutletId;
        if(mobileSelector) mobileSelector.value = activeOutletId;
        if(opSelector) opSelector.value = activeOutletId;
        
        const handleChange = (e) => {
            setActiveOutletId(e.target.value);
            selector.value = activeOutletId;
            if(mobileSelector) mobileSelector.value = activeOutletId;
            if(opSelector) opSelector.value = activeOutletId;
            localStorage.setItem('pos_active_outlet_id', activeOutletId);
            generateOrderId();
            checkAttendanceStatus();
            checkActiveShift();
            loadProducts();
            loadHistory();
            if(window.loadDashboard) window.loadDashboard();
            
            // Reload management data if they are bound
            if (window.loadInventoryForManagement) window.loadInventoryForManagement();
            if (window.loadExpensesForManagement) window.loadExpensesForManagement();
            if (window.loadDepositsForManagement) window.loadDepositsForManagement();
            if (window.loadShifts) window.loadShifts();
        };
        
        // Guard: mencegah listener bertumpuk saat re-login tanpa reload
        if (!selector._outletChangeAttached) {
            selector.addEventListener('change', handleChange);
            selector._outletChangeAttached = true;
        }
        if (mobileSelector && !mobileSelector._outletChangeAttached) {
            mobileSelector.addEventListener('change', handleChange);
            mobileSelector._outletChangeAttached = true;
        }

        if (opSelector && !opSelector._outletChangeAttached) {
            opSelector.addEventListener('change', handleChange);
            opSelector._outletChangeAttached = true;
        }
    } else {
        const outlet = posOutletsList.find(o => o.id === activeOutletId);
        if (outlet) {
            nameLabel.textContent = outlet.name;
            if(mobileNameLabel) mobileNameLabel.textContent = outlet.name;
        } else {
            nameLabel.textContent = 'Belum ada Outlet';
            if(mobileNameLabel) mobileNameLabel.textContent = 'Belum ada Outlet';
        }
        nameLabel.classList.remove('hidden');
        if(mobileNameLabel) mobileNameLabel.classList.remove('hidden');
        selector.classList.add('hidden');
        if(mobileSelector) mobileSelector.classList.add('hidden');
    }
    
    initPos();
}

// ------------------------------
// EVENT LISTENERS SETUP
// ------------------------------
function setupEventListeners() {
    // Toggle Password Visibility
    document.querySelectorAll('.toggle-password').forEach(icon => {
        icon.addEventListener('click', function() {
            const input = this.previousElementSibling;
            if (input.type === 'password') {
                input.type = 'text';
                this.classList.remove('ph-eye');
                this.classList.add('ph-eye-closed');
            } else {
                input.type = 'password';
                this.classList.remove('ph-eye-closed');
                this.classList.add('ph-eye');
            }
        });
    });

    // Forgot Password Flow
    const btnForgot = document.getElementById('btn-forgot-password');
    const btnBackLogin = document.getElementById('btn-back-login');
    const forgotView = document.getElementById('forgot-password-view');
    const loginViewEl = document.getElementById('login-view');
    
    if (btnForgot && forgotView && loginViewEl) {
        btnForgot.addEventListener('click', (e) => {
            e.preventDefault();
            loginViewEl.classList.add('hidden');
            loginViewEl.classList.remove('active');
            forgotView.classList.remove('hidden');
        });
    }
    
    if (btnBackLogin && forgotView && loginViewEl) {
        btnBackLogin.addEventListener('click', (e) => {
            e.preventDefault();
            forgotView.classList.add('hidden');
            loginViewEl.classList.remove('hidden');
            loginViewEl.classList.add('active');
        });
    }

    document.getElementById('forgot-password-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value;
        const btn = document.getElementById('reset-btn');
        btn.disabled = true;
        btn.textContent = 'Mengirim...';
        
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + window.location.pathname,
        });
        
        if (error) {
            showToast('Gagal mengirim link reset: ' + error.message, 'error');
        } else {
            showToast('Link reset password telah dikirim ke email Anda', 'success');
            setTimeout(() => {
                btnBackLogin.click();
            }, 3000);
        }
        btn.disabled = false;
        btn.textContent = 'Kirim Link Reset';
    });

    document.getElementById('reset-password-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('new-password').value;
        const btn = document.getElementById('btn-save-new-password');
        btn.disabled = true;
        btn.textContent = 'Menyimpan...';

        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
            showToast('Gagal mengubah password: ' + error.message, 'error');
            btn.disabled = false;
            btn.textContent = 'Simpan Password Baru';
        } else {
            showToast('Password berhasil diubah, silakan login', 'success');
            document.getElementById('reset-password-view').classList.add('hidden');
            loginViewEl.classList.remove('hidden');
            loginViewEl.classList.add('active');
            // Log out user so they have to login with new password
            await supabase.auth.signOut();
        }
    });

    // Login
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = document.getElementById('login-btn');
        btn.disabled = true;
        btn.innerHTML = '<span>Memuat...</span>';
        
        const sessionData = await login(email, password);
        if (sessionData) routeUser(sessionData.profile);
        
        btn.disabled = false;
        btn.innerHTML = '<span>Masuk</span><i class="ph ph-arrow-right"></i>';
    });

    

    document.getElementById('btn-management').addEventListener('click', () => {
        showView('superadmin');
        const role = getCurrentProfile()?.role;
        document.getElementById('sa-user-info').textContent = role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        initManagement();
    });

    document.getElementById('btn-back-pos').addEventListener('click', () => {
        showView('pos');
        // Pastikan tab kasir terbuka
        document.querySelector('.pos-nav-btn[data-target="pos-tab-content"]')?.click();
    });
    // Logout
    document.querySelectorAll('.btn-logout').forEach(btn => {
        btn.addEventListener('click', () => logout());
    });

    // Modals (General Close Button)
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.currentTarget.getAttribute('data-close');
            document.getElementById(targetId)?.classList.add('hidden');
        });
    });

    // Shift Events
    const btnOpenShiftModal = document.getElementById('btn-open-shift-modal');
    if (btnOpenShiftModal) {
        btnOpenShiftModal.addEventListener('click', () => {
            document.getElementById('modal-open-shift').classList.remove('hidden');
        });
    }

    const btnCloseShift = document.getElementById('btn-close-shift');
    if (btnCloseShift) {
        btnCloseShift.addEventListener('click', () => {
            document.getElementById('modal-close-shift').classList.remove('hidden');
        });
    }

    document.getElementById('form-open-shift')?.addEventListener('submit', handleOpenShift);
    document.getElementById('form-close-shift')?.addEventListener('submit', handleCloseShift);

    // New modules form binding
    document.getElementById('btn-add-inventory')?.addEventListener('click', () => window.editInventory(null));
    document.getElementById('form-inventory')?.addEventListener('submit', handleSaveInventory);

    document.getElementById('btn-add-expense')?.addEventListener('click', () => {
        const form = document.getElementById('form-expense');
        if(form) form.reset();
        if(window.expenseCurrentItems) window.expenseCurrentItems = [];
        if(window.renderExpenseItemsTable) window.renderExpenseItemsTable();
        document.getElementById('expense-id').value = '';
        document.getElementById('modal-expense').classList.remove('hidden');
    });
    document.getElementById('btn-add-expense-item')?.addEventListener('click', () => {
        if(window.addExpenseItem) window.addExpenseItem();
    });
    document.getElementById('form-expense')?.addEventListener('submit', handleSaveExpense);

    document.getElementById('btn-add-expense-master')?.addEventListener('click', openAddExpenseMaster);
    document.getElementById('form-expense-master')?.addEventListener('submit', handleSaveExpenseMaster);

    document.getElementById('btn-add-deposit')?.addEventListener('click', () => {
        if(window.openAddDeposit) window.openAddDeposit();
        else document.getElementById('modal-deposit').classList.remove('hidden');
    });
    document.getElementById('form-deposit')?.addEventListener('submit', handleSaveDeposit);

    document.getElementById('form-shift-master')?.addEventListener('submit', handleSaveShift);

    // Mobile Sidebar Logic
    const btnMobileMenu = document.getElementById('btn-mobile-menu');
    const posSidebar = document.getElementById('pos-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    if (btnMobileMenu && posSidebar && sidebarOverlay) {
        btnMobileMenu.addEventListener('click', () => {
            posSidebar.classList.add('open');
            sidebarOverlay.classList.add('active');
        });

        sidebarOverlay.addEventListener('click', () => {
            posSidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        });

        const sidebarButtons = posSidebar.querySelectorAll('.btn, .pos-nav-btn');
        sidebarButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    posSidebar.classList.remove('open');
                    sidebarOverlay.classList.remove('active');
                }
            });
        });
    }

    // SA Mobile Sidebar Logic
    const btnSaMobileMenu = document.getElementById('btn-sa-mobile-menu');
    const saSidebar = document.getElementById('sa-sidebar');
    const saSidebarOverlay = document.getElementById('sa-sidebar-overlay');

    if (btnSaMobileMenu && saSidebar && saSidebarOverlay) {
        btnSaMobileMenu.addEventListener('click', () => {
            saSidebar.classList.add('open');
            saSidebarOverlay.classList.add('active');
        });

        saSidebarOverlay.addEventListener('click', () => {
            saSidebar.classList.remove('open');
            saSidebarOverlay.classList.remove('active');
        });

        const saTabBtns = saSidebar.querySelectorAll('.tab-btn');
        saTabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    saSidebar.classList.remove('open');
                    saSidebarOverlay.classList.remove('active');
                }
            });
        });
    }

    // Toggle List/Grid View Setup
    const btnToggleLayout = document.getElementById('btn-toggle-layout');
    const productGrid = document.getElementById('product-grid');
    if (btnToggleLayout && productGrid) {
        // Set default to list-view on mobile
        if (window.innerWidth <= 768) {
            productGrid.classList.add('list-view');
            const icon = btnToggleLayout.querySelector('i');
            if(icon) {
                icon.classList.remove('ph-list-dashes');
                icon.classList.add('ph-squares-four');
            }
        }
    }



    // Modal Close
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.currentTarget.getAttribute('data-close');
            document.getElementById(modalId).classList.add('hidden');
        });
    });

    // Tutup modal jika klik di luar area konten (di area overlay yang gelap)
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.add('hidden');
            }
        });
    });

    // Edit Profile Modals
    const openEditProfile = () => {
        const profile = getCurrentProfile();
        document.getElementById('my-name').value = profile?.name || '';
        document.getElementById('my-old-password').value = '';
        document.getElementById('my-password').value = '';
        document.getElementById('modal-edit-profile').classList.remove('hidden');
    };
    document.getElementById('btn-edit-profile-sa')?.addEventListener('click', openEditProfile);
    document.getElementById('btn-edit-profile-op')?.addEventListener('click', openEditProfile);
    document.getElementById('btn-edit-profile-pos')?.addEventListener('click', openEditProfile);
    
    document.getElementById('form-edit-profile')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save-my-profile');
        btn.disabled = true;
        btn.innerHTML = 'Menyimpan...';
        
        const newName = document.getElementById('my-name').value;
        const newPassword = document.getElementById('my-password').value;
        const profile = getCurrentProfile();
        
        try {
            if(newName !== profile.name) {
                const { error } = await supabase.from('profiles').update({ name: newName }).eq('id', profile.id);
                if(error) throw error;
                profile.name = newName; // Update local state directly
                const encodedStr = btoa(encodeURIComponent(JSON.stringify(profile)));
                localStorage.setItem('pos_profile', encodedStr); // Update cache
            }
            if(newPassword) {
                const oldPassword = document.getElementById('my-old-password').value;
                if (!oldPassword) throw new Error("Password lama wajib diisi untuk mengubah password");
                
                // Verifikasi password lama
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("Sesi tidak valid");
                
                const { error: authError } = await supabase.auth.signInWithPassword({
                    email: user.email,
                    password: oldPassword
                });
                
                if (authError) throw new Error("Password lama salah");

                const { error } = await supabase.auth.updateUser({ password: newPassword });
                if(error) throw error;
            }
            showToast('Profil berhasil diperbarui', 'success');
            document.getElementById('modal-edit-profile').classList.add('hidden');
        } catch (err) {
            showToast('Gagal: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Simpan';
        }
    });

    // Main Tabs (Pengaturan & Manajemen)
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const viewId = 'superadmin-view';
            const storageKey = 'management_active_tab';
            
            const prevTab = localStorage.getItem(storageKey);
            if (prevTab === 'analytics-tab' && e.currentTarget.getAttribute('data-target') !== 'analytics-tab') {
                if (window.revenueChartInst) { window.revenueChartInst.destroy(); window.revenueChartInst = null; }
                if (window.productChartInst) { window.productChartInst.destroy(); window.productChartInst = null; }
            }

            const viewContainer = document.getElementById(viewId);
            viewContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            viewContainer.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
            
            e.currentTarget.classList.add('active');
            const targetId = e.currentTarget.getAttribute('data-target');
            document.getElementById(targetId)?.classList.remove('hidden');
            localStorage.setItem(storageKey, targetId);
            
            if (targetId === 'analytics-tab') {
                if (!document.getElementById('script-dashboard')) {
                    const script = document.createElement('script');
                    script.id = 'script-dashboard';
                    script.src = 'js/dashboard.js';
                    script.onload = () => window.loadAnalytics();
                    document.body.appendChild(script);
                } else if (window.loadAnalytics) {
                    window.loadAnalytics();
                }
            }
        });
    });

    // POS Tabs
    document.querySelectorAll('.pos-nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const prevTab = localStorage.getItem('pos_active_tab');
            if (prevTab === 'dashboard-tab-content' && e.currentTarget.getAttribute('data-target') !== 'dashboard-tab-content') {
                if (window.revenueChartInst) { window.revenueChartInst.destroy(); window.revenueChartInst = null; }
                if (window.productChartInst) { window.productChartInst.destroy(); window.productChartInst = null; }
            }

            document.querySelectorAll('.pos-nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.pos-tab-pane').forEach(p => p.classList.add('hidden'));
            e.currentTarget.classList.add('active');
            const targetId = e.currentTarget.getAttribute('data-target');
            const tabEl = document.getElementById(targetId);
            tabEl.classList.remove('hidden');
            
            // Show/Hide Add Product Button
            const btnAdd = document.getElementById('btn-add-product');
            if (btnAdd && !btnAdd.classList.contains('hidden') || getCurrentProfile()?.role === 'kepala_toko' || getCurrentProfile()?.role === 'owner' || getCurrentProfile()?.role === 'kepala_cabang') {
                 btnAdd.style.display = (targetId === 'pos-tab-content') ? 'block' : 'none';
            }
            
            localStorage.setItem('pos_active_tab', targetId);
            
            if(targetId === 'history-tab-content') loadHistory();
            if(targetId === 'attendance-history-tab-content') loadAttendanceHistory();
            if(targetId === 'dashboard-tab-content') {
                if (!document.getElementById('script-dashboard')) {
                    const script = document.createElement('script');
                    script.id = 'script-dashboard';
                    script.src = 'js/dashboard.js';
                    script.onload = () => window.loadDashboard();
                    document.body.appendChild(script);
                } else if (window.loadDashboard) {
                    window.loadDashboard();
                }
            }
        });
    });


    // Sub-Tabs (for Stock & Expenses)
    document.querySelectorAll('.sub-nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const container = e.currentTarget.closest('.pos-tab-pane') || e.currentTarget.closest('.tab-pane');
            if (container) {
                container.querySelectorAll('.sub-nav-btn').forEach(b => b.classList.remove('active'));
                container.querySelectorAll('.subtab-pane').forEach(p => p.classList.add('hidden'));
                
                e.currentTarget.classList.add('active');
                const targetId = e.currentTarget.getAttribute('data-target');
                const tabEl = document.getElementById(targetId);
                if (tabEl) tabEl.classList.remove('hidden');
            }
        });
    });

    // Superadmin Actions
    document.getElementById('btn-add-branch').addEventListener('click', () => {
        document.getElementById('modal-branch-title').textContent = 'Tambah Cabang Baru';
        document.getElementById('form-branch').reset();
        document.getElementById('branch-id').value = '';
        document.getElementById('modal-branch').classList.remove('hidden');
    });

    document.getElementById('btn-add-outlet').addEventListener('click', () => {
        document.getElementById('modal-outlet-title').textContent = 'Tambah Outlet Baru';
        document.getElementById('form-outlet').reset();
        document.getElementById('outlet-id').value = '';
        document.getElementById('outlet-branch').innerHTML = branchesList.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
        document.getElementById('modal-outlet').classList.remove('hidden');
    });

    document.getElementById('btn-add-user').addEventListener('click', () => {
        document.getElementById('modal-user-title').textContent = 'Tambah Pegawai Baru';
        document.getElementById('form-user').reset();
        document.getElementById('user-id').value = '';
        document.getElementById('user-name').value = '';
        document.getElementById('user-email').disabled = false;
        document.getElementById('user-password').placeholder = 'Minimal 6 karakter';
        if (window.populateShiftOptions) window.populateShiftOptions();
        document.getElementById('user-password').setAttribute('required', 'true');
        document.getElementById('user-status').value = 'active';
        document.getElementById('user-branch').innerHTML = branchesList.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
        filterUserOutlets();
        
        // Filter options based on role
        const role = getCurrentProfile()?.role;
        const roleSelect = document.getElementById('user-role');
        Array.from(roleSelect.options).forEach(opt => opt.style.display = 'block');
        if (role === 'kepala_cabang') {
            Array.from(roleSelect.options).forEach(opt => {
                if(!['kepala_toko', 'kasir'].includes(opt.value)) opt.style.display = 'none';
            });
            roleSelect.value = 'kepala_toko';
        } else if (role === 'kepala_toko') {
            Array.from(roleSelect.options).forEach(opt => {
                if(!['kasir'].includes(opt.value)) opt.style.display = 'none';
            });
            roleSelect.value = 'kasir';
        } else {
            roleSelect.value = 'owner';
        }
        
        let filteredOutlets = outletsList;
        const branchVal = document.getElementById('user-branch').value;
        if (branchVal) {
            filteredOutlets = outletsList.filter(o => o.branch_id === branchVal);
        }
        document.getElementById('user-outlet').innerHTML = filteredOutlets.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
        
        document.getElementById('modal-user').classList.remove('hidden');
        handleRoleSelectionChange();
    });

    document.getElementById('user-branch').addEventListener('change', (e) => {
        const branchVal = e.target.value;
        const filteredOutlets = outletsList.filter(o => o.branch_id === branchVal);
        document.getElementById('user-outlet').innerHTML = filteredOutlets.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
    });

    document.getElementById('user-role').addEventListener('change', handleRoleSelectionChange);
    document.getElementById('user-branch').addEventListener('change', filterUserOutlets);

    document.getElementById('form-branch').addEventListener('submit', handleAddBranch);
    document.getElementById('form-outlet').addEventListener('submit', handleAddOutlet);
    document.getElementById('form-user').addEventListener('submit', handleAddUser);
    const formCompany = document.getElementById('form-company');
    if (formCompany) formCompany.addEventListener('submit', (e) => { e.preventDefault(); window.saveCompany(); });

    // POS Actions
    // Image Preview for Product
    document.getElementById('product-image').addEventListener('change', function(e) {
        const file = e.target.files[0];
        const previewContainer = document.getElementById('product-image-preview-container');
        const previewImg = document.getElementById('product-image-preview');
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                previewImg.src = e.target.result;
                previewContainer.classList.remove('hidden');
            }
            reader.readAsDataURL(file);
        } else {
            previewContainer.classList.add('hidden');
            previewImg.src = '';
        }
    });

    document.getElementById('btn-add-product').addEventListener('click', () => {
        if (!activeOutletId) { showToast('Pilih outlet dulu', 'error'); return; }
        document.getElementById('form-product').reset();
        document.getElementById('product-id').value = '';
        document.getElementById('product-image').value = '';
        document.getElementById('product-image-preview-container').classList.add('hidden');
        document.getElementById('product-image-preview').src = '';
        document.getElementById('product-modal-title').textContent = 'Tambah Produk';
        document.getElementById('modal-product').classList.remove('hidden');
    });

    document.getElementById('form-product').addEventListener('submit', handleSaveProduct);
    document.getElementById('product-search').addEventListener('input', debounce((e) => renderProducts(e.target.value), 300));
    
    document.getElementById('modal-payment-method').addEventListener('change', () => {
        renderCart();
    });
    document.getElementById('modal-cash-received').addEventListener('input', calculateChange);
    document.getElementById('modal-discount-percent').addEventListener('input', calculateChange);
    document.getElementById('modal-discount-nominal').addEventListener('input', calculateChange);
    document.getElementById('btn-checkout').addEventListener('click', openCheckoutModal);
    document.getElementById('btn-confirm-payment').addEventListener('click', finalizeCheckout);
    
    // Set default history and attendance dates to today and listen for changes
    const dIds = ['history-date-start', 'history-date-end', 'attendance-date-start', 'attendance-date-end', 'dashboard-date-start', 'dashboard-date-end'];
    dIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const today = getLocalToday();
            if(!el.value) el.value = today;
            if(id.startsWith('history')) el.addEventListener('change', loadHistory);
            if(id.startsWith('attendance')) el.addEventListener('change', loadAttendanceHistory);
            if(id.startsWith('dashboard')) el.addEventListener('change', () => { if(window.loadDashboard) window.loadDashboard() });
        }
    });
    
    document.getElementById('btn-export-excel')?.addEventListener('click', exportToExcel);
    
    document.getElementById('analytics-outlet-filter')?.addEventListener('change', () => { if(window.loadAnalytics) window.loadAnalytics() });
    document.getElementById('analytics-period-filter')?.addEventListener('change', () => { if(window.loadAnalytics) window.loadAnalytics() });
}

function filterUserOutlets() {
    const branchId = document.getElementById('user-branch').value;
    const myRole = getCurrentProfile()?.role;
    let filteredOutlets = outletsList;

    if (myRole === 'kepala_cabang') {
        filteredOutlets = outletsList.filter(o => o.branch_id === getCurrentProfile().branch_id);
    } else if (branchId) {
        filteredOutlets = outletsList.filter(o => o.branch_id === branchId);
    }

    document.getElementById('user-outlet').innerHTML = filteredOutlets.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
}

function handleRoleSelectionChange() {
    const role = document.getElementById('user-role').value;
    const branchGroup = document.getElementById('group-user-branch');
    const outletGroup = document.getElementById('group-user-outlet');
    const shiftGroup = document.getElementById('group-user-shift');
    const myRole = getCurrentProfile()?.role;
    
    if (role === 'owner' || role === 'superadmin') {
        branchGroup.classList.add('hidden');
        outletGroup.classList.add('hidden');
        if(shiftGroup) shiftGroup.classList.add('hidden');
    } else if (role === 'kepala_cabang') {
        if(myRole === 'superadmin' || myRole === 'owner') branchGroup.classList.remove('hidden');
        else branchGroup.classList.add('hidden');
        outletGroup.classList.add('hidden');
        if(shiftGroup) shiftGroup.classList.add('hidden');
    } else {
        if(myRole === 'superadmin' || myRole === 'owner') branchGroup.classList.remove('hidden');
        else branchGroup.classList.add('hidden');
        if(myRole === 'kepala_toko') outletGroup.classList.add('hidden'); // Kepala toko can't change outlet
        else outletGroup.classList.remove('hidden');
        
        // Populate shift will handle showing shiftGroup if there are shifts available
        if(window.populateShiftOptions) window.populateShiftOptions(document.getElementById('user-outlet').value);
    }

    filterUserOutlets();
}

// ------------------------------
// Management Logic moved to management.js


// ------------------------------
// POS / ADMIN LOGIC
// ------------------------------
async function initPos() {
    startAttendanceClock();
    checkAttendanceStatus();
    await checkActiveShift();

    const today = getLocalToday();
    const initIds = ['history-date-start', 'history-date-end', 'dashboard-date-start', 'dashboard-date-end', 'attendance-date-start', 'attendance-date-end'];
    initIds.forEach(id => {
        const el = document.getElementById(id);
        if(el && !el.value) el.value = today;
    });

    generateOrderId(false);
    if (activeOutletId) {
        await loadProducts();
        renderCart();
        loadInventory();
        loadStockPostings();
        loadExpenseMaster();
        loadExpenses();
        loadDeposits();
    }
    // Restore active tab
    const savedTab = localStorage.getItem('pos_active_tab') || 'pos-tab-content';
    const btn = document.querySelector(`.pos-nav-btn[data-target="${savedTab}"]`);
    if(btn) btn.click();
    
    // Bind printer connect button
    const btnConnectPrinter = document.getElementById('btn-connect-printer');
    if (btnConnectPrinter) {
        btnConnectPrinter.onclick = connectPrinter;
    }

    // Bind hard refresh button
    const btnHardRefresh = document.getElementById('btn-hard-refresh');
    if (btnHardRefresh) {
        btnHardRefresh.addEventListener('click', async () => {
            const icon = btnHardRefresh.querySelector('i');
            if(icon) {
                icon.classList.remove('ph-arrows-clockwise');
                icon.classList.add('ph-spinner', 'ph-spin');
            }
            try {
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (let registration of registrations) {
                        await registration.unregister();
                    }
                }
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
                window.location.reload(true);
            } catch (e) {
                window.location.reload(true);
            }
        });
    }
}

export function generateOrderId(resetCart = true) {
    const id = 'ORD-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const orderIdEl = document.getElementById('current-order-id');
    if(orderIdEl) orderIdEl.textContent = id;
    
    if (resetCart) {
        emptyCart();
        const cashEl = document.getElementById('cash-received');
        if(cashEl) cashEl.value = '';
    }
}

export function generateRandomDocNumber(prefix) {
    return prefix + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Attendance logic moved to attendance.js

// Products logic moved to products.js

// Cart logic moved to cart.js



// History logic moved to history.js



// Table Sorting Logic
window.enableTableSort = enableTableSort;
export function enableTableSort(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const headers = table.querySelectorAll('th');
    
    headers.forEach((header, index) => {
        // Skip sort for action column
        if (header.classList.contains('action-col')) return;

        header.style.cursor = 'pointer';
        header.title = "Klik untuk mengurutkan";
        
        let sortAsc = true;
        
        header.addEventListener('click', () => {
            const tbody = table.querySelector('tbody');
            if (!tbody) return;
            const rows = Array.from(tbody.querySelectorAll('tr'));
            
            // Remove sort icons from other headers
            headers.forEach(h => {
                const icon = h.querySelector('.sort-icon');
                if (icon) icon.remove();
            });

            // Add sort icon to current header
            const icon = document.createElement('i');
            icon.className = `sort-icon ph ph-caret-${sortAsc ? 'up' : 'down'}`;
            icon.style.marginLeft = '5px';
            header.appendChild(icon);

            rows.sort((a, b) => {
                const cellA = a.querySelectorAll('td')[index]?.textContent.trim() || '';
                const cellB = b.querySelectorAll('td')[index]?.textContent.trim() || '';

                // Check if numeric
                const numA = parseFloat(cellA.replace(/[^0-9.-]+/g,""));
                const numB = parseFloat(cellB.replace(/[^0-9.-]+/g,""));

                if (!isNaN(numA) && !isNaN(numB) && cellA.match(/[0-9]/) && cellB.match(/[0-9]/)) {
                    return sortAsc ? numA - numB : numB - numA;
                }

                return sortAsc ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
            });

            tbody.innerHTML = '';
            rows.forEach(row => tbody.appendChild(row));
            
            sortAsc = !sortAsc;
        });
    });
}

// Start App
init();

// ------------------------------
// ATTENDANCE HISTORY & EXPORT
// ------------------------------
// loadAttendanceHistory handled by attendance.js

window.exportAttendanceExcel = async () => {
    const profile = getCurrentProfile();
    const role = profile?.role;
    if (!['superadmin', 'owner', 'kepala_cabang', 'kepala_toko'].includes(role)) return;

    const startDate = document.getElementById('attendance-start-date').value;
    const endDate = document.getElementById('attendance-end-date').value;
    if (!startDate || !endDate) return showToast('Pilih rentang tanggal', 'error');

    const btn = document.getElementById('btn-export-attendance');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Mengekspor...';

    try {
        const { data, error } = await supabase.rpc('get_attendance_report', {
            p_start_date: startDate,
            p_end_date: endDate
        });

        if (error) throw error;
        if (!data || data.length === 0) {
            showToast('Tidak ada data absensi', 'error');
            return;
        }

        const exportRows = data.map(record => ({
            'Tanggal': new Date(record.record_date).toLocaleDateString('id-ID'),
            'Nama Pegawai': record.name || record.email || '-',
            'Role': (record.role || '-').replace('_', ' ').toUpperCase(),
            'Cabang': record.branch_name || '-',
            'Jam Masuk': record.clock_in ? new Date(record.clock_in).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-',
            'Jam Pulang': record.clock_out ? new Date(record.clock_out).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-',
            'Status': record.status
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Riwayat Absensi");

        const colWidths = [
            { wch: 15 }, // Tanggal
            { wch: 25 }, // Nama
            { wch: 15 }, // Role
            { wch: 20 }, // Cabang
            { wch: 15 }, // In
            { wch: 15 }, // Out
            { wch: 10 }  // Status
        ];
        worksheet['!cols'] = colWidths;

        let filenameDate = startDate === endDate ? startDate : `${startDate}_to_${endDate}`;
        XLSX.writeFile(workbook, `Laporan_Absensi_${filenameDate}.xlsx`);
        showToast('Berhasil mengunduh Excel', 'success');
    } catch (e) {
        console.error(e);
        showToast('Gagal mengekspor Excel', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
};

window.loadServerInfo = async () => {
    const btnRefresh = document.getElementById('btn-refresh-server');
    if(btnRefresh) {
        btnRefresh.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Loading...';
        btnRefresh.disabled = true;
    }

    try {
        // Supabase DB Size
        const { data: dbSizeData, error: dbError } = await supabase.rpc('get_db_size');
        if(dbError) console.error("Error fetching db size:", dbError);
        
        const sbText = document.getElementById('supabase-usage-text');
        const sbBar = document.getElementById('supabase-usage-bar');
        
        if (dbSizeData !== null) {
            const dbSizeInMb = (dbSizeData / (1024 * 1024)).toFixed(2);
            sbText.textContent = `${dbSizeInMb} MB / 500 MB`;
            const percentage = Math.min((dbSizeInMb / 500) * 100, 100);
            sbBar.style.width = `${percentage}%`;
            sbBar.style.background = percentage > 90 ? 'var(--danger)' : '#3ECF8E';
        } else {
            sbText.textContent = "Gagal mengambil data";
        }

        // GitHub Repo Size
        const ghText = document.getElementById('github-usage-text');
        const ghBar = document.getElementById('github-usage-bar');

        const ghRes = await fetch('https://api.github.com/repos/nailur/nailur.github.io');
        if(ghRes.ok) {
            const ghData = await ghRes.json();
            const sizeInKb = ghData.size;
            const sizeInMb = (sizeInKb / 1024).toFixed(2);
            ghText.textContent = `${sizeInMb} MB / 1024 MB (1GB)`;
            
            const percentage = Math.min((sizeInMb / 1024) * 100, 100);
            ghBar.style.width = `${percentage}%`;
            ghBar.style.background = percentage > 90 ? 'var(--danger)' : '#181717';
        } else {
            ghText.textContent = "Gagal mengambil data";
        }

    } catch (e) {
        console.error(e);
    } finally {
        if(btnRefresh) {
            btnRefresh.innerHTML = '<i class="ph ph-arrows-clockwise"></i> Refresh';
            btnRefresh.disabled = false;
        }
    }
};

document.querySelectorAll('.pos-nav-btn[data-target="server-info-tab"]').forEach(btn => {
    btn.addEventListener('click', window.loadServerInfo);
});

// ------------------------------
// PWA Service Worker Registration
// ------------------------------
// GLOBAL UI FUNCTIONS
// ------------------------------
window.toggleLayout = function() {
    const productGrid = document.getElementById('product-grid');
    const btnToggleLayout = document.getElementById('btn-toggle-layout');
    if (!productGrid || !btnToggleLayout) return;
    
    productGrid.classList.toggle('list-view');
    const icon = btnToggleLayout.querySelector('i');
    if (icon) {
        if (productGrid.classList.contains('list-view')) {
            icon.classList.remove('ph-list-dashes');
            icon.classList.add('ph-squares-four');
        } else {
            icon.classList.add('ph-list-dashes');
            icon.classList.remove('ph-squares-four');
        }
    }
};

// ------------------------------
// GLOBAL REFRESH BROADCAST
// ------------------------------
let globalChannel = null;
let userChannel = null;

function handleForceRefresh(payload) {
    console.log('Received force_refresh broadcast:', payload);
    
    const executeHardRefresh = async () => {
        try {
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.unregister();
                }
            }
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            setTimeout(() => window.location.reload(true), 1000);
        } catch (e) {
            setTimeout(() => window.location.reload(true), 1000);
        }
    };

    if (cart && cart.length > 0) {
        const container = document.getElementById('toast-container');
        if (container) {
            if (container.querySelector('.toast-warning')) return;
            
            const toast = document.createElement('div');
            toast.className = `toast toast-warning`;
            toast.style.background = '#f59e0b';
            toast.style.display = 'flex';
            toast.style.flexDirection = 'column';
            toast.style.gap = '10px';
            toast.style.opacity = '1';
            toast.innerHTML = `
                <span>Pusat meminta Anda memperbarui aplikasi. Tolong selesaikan transaksi Anda saat ini, lalu klik tombol Refresh.</span>
                <button id="btn-pwa-refresh-forced" style="padding: 6px 12px; border: none; border-radius: 4px; background: white; color: #f59e0b; font-weight: bold; cursor: pointer;">Refresh Sekarang</button>
            `;
            container.appendChild(toast);
            
            document.getElementById('btn-pwa-refresh-forced').onclick = () => {
                toast.remove();
                showToast('Memperbarui aplikasi...', 'info');
                executeHardRefresh();
            };
        }
    } else {
        showToast('Memperbarui aplikasi dari Pusat...', 'info');
        executeHardRefresh();
    }
}

function handleAnnouncement(payload) {
    const { title, body } = payload.payload || {};
    
    const container = document.getElementById('toast-container');
    if (container) {
        const toast = document.createElement('div');
        toast.className = `toast toast-info`;
        toast.style.background = 'var(--primary)';
        toast.style.display = 'flex';
        toast.style.flexDirection = 'column';
        toast.style.gap = '10px';
        toast.style.opacity = '1';
        toast.style.animation = 'slideIn 0.3s ease';
        toast.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong><i class="ph-fill ph-bell-ringing"></i> ${escapeHtml(title) || 'Pengumuman'}</strong>
                <button class="btn-close-toast" style="background:none; border:none; color:white; cursor:pointer;"><i class="ph ph-x"></i></button>
            </div>
            <div style="font-size: 0.95rem; white-space: pre-wrap;">${escapeHtml(body) || ''}</div>
        `;
        container.appendChild(toast);
        toast.querySelector('.btn-close-toast').onclick = () => toast.remove();
        
        setTimeout(() => {
            if(toast.parentElement) toast.remove();
        }, 30000);
    }
    
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title || 'Pengumuman', {
            body: body || '',
            icon: './icon-192.png'
        });
    }
}

function setupGlobalRefreshListener() {
    if (!supabase) return;
    const profile = getCurrentProfile();
    
    // 1. GLOBAL channel: force_refresh + announcements for ALL users
    globalChannel = supabase.channel('system_events:global');
    globalChannel
        .on('broadcast', { event: 'force_refresh' }, handleForceRefresh)
        .on('broadcast', { event: 'system_announcement' }, handleAnnouncement)
        .subscribe((status) => {
            console.log('Global Channel Status:', status);
        });

    // 2. PER-USER channel: targeted announcements for this specific user only
    if (profile?.id) {
        userChannel = supabase.channel(`system_events:user_${profile.id}`);
        userChannel
            .on('broadcast', { event: 'system_announcement' }, handleAnnouncement)
            .subscribe((status) => {
                console.log('User Channel Status:', status);
            });
    }
}

window.triggerGlobalRefresh = async function() {
    const btn = document.getElementById('btn-force-global-refresh');
    const originalText = btn.innerHTML;
    
    if (!confirm('Peringatan: Tindakan ini akan memaksa SELURUH perangkat kasir yang sedang online untuk memuat ulang aplikasi detik ini juga. Lanjutkan?')) {
        return;
    }
    
    if (btn) {
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Mengirim Sinyal...';
        btn.disabled = true;
    }
    
    if (globalChannel) {
        const resp = await globalChannel.send({
            type: 'broadcast',
            event: 'force_refresh',
            payload: { timestamp: new Date().toISOString() }
        });
        
        if (resp !== 'ok') {
            showToast('Gagal mengirim sinyal refresh ke perangkat lain.', 'error');
        }
    } else {
        showToast('Koneksi Realtime belum siap.', 'error');
    }
    
    if (btn) {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

window.sendCustomNotification = async function(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    
    const target = document.getElementById('announcement-target').value;
    const title = document.getElementById('announcement-title').value;
    const body = document.getElementById('announcement-body').value;
    
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Mengirim...';
    btn.disabled = true;
    
    let sendSuccess = false;
    
    if (target === 'all') {
        // Send global broadcast via supabase
        const resp = await globalChannel.send({
            type: 'broadcast',
            event: 'system_announcement',
            payload: { title, body, target }
        });
        sendSuccess = resp === 'ok';
    } else {
        // Send to specific USER's channel via supabase
        const targetChannel = supabase.channel(`system_events:user_${target}`);
        await new Promise(resolve => {
            targetChannel.subscribe((status) => {
                if (status === 'SUBSCRIBED') resolve();
            });
        });
        const resp = await targetChannel.send({
            type: 'broadcast',
            event: 'system_announcement',
            payload: { title, body, target }
        });
        sendSuccess = resp === 'ok';
        // Unsubscribe from temporary channel after sending
        supabase.removeChannel(targetChannel);
    }
    
    // Kirim Push Notification via Vercel API (OneSignal)
    try {
        const pushResp = await fetch('https://nailur.vercel.app/api/pos-broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, body, target })
        });
        if (!pushResp.ok) {
            console.warn('OneSignal Push Failed:', await pushResp.text());
        }
    } catch(err) {
        console.error('Error triggering push notification:', err);
    }
    
    if (sendSuccess) {
        showToast('Pengumuman berhasil dikirim!', 'success');
        document.getElementById('form-announcement').reset();
    } else {
        showToast('Gagal mengirim pengumuman.', 'error');
    }
    
    btn.innerHTML = originalText;
    btn.disabled = false;
};

async function loadTargetUsers() {
    const select = document.getElementById('announcement-target');
    if (!select) return;
    
    const { data: users, error } = await supabase.from('profiles').select('id, name, email').neq('role', 'superadmin');
    if (users && !error) {
        select.innerHTML = '<option value="all">Semua Kasir</option>';
        users.forEach(u => {
            const name = u.name || u.email;
            select.innerHTML += `<option value="${u.id}">${name}</option>`;
        });
    }
}
window.loadTargetUsers = loadTargetUsers;

// Start listening when file loads
setupGlobalRefreshListener();

// ------------------------------
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });

        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
            
        // Trigger sync when app loads
        setTimeout(() => {
            if(navigator.onLine) syncOfflineTransactions();
        }, 3000); // delay to let app initialize first
    });
}

// Offline logic moved to offline.js

// --- GLOBAL TABLE SORTER ---
document.addEventListener('click', function(e) {
    const th = e.target.closest('th');
    if (!th) return;
    const table = th.closest('table.data-table');
    if (!table) return;
    
    // Skip action columns
    if (th.classList.contains('action-col') || th.textContent.trim().toLowerCase() === 'aksi' || th.cellIndex === th.parentNode.cells.length - 1) return;

    // Remove sorting indicators from other ths in the same table
    const allThs = table.querySelectorAll('th');
    allThs.forEach(header => {
        if (header !== th) header.removeAttribute('data-sort-dir');
    });

    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    // Determine sort direction
    let dir = th.getAttribute('data-sort-dir') === 'asc' ? 'desc' : 'asc';
    th.setAttribute('data-sort-dir', dir);

    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length === 0 || rows[0].querySelector('td[colspan]')) return; // empty table message
    
    const index = Array.from(th.parentNode.children).indexOf(th);
    
    rows.sort((a, b) => {
        const aCol = a.children[index];
        const bCol = b.children[index];
        if (!aCol || !bCol) return 0;
        
        let aText = aCol.textContent.trim();
        let bText = bCol.textContent.trim();
        
        const aNum = parseFloat(aText.replace(/[^0-9,-]+/g, '').replace(',', '.'));
        const bNum = parseFloat(bText.replace(/[^0-9,-]+/g, '').replace(',', '.'));
        
        const isNum = !isNaN(aNum) && !isNaN(bNum) && 
                      (aText.includes('Rp') || aText.match(/^[0-9.,]+$/));

        if (isNum) {
            return dir === 'asc' ? aNum - bNum : bNum - aNum;
        } else {
            return dir === 'asc' ? aText.localeCompare(bText) : bText.localeCompare(aText);
        }
    });

    // Re-append sorted rows
    rows.forEach(row => tbody.appendChild(row));
});
