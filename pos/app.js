import { supabase } from './supabase.js';
import { supabaseAdmin } from './supabase-admin.js';
import { checkSession, login, logout, getCurrentUser, getCurrentProfile } from './auth.js';

// DOM Elements
const appContainer = document.getElementById('app-container');
const loginView = document.getElementById('login-view');
const superadminView = document.getElementById('superadmin-view');
const posView = document.getElementById('pos-view');
const receiptView = document.getElementById('receipt-view');

// Toasts
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    // Simple inline style for colors
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
let outletsList = [];

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
        posView.classList.add('pos-layout'); // ensure layout class
    }
}

function routeUser(profile) {
    if (!profile) {
        showToast('Profil tidak ditemukan', 'error');
        logout();
        return;
    }
    if (profile.role === 'superadmin') {
        showView('superadmin');
        document.getElementById('sa-user-info').textContent = 'Superadmin';
        initSuperadmin();
    } else if (profile.role === 'kepala_toko' || profile.role === 'kasir') {
        showView('pos');
        document.getElementById('pos-outlet-name').textContent = profile.outlets?.name || 'Toko';
        if (profile.role === 'kepala_toko') {
            document.getElementById('btn-add-product').classList.remove('hidden');
        }
        initPos();
    } else {
        showToast('Role tidak valid', 'error');
        logout();
    }
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
        if (sessionData) {
            routeUser(sessionData.profile);
        }
        
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

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
            
            e.currentTarget.classList.add('active');
            const targetId = e.currentTarget.getAttribute('data-target');
            document.getElementById(targetId).classList.remove('hidden');
        });
    });

    // Superadmin Actions
    document.getElementById('btn-add-outlet').addEventListener('click', () => {
        document.getElementById('form-outlet').reset();
        document.getElementById('modal-outlet').classList.remove('hidden');
    });

    document.getElementById('btn-add-user').addEventListener('click', () => {
        document.getElementById('form-user').reset();
        // Populate outlet select
        const select = document.getElementById('user-outlet');
        select.innerHTML = outletsList.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
        document.getElementById('modal-user').classList.remove('hidden');
    });

    document.getElementById('form-outlet').addEventListener('submit', handleAddOutlet);
    document.getElementById('form-user').addEventListener('submit', handleAddUser);

    // POS Actions
    document.getElementById('btn-add-product').addEventListener('click', () => {
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


// ------------------------------
// SUPERADMIN LOGIC
// ------------------------------
async function initSuperadmin() {
    await loadOutlets();
    await loadUsers();
}

async function loadOutlets() {
    const { data, error } = await supabase.from('outlets').select('*').order('created_at', { ascending: false });
    if (error) {
        showToast('Gagal memuat outlet', 'error');
        return;
    }
    outletsList = data;
    const tbody = document.querySelector('#outlets-table tbody');
    tbody.innerHTML = data.map(o => `
        <tr>
            <td><strong>${o.name}</strong></td>
            <td>${o.address || '-'}</td>
            <td>
                <!-- future actions -->
            </td>
        </tr>
    `).join('');
}

async function loadUsers() {
    const { data, error } = await supabase.from('profiles').select('*, outlets(name)').neq('role', 'superadmin');
    if (error) {
        showToast('Gagal memuat pegawai', 'error');
        return;
    }
    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = data.map(u => `
        <tr>
            <td>${u.email}</td>
            <td><span class="user-badge">${u.role}</span></td>
            <td>${u.outlets?.name || '-'}</td>
            <td>
                <!-- future actions -->
            </td>
        </tr>
    `).join('');
}

async function handleAddOutlet(e) {
    e.preventDefault();
    const name = document.getElementById('outlet-name').value;
    const address = document.getElementById('outlet-address').value;

    const { error } = await supabase.from('outlets').insert([{ name, address }]);
    if (error) {
        showToast(error.message, 'error');
    } else {
        showToast('Outlet ditambahkan!', 'success');
        document.getElementById('modal-outlet').classList.add('hidden');
        loadOutlets();
    }
}

async function handleAddUser(e) {
    e.preventDefault();
    const email = document.getElementById('user-email').value;
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;
    const outlet_id = document.getElementById('user-outlet').value;

    const btn = document.getElementById('btn-save-user');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    // Create user using secondary client to prevent logout
    const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
        email,
        password
    });

    if (authError) {
        showToast(authError.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Simpan';
        return;
    }

    // User created, the trigger in DB will create a 'kasir' profile by default.
    // We need to update that profile with the correct role and outlet_id.
    const userId = authData.user.id;
    
    // Wait a short moment for trigger to complete
    setTimeout(async () => {
        const { error: updateError } = await supabase.from('profiles')
            .update({ role, outlet_id })
            .eq('id', userId);
            
        if (updateError) {
            showToast('Gagal set profile: ' + updateError.message, 'error');
        } else {
            showToast('Pegawai berhasil ditambahkan!', 'success');
            document.getElementById('modal-user').classList.add('hidden');
            loadUsers();
        }
        btn.disabled = false;
        btn.textContent = 'Simpan';
    }, 1000);
}


// ------------------------------
// POS / ADMIN LOGIC
// ------------------------------
async function initPos() {
    generateOrderId();
    await loadProducts();
}

function generateOrderId() {
    const id = 'ORD-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    document.getElementById('current-order-id').textContent = id;
    cart = [];
    document.getElementById('cash-received').value = '';
    renderCart();
}

async function loadProducts() {
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (error) {
        showToast('Gagal memuat produk', 'error');
        return;
    }
    products = data;
    renderProducts();
}

function renderProducts(search = '') {
    const grid = document.getElementById('product-grid');
    const profile = getCurrentProfile();
    const isKepalaToko = profile.role === 'kepala_toko';
    
    const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    
    if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-cart"><p>Tidak ada produk</p></div>`;
        return;
    }

    grid.innerHTML = filtered.map(p => `
        <div class="product-card" onclick="addToCart('${p.id}')">
            <!-- Placeholder for image if we had one -->
            <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
                <div class="product-name">${p.name}</div>
                <div class="product-price">Rp ${p.price.toLocaleString('id-ID')}</div>
                <div class="text-sm text-muted">Stok: ${p.stock}</div>
            </div>
            ${isKepalaToko ? `
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
    const id = document.getElementById('product-id').value;
    const name = document.getElementById('product-name').value;
    const price = document.getElementById('product-price').value;
    const stock = document.getElementById('product-stock').value;
    const outlet_id = getCurrentProfile().outlet_id;

    if (id) {
        // Edit
        const { error } = await supabase.from('products').update({ name, price, stock }).eq('id', id);
        if (error) showToast(error.message, 'error');
        else { showToast('Produk diperbarui', 'success'); document.getElementById('modal-product').classList.add('hidden'); loadProducts(); }
    } else {
        // Add
        const { error } = await supabase.from('products').insert([{ name, price, stock, outlet_id }]);
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
    
    // Check stock
    const existing = cart.find(item => item.product_id === id);
    const currentQty = existing ? existing.quantity : 0;
    
    if (currentQty >= product.stock) {
        showToast('Stok tidak mencukupi!', 'error');
        return;
    }
    
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            product_id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1
        });
    }
    renderCart();
};

window.updateQty = (id, delta) => {
    const item = cart.find(i => i.product_id === id);
    if (!item) return;
    
    const product = products.find(p => p.id === id);
    
    if (delta > 0 && item.quantity >= product.stock) {
        showToast('Stok tidak mencukupi!', 'error');
        return;
    }
    
    item.quantity += delta;
    if (item.quantity <= 0) {
        cart = cart.filter(i => i.product_id !== id);
    }
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
    if (cart.length === 0) return;
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const received = parseFloat(document.getElementById('cash-received').value) || 0;
    
    if (received < total) {
        showToast('Uang tunai kurang!', 'error');
        return;
    }

    const btn = document.getElementById('btn-checkout');
    btn.disabled = true;
    btn.textContent = 'Memproses...';

    const profile = getCurrentProfile();
    const outlet_id = profile.outlet_id;
    const cashier_id = profile.id;

    // 1. Insert Transaction
    const { data: trxData, error: trxError } = await supabase.from('transactions').insert([{
        outlet_id,
        cashier_id,
        total_amount: total,
        payment_method: 'cash'
    }]).select().single();

    if (trxError) {
        showToast('Gagal menyimpan transaksi', 'error');
        btn.disabled = false;
        btn.textContent = 'Bayar & Cetak';
        return;
    }

    // 2. Insert Items and Update Stock
    const items = cart.map(item => ({
        transaction_id: trxData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price
    }));

    const { error: itemsError } = await supabase.from('transaction_items').insert(items);
    if (itemsError) {
        console.error(itemsError);
    }
    
    // Deduct stock (Simple update loop, ideally use an RPC function for atomic updates)
    for (const item of cart) {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
            await supabase.from('products').update({ stock: product.stock - item.quantity }).eq('id', item.product_id);
        }
    }

    // 3. Print Receipt
    printReceipt(trxData.id, cart, total, received);

    // 4. Reset
    showToast('Transaksi Berhasil!', 'success');
    generateOrderId();
    await loadProducts(); // reload stock
    
    btn.textContent = 'Bayar & Cetak';
}

function printReceipt(trxId, cartItems, total, received) {
    const profile = getCurrentProfile();
    const dateStr = new Date().toLocaleString('id-ID');
    const change = received - total;

    document.getElementById('receipt-store-name').textContent = profile.outlets?.name || 'Toko Kami';
    document.getElementById('receipt-store-address').textContent = profile.outlets?.address || 'Alamat Toko';
    document.getElementById('receipt-date').textContent = dateStr;
    document.getElementById('receipt-id').textContent = trxId.substring(0,8);
    document.getElementById('receipt-cashier').textContent = getCurrentUser().email;

    const itemsHtml = `
        ${cartItems.map(item => `
            <tr>
                <td colspan="3">${item.name}</td>
            </tr>
            <tr>
                <td>${item.quantity}x</td>
                <td>${item.price.toLocaleString('id-ID')}</td>
                <td class="text-right">${(item.price * item.quantity).toLocaleString('id-ID')}</td>
            </tr>
        `).join('')}
    `;
    document.getElementById('receipt-items').innerHTML = itemsHtml;
    
    document.getElementById('receipt-total').textContent = total.toLocaleString('id-ID');
    document.getElementById('receipt-cash').textContent = received.toLocaleString('id-ID');
    document.getElementById('receipt-change').textContent = change.toLocaleString('id-ID');

    // Trigger Print
    window.print();
}

// Start App
init();
