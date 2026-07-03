import { supabase } from './supabase.js';
import { supabaseAdmin } from './supabase-admin.js';
import { checkSession, login, logout, getCurrentUser, getCurrentProfile } from './auth.js';
import { connectPrinter, printReceiptNative } from './printer.js';

window.getCurrentProfile = getCurrentProfile;
window.getCurrentUser = getCurrentUser;
window.supabase = supabase;
window.showToast = showToast;

// DOM Elements
const appContainer = document.getElementById('app-container');
const loginView = document.getElementById('login-view');
const superadminView = document.getElementById('superadmin-view');
const posView = document.getElementById('pos-view');

function getLocalToday() {
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

// Global State
let products = [];
let cart = JSON.parse(localStorage.getItem('pos_cart')) || [];
let branchesList = [];
let outletsList = [];
let posOutletsList = []; // Outlets accessible by current POS user
let activeOutletId = null;

// Expose to window for external scripts (e.g. dashboard.js)
Object.defineProperty(window, 'products', { get: () => products });
Object.defineProperty(window, 'outletsList', { get: () => outletsList });
Object.defineProperty(window, 'activeOutletId', { get: () => activeOutletId });

// Pagination State
const HISTORY_PAGE_SIZE = 25;
let historyPage = 0;
let historyTotalCount = 0;

// Product Display Limit
const PRODUCT_DISPLAY_LIMIT = 50;
let productShowAll = false;

// Initialize
async function init() {
    supabase.auth.onAuthStateChange((event, session) => {
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
        loginView.classList.add('active');
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
        activeOutletId = profile.outlet_id;
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
    
    // Tampilkan tombol manajemen dan tab absensi untuk role manajerial
    if (['superadmin', 'owner', 'kepala_cabang', 'kepala_toko'].includes(profile.role)) {
        document.getElementById('btn-management').classList.remove('hidden');
        document.getElementById('nav-attendance').classList.remove('hidden');
    } else {
        document.getElementById('btn-management').classList.add('hidden');
        document.getElementById('nav-attendance').classList.add('hidden');
    }
}

async function initPosMultiOutlet(profile) {
    document.getElementById('btn-add-product').classList.remove('hidden');
    
    // Load accessible outlets
    let query = supabase.from('outlets').select('id, name, branch_id').order('name');
    if (profile.role === 'kepala_cabang') {
        query = query.eq('branch_id', profile.branch_id);
    }
    const { data } = await query;
    posOutletsList = data || [];
    const nameLabel = document.getElementById('pos-outlet-name');
    const mobileNameLabel = document.getElementById('mobile-pos-outlet-name');
    const selector = document.getElementById('active-outlet-selector');
    const mobileSelector = document.getElementById('mobile-active-outlet-selector');
    
    if (posOutletsList.length > 1) {
        nameLabel.classList.add('hidden');
        if(mobileNameLabel) mobileNameLabel.classList.add('hidden'); // Also hide mobile label if using dropdown
        selector.classList.remove('hidden');
        if(mobileSelector) mobileSelector.classList.remove('hidden');
        
        const optionsHtml = posOutletsList.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
        selector.innerHTML = optionsHtml;
        if(mobileSelector) mobileSelector.innerHTML = optionsHtml;
        
        selector.value = activeOutletId;
        if(mobileSelector) mobileSelector.value = activeOutletId;
        
        const handleChange = (e) => {
            activeOutletId = e.target.value;
            selector.value = activeOutletId;
            if(mobileSelector) mobileSelector.value = activeOutletId;
            localStorage.setItem('pos_active_outlet_id', activeOutletId);
            checkAttendanceStatus();
            loadProducts();
            loadHistory();
            if(window.loadDashboard) window.loadDashboard();
        };
        
        selector.addEventListener('change', handleChange);
        if(mobileSelector) mobileSelector.addEventListener('change', handleChange);
    } else {
        const outlet = posOutletsList.find(o => o.id === activeOutletId);
        if (outlet) {
            nameLabel.textContent = outlet.name;
            if(mobileNameLabel) mobileNameLabel.textContent = outlet.name;
        }
        nameLabel.classList.remove('hidden');
        if(mobileNameLabel) mobileNameLabel.classList.remove('hidden');
        selector.classList.add('hidden');
        if(mobileSelector) mobileSelector.classList.add('hidden');
    }
    
    const savedOutletId = localStorage.getItem('pos_active_outlet_id');
    if (savedOutletId && posOutletsList.find(o => o.id === savedOutletId)) {
        activeOutletId = savedOutletId;
        selector.value = savedOutletId;
        if(mobileSelector) mobileSelector.value = savedOutletId;
    } else if (posOutletsList.length > 0) {
        activeOutletId = posOutletsList[0].id;
        localStorage.setItem('pos_active_outlet_id', activeOutletId);
        selector.value = activeOutletId;
        if(mobileSelector) mobileSelector.value = activeOutletId;
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

    // Navigasi POS <-> Manajemen
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

        const saSidebarButtons = saSidebar.querySelectorAll('.btn, .pos-nav-btn, .tab-btn');
        saSidebarButtons.forEach(btn => {
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
                localStorage.setItem('pos_profile', JSON.stringify(profile)); // Update cache
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

    // Main Tabs (Superadmin)
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const prevTab = localStorage.getItem('management_active_tab');
            if (prevTab === 'analytics-tab' && e.currentTarget.getAttribute('data-target') !== 'analytics-tab') {
                if (window.revenueChartInst) { window.revenueChartInst.destroy(); window.revenueChartInst = null; }
                if (window.productChartInst) { window.productChartInst.destroy(); window.productChartInst = null; }
            }

            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
            e.currentTarget.classList.add('active');
            const targetId = e.currentTarget.getAttribute('data-target');
            document.getElementById(targetId).classList.remove('hidden');
            localStorage.setItem('management_active_tab', targetId);
            
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
            if (btnAdd && !btnAdd.classList.contains('hidden') || getCurrentUser()?.role === 'kepala_toko' || getCurrentUser()?.role === 'owner' || getCurrentUser()?.role === 'kepala_cabang') {
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

    // Outlet Selector Change (Owner/Kepala Cabang)
    const outletSelector = document.getElementById('active-outlet-selector');
    if (outletSelector) {
        outletSelector.addEventListener('change', (e) => {
            activeOutletId = e.target.value;
            localStorage.setItem('pos_active_outlet_id', activeOutletId);
            generateOrderId();
            loadProducts();
            if(!document.getElementById('history-tab-content').classList.contains('hidden')) {
                loadHistory();
            }
            if(!document.getElementById('dashboard-tab-content').classList.contains('hidden')) {
                if(window.loadDashboard) window.loadDashboard();
            }
        });
    }

    // Superadmin Actions
    document.getElementById('btn-add-branch').addEventListener('click', () => {
        document.getElementById('form-branch').reset();
        document.getElementById('branch-id').value = '';
        document.getElementById('modal-branch').classList.remove('hidden');
    });

    document.getElementById('btn-add-outlet').addEventListener('click', () => {
        document.getElementById('form-outlet').reset();
        document.getElementById('outlet-id').value = '';
        document.getElementById('outlet-branch').innerHTML = branchesList.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
        document.getElementById('modal-outlet').classList.remove('hidden');
    });

    document.getElementById('btn-add-user').addEventListener('click', () => {
        document.getElementById('form-user').reset();
        document.getElementById('user-id').value = '';
        document.getElementById('user-name').value = '';
        document.getElementById('user-email').disabled = false;
        document.getElementById('user-password').placeholder = 'Minimal 6 karakter';
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

    document.getElementById('form-branch').addEventListener('submit', (e) => { e.preventDefault(); window.saveBranch(); });
    document.getElementById('form-outlet').addEventListener('submit', (e) => { e.preventDefault(); window.saveOutlet(); });
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
    const myRole = getCurrentProfile()?.role;
    
    if (role === 'owner' || role === 'superadmin') {
        branchGroup.classList.add('hidden');
        outletGroup.classList.add('hidden');
    } else if (role === 'kepala_cabang') {
        if(myRole === 'superadmin' || myRole === 'owner') branchGroup.classList.remove('hidden');
        else branchGroup.classList.add('hidden');
        outletGroup.classList.add('hidden');
    } else {
        if(myRole === 'superadmin' || myRole === 'owner') branchGroup.classList.remove('hidden');
        else branchGroup.classList.add('hidden');
        if(myRole === 'kepala_toko') outletGroup.classList.add('hidden'); // Kepala toko can't change outlet
        else outletGroup.classList.remove('hidden');
    }

    filterUserOutlets();
}

// ------------------------------
// MANAGEMENT LOGIC (Superadmin / Kepala Cabang / Kepala Toko)
// ------------------------------
async function initManagement() {
    const profile = getCurrentProfile();
    const role = profile?.role;
    
    // Sembunyikan tab berdasarkan role
    const tabBranches = document.querySelector('.tab-btn[data-target="branches-tab"]');
    const tabOutlets = document.querySelector('.tab-btn[data-target="outlets-tab"]');
    const tabServerInfo = document.querySelector('.tab-btn[data-target="server-info-tab"]');
    const tabAnnouncement = document.querySelector('.tab-btn[data-target="announcement-tab"]');
    
    if (role === 'superadmin' || role === 'owner') {
        tabBranches.classList.remove('hidden');
        tabOutlets.classList.remove('hidden');
        if(role === 'superadmin') {
            if (tabServerInfo) tabServerInfo.classList.remove('hidden');
            if (tabAnnouncement) tabAnnouncement.classList.remove('hidden');
        } else {
            if (tabServerInfo) tabServerInfo.classList.add('hidden');
            if (tabAnnouncement) tabAnnouncement.classList.add('hidden');
        }
        document.getElementById('management-title').textContent = 'Manajemen Sistem';
    } else if (role === 'kepala_cabang') {
        tabBranches.classList.add('hidden');
        tabOutlets.classList.remove('hidden');
        if(tabServerInfo) tabServerInfo.classList.add('hidden');
        if(tabAnnouncement) tabAnnouncement.classList.add('hidden');
        document.getElementById('management-title').textContent = 'Panel Kepala Cabang';
    } else if (role === 'kepala_toko') {
        tabBranches.classList.add('hidden');
        tabOutlets.classList.add('hidden');
        if(tabServerInfo) tabServerInfo.classList.add('hidden');
        if(tabAnnouncement) tabAnnouncement.classList.add('hidden');
        document.getElementById('management-title').textContent = 'Panel Kepala Toko';
    }
    
    // Restore active sub-tab or click the first available
    const savedMgmtTab = localStorage.getItem('management_active_tab');
    let tabToClick = null;
    
    if (savedMgmtTab) {
        const btn = document.querySelector(`.tab-btn[data-target="${savedMgmtTab}"]`);
        if (btn && !btn.classList.contains('hidden')) {
            tabToClick = btn;
        }
    }
    
    if (!tabToClick) {
        if (!tabBranches.classList.contains('hidden')) {
            tabToClick = tabBranches;
        } else if (!tabOutlets.classList.contains('hidden')) {
            tabToClick = tabOutlets;
        } else {
            tabToClick = document.querySelector('.tab-btn[data-target="users-tab"]');
        }
    }
    
    if (tabToClick) tabToClick.click();

    if (role === 'superadmin' || role === 'owner' || role === 'kepala_cabang') await loadBranches();
    if (role === 'superadmin' || role === 'owner' || role === 'kepala_cabang') await loadOutlets();
    await loadUsers();
    
    if (role === 'superadmin') {
        const formAnnouncement = document.getElementById('form-announcement');
        if (formAnnouncement && !formAnnouncement.dataset.bound) {
            formAnnouncement.addEventListener('submit', window.sendCustomNotification);
            formAnnouncement.dataset.bound = 'true';
        }
        await loadTargetUsers();
    }
}

async function loadBranches() {
    let query = supabase.from('branches').select('id, name, created_at').order('created_at', { ascending: false });
    const profile = getCurrentProfile();
    if (profile?.role === 'kepala_cabang') {
        query = query.eq('id', profile.branch_id);
    }
    const { data, error } = await query;
    if (error) return showToast('Gagal memuat cabang', 'error');
    branchesList = data;
    const tbody = document.querySelector('#branches-table tbody');
    tbody.innerHTML = data.map(b => `
        <tr>
            <td><strong>${b.name}</strong></td>
            <td>
                <button class="btn btn-icon" style="color:var(--primary)" onclick="editBranch('${b.id}')"><i class="ph ph-pencil-simple"></i></button>
                <button class="btn btn-icon" onclick="deleteBranch('${b.id}')"><i class="ph ph-trash"></i></button>
            </td>
        </tr>
    `).join('');
    enableTableSort('branches-table');
}

async function loadOutlets() {
    let query = supabase.from('outlets').select('*, branches(name)').order('created_at', { ascending: false });
    const profile = getCurrentProfile();
    if (profile?.role === 'kepala_cabang') {
        query = query.eq('branch_id', profile.branch_id);
    }
    const { data, error } = await query;
    if (error) return showToast('Gagal memuat outlet', 'error');
    outletsList = data;
    const tbody = document.querySelector('#outlets-table tbody');
    tbody.innerHTML = data.map(o => `
        <tr>
            <td><strong>${o.name}</strong></td>
            <td><strong>${o.code || '-'}</strong></td>
            <td>${o.branches?.name || '-'}</td>
            <td>${o.address || '-'}</td>
            <td>
                <button class="btn btn-icon" style="color:var(--primary)" onclick="editOutlet('${o.id}')"><i class="ph ph-pencil-simple"></i></button>
                <button class="btn btn-icon" onclick="deleteOutlet('${o.id}')"><i class="ph ph-trash"></i></button>
            </td>
        </tr>
    `).join('');
    enableTableSort('outlets-table');
}

async function loadUsers() {
    let query = supabase.from('profiles').select('*, outlets(name), branches(name)').neq('role', 'superadmin');
    const profile = getCurrentProfile();
    if (profile?.role === 'kepala_cabang') {
        const { data: bOutlets } = await supabase.from('outlets').select('id').eq('branch_id', profile.branch_id);
        const outletIds = bOutlets ? bOutlets.map(o => o.id) : [];
        if (outletIds.length > 0) {
            query = query.or(`branch_id.eq.${profile.branch_id},outlet_id.in.(${outletIds.join(',')})`);
        } else {
            query = query.eq('branch_id', profile.branch_id);
        }
    } else if (profile?.role === 'kepala_toko') {
        query = query.eq('outlet_id', profile.outlet_id);
    }
    const { data, error } = await query;
    if (error) return showToast('Gagal memuat pegawai', 'error');
    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = data.map(u => `
        <tr>
            <td>${u.name || '-'}</td>
            <td>${u.email}</td>
            <td><span class="user-badge">${u.role}</span></td>
            <td>${u.branches?.name || '-'}</td>
            <td>${u.outlets?.name || '-'}</td>
            <td>${u.status === 'inactive' ? '<span class="user-badge" style="background:var(--danger)">Inactive</span>' : '<span class="user-badge" style="background:var(--success)">Active</span>'}</td>
            <td>
                <button class="btn btn-icon" style="color:var(--primary)" onclick="editUser('${u.id}')"><i class="ph ph-pencil-simple"></i></button>
                <button class="btn btn-icon" onclick="deleteUser('${u.id}')"><i class="ph ph-trash"></i></button>
            </td>
        </tr>
    `).join('');
    enableTableSort('users-table');
}

async function handleAddBranch(e) {
    e.preventDefault();
    const id = document.getElementById('branch-id').value;
    const name = document.getElementById('branch-name').value;
    
    if (id) {
        const { error } = await supabase.from('branches').update({ name }).eq('id', id);
        if (error) showToast(error.message, 'error');
        else { showToast('Cabang diperbarui!', 'success'); document.getElementById('modal-branch').classList.add('hidden'); loadBranches(); }
    } else {
        const { error } = await supabase.from('branches').insert([{ name }]);
        if (error) showToast(error.message, 'error');
        else { showToast('Cabang ditambahkan!', 'success'); document.getElementById('modal-branch').classList.add('hidden'); loadBranches(); }
    }
}

window.editBranch = (id) => {
    const b = branchesList.find(x => x.id === id);
    if (!b) return;
    document.getElementById('branch-id').value = b.id;
    document.getElementById('branch-name').value = b.name;

    document.getElementById('modal-branch').classList.remove('hidden');
};

window.deleteBranch = async (id) => {
    if(!confirm('Hapus cabang ini?')) return;
    
    // Validasi Outlet
    const { count, error: countErr } = await supabase.from('outlets').select('*', { count: 'exact', head: true }).eq('branch_id', id);
    if(countErr) return showToast('Gagal memvalidasi cabang', 'error');
    if(count > 0) return showToast('Cabang tidak bisa dihapus karena masih memiliki outlet!', 'error');

    const { error } = await supabase.from('branches').delete().eq('id', id);
    if(error) showToast(error.message, 'error');
    else loadBranches();
};

async function handleAddOutlet(e) {
    e.preventDefault();
    const id = document.getElementById('outlet-id').value;
    const name = document.getElementById('outlet-name').value;
    const code = document.getElementById('outlet-code').value.toUpperCase();
    let branch_id = document.getElementById('outlet-branch').value;
    const address = document.getElementById('outlet-address').value;
    const phone = document.getElementById('outlet-phone').value;
    const tax_rate_percent = parseFloat(document.getElementById('outlet-tax').value) || 0;

    const profile = getCurrentProfile();
    if (profile?.role === 'kepala_cabang') {
        branch_id = profile.branch_id;
    }

    if (id) {
        const { error } = await supabase.from('outlets').update({ name, code, address, phone, branch_id, tax_rate_percent }).eq('id', id);
        if (error) showToast(error.message, 'error');
        else { showToast('Outlet diperbarui!', 'success'); document.getElementById('modal-outlet').classList.add('hidden'); loadOutlets(); }
    } else {
        const { error } = await supabase.from('outlets').insert([{ name, code, address, phone, branch_id, tax_rate_percent }]);
        if (error) showToast(error.message, 'error');
        else { showToast('Outlet ditambahkan!', 'success'); document.getElementById('modal-outlet').classList.add('hidden'); loadOutlets(); }
    }
}

window.editOutlet = (id) => {
    const o = outletsList.find(x => x.id === id);
    if (!o) return;
    document.getElementById('outlet-id').value = o.id;
    document.getElementById('outlet-name').value = o.name;
    document.getElementById('outlet-code').value = o.code || '';
    document.getElementById('outlet-branch').innerHTML = branchesList.map(b => `<option value="${b.id}" ${b.id===o.branch_id?'selected':''}>${b.name}</option>`).join('');
    document.getElementById('outlet-address').value = o.address || '';
    document.getElementById('outlet-phone').value = o.phone || '';
    document.getElementById('outlet-tax').value = o.tax_rate_percent || 0;
    document.getElementById('modal-outlet').classList.remove('hidden');
};

window.deleteOutlet = async (id) => {
    if(!confirm('Hapus outlet ini?')) return;
    
    // Validasi Transaksi & Produk
    const { count: txCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('outlet_id', id);
    if(txCount > 0) return showToast('Outlet tidak bisa dihapus karena sudah memiliki transaksi!', 'error');

    const { count: prodCount } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('outlet_id', id);
    if(prodCount > 0) return showToast('Outlet tidak bisa dihapus karena memiliki produk!', 'error');

    const { error } = await supabase.from('outlets').delete().eq('id', id);
    if(error) showToast(error.message, 'error');
    else loadOutlets();
};

async function handleAddUser(e) {
    e.preventDefault();
    const id = document.getElementById('user-id').value;
    const email = document.getElementById('user-email').value;
    const name = document.getElementById('user-name').value;
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;
    const status = document.getElementById('user-status').value;
    let branch_id = null;
    let outlet_id = null;

    const profile = getCurrentProfile();

    if (role !== 'owner' && role !== 'superadmin') {
        branch_id = document.getElementById('user-branch').value;
    }
    if (role === 'kepala_toko' || role === 'kasir') {
        outlet_id = document.getElementById('user-outlet').value;
    }

    // Force override untuk manager
    if (profile?.role === 'kepala_cabang') {
        branch_id = profile.branch_id;
        // Outlet ID diambil dari form, karena sudah difilter isi dropdownnya
    } else if (profile?.role === 'kepala_toko') {
        branch_id = profile.branch_id;
        outlet_id = profile.outlet_id;
    }

    const btn = document.getElementById('btn-save-user');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    if (id) {
        // Edit User (hanya profile, email/password tidak diubah dari UI ini)
        const { error } = await supabase.from('profiles').update({ name, role, branch_id, outlet_id, status }).eq('id', id);
        if (error) showToast('Gagal update: ' + error.message, 'error');
        else { showToast('Pegawai diperbarui!', 'success'); document.getElementById('modal-user').classList.add('hidden'); loadUsers(); }
        btn.disabled = false; btn.textContent = 'Simpan';
    } else {
        // Create User
        if (!password) {
            showToast('Password wajib diisi untuk pengguna baru', 'error');
            btn.disabled = false; btn.textContent = 'Simpan';
            return;
        }
        const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({ email, password });
        if (authError) {
            showToast(authError.message, 'error');
            btn.disabled = false; btn.textContent = 'Simpan'; return;
        }

        setTimeout(async () => {
            const { error: updateError } = await supabase.from('profiles')
                .update({ name, role, branch_id, outlet_id, status })
                .eq('id', authData.user.id);
                
            if (updateError) showToast('Gagal set profile: ' + updateError.message, 'error');
            else { showToast('Pegawai berhasil ditambahkan!', 'success'); document.getElementById('modal-user').classList.add('hidden'); loadUsers(); }
            btn.disabled = false; btn.textContent = 'Simpan';
        }, 1000);
    }
}

window.editUser = async (id) => {
    // Fetch user details from DB
    const { data, error } = await supabase.from('profiles').select('id, name, email, role, branch_id, outlet_id').eq('id', id).single();
    if (error || !data) return showToast('Gagal memuat profil', 'error');
    
    document.getElementById('user-id').value = data.id;
    document.getElementById('user-email').value = data.email;
    document.getElementById('user-name').value = data.name || '';
    document.getElementById('user-email').disabled = true; // Email disabled on edit
    document.getElementById('user-password').value = ''; // Leave blank, not supported for edit here
    document.getElementById('user-password').placeholder = '(Tidak bisa diubah dari sini)';
    document.getElementById('user-password').removeAttribute('required');
    
    document.getElementById('user-role').value = data.role;
    document.getElementById('user-status').value = data.status || 'active';
    let dataBranchId = data.branch_id;
    if (!dataBranchId && data.outlet_id) {
        const out = outletsList.find(o => o.id === data.outlet_id);
        if (out) dataBranchId = out.branch_id;
    }
    const initialBranch = dataBranchId || (branchesList.length > 0 ? branchesList[0].id : null);
    
    document.getElementById('user-branch').innerHTML = branchesList.map(b => `<option value="${b.id}" ${b.id===initialBranch?'selected':''}>${b.name}</option>`).join('');
    
    const filteredOutlets = outletsList.filter(o => o.branch_id === initialBranch);
    document.getElementById('user-outlet').innerHTML = filteredOutlets.map(o => `<option value="${o.id}" ${o.id===data.outlet_id?'selected':''}>${o.name}</option>`).join('');
    
    handleRoleSelectionChange();
    // Beri sedikit jeda agar DOM ter-update, lalu set nilai outlet asli
    setTimeout(() => {
        document.getElementById('user-outlet').value = data.outlet_id || '';
    }, 50);
    document.getElementById('modal-user').classList.remove('hidden');
};

window.deleteUser = async (id) => {
    const profile = getCurrentProfile();
    if(id === profile?.id) return showToast('Tidak dapat menghapus diri sendiri', 'error');

    if(!confirm('Hapus pegawai ini? Aksesnya akan dicabut.')) return;
    
    // Validasi Transaksi (kasir)
    const { count: txCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('cashier_id', id);
    if(txCount > 0) return showToast('User tidak bisa dihapus karena memiliki riwayat transaksi!', 'error');

    // Validasi Absensi
    const { count: attCount } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('profile_id', id);
    if(attCount > 0) return showToast('User tidak bisa dihapus karena memiliki riwayat absensi!', 'error');

    // We try to delete from auth.admin if available, otherwise just delete profile
    try {
        if (supabaseAdmin.auth.admin) {
            await supabaseAdmin.auth.admin.deleteUser(id);
        }
    } catch(e) { console.warn('Supabase admin delete unsupported, deleting profile only'); }
    
    // Deleting profile triggers CASCADE if set, but if not we just delete profile
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if(error) showToast(error.message, 'error');
    else loadUsers();
};


// ------------------------------
// POS / ADMIN LOGIC
// ------------------------------
async function initPos() {
    startAttendanceClock();
    checkAttendanceStatus();

    const today = getLocalToday();
    const initIds = ['history-date-start', 'history-date-end', 'dashboard-date-start', 'dashboard-date-end', 'attendance-date-start', 'attendance-date-end'];
    initIds.forEach(id => {
        const el = document.getElementById(id);
        if(el && !el.value) el.value = today;
    });

    generateOrderId(false);
    if (activeOutletId) await loadProducts();
    
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

function generateOrderId(resetCart = true) {
    const id = 'ORD-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const orderIdEl = document.getElementById('current-order-id');
    if(orderIdEl) orderIdEl.textContent = id;
    
    if (resetCart) {
        cart = [];
        const cashEl = document.getElementById('cash-received');
        if(cashEl) cashEl.value = '';
    }
    renderCart();
}

// ------------------------------
// ATTENDANCE (CLOCK TIME) LOGIC
// ------------------------------
let attendanceTimer;
let currentAttendanceRecord = null;

function startAttendanceClock() {
    const profile = getCurrentProfile();
    const nameEl = document.getElementById('attendance-name');
    if(nameEl && profile) {
        let name = profile.name || profile.email.split('@')[0];
        nameEl.textContent = name;
    }

    if (attendanceTimer) clearInterval(attendanceTimer);
    attendanceTimer = setInterval(() => {
        const now = new Date();
        
        const timeEl = document.getElementById('attendance-time');
        if(timeEl) {
            timeEl.textContent = now.toLocaleTimeString('id-ID', { hour12: false });
        }
        
        const dateEl = document.getElementById('attendance-date');
        if(dateEl) {
            dateEl.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        }
    }, 1000);
}

async function checkAttendanceStatus() {
    const profile = getCurrentProfile();
    if (!profile || !activeOutletId) return;

    const today = getLocalToday();
    
    const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('profile_id', profile.id)
        .eq('outlet_id', activeOutletId)
        .eq('date', today)
        .single();

    currentAttendanceRecord = data;
    renderAttendanceButton();
}

function renderAttendanceButton() {
    const btn = document.getElementById('btn-clock-time');
    if (!btn) return;

    if (!currentAttendanceRecord) {
        btn.textContent = 'Clock In';
        btn.className = 'btn btn-primary';
        btn.onclick = handleClockIn;
    } else if (!currentAttendanceRecord.clock_out) {
        const timeIn = new Date(currentAttendanceRecord.clock_in).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
        btn.innerHTML = `<span style="display:flex; align-items:center; justify-content:center; gap:5px;"><div style="width:8px; height:8px; border-radius:50%; background:#10b981;"></div> Clock Out (In: ${timeIn})</span>`;
        btn.className = 'btn btn-secondary';
        btn.onclick = handleClockOut;
    } else {
        const timeOut = new Date(currentAttendanceRecord.clock_out).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
        btn.innerHTML = `<span style="display:flex; align-items:center; justify-content:center; gap:5px;"><div style="width:8px; height:8px; border-radius:50%; background:#ef4444;"></div> Pulang: ${timeOut} (Klik Edit)</span>`;
        btn.className = 'btn btn-secondary';
        btn.onclick = handleClockOut; // Allow replacing clock out
    }
}

async function handleClockIn() {
    const profile = getCurrentProfile();
    if (!profile || !activeOutletId) return;

    const btn = document.getElementById('btn-clock-time');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    const today = getLocalToday();
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('attendance')
        .insert([{
            profile_id: profile.id,
            outlet_id: activeOutletId,
            date: today,
            clock_in: now
        }])
        .select()
        .single();

    btn.disabled = false;
    if (error) {
        showToast('Gagal Clock In: ' + error.message, 'error');
    } else {
        currentAttendanceRecord = data;
        showToast('Berhasil Clock In!', 'success');
        renderAttendanceButton();
    }
}

async function handleClockOut() {
    if (!currentAttendanceRecord) return;
    
    if (currentAttendanceRecord.clock_out) {
        if (!confirm('Anda sudah Clock Out sebelumnya. Ganti jam pulang dengan waktu sekarang?')) return;
    }

    const btn = document.getElementById('btn-clock-time');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('attendance')
        .update({ clock_out: now })
        .eq('id', currentAttendanceRecord.id)
        .select()
        .single();

    btn.disabled = false;
    if (error) {
        showToast('Gagal Clock Out: ' + error.message, 'error');
    } else {
        currentAttendanceRecord = data;
        showToast('Berhasil Clock Out!', 'success');
        renderAttendanceButton();
    }
}

async function loadProducts() {
    if (!activeOutletId) return;

    // 1. Cache-First: Load from IndexedDB
    try {
        const cachedProducts = await getOfflineProducts(activeOutletId);
        if (cachedProducts && cachedProducts.length > 0) {
            products = cachedProducts;
            productShowAll = false;
            renderProducts();
        }
    } catch (err) {
        console.error('Failed to load products from cache', err);
    }

    // 2. Background Revalidation (Stale-While-Revalidate)
    if (!navigator.onLine) return;

    const { data, error } = await supabase.from('products').select('id, name, price, price_gofood, price_grabfood, price_shopeefood, stock, image_url, created_at').eq('outlet_id', activeOutletId).order('name');
    if (error) {
        if (!products.length) showToast('Gagal memuat produk dari server', 'error');
        return;
    }
    
    products = data;
    productShowAll = false;
    renderProducts();
    
    // 3. Save fresh data to IndexedDB
    await saveOfflineProducts(activeOutletId, data);
}

function renderProducts(search = '') {
    const grid = document.getElementById('product-grid');
    const profile = getCurrentProfile();
    const canEdit = profile.role !== 'kasir';
    
    const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    
    if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-cart"><p>Tidak ada produk</p></div>`;
        return;
    }

    // Apply display limit for performance (only when not searching)
    const shouldLimit = !search && !productShowAll && filtered.length > PRODUCT_DISPLAY_LIMIT;
    const displayProducts = shouldLimit ? filtered.slice(0, PRODUCT_DISPLAY_LIMIT) : filtered;

    grid.innerHTML = displayProducts.map(p => {
        const isOutOfStock = p.stock <= 0;
        return `
        <div class="product-card ${isOutOfStock ? 'out-of-stock' : ''}" ${isOutOfStock ? '' : `onclick="addToCart('${p.id}')"`} style="${isOutOfStock ? 'opacity: 0.5; filter: grayscale(1); cursor: not-allowed;' : ''}">
            ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}" class="product-image" loading="lazy" decoding="async">` : `<div class="product-image" style="display:flex;align-items:center;justify-content:center;color:#ccc;"><i class="ph-duotone ph-image" style="font-size:2.5rem;"></i></div>`}
            <div style="flex:1; display:flex; flex-direction:column; justify-content:flex-start;">
                <div class="product-name">${p.name}</div>
                <div class="product-price">Rp ${p.price.toLocaleString('id-ID')}</div>
                <div class="text-sm ${isOutOfStock ? 'text-danger' : 'text-muted'}">${isOutOfStock ? 'Stok Habis' : 'Stok: ' + p.stock}</div>
            </div>
            ${canEdit ? `
                <div style="margin-top:10px; display:flex; gap:5px; justify-content:center;" onclick="event.stopPropagation()">
                    <button class="btn btn-icon" style="color:var(--primary)" onclick="editProduct('${p.id}')"><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn btn-icon" onclick="deleteProduct('${p.id}')"><i class="ph ph-trash"></i></button>
                </div>
            ` : ''}
        </div>
    `}).join('');

    // Show "Load More" button if products were truncated
    if (shouldLimit) {
        grid.insertAdjacentHTML('beforeend', `
            <button class="btn-load-more" onclick="showAllProducts()">
                <i class="ph ph-arrow-down"></i> Tampilkan Semua (${filtered.length} produk)
            </button>
        `);
    }
}

// Helper function to compress image
function compressImage(file, maxWidth = 300, maxHeight = 300, quality = 0.6) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round(height * (maxWidth / width));
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round(width * (maxHeight / height));
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    // Create a new File from the Blob so it retains name and type properties
                    const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    resolve(compressedFile);
                }, 'image/jpeg', quality);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

async function handleSaveProduct(e) {
    e.preventDefault();
    if (!activeOutletId) return;
    
    const btn = document.getElementById('btn-save-product');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    const id = document.getElementById('product-id').value;
    const name = document.getElementById('product-name').value;
    const price = document.getElementById('product-price').value;
    const price_gofood = document.getElementById('product-price-gofood').value;
    const price_grabfood = document.getElementById('product-price-grabfood').value;
    const price_shopeefood = document.getElementById('product-price-shopeefood').value;
    const stock = document.getElementById('product-stock').value;
    const imageInput = document.getElementById('product-image');
    let image_url = null;

    try {
        if (imageInput.files && imageInput.files[0]) {
            const file = imageInput.files[0];
            
            // Kompres gambar sebelum diupload
            btn.textContent = 'Mengompres Gambar...';
            const compressedFile = await compressImage(file, 800, 800, 0.7);
            
            btn.textContent = 'Mengunggah...';
            const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.jpg`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(fileName, compressedFile, { contentType: 'image/jpeg' });
                
            if (uploadError) throw new Error('Gagal mengunggah foto: ' + uploadError.message);
            
            const { data: publicUrlData } = supabase.storage
                .from('product-images')
                .getPublicUrl(fileName);
                
            image_url = publicUrlData.publicUrl;
        }

        const payload = { 
            name, price, stock, outlet_id: activeOutletId,
            price_gofood: price_gofood ? price_gofood : null,
            price_grabfood: price_grabfood ? price_grabfood : null,
            price_shopeefood: price_shopeefood ? price_shopeefood : null
        };
        if (image_url) payload.image_url = image_url; // Only update image_url if a new one is uploaded

        if (id) {
            const { error } = await supabase.from('products').update(payload).eq('id', id);
            if (error) throw new Error(error.message);
            showToast('Produk diperbarui', 'success');
        } else {
            const { error } = await supabase.from('products').insert([payload]);
            if (error) throw new Error(error.message);
            showToast('Produk ditambahkan', 'success');
        }
        
        document.getElementById('modal-product').classList.add('hidden');
        loadProducts();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Simpan';
    }
}

window.editProduct = (id) => {
    const p = products.find(x => x.id === id);
    if (!p) return;
    document.getElementById('product-id').value = p.id;
    document.getElementById('product-name').value = p.name;
    document.getElementById('product-price').value = p.price;
    document.getElementById('product-price-gofood').value = p.price_gofood || '';
    document.getElementById('product-price-grabfood').value = p.price_grabfood || '';
    document.getElementById('product-price-shopeefood').value = p.price_shopeefood || '';
    document.getElementById('product-stock').value = p.stock;
    document.getElementById('product-image').value = '';
    
    if (p.image_url) {
        document.getElementById('product-image-preview').src = p.image_url;
        document.getElementById('product-image-preview-container').classList.remove('hidden');
    } else {
        document.getElementById('product-image-preview').src = '';
        document.getElementById('product-image-preview-container').classList.add('hidden');
    }

    document.getElementById('product-modal-title').textContent = 'Edit Produk';
    document.getElementById('modal-product').classList.remove('hidden');
};

window.deleteProduct = async (id) => {
    if(!confirm('Hapus produk ini?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if(error) showToast(error.message, 'error');
    else loadProducts();
};

window.showAllProducts = () => {
    productShowAll = true;
    renderProducts();
};

window.addToCart = (id) => {
    const product = products.find(p => p.id === id);
    if (!product) return;
    const existing = cart.find(item => item.product_id === id);
    const currentQty = existing ? existing.quantity : 0;
    if (currentQty >= product.stock) return showToast('Stok tidak mencukupi!', 'error');
    
    if (existing) existing.quantity += 1;
    else cart.push({ product_id: product.id, name: product.name, price: product.price, product: product, quantity: 1 });
    renderCart();
};

window.updateQty = (id, delta) => {
    const item = cart.find(i => i.product_id === id);
    if (!item) return;
    const product = products.find(p => p.id === id);
    if (delta > 0 && item.quantity >= product.stock) return showToast('Stok tidak mencukupi!', 'error');
    
    item.quantity += delta;
    if (item.quantity <= 0) cart = cart.filter(i => i.product_id !== id);
    renderCart();
};

window.emptyCart = () => {
    cart = [];
    renderCart();
};

let _prevCartIds = []; // Track previous cart product IDs for surgical update detection

function renderCart(forceRebuild = false) {
    localStorage.setItem('pos_cart', JSON.stringify(cart));
    const container = document.getElementById('cart-items-container');
    const subtotalEl = document.getElementById('cart-subtotal');
    const totalEl = document.getElementById('cart-total');
    
    const method = document.getElementById('modal-payment-method').value;
    
    // Update effective price in cart items based on payment method
    cart.forEach(item => {
        let effectivePrice = item.product.price;
        if (method === 'Go Food' && item.product.price_gofood) effectivePrice = item.product.price_gofood;
        else if (method === 'Grab Food' && item.product.price_grabfood) effectivePrice = item.product.price_grabfood;
        else if (method === 'Shopee Food' && item.product.price_shopeefood) effectivePrice = item.product.price_shopeefood;
        item.price = effectivePrice;
    });

    if (cart.length === 0) {
        container.innerHTML = `<div class="empty-cart"><i class="ph-duotone ph-shopping-cart"></i><p>Keranjang kosong</p></div>`;
        subtotalEl.textContent = 'Rp 0';
        totalEl.textContent = 'Rp 0';
        document.getElementById('btn-checkout').disabled = true;
        _prevCartIds = [];
        calculateChange();
        return;
    }

    // Determine if we need a full rebuild or can do surgical update
    const currentIds = cart.map(i => i.product_id);
    const idsMatch = !forceRebuild && currentIds.length === _prevCartIds.length && currentIds.every((id, idx) => id === _prevCartIds[idx]);

    if (idsMatch) {
        // SURGICAL UPDATE: Only update qty and price text, no DOM destruction
        cart.forEach(item => {
            const el = container.querySelector(`[data-product-id="${item.product_id}"]`);
            if (el) {
                el.querySelector('.qty-display').textContent = item.quantity;
                el.querySelector('.cart-item-price').textContent = `Rp ${(item.price * item.quantity).toLocaleString('id-ID')}`;
            }
        });
    } else {
        // FULL REBUILD: Items were added or removed
        container.innerHTML = cart.map(item => `
            <div class="cart-item" data-product-id="${item.product_id}">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">Rp ${(item.price * item.quantity).toLocaleString('id-ID')}</div>
                </div>
                <div class="cart-item-controls">
                    <button class="qty-btn" onclick="updateQty('${item.product_id}', -1)"><i class="ph ph-minus"></i></button>
                    <div class="qty-display">${item.quantity}</div>
                    <button class="qty-btn" onclick="updateQty('${item.product_id}', 1)"><i class="ph ph-plus"></i></button>
                </div>
            </div>
        `).join('');
        _prevCartIds = [...currentIds];
    }
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    subtotalEl.textContent = `Rp ${total.toLocaleString('id-ID')}`;
    totalEl.textContent = `Rp ${total.toLocaleString('id-ID')}`;
    document.getElementById('btn-checkout').disabled = false;
    calculateChange();
}

function calculateTotals() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    let discountPercent = parseFloat(document.getElementById('modal-discount-percent').value) || 0;
    let discountNominal = parseFloat(document.getElementById('modal-discount-nominal').value) || 0;
    
    let discount = (subtotal * discountPercent / 100) + discountNominal;
    if (discount > subtotal) discount = subtotal;
    
    const afterDiscount = subtotal - discount;
    
    const activeOutlet = posOutletsList.find(o => o.id === activeOutletId) || {};
    const taxRate = activeOutlet.tax_rate_percent || 0;
    
    const tax = Math.round(afterDiscount * taxRate / 100);
    const total = afterDiscount + tax;
    
    return { subtotal, discount, tax, taxRate, total };
}

function calculateChange() {
    const totals = calculateTotals();
    const total = totals.total;
    
    // Update breakdowns in modal
    const subtotalEl = document.getElementById('modal-checkout-subtotal');
    const discountEl = document.getElementById('modal-checkout-discount');
    const taxEl = document.getElementById('modal-checkout-tax');
    const taxRateEl = document.getElementById('modal-checkout-tax-rate');
    const modalTotalEl = document.getElementById('modal-checkout-total');
    
    if (subtotalEl) subtotalEl.textContent = `Rp ${totals.subtotal.toLocaleString('id-ID')}`;
    if (discountEl) discountEl.textContent = `-Rp ${totals.discount.toLocaleString('id-ID')}`;
    if (taxEl) taxEl.textContent = `Rp ${totals.tax.toLocaleString('id-ID')}`;
    if (taxRateEl) taxRateEl.textContent = totals.taxRate;
    if (modalTotalEl) modalTotalEl.textContent = `Rp ${total.toLocaleString('id-ID')}`;
    
    const method = document.getElementById('modal-payment-method').value;
    const cashGroup = document.getElementById('modal-cash-input-group');
    const changeGroup = document.getElementById('modal-change-group');
    const changeEl = document.getElementById('modal-cart-change');
    const btn = document.getElementById('btn-confirm-payment');
    
    if (method === 'Tunai') {
        cashGroup.classList.remove('hidden');
        if (changeGroup) changeGroup.classList.remove('hidden');
        const receivedStr = document.getElementById('modal-cash-received').value;
        const received = receivedStr ? parseFloat(receivedStr) : 0;
        const change = received - total;
        
        if (received >= total && total > 0) {
            changeEl.textContent = `Rp ${change.toLocaleString('id-ID')}`;
            changeEl.className = 'text-success';
            btn.disabled = false;
        } else {
            changeEl.textContent = `Kurang Rp ${Math.abs(change).toLocaleString('id-ID')}`;
            changeEl.className = 'text-muted';
            btn.disabled = true;
        }
    } else {
        cashGroup.classList.add('hidden');
        if (changeGroup) changeGroup.classList.add('hidden');
        changeEl.textContent = 'Rp 0';
        changeEl.className = 'text-success';
        btn.disabled = total <= 0;
    }
}

function openCheckoutModal() {
    if (cart.length === 0 || !activeOutletId) return;
    
    // Reset payment method first so renderCart uses the correct price
    document.getElementById('modal-payment-method').value = 'Tunai';
    document.getElementById('modal-cash-received').value = '';
    document.getElementById('modal-customer-name').value = '';
    document.getElementById('modal-discount-percent').value = '';
    document.getElementById('modal-discount-nominal').value = '';
    
    // Pastikan update harga sebelum total dihitung
    renderCart();

    calculateChange(); // update UI elements in modal
    document.getElementById('modal-checkout').classList.remove('hidden');
}

async function finalizeCheckout() {
    if (cart.length === 0 || !activeOutletId) return;
    
    const totals = calculateTotals();
    const method = document.getElementById('modal-payment-method').value;
    let received = totals.total;
    
    if (method === 'Tunai') {
        received = parseFloat(document.getElementById('modal-cash-received').value) || 0;
        if (received < totals.total) return showToast('Uang tunai kurang!', 'error');
    }

    const btn = document.getElementById('btn-confirm-payment');
    btn.disabled = true;
    btn.textContent = 'Memproses...';

    const profile = getCurrentProfile();
    const customer_name = document.getElementById('modal-customer-name').value || null;

    const itemsPayload = cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price
    }));

    function generateUUID() {
        if (crypto.randomUUID) return crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    let isOffline = !navigator.onLine;
    let trxData = { 
        id: generateUUID(), 
        created_at: new Date().toISOString(),
        outlet_id: activeOutletId
    };
    let receiptNo = "";
    
    if (!isOffline) {
        try {
            const { data, error } = await supabase.rpc('process_checkout', {
                p_id: trxData.id,
                p_outlet_id: activeOutletId,
                p_cashier_id: profile.id,
                p_subtotal_amount: totals.subtotal,
                p_discount_amount: totals.discount,
                p_tax_amount: totals.tax,
                p_total_amount: totals.total,
                p_payment_method: method,
                p_customer_name: customer_name,
                p_items: itemsPayload
            });
            
            if (error) {
                console.error("RPC Error:", error);
                isOffline = true;
            } else {
                trxData.id = data; // the UUID returned
                receiptNo = await generateReceiptNumber(trxData);
            }
        } catch (e) {
            console.error("RPC Exception:", e);
            isOffline = true;
        }
    }
    
    if (isOffline) {
        receiptNo = "OFFLINE-" + Math.floor(Math.random() * 10000);
        const offlineTrx = {
            id: trxData.id,
            outlet_id: activeOutletId,
            cashier_id: profile.id,
            subtotal_amount: totals.subtotal,
            discount_amount: totals.discount,
            tax_amount: totals.tax,
            total_amount: totals.total,
            payment_method: method,
            customer_name: customer_name,
            items: itemsPayload,
            created_at: trxData.created_at,
            receipt_no: receiptNo
        };
        await saveOfflineTransaction(offlineTrx);
        showToast('Offline! Transaksi disimpan di perangkat.', 'warning');
    }
    
    // Kurangi stok di UI agar kasir langsung melihat perubahan
    for (const item of cart) {
        const p = products.find(x => x.id === item.product_id);
        if (p) p.stock -= item.quantity;
    }
    
    const change = received - totals.total;
    const cartClone = [...cart];
    const finalTotals = { ...totals };
    
    // Close Checkout Modal
    document.getElementById('modal-checkout').classList.add('hidden');
    
    // Reset Cart
    cart = [];
    renderCart();
    
    // Reset btn confirm
    btn.textContent = 'Konfirmasi & Cetak';
    btn.disabled = false;
    
    // Generate struk text untuk dicetak
    const activeOutlet = posOutletsList.find(o => o.id === activeOutletId) || {};
    const outletName = activeOutlet.name || 'Toko Kami';
    let displayName = null;
    displayName = profile.name || profile.email;
    
    // ESC/POS Commands
    const ESC_INIT = "\x1B\x40";
    const ALIGN_CENTER = "\x1B\x61\x01";
    const ALIGN_LEFT = "\x1B\x61\x00";
    const BOLD_ON = "\x1B\x45\x01";
    const BOLD_OFF = "\x1B\x45\x00";

    // Remove redeclaration since receiptNo is already declared and generated above
    // const receiptNo = await generateReceiptNumber(trxData);
    
    // Helper untuk memotong teks agar tidak turun ke bawah (maks 32 karakter standar 58mm)
    const tLine = (str) => str.length > 32 ? str.substring(0, 32) : str;
    
    // Helper untuk memecah teks panjang menjadi beberapa baris
    const wrapLine = (str, len = 32) => {
        if (!str) return [];
        const lines = [];
        let curr = '';
        str.split(' ').forEach(word => {
            if ((curr + word).length > len) {
                if (curr) lines.push(curr.trim());
                curr = word + ' ';
            } else {
                curr += word + ' ';
            }
        });
        if (curr) lines.push(curr.trim());
        return lines;
    };

    let text = ESC_INIT;
    text += ALIGN_CENTER + BOLD_ON + tLine(outletName) + "\n" + BOLD_OFF;
    
    if (activeOutlet.address) {
        wrapLine(activeOutlet.address).forEach(line => {
            text += line + "\n";
        });
    }
    
    if(activeOutlet.phone) text += tLine(activeOutlet.phone) + "\n";
    text += ALIGN_LEFT;
    text += `--------------------------------\n`;
    text += tLine(`No      : ${receiptNo}`) + `\n`;
    text += tLine(`Tanggal : ${new Date(trxData.created_at).toLocaleString('id-ID')}`) + `\n`;
    text += tLine(`Kasir   : ${displayName}`) + `\n`;
    if (customer_name) {
        text += tLine(`Customer: ${customer_name}`) + `\n`;
    }
    text += tLine(`Metode  : ${method}`) + `\n`;
    text += `--------------------------------\n`;
    
    cartClone.forEach(item => {
        text += tLine(`${item.name}`) + `\n`;
        const qtyStr = `${item.quantity}x`;
        const priceStr = item.price.toLocaleString('id-ID');
        const subtotalStr = (item.price * item.quantity).toLocaleString('id-ID');
        
        let line = ` ${qtyStr}   ${priceStr}`;
        let spaces = 32 - line.length - subtotalStr.length;
        if(spaces < 1) spaces = 1;
        line += " ".repeat(spaces) + subtotalStr;
        text += `${line}\n`;
    });
    
    text += `--------------------------------\n`;
    
    const subtotalStr = finalTotals.subtotal.toLocaleString('id-ID');
    text += `Subtotal: ${" ".repeat(32 - 10 - subtotalStr.length)}${subtotalStr}\n`;
    
    if (finalTotals.discount > 0) {
        const discountStr = "-" + finalTotals.discount.toLocaleString('id-ID');
        text += `Diskon  : ${" ".repeat(32 - 10 - discountStr.length)}${discountStr}\n`;
    }
    
    if (finalTotals.tax > 0) {
        const taxStr = finalTotals.tax.toLocaleString('id-ID');
        text += `Pajak   : ${" ".repeat(32 - 10 - taxStr.length)}${taxStr}\n`;
    }

    const totalStr = finalTotals.total.toLocaleString('id-ID');
    text += `Total   : ${" ".repeat(32 - 10 - totalStr.length)}${totalStr}\n`;
    const receivedStr = received.toLocaleString('id-ID');
    text += `Tunai   : ${" ".repeat(32 - 10 - receivedStr.length)}${receivedStr}\n`;
    const changeStr = change.toLocaleString('id-ID');
    text += `Kembali : ${" ".repeat(32 - 10 - changeStr.length)}${changeStr}\n`;
    text += `--------------------------------\n`;
    text += ALIGN_CENTER;
    text += `Terima Kasih\n`;
    text += `Follow Us On @D.OneChicken\n`;
    text += `#ChickenRasaNo1\n`;
    text += `\n\n\n`; // Add extra line feeds at the bottom
    
    // Auto cetak Native Web Bluetooth dengan logo
    const logoUrl = window.location.origin + window.location.pathname.replace('index.html', '') + 'receipt_logo_print.png';
    printReceiptNative(text, logoUrl);
    
    // Tampilkan Modal Success
    const changeAmountEl = document.getElementById('success-change-amount');
    if (changeAmountEl) changeAmountEl.textContent = 'Rp ' + change.toLocaleString('id-ID');
    document.getElementById('modal-checkout-success').classList.remove('hidden');

    // Auto close after 1 second
    setTimeout(() => {
        document.getElementById('modal-checkout-success').classList.add('hidden');
    }, 1000);

    showToast('Transaksi Berhasil!', 'success');
    generateOrderId();
    await loadProducts();
    btn.textContent = 'Bayar & Cetak';
}

function printReceipt(trxId, cartItems, total, received, method, trxDate = null, cashierName = null, customerName = null, totalsObj = null) {
    const dateStr = trxDate ? new Date(trxDate).toLocaleString('id-ID') : new Date().toLocaleString('id-ID');
    const change = received - total;
    
    // Retrieve the active outlet data from posOutletsList (available for all POS users)
    const activeOutlet = posOutletsList.find(o => o.id === activeOutletId) || {};
    const outletName = activeOutlet.name || 'Toko Kami';
    const outletAddress = activeOutlet.address || '';
    const outletPhone = activeOutlet.phone || '';

    // Set outlet data
    document.getElementById('receipt-store-name').textContent = outletName;
    document.getElementById('receipt-store-address').textContent = outletAddress;
    document.getElementById('receipt-store-phone').textContent = outletPhone;
    
    // Set transaction data
    document.getElementById('receipt-date').textContent = dateStr;
    document.getElementById('receipt-id').textContent = trxId; // trxId is now the receiptNo
    
    // Use cashier name if provided, else use current profile
    let displayName = cashierName;
    if (!displayName) {
        const profile = getCurrentProfile();
        displayName = profile.name || profile.email;
    }
    document.getElementById('receipt-cashier').textContent = displayName;
    document.getElementById('receipt-method').textContent = method;
    
    // Set customer name if provided
    const customerEl = document.getElementById('receipt-customer-row');
    if (customerName) {
        document.getElementById('receipt-customer-name').textContent = customerName;
        customerEl.style.display = 'block';
    } else {
        customerEl.style.display = 'none';
    }

    const itemsHtml = cartItems.map(item => `
        <tr><td colspan="3">${item.name}</td></tr>
        <tr>
            <td>${item.quantity}x</td>
            <td>${item.price.toLocaleString('id-ID')}</td>
            <td class="text-right">${(item.price * item.quantity).toLocaleString('id-ID')}</td>
        </tr>
    `).join('');
    document.getElementById('receipt-items').innerHTML = itemsHtml;
    
    if (totalsObj) {
        document.getElementById('receipt-subtotal').textContent = totalsObj.subtotal.toLocaleString('id-ID');
        if (totalsObj.discount > 0) {
            document.getElementById('receipt-discount-row').style.display = 'flex';
            document.getElementById('receipt-discount').textContent = '-' + totalsObj.discount.toLocaleString('id-ID');
        } else {
            document.getElementById('receipt-discount-row').style.display = 'none';
        }
        if (totalsObj.tax > 0) {
            document.getElementById('receipt-tax-row').style.display = 'flex';
            document.getElementById('receipt-tax').textContent = totalsObj.tax.toLocaleString('id-ID');
        } else {
            document.getElementById('receipt-tax-row').style.display = 'none';
        }
    } else {
        document.getElementById('receipt-subtotal').textContent = total.toLocaleString('id-ID');
        document.getElementById('receipt-discount-row').style.display = 'none';
        document.getElementById('receipt-tax-row').style.display = 'none';
    }

    document.getElementById('receipt-total').textContent = total.toLocaleString('id-ID');
    document.getElementById('receipt-cash').textContent = received.toLocaleString('id-ID');
    document.getElementById('receipt-change').textContent = change.toLocaleString('id-ID');

    window.print();
}

function printReceiptRawBT(trxId, cartItems, total, received, method, trxDate = null, cashierName = null, customerName = null) {
    const dateStr = trxDate ? new Date(trxDate).toLocaleString('id-ID') : new Date().toLocaleString('id-ID');
    const change = received - total;
    
    const activeOutlet = posOutletsList.find(o => o.id === activeOutletId) || {};
    const outletName = activeOutlet.name || 'Toko Kami';
    
    let displayName = cashierName;
    if (!displayName) {
        const profile = getCurrentProfile();
        displayName = profile.name || profile.email;
    }

    // Helper untuk memotong teks (harus 1 baris)
    const tLine = (str) => str.length > 32 ? str.substring(0, 32) : str;

    // Helper untuk memecah teks panjang menjadi beberapa baris
    const wrapLine = (str, len = 32) => {
        if (!str) return [];
        const lines = [];
        let curr = '';
        str.split(' ').forEach(word => {
            if ((curr + word).length > len) {
                if (curr) lines.push(curr.trim());
                curr = word + ' ';
            } else {
                curr += word + ' ';
            }
        });
        if (curr) lines.push(curr.trim());
        return lines;
    };

    let text = `[C]<img>https://nailur.github.io/pos/receipt_logo_print.png</img>\n`;
    text += `[C]<b>${tLine(outletName)}</b>\n`;
    
    if (activeOutlet.address) {
        wrapLine(activeOutlet.address).forEach(line => {
            text += `[C]${line}\n`;
        });
    }
    
    if (activeOutlet.phone) text += `[C]${tLine(activeOutlet.phone)}\n`;
    text += `--------------------------------\n`;
    text += tLine(`No      : ${trxId}`) + `\n`;
    text += tLine(`Tanggal : ${dateStr}`) + `\n`;
    text += tLine(`Kasir   : ${displayName}`) + `\n`;
    if (customerName) {
        text += tLine(`Customer: ${customerName}`) + `\n`;
    }
    text += tLine(`Metode  : ${method}`) + `\n`;
    text += `--------------------------------\n`;
    
    cartItems.forEach(item => {
        text += tLine(`${item.name}`) + `\n`;
        const qtyStr = `${item.quantity}x`;
        const priceStr = item.price.toLocaleString('id-ID');
        const subtotalStr = (item.price * item.quantity).toLocaleString('id-ID');
        
        let line = ` ${qtyStr}   ${priceStr}`;
        let spaces = 32 - line.length - subtotalStr.length;
        if(spaces < 1) spaces = 1;
        line += " ".repeat(spaces) + subtotalStr;
        text += `${line}\n`;
    });
    
    text += `--------------------------------\n`;
    
    const totalStr = total.toLocaleString('id-ID');
    text += `Total   : ${" ".repeat(32 - 10 - totalStr.length)}${totalStr}\n`;
    
    const receivedStr = received.toLocaleString('id-ID');
    text += `Tunai   : ${" ".repeat(32 - 10 - receivedStr.length)}${receivedStr}\n`;
    
    const changeStr = change.toLocaleString('id-ID');
    text += `Kembali : ${" ".repeat(32 - 10 - changeStr.length)}${changeStr}\n`;
    
    text += `--------------------------------\n`;
    text += `[C]Terima Kasih\n`;
    text += `[C]Follow Us On @D.OneChicken\n`;
    text += `[C]#ChickenRasaNo1\n`;
    text += `\n\n`; // Add paper feed

    // Membuka aplikasi RawBT dengan intent
    const rawbt_url = "intent:" + encodeURI(text) + "#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;";
    window.location.href = rawbt_url;
}

// Generate TRN-YYYYMMDD-XXXX
async function generateReceiptNumber(trx) {
    if (!trx || !trx.created_at || !trx.outlet_id) return trx?.id ? trx.id.substring(0,8).toUpperCase() : "TRN-0000";
    try {
        const trxDate = new Date(trx.created_at);
        const { count, error } = await supabase.from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('outlet_id', trx.outlet_id)
            .lte('created_at', trx.created_at);
            
        let counter = count || 1;
        
        const activeOutlet = typeof posOutletsList !== 'undefined' ? posOutletsList.find(o => o.id === trx.outlet_id) : null;
        let outletCode = activeOutlet && activeOutlet.code ? activeOutlet.code.toUpperCase() : null;
        if (!outletCode) {
             outletCode = activeOutlet && activeOutlet.name ? activeOutlet.name.replace(/[^A-Za-z0-9]/g, '').substring(0, 3).toUpperCase() : 'TRN';
        }
        
        return `${outletCode}-${counter.toString().padStart(6, '0')}`;
    } catch(e) {
        return trx.id.substring(0,8).toUpperCase();
    }
}

async function exportToExcel() {
    if (!activeOutletId) return showToast('Pilih outlet terlebih dahulu', 'error');
    
    const startDate = document.getElementById('history-date-start').value;
    const endDate = document.getElementById('history-date-end').value;
    if (!startDate || !endDate) return showToast('Pilih rentang tanggal terlebih dahulu', 'error');
    
    // Konversi ke UTC
    const startOfDay = new Date(`${startDate}T00:00:00`).toISOString();
    const endOfDay = new Date(`${endDate}T23:59:59.999`).toISOString();

    const btn = document.getElementById('btn-export-excel');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Mengekspor...';

    try {
        // 1. Fetch Transactions
        const { data: trxData, error: trxError } = await supabase.from('transactions')
            .select('*, profiles(email, name)')
            .eq('outlet_id', activeOutletId)
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay)
            .order('created_at', { ascending: false });

        if (trxError) throw trxError;
        if (!trxData || trxData.length === 0) {
            showToast('Tidak ada data transaksi untuk diekspor', 'error');
            return;
        }

        // 2. Fetch Transaction Items for those transactions
        const trxIds = trxData.map(t => t.id);
        const { data: itemsData, error: itemsError } = await supabase.from('transaction_items')
            .select('*, products(name)')
            .in('transaction_id', trxIds);

        if (itemsError) throw itemsError;

        // 3. Flatten data for Excel
        const exportRows = [];
        
        for (const trx of trxData) {
            const cashierName = trx.profiles?.name || trx.profiles?.email || '-';
            const trxItems = itemsData.filter(i => i.transaction_id === trx.id);
            
            if (trxItems.length === 0) {
                // If somehow no items
                exportRows.push({
                    'ID Transaksi': trx.id.substring(0, 8),
                    'Tanggal': new Date(trx.created_at).toLocaleString('id-ID'),
                    'Kasir': cashierName,
                    'Metode Pembayaran': trx.payment_method,
                    'Produk': '-',
                    'Kuantitas': 0,
                    'Harga Satuan': 0,
                    'Subtotal Produk': 0,
                    'Total Transaksi': trx.total_amount
                });
            } else {
                for (const item of trxItems) {
                    exportRows.push({
                        'ID Transaksi': trx.id.substring(0, 8),
                        'Tanggal': new Date(trx.created_at).toLocaleString('id-ID'),
                        'Kasir': cashierName,
                        'Metode Pembayaran': trx.payment_method,
                        'Produk': item.products?.name || 'Produk Terhapus',
                        'Kuantitas': item.quantity,
                        'Harga Satuan': item.price,
                        'Subtotal Produk': item.quantity * item.price,
                        'Total Transaksi': trx.total_amount // Total of the whole transaction
                    });
                }
            }
        }

        // 4. Generate Excel using SheetJS
        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Riwayat Transaksi");
        
        // Adjust column widths automatically
        const colWidths = [
            { wch: 15 }, // ID
            { wch: 20 }, // Tanggal
            { wch: 25 }, // Kasir
            { wch: 15 }, // Metode
            { wch: 25 }, // Produk
            { wch: 10 }, // Qty
            { wch: 15 }, // Harga
            { wch: 15 }, // Subtotal
            { wch: 15 }  // Total
        ];
        worksheet['!cols'] = colWidths;

        let filenameDate = startDate === endDate ? startDate : `${startDate}_to_${endDate}`;
        XLSX.writeFile(workbook, `Laporan_Transaksi_${filenameDate}.xlsx`);
        showToast('Berhasil mengunduh Excel', 'success');

    } catch (e) {
        console.error(e);
        showToast('Gagal mengekspor Excel', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

async function loadHistory(resetPage = true) {
    if (!activeOutletId) return;
    
    if (resetPage) historyPage = 0;
    
    const from = historyPage * HISTORY_PAGE_SIZE;
    const to = from + HISTORY_PAGE_SIZE - 1;
    
    let query = supabase.from('transactions')
        .select('*, profiles(email, name)', { count: 'exact' })
        .eq('outlet_id', activeOutletId)
        .order('created_at', { ascending: false });

    const startDate = document.getElementById('history-date-start');
    const endDate = document.getElementById('history-date-end');
    
    if (startDate && startDate.value && endDate && endDate.value) {
        const startOfDay = new Date(`${startDate.value}T00:00:00`).toISOString();
        const endOfDay = new Date(`${endDate.value}T23:59:59.999`).toISOString();
        
        query = query.gte('created_at', startOfDay)
                     .lte('created_at', endOfDay);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
        showToast('Gagal memuat riwayat', 'error');
        return;
    }

    historyTotalCount = count || 0;
    const tbody = document.querySelector('#history-table tbody');
    const paginationEl = document.getElementById('history-pagination');

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Belum ada transaksi</td></tr>';
        if (paginationEl) paginationEl.innerHTML = '';
        return;
    }

    const rowsHTML = await Promise.all(data.map(async trx => {
        const receiptNo = await generateReceiptNumber(trx);
        return `
            <tr>
                <td>${new Date(trx.created_at).toLocaleString('id-ID')}</td>
                <td>${receiptNo}</td>
                <td>Rp ${trx.total_amount.toLocaleString('id-ID')}</td>
                <td>${trx.payment_method}</td>
                <td>${trx.profiles?.name || trx.profiles?.email || '-'}</td>
                <td>
                    <button class="btn btn-icon" style="color:var(--primary);" onclick="viewTransactionDetails('${trx.id}')" title="Detail"><i class="ph ph-eye"></i></button>
                </td>
            </tr>
        `;
    }));
    tbody.innerHTML = rowsHTML.join('');
    enableTableSort('history-table');

    // Render pagination controls
    const totalPages = Math.ceil(historyTotalCount / HISTORY_PAGE_SIZE);
    if (paginationEl && totalPages > 1) {
        const currentPage = historyPage + 1;
        paginationEl.innerHTML = `
            <button ${historyPage === 0 ? 'disabled' : ''} onclick="changeHistoryPage(${historyPage - 1})">
                <i class="ph ph-caret-left"></i> Prev
            </button>
            <span class="pagination-info">Halaman ${currentPage} dari ${totalPages} (${historyTotalCount} transaksi)</span>
            <button ${currentPage >= totalPages ? 'disabled' : ''} onclick="changeHistoryPage(${historyPage + 1})">
                Next <i class="ph ph-caret-right"></i>
            </button>
        `;
    } else if (paginationEl) {
        paginationEl.innerHTML = historyTotalCount > 0 ? `<span class="pagination-info">${historyTotalCount} transaksi</span>` : '';
    }
}

window.changeHistoryPage = (page) => {
    historyPage = page;
    loadHistory(false);
};

window.viewTransactionDetails = async (trxId) => {
    const { data: trx, error: trxError } = await supabase.from('transactions')
        .select('*, profiles(email, name)')
        .eq('id', trxId)
        .single();
        
    const { data: items, error: itemsError } = await supabase.from('transaction_items')
        .select('*, products(name)')
        .eq('transaction_id', trxId);
        
    if (trxError || itemsError) return showToast('Gagal memuat detail transaksi', 'error');

    const receiptNo = await generateReceiptNumber(trx);
    document.getElementById('detail-trx-id').textContent = receiptNo;
    document.getElementById('detail-trx-date').textContent = new Date(trx.created_at).toLocaleString('id-ID');
    document.getElementById('detail-trx-cashier').textContent = trx.profiles?.name || trx.profiles?.email || '-';
    
    const customerWrapper = document.getElementById('detail-trx-customer-wrapper');
    if (trx.customer_name) {
        document.getElementById('detail-trx-customer').textContent = trx.customer_name;
        if (customerWrapper) customerWrapper.style.display = 'block';
    } else {
        if (customerWrapper) customerWrapper.style.display = 'none';
    }
    
    document.getElementById('detail-trx-method').textContent = trx.payment_method;
    
    const tbody = document.getElementById('detail-trx-items');
    tbody.innerHTML = items.map(item => `
        <tr>
            <td>${item.products?.name || 'Produk Terhapus'}</td>
            <td style="text-align: right;">${item.quantity}</td>
            <td style="text-align: right;">${item.price.toLocaleString('id-ID')}</td>
            <td style="text-align: right;">${(item.quantity * item.price).toLocaleString('id-ID')}</td>
        </tr>
    `).join('');
    
    document.getElementById('detail-trx-total').textContent = `Rp ${trx.total_amount.toLocaleString('id-ID')}`;
    
    document.getElementById('btn-reprint-trx').onclick = () => reprintReceipt(trx, items);
    document.getElementById('modal-transaction-details').classList.remove('hidden');
}

async function reprintReceipt(trx, items) {
    let cashierName = null;
    if (trx.profiles) {
        cashierName = trx.profiles.name || trx.profiles.email;
    }
    const cartItems = items.map(i => ({
        name: i.products?.name || 'Produk',
        quantity: i.quantity,
        price: i.price
    }));
    const receiptNo = await generateReceiptNumber(trx);
    const totalsObj = {
        subtotal: trx.subtotal_amount || trx.total_amount,
        discount: trx.discount_amount || 0,
        tax: trx.tax_amount || 0,
        total: trx.total_amount || 0
    };
    printReceipt(receiptNo, cartItems, trx.total_amount, trx.total_amount, trx.payment_method, trx.created_at, cashierName, trx.customer_name, totalsObj);
}



// Table Sorting Logic
function enableTableSort(tableId) {
    window.enableTableSort = enableTableSort;
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
async function loadAttendanceHistory() {
    const profile = getCurrentProfile();
    const role = profile?.role;
    if (!['superadmin', 'owner', 'kepala_cabang', 'kepala_toko'].includes(role)) return;

    const startDate = document.getElementById('attendance-date-start');
    const endDate = document.getElementById('attendance-date-end');
    if (!startDate || !startDate.value || !endDate || !endDate.value) return;

    const { data, error } = await supabase.rpc('get_attendance_report', {
        p_start_date: startDate.value,
        p_end_date: endDate.value
    });

    if (error) {
        showToast('Gagal memuat riwayat absensi', 'error');
        return;
    }

    const tbody = document.querySelector('#attendance-table tbody');
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Belum ada data absensi</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(record => {
        const name = record.name || record.email || 'Unknown';
        const roleName = record.role || '-';
        const branchName = record.branch_name || '-';
        const dateStr = new Date(record.record_date).toLocaleDateString('id-ID');
        const clockIn = record.clock_in ? new Date(record.clock_in).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-';
        const clockOut = record.clock_out ? new Date(record.clock_out).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-';
        
        const statusBadge = record.status === 'PRS' 
            ? '<span style="background:var(--success); color:white; padding:2px 8px; border-radius:4px; font-size:0.8rem;">PRS</span>'
            : '<span style="background:var(--danger); color:white; padding:2px 8px; border-radius:4px; font-size:0.8rem;">OFF</span>';

        return `
            <tr>
                <td>${dateStr}</td>
                <td><strong>${name}</strong></td>
                <td style="text-transform: capitalize;">${roleName.replace('_', ' ')}</td>
                <td>${branchName}</td>
                <td>${clockIn}</td>
                <td>${clockOut}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    }).join('');
    
    enableTableSort('attendance-table');
}

window.exportAttendanceExcel = async () => {
    const profile = getCurrentProfile();
    const role = profile?.role;
    if (!['superadmin', 'owner', 'kepala_cabang', 'kepala_toko'].includes(role)) return;

    const startDate = document.getElementById('attendance-date-start').value;
    const endDate = document.getElementById('attendance-date-end').value;
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
                <strong><i class="ph-fill ph-bell-ringing"></i> ${title || 'Pengumuman'}</strong>
                <button class="btn-close-toast" style="background:none; border:none; color:white; cursor:pointer;"><i class="ph ph-x"></i></button>
            </div>
            <div style="font-size: 0.95rem; white-space: pre-wrap;">${body || ''}</div>
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
        // Send to GLOBAL channel — all devices receive it
        if (globalChannel) {
            const resp = await globalChannel.send({
                type: 'broadcast',
                event: 'system_announcement',
                payload: { title, body, target }
            });
            sendSuccess = resp === 'ok';
        }
    } else {
        // Send to specific USER's channel — only that user receives it
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
                
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            const container = document.getElementById('toast-container');
                            if (container) {
                                const toast = document.createElement('div');
                                toast.className = `toast toast-info`;
                                toast.style.background = 'var(--primary)';
                                toast.style.display = 'flex';
                                toast.style.flexDirection = 'column';
                                toast.style.gap = '10px';
                                toast.style.opacity = '1';
                                toast.innerHTML = `
                                    <span>Versi terbaru aplikasi telah tersedia!</span>
                                    <button id="btn-pwa-refresh" style="padding: 6px 12px; border: none; border-radius: 4px; background: white; color: var(--primary); font-weight: bold; cursor: pointer;">Refresh Sekarang</button>
                                `;
                                container.appendChild(toast);
                                
                                document.getElementById('btn-pwa-refresh').addEventListener('click', () => {
                                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                                });
                            }
                        }
                    });
                });
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

// ------------------------------
// OFFLINE SYNC (IndexedDB)
// ------------------------------
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('POSDatabase', 2);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('offline_transactions')) {
                db.createObjectStore('offline_transactions', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('offline_products')) {
                db.createObjectStore('offline_products', { keyPath: 'outlet_id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getOfflineProducts(outletId) {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('offline_products', 'readonly');
            const store = tx.objectStore('offline_products');
            const req = store.get(outletId);
            req.onsuccess = () => resolve(req.result ? req.result.products : null);
            req.onerror = () => reject(req.error);
        });
    } catch(e) { return null; }
}

async function saveOfflineProducts(outletId, productsData) {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('offline_products', 'readwrite');
            const store = tx.objectStore('offline_products');
            store.put({ outlet_id: outletId, products: productsData, updated_at: new Date().toISOString() });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch(e) { console.error('Failed saving offline products', e); }
}

async function saveOfflineTransaction(trx) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('offline_transactions', 'readwrite');
        const store = tx.objectStore('offline_transactions');
        store.put(trx);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function getOfflineTransactions() {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('offline_transactions', 'readonly');
        const store = tx.objectStore('offline_transactions');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function clearOfflineTransaction(id) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('offline_transactions', 'readwrite');
        const store = tx.objectStore('offline_transactions');
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

window.addEventListener('online', async () => {
    console.log('Online! Menyinkronkan data...');
    await syncOfflineTransactions();
});

let isSyncing = false;
async function syncOfflineTransactions() {
    if (!navigator.onLine || isSyncing) return;
    
    isSyncing = true;
    try {
        const pending = await getOfflineTransactions();
        if (pending.length === 0) return;
    
    showToast(`Menyinkronkan ${pending.length} transaksi offline...`, 'info');
    let successCount = 0;
    for (const trx of pending) {
        try {
            const { error } = await supabase.rpc('process_checkout', {
                p_id: trx.id,
                p_outlet_id: trx.outlet_id,
                p_cashier_id: trx.cashier_id,
                p_subtotal_amount: trx.subtotal_amount,
                p_discount_amount: trx.discount_amount,
                p_tax_amount: trx.tax_amount,
                p_total_amount: trx.total_amount,
                p_payment_method: trx.payment_method,
                p_customer_name: trx.customer_name,
                p_items: trx.items
            });
            if (!error) {
                await clearOfflineTransaction(trx.id);
                successCount++;
            } else {
                console.error('Offline Sync Error:', error);
            }
        } catch (e) {
            console.error('Failed to sync offline transaction', e);
        }
    }
    
    if (successCount > 0) {
        showToast(`${successCount} transaksi offline berhasil disinkronkan!`, 'success');
        if (typeof loadHistory === 'function') loadHistory();
    }
    } finally {
        isSyncing = false;
    }
}
