import { supabase } from './supabase.js';
import { supabaseAdmin } from './supabase-admin.js';
import { checkSession, login, logout, getCurrentUser, getCurrentProfile } from './auth.js';

// DOM Elements
const appContainer = document.getElementById('app-container');
const loginView = document.getElementById('login-view');
const superadminView = document.getElementById('superadmin-view');
const posView = document.getElementById('pos-view');

// Toasts
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    if (type === 'error') toast.style.background = 'var(--danger)';
    if (type === 'success') toast.style.background = 'var(--success)';
    
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Global State
let products = [];
let cart = [];
let branchesList = [];
let outletsList = [];
let posOutletsList = []; // Outlets accessible by current POS user
let activeOutletId = null;

// Initialize
async function init() {
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
    if (profile.role === 'superadmin' || profile.role === 'owner') {
        // We will show superadmin view for both superadmin and owner for simplicity, 
        // but owner can also access POS. Let's redirect owner to POS with full access.
        if (profile.role === 'superadmin') {
            showView('superadmin');
            document.getElementById('sa-user-info').textContent = 'Superadmin';
            initSuperadmin();
        } else {
            // Owner
            showView('pos');
            await initPosMultiOutlet(profile);
        }
    } else if (profile.role === 'kepala_cabang') {
        showView('pos');
        await initPosMultiOutlet(profile);
    } else if (profile.role === 'kepala_toko' || profile.role === 'kasir') {
        showView('pos');
        activeOutletId = profile.outlet_id;
        document.getElementById('pos-outlet-name').textContent = profile.outlets?.name || 'Toko';
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
}

async function initPosMultiOutlet(profile) {
    document.getElementById('btn-add-product').classList.remove('hidden');
    
    // Load accessible outlets
    let query = supabase.from('outlets').select('*').order('name');
    if (profile.role === 'kepala_cabang') {
        query = query.eq('branch_id', profile.branch_id);
    }
    const { data } = await query;
    posOutletsList = data || [];
    
    const selector = document.getElementById('active-outlet-selector');
    const nameLabel = document.getElementById('pos-outlet-name');
    
    if (posOutletsList.length > 0) {
        selector.classList.remove('hidden');
        nameLabel.classList.add('hidden');
        selector.innerHTML = posOutletsList.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
        activeOutletId = posOutletsList[0].id;
    } else {
        nameLabel.textContent = 'Tidak ada outlet';
    }
    
    initPos();
}

// ------------------------------
// EVENT LISTENERS SETUP
// ------------------------------
function setupEventListeners() {
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

    // Logout
    document.querySelectorAll('.btn-logout').forEach(btn => {
        btn.addEventListener('click', () => logout());
    });

    // Modals Close
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.currentTarget.getAttribute('data-close');
            document.getElementById(modalId).classList.add('hidden');
        });
    });

    // Main Tabs (Superadmin)
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
            e.currentTarget.classList.add('active');
            const targetId = e.currentTarget.getAttribute('data-target');
            document.getElementById(targetId).classList.remove('hidden');
        });
    });

    // POS Tabs
    document.querySelectorAll('.pos-nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.pos-nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.pos-tab-pane').forEach(p => p.classList.add('hidden'));
            e.currentTarget.classList.add('active');
            const targetId = e.currentTarget.getAttribute('data-target');
            const tabEl = document.getElementById(targetId);
            tabEl.classList.remove('hidden');
            if(targetId === 'history-tab-content') loadHistory();
        });
    });

    // Outlet Selector Change (Owner/Kepala Cabang)
    const outletSelector = document.getElementById('active-outlet-selector');
    if (outletSelector) {
        outletSelector.addEventListener('change', (e) => {
            activeOutletId = e.target.value;
            generateOrderId();
            loadProducts();
            if(!document.getElementById('history-tab-content').classList.contains('hidden')) {
                loadHistory();
            }
        });
    }

    // Superadmin Actions
    document.getElementById('btn-add-branch').addEventListener('click', () => {
        document.getElementById('form-branch').reset();
        document.getElementById('modal-branch').classList.remove('hidden');
    });

    document.getElementById('btn-add-outlet').addEventListener('click', () => {
        document.getElementById('form-outlet').reset();
        document.getElementById('outlet-branch').innerHTML = branchesList.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
        document.getElementById('modal-outlet').classList.remove('hidden');
    });

    document.getElementById('btn-add-user').addEventListener('click', () => {
        document.getElementById('form-user').reset();
        document.getElementById('user-branch').innerHTML = branchesList.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
        document.getElementById('user-outlet').innerHTML = outletsList.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
        document.getElementById('modal-user').classList.remove('hidden');
        handleRoleSelectionChange();
    });

    document.getElementById('user-role').addEventListener('change', handleRoleSelectionChange);

    document.getElementById('form-branch').addEventListener('submit', handleAddBranch);
    document.getElementById('form-outlet').addEventListener('submit', handleAddOutlet);
    document.getElementById('form-user').addEventListener('submit', handleAddUser);

    // POS Actions
    document.getElementById('btn-add-product').addEventListener('click', () => {
        if (!activeOutletId) { showToast('Pilih outlet dulu', 'error'); return; }
        document.getElementById('form-product').reset();
        document.getElementById('product-id').value = '';
        document.getElementById('product-modal-title').textContent = 'Tambah Produk';
        document.getElementById('modal-product').classList.remove('hidden');
    });

    document.getElementById('form-product').addEventListener('submit', handleSaveProduct);
    document.getElementById('product-search').addEventListener('input', (e) => renderProducts(e.target.value));
    
    document.getElementById('cash-received').addEventListener('input', calculateChange);
    document.getElementById('btn-checkout').addEventListener('click', checkout);
}

function handleRoleSelectionChange() {
    const role = document.getElementById('user-role').value;
    const branchGroup = document.getElementById('group-user-branch');
    const outletGroup = document.getElementById('group-user-outlet');
    
    if (role === 'owner' || role === 'superadmin') {
        branchGroup.classList.add('hidden');
        outletGroup.classList.add('hidden');
    } else if (role === 'kepala_cabang') {
        branchGroup.classList.remove('hidden');
        outletGroup.classList.add('hidden');
    } else {
        branchGroup.classList.add('hidden');
        outletGroup.classList.remove('hidden');
    }
}

// ------------------------------
// SUPERADMIN LOGIC
// ------------------------------
async function initSuperadmin() {
    await loadBranches();
    await loadOutlets();
    await loadUsers();
}

async function loadBranches() {
    const { data, error } = await supabase.from('branches').select('*').order('created_at', { ascending: false });
    if (error) return showToast('Gagal memuat cabang', 'error');
    branchesList = data;
    const tbody = document.querySelector('#branches-table tbody');
    tbody.innerHTML = data.map(b => `
        <tr>
            <td><strong>${b.name}</strong></td>
            <td></td>
        </tr>
    `).join('');
}

async function loadOutlets() {
    const { data, error } = await supabase.from('outlets').select('*, branches(name)').order('created_at', { ascending: false });
    if (error) return showToast('Gagal memuat outlet', 'error');
    outletsList = data;
    const tbody = document.querySelector('#outlets-table tbody');
    tbody.innerHTML = data.map(o => `
        <tr>
            <td><strong>${o.name}</strong></td>
            <td>${o.branches?.name || '-'}</td>
            <td>${o.address || '-'}</td>
            <td></td>
        </tr>
    `).join('');
}

async function loadUsers() {
    const { data, error } = await supabase.from('profiles').select('*, outlets(name), branches(name)').neq('role', 'superadmin');
    if (error) return showToast('Gagal memuat pegawai', 'error');
    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = data.map(u => `
        <tr>
            <td>${u.email}</td>
            <td><span class="user-badge">${u.role}</span></td>
            <td>${u.role === 'kepala_cabang' ? (u.branches?.name || '-') : (u.outlets?.name || '-')}</td>
            <td></td>
        </tr>
    `).join('');
}

async function handleAddBranch(e) {
    e.preventDefault();
    const name = document.getElementById('branch-name').value;
    const { error } = await supabase.from('branches').insert([{ name }]);
    if (error) showToast(error.message, 'error');
    else { showToast('Cabang ditambahkan!', 'success'); document.getElementById('modal-branch').classList.add('hidden'); loadBranches(); }
}

async function handleAddOutlet(e) {
    e.preventDefault();
    const name = document.getElementById('outlet-name').value;
    const branch_id = document.getElementById('outlet-branch').value;
    const address = document.getElementById('outlet-address').value;

    const { error } = await supabase.from('outlets').insert([{ name, address, branch_id }]);
    if (error) showToast(error.message, 'error');
    else { showToast('Outlet ditambahkan!', 'success'); document.getElementById('modal-outlet').classList.add('hidden'); loadOutlets(); }
}

async function handleAddUser(e) {
    e.preventDefault();
    const email = document.getElementById('user-email').value;
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;
    let branch_id = null;
    let outlet_id = null;

    if (role === 'kepala_cabang') branch_id = document.getElementById('user-branch').value;
    if (role === 'kepala_toko' || role === 'kasir') outlet_id = document.getElementById('user-outlet').value;

    const btn = document.getElementById('btn-save-user');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({ email, password });
    if (authError) {
        showToast(authError.message, 'error');
        btn.disabled = false; btn.textContent = 'Simpan'; return;
    }

    setTimeout(async () => {
        const { error: updateError } = await supabase.from('profiles')
            .update({ role, branch_id, outlet_id })
            .eq('id', authData.user.id);
            
        if (updateError) showToast('Gagal set profile: ' + updateError.message, 'error');
        else { showToast('Pegawai berhasil ditambahkan!', 'success'); document.getElementById('modal-user').classList.add('hidden'); loadUsers(); }
        btn.disabled = false; btn.textContent = 'Simpan';
    }, 1000);
}


// ------------------------------
// POS / ADMIN LOGIC
// ------------------------------
async function initPos() {
    generateOrderId();
    if (activeOutletId) await loadProducts();
}

function generateOrderId() {
    const id = 'ORD-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    document.getElementById('current-order-id').textContent = id;
    cart = [];
    document.getElementById('cash-received').value = '';
    renderCart();
}

async function loadProducts() {
    if (!activeOutletId) return;
    const { data, error } = await supabase.from('products').select('*').eq('outlet_id', activeOutletId).order('name');
    if (error) return showToast('Gagal memuat produk', 'error');
    products = data;
    renderProducts();
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

    grid.innerHTML = filtered.map(p => `
        <div class="product-card" onclick="addToCart('${p.id}')">
            <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
                <div class="product-name">${p.name}</div>
                <div class="product-price">Rp ${p.price.toLocaleString('id-ID')}</div>
                <div class="text-sm text-muted">Stok: ${p.stock}</div>
            </div>
            ${canEdit ? `
                <div style="margin-top:10px; display:flex; gap:5px; justify-content:center;" onclick="event.stopPropagation()">
                    <button class="btn btn-icon" style="color:var(--primary)" onclick="editProduct('${p.id}')"><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn btn-icon" onclick="deleteProduct('${p.id}')"><i class="ph ph-trash"></i></button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

async function handleSaveProduct(e) {
    e.preventDefault();
    if (!activeOutletId) return;
    const id = document.getElementById('product-id').value;
    const name = document.getElementById('product-name').value;
    const price = document.getElementById('product-price').value;
    const stock = document.getElementById('product-stock').value;

    if (id) {
        const { error } = await supabase.from('products').update({ name, price, stock }).eq('id', id);
        if (error) showToast(error.message, 'error');
        else { showToast('Produk diperbarui', 'success'); document.getElementById('modal-product').classList.add('hidden'); loadProducts(); }
    } else {
        const { error } = await supabase.from('products').insert([{ name, price, stock, outlet_id: activeOutletId }]);
        if (error) showToast(error.message, 'error');
        else { showToast('Produk ditambahkan', 'success'); document.getElementById('modal-product').classList.add('hidden'); loadProducts(); }
    }
}

window.editProduct = (id) => {
    const p = products.find(x => x.id === id);
    if (!p) return;
    document.getElementById('product-id').value = p.id;
    document.getElementById('product-name').value = p.name;
    document.getElementById('product-price').value = p.price;
    document.getElementById('product-stock').value = p.stock;
    document.getElementById('product-modal-title').textContent = 'Edit Produk';
    document.getElementById('modal-product').classList.remove('hidden');
};

window.deleteProduct = async (id) => {
    if(!confirm('Hapus produk ini?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if(error) showToast(error.message, 'error');
    else loadProducts();
};

window.addToCart = (id) => {
    const product = products.find(p => p.id === id);
    if (!product) return;
    const existing = cart.find(item => item.product_id === id);
    const currentQty = existing ? existing.quantity : 0;
    if (currentQty >= product.stock) return showToast('Stok tidak mencukupi!', 'error');
    
    if (existing) existing.quantity += 1;
    else cart.push({ product_id: product.id, name: product.name, price: product.price, quantity: 1 });
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

function renderCart() {
    const container = document.getElementById('cart-items-container');
    const subtotalEl = document.getElementById('cart-subtotal');
    const totalEl = document.getElementById('cart-total');
    
    if (cart.length === 0) {
        container.innerHTML = `<div class="empty-cart"><i class="ph-duotone ph-shopping-cart"></i><p>Keranjang kosong</p></div>`;
        subtotalEl.textContent = 'Rp 0';
        totalEl.textContent = 'Rp 0';
        document.getElementById('btn-checkout').disabled = true;
        calculateChange();
        return;
    }
    
    container.innerHTML = cart.map(item => `
        <div class="cart-item">
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
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    subtotalEl.textContent = `Rp ${total.toLocaleString('id-ID')}`;
    totalEl.textContent = `Rp ${total.toLocaleString('id-ID')}`;
    document.getElementById('btn-checkout').disabled = false;
    calculateChange();
}

function calculateChange() {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const receivedStr = document.getElementById('cash-received').value;
    const received = receivedStr ? parseFloat(receivedStr) : 0;
    const change = received - total;
    const changeEl = document.getElementById('cart-change');
    const btn = document.getElementById('btn-checkout');
    
    if (received >= total && total > 0) {
        changeEl.textContent = `Rp ${change.toLocaleString('id-ID')}`;
        changeEl.className = 'text-success';
        btn.disabled = false;
    } else {
        changeEl.textContent = `Kurang Rp ${Math.abs(change).toLocaleString('id-ID')}`;
        changeEl.className = 'text-muted';
        btn.disabled = true;
    }
}

async function checkout() {
    if (cart.length === 0 || !activeOutletId) return;
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const received = parseFloat(document.getElementById('cash-received').value) || 0;
    if (received < total) return showToast('Uang tunai kurang!', 'error');

    const btn = document.getElementById('btn-checkout');
    btn.disabled = true;
    btn.textContent = 'Memproses...';

    const profile = getCurrentProfile();

    const { data: trxData, error: trxError } = await supabase.from('transactions').insert([{
        outlet_id: activeOutletId,
        cashier_id: profile.id,
        total_amount: total,
        payment_method: 'cash'
    }]).select().single();

    if (trxError) {
        showToast('Gagal menyimpan transaksi', 'error');
        btn.disabled = false; btn.textContent = 'Bayar & Cetak'; return;
    }

    const items = cart.map(item => ({
        transaction_id: trxData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price
    }));

    await supabase.from('transaction_items').insert(items);
    
    for (const item of cart) {
        const product = products.find(p => p.id === item.product_id);
        if (product) await supabase.from('products').update({ stock: product.stock - item.quantity }).eq('id', item.product_id);
    }

    printReceipt(trxData.id, cart, total, received);
    showToast('Transaksi Berhasil!', 'success');
    generateOrderId();
    await loadProducts();
    btn.textContent = 'Bayar & Cetak';
}

function printReceipt(trxId, cartItems, total, received) {
    const dateStr = new Date().toLocaleString('id-ID');
    const change = received - total;
    const outletName = document.getElementById('pos-outlet-name').textContent !== 'Loading...' 
        ? document.getElementById('pos-outlet-name').textContent 
        : (document.getElementById('active-outlet-selector')?.options[document.getElementById('active-outlet-selector').selectedIndex]?.text || 'Toko Kami');

    document.getElementById('receipt-store-name').textContent = outletName;
    document.getElementById('receipt-store-address').textContent = '';
    document.getElementById('receipt-date').textContent = dateStr;
    document.getElementById('receipt-id').textContent = trxId.substring(0,8);
    document.getElementById('receipt-cashier').textContent = getCurrentUser().email;

    const itemsHtml = cartItems.map(item => `
        <tr><td colspan="3">${item.name}</td></tr>
        <tr>
            <td>${item.quantity}x</td>
            <td>${item.price.toLocaleString('id-ID')}</td>
            <td class="text-right">${(item.price * item.quantity).toLocaleString('id-ID')}</td>
        </tr>
    `).join('');
    document.getElementById('receipt-items').innerHTML = itemsHtml;
    document.getElementById('receipt-total').textContent = total.toLocaleString('id-ID');
    document.getElementById('receipt-cash').textContent = received.toLocaleString('id-ID');
    document.getElementById('receipt-change').textContent = change.toLocaleString('id-ID');

    window.print();
}

async function loadHistory() {
    if (!activeOutletId) return;
    const { data, error } = await supabase.from('transactions')
        .select('*, profiles(email)')
        .eq('outlet_id', activeOutletId)
        .order('created_at', { ascending: false });

    if (error) {
        showToast('Gagal memuat riwayat', 'error');
        return;
    }

    const tbody = document.querySelector('#history-table tbody');
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Belum ada transaksi</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(trx => `
        <tr>
            <td>${new Date(trx.created_at).toLocaleString('id-ID')}</td>
            <td>${trx.id.substring(0,8)}</td>
            <td>Rp ${trx.total_amount.toLocaleString('id-ID')}</td>
            <td>${trx.payment_method}</td>
            <td>${trx.profiles?.email || '-'}</td>
        </tr>
    `).join('');
}

// Start App
init();
