/**
 * ============================================================================
 * NTPOS - Modul Affiliate (Khusus Superadmin)
 * ============================================================================
 * Modul ini menangani:
 * 1. Master Affiliate Setting (konfigurasi komisi normal & order masal >= 15 qty)
 * 2. Posting / Klaim Affiliate dengan multi-select transaksi yang belum diklaim
 * 3. Kalkulasi otomatis berdasarkan akumulasi qty per produk
 * 4. Pembayaran (Unpaid -> Paid) disertai upload bukti transfer ke storage privat
 * ============================================================================
 */

import { supabase } from './supabase.js';
import { getActiveOutletId } from './state.js';
import { showToast, getLocalToday, generateRandomDocNumber, escapeHtml } from './app.js';
import { getCurrentProfile } from './auth.js';

// State internal
let affiliateSettingsList = [];
let affiliateProductsMaster = [];
let affiliatePostingsList = [];
let unclaimedTransactionsList = [];
let selectedTransactionIds = new Set();

/**
 * Memeriksa apakah user saat ini adalah superadmin
 */
export function isSuperAdmin() {
    const profile = getCurrentProfile();
    return profile && profile.role === 'superadmin';
}

/**
 * ----------------------------------------------------------------------------
 * 1. MASTER AFFILIATE SETTING
 * ----------------------------------------------------------------------------
 */

/**
 * Memuat daftar produk & setting komisi affiliate untuk outlet aktif
 */
export async function loadAffiliateSettings() {
    if (!isSuperAdmin()) return;
    const outletId = getActiveOutletId();
    if (!outletId) return;

    // 1. Ambil seluruh produk di outlet ini
    const { data: productsData, error: prodError } = await supabase
        .from('products')
        .select('id, name, price')
        .eq('outlet_id', outletId)
        .order('name');

    if (prodError) {
        console.error('Error load products for Affiliate Setting:', prodError);
        showToast('Gagal memuat produk untuk Affiliate Setting', 'error');
        return;
    }
    affiliateProductsMaster = productsData || [];

    // 2. Ambil setting affiliate dari affiliate_settings
    const { data: settingsData, error: setError } = await supabase
        .from('affiliate_settings')
        .select('*')
        .eq('outlet_id', outletId);

    if (setError && setError.code !== 'PGRST116') {
        console.error('Error load affiliate settings:', setError);
    }

    const settingsMap = new Map();
    (settingsData || []).forEach(item => {
        settingsMap.set(item.product_id, item);
    });

    // 3. Gabungkan produk dengan settingnya
    affiliateSettingsList = affiliateProductsMaster.map(prod => {
        const setting = settingsMap.get(prod.id) || {};
        const targetQtyVal = setting.bonus_target_qty !== undefined ? setting.bonus_target_qty : 15;
        const bonusNominalVal = setting.bonus_nominal !== undefined ? setting.bonus_nominal : setting.bulk_commission_nominal || 0;
        return {
            product_id: prod.id,
            product_name: prod.name,
            product_price: prod.price || 0,
            commission_nominal: Number(setting.commission_nominal || 0),
            bonus_target_qty: Number(targetQtyVal || 15),
            bonus_nominal: Number(bonusNominalVal || 0),
            bulk_commission_nominal: Number(setting.bulk_commission_nominal || 0),
            setting_id: setting.id || null
        };
    });

    renderAffiliateSettings();
}

/**
 * Menderetkan daftar produk beserta setting komisi di tabel HTML
 */
export function renderAffiliateSettings() {
    const tbody = document.getElementById('affiliate-settings-table')?.querySelector('tbody');
    if (!tbody) return;

    if (affiliateSettingsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Belum ada produk tersedia</td></tr>';
        return;
    }

    tbody.innerHTML = affiliateSettingsList.map(item => {
        const commNormalStr = item.commission_nominal > 0 
            ? `<span class="badge badge-success" style="font-weight:600;">Rp ${item.commission_nominal.toLocaleString('id-ID')} / qty</span>` 
            : `<span style="color:var(--text-secondary)">-</span>`;
        const targetQtyStr = `<strong>${item.bonus_target_qty || 15}</strong> qty`;
        const bonusNominalStr = item.bonus_nominal > 0 
            ? `<span class="badge badge-info" style="font-weight:600;">+ Rp ${item.bonus_nominal.toLocaleString('id-ID')} / ${item.bonus_target_qty || 15} qty</span>` 
            : `<span style="color:var(--text-secondary)">-</span>`;

        return `
            <tr>
                <td><strong>${escapeHtml(item.product_name)}</strong></td>
                <td>Rp ${Number(item.product_price).toLocaleString('id-ID')}</td>
                <td>${commNormalStr}</td>
                <td>${targetQtyStr}</td>
                <td>${bonusNominalStr}</td>
                <td style="text-align:right;">
                    <button class="btn btn-sm btn-secondary" style="padding:6px 10px; font-size:0.95rem; border-radius:8px;" title="Atur Komisi Produk" onclick="window.editAffiliateSetting('${item.product_id}')">
                        <i class="ph ph-pencil-simple"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Membuka modal pengaturan komisi untuk satu produk dari tombol Atur Komisi
 */
window.editAffiliateSetting = function(productId) {
    if (!isSuperAdmin()) return;
    const item = affiliateSettingsList.find(i => i.product_id === productId);
    if (!item) return;

    const modal = document.getElementById('modal-affiliate-setting');
    const selectEl = document.getElementById('affiliate-setting-product-select');
    const nameEl = document.getElementById('affiliate-setting-product-name');
    if (!modal) return;

    if (nameEl) {
        nameEl.textContent = item.product_name;
        nameEl.style.display = 'block';
    }
    if (selectEl) selectEl.style.display = 'none';

    populateSettingForm(item);
    modal.classList.remove('hidden');
};

/**
 * Membuka modal pengaturan komisi dengan dropdown seluruh produk (tombol + Atur Komisi Produk)
 */
export function openCreateAffiliateSettingModal() {
    if (!isSuperAdmin()) return;
    if (affiliateSettingsList.length === 0) {
        showToast('Daftar produk tidak tersedia di outlet ini', 'warning');
        return;
    }
    const modal = document.getElementById('modal-affiliate-setting');
    const selectEl = document.getElementById('affiliate-setting-product-select');
    const nameEl = document.getElementById('affiliate-setting-product-name');
    if (!modal || !selectEl) return;

    selectEl.innerHTML = affiliateSettingsList.map(item => `<option value="${item.product_id}">${escapeHtml(item.product_name)}</option>`).join('');
    selectEl.style.display = 'block';
    if (nameEl) nameEl.style.display = 'none';

    const firstItem = affiliateSettingsList[0];
    populateSettingForm(firstItem);

    selectEl.onchange = (e) => {
        const selectedItem = affiliateSettingsList.find(i => i.product_id === e.target.value);
        if (selectedItem) populateSettingForm(selectedItem);
    };

    modal.classList.remove('hidden');
}

function populateSettingForm(item) {
    document.getElementById('affiliate-setting-product-id').value = item.product_id;
    document.getElementById('affiliate-setting-normal').value = item.commission_nominal > 0 ? item.commission_nominal : '';
    document.getElementById('affiliate-setting-target-qty').value = item.bonus_target_qty || 15;
    document.getElementById('affiliate-setting-bonus-nominal').value = item.bonus_nominal > 0 ? item.bonus_nominal : '';
    if (window.updateAffiliateSettingPreview) window.updateAffiliateSettingPreview();
}

/**
 * Live simulasi perhitungan komisi dan bonus kelipatan di Modal Setting
 */
window.updateAffiliateSettingPreview = function() {
    const previewEl = document.getElementById('affiliate-setting-live-preview');
    if (!previewEl) return;

    const commNormal = parseFloat(document.getElementById('affiliate-setting-normal')?.value) || 0;
    const targetQty = parseInt(document.getElementById('affiliate-setting-target-qty')?.value) || 15;
    const bonusNominal = parseFloat(document.getElementById('affiliate-setting-bonus-nominal')?.value) || 0;

    const calc = (qty) => {
        const base = qty * commNormal;
        let bCount = 0;
        let bTotal = 0;
        if (targetQty > 0 && qty >= targetQty && bonusNominal > 0) {
            bCount = Math.floor(qty / targetQty);
            bTotal = bCount * bonusNominal;
        }
        return { total: base + bTotal, base, bCount, bTotal };
    };

    const q1 = Math.max(1, targetQty - 1);
    const q2 = targetQty;
    const q3 = targetQty + 1;
    const q4 = targetQty * 2;

    const r1 = calc(q1);
    const r2 = calc(q2);
    const r3 = calc(q3);
    const r4 = calc(q4);

    previewEl.innerHTML = `
        <strong style="display:block; margin-bottom: 6px; color:var(--primary);"><i class="ph ph-calculator"></i> Simulasi Perhitungan Komisi & Bonus:</strong>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 6px; color:var(--text-main);">
            <div>Beli <strong>${q1} item</strong>: <span style="font-weight:600;">Rp ${Math.round(r1.total).toLocaleString('id-ID')}</span> <small>(0 bonus)</small></div>
            <div>Beli <strong>${q2} item</strong>: <span style="font-weight:700; color:var(--success);">Rp ${Math.round(r2.total).toLocaleString('id-ID')}</span> <small>(+ Bonus Rp ${Math.round(r2.bTotal).toLocaleString('id-ID')})</small></div>
            <div>Beli <strong>${q3} item</strong>: <span style="font-weight:600;">Rp ${Math.round(r3.total).toLocaleString('id-ID')}</span> <small>(+ Bonus Rp ${Math.round(r3.bTotal).toLocaleString('id-ID')})</small></div>
            <div>Beli <strong>${q4} item</strong>: <span style="font-weight:700; color:var(--success);">Rp ${Math.round(r4.total).toLocaleString('id-ID')}</span> <small>(+ Bonus 2x Rp ${Math.round(r4.bTotal).toLocaleString('id-ID')})</small></div>
        </div>
    `;
};

/**
 * Menyimpan / memperbarui setting komisi ke tabel affiliate_settings
 */
export async function handleSaveAffiliateSetting(event) {
    event.preventDefault();
    if (!isSuperAdmin()) {
        showToast('Hanya superadmin yang dapat mengubah setting Affiliate', 'error');
        return;
    }

    const outletId = getActiveOutletId();
    const productId = document.getElementById('affiliate-setting-product-id')?.value;
    const commNormal = parseFloat(document.getElementById('affiliate-setting-normal')?.value) || 0;
    const targetQty = parseInt(document.getElementById('affiliate-setting-target-qty')?.value) || 15;
    const bonusNominal = parseFloat(document.getElementById('affiliate-setting-bonus-nominal')?.value) || 0;

    if (!outletId || !productId) return;

    const btnSubmit = document.getElementById('btn-save-affiliate-setting');
    if (btnSubmit) btnSubmit.disabled = true;

    const payload = {
        outlet_id: outletId,
        product_id: productId,
        commission_nominal: commNormal,
        bonus_target_qty: targetQty,
        bonus_nominal: bonusNominal,
        bulk_commission_nominal: bonusNominal
    };

    let { error } = await supabase
        .from('affiliate_settings')
        .upsert(payload, { onConflict: 'outlet_id, product_id' });

    if (error && (error.code === '42703' || error.message?.includes('bonus_target_qty') || error.message?.includes('bonus_nominal') || error.message?.includes('column'))) {
        console.warn('Kolom bonus_target_qty/bonus_nominal belum ada di tabel DB. Melakukan fallback ke kolom lama.', error);
        const fallbackPayload = {
            outlet_id: outletId,
            product_id: productId,
            commission_nominal: commNormal,
            bulk_commission_nominal: bonusNominal
        };
        const fallbackRes = await supabase
            .from('affiliate_settings')
            .upsert(fallbackPayload, { onConflict: 'outlet_id, product_id' });
        error = fallbackRes.error;
    }

    if (btnSubmit) btnSubmit.disabled = false;

    if (error) {
        console.error('Save affiliate setting error:', error);
        showToast('Gagal menyimpan setting komisi Affiliate', 'error');
    } else {
        showToast('Setting komisi Affiliate berhasil disimpan', 'success');
        document.getElementById('modal-affiliate-setting')?.classList.add('hidden');
        loadAffiliateSettings();
    }
}

/**
 * ----------------------------------------------------------------------------
 * 2. POSTING AFFILIATE (DAFTAR REKAP KOMISI)
 * ----------------------------------------------------------------------------
 */

/**
 * Memuat riwayat postingan affiliate untuk outlet aktif
 */
export async function loadAffiliatePostings() {
    if (!isSuperAdmin()) return;
    const outletId = getActiveOutletId();
    if (!outletId) return;

    const { data, error } = await supabase
        .from('affiliate_postings')
        .select('*, profiles:created_by(name)')
        .eq('outlet_id', outletId)
        .order('created_at', { ascending: false })
        .limit(100);

    if (error && error.code !== 'PGRST116') {
        console.error('Error load affiliate postings:', error);
        showToast('Gagal memuat daftar Posting Affiliate', 'error');
        return;
    }

    affiliatePostingsList = data || [];
    renderAffiliatePostings();
}

/**
 * Menderetkan riwayat postingan affiliate di tabel HTML
 */
export function renderAffiliatePostings() {
    const tbody = document.getElementById('affiliate-postings-table')?.querySelector('tbody');
    if (!tbody) return;

    if (affiliatePostingsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Belum ada postingan komisi Affiliate</td></tr>';
        return;
    }

    tbody.innerHTML = affiliatePostingsList.map(post => {
        const isPaid = post.status === 'Paid';
        const badgeClass = isPaid ? 'badge-success' : 'badge-warning';
        const dateFormatted = new Date(post.posting_date).toLocaleDateString('id-ID');
        const adminName = post.profiles?.name || '-';

        return `
            <tr>
                <td><strong>${escapeHtml(post.document_number)}</strong></td>
                <td>${dateFormatted}</td>
                <td><strong>${escapeHtml(post.affiliator_name)}</strong></td>
                <td>Rp ${Number(post.total_amount).toLocaleString('id-ID')}</td>
                <td><span class="badge ${badgeClass}">${escapeHtml(post.status)}</span></td>
                <td>
                    ${isPaid && post.proof_attachment ? `
                        <button class="btn btn-sm btn-secondary" onclick="window.viewAffiliateProof('${escapeHtml(post.proof_attachment)}')">
                            <i class="ph ph-image"></i> Lihat Bukti
                        </button>
                    ` : '<span style="color:var(--text-secondary);">-</span>'}
                </td>
                <td>${escapeHtml(adminName)}</td>
                <td style="text-align:right;">
                    <div style="display:inline-flex; gap:6px;">
                        ${!isPaid ? `
                            <button class="btn btn-sm btn-success" onclick="window.openPayAffiliateModal('${post.id}')" title="Bayar Komisi">
                                <i class="ph ph-money"></i> Bayar
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-secondary" onclick="window.viewAffiliateDetails('${post.id}')" title="Lihat Detail">
                            <i class="ph ph-eye"></i> Detail
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="window.deleteAffiliatePosting('${post.id}')" title="Hapus Posting">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * ----------------------------------------------------------------------------
 * 3. PEMBUATAN POSTING AFFILIATE BARU (MULTI-TRANSACTION CLAIM)
 * ----------------------------------------------------------------------------
 */

/**
 * Membuka modal Add Affiliate Posting & memuat transaksi yang belum diklaim
 */
export async function openCreateAffiliateModal() {
    if (!isSuperAdmin()) {
        showToast('Hanya superadmin yang dapat membuat Posting Affiliate', 'error');
        return;
    }
    const outletId = getActiveOutletId();
    if (!outletId) return;

    selectedTransactionIds.clear();

    const modal = document.getElementById('modal-create-affiliate-posting');
    if (!modal) return;

    // Reset form
    document.getElementById('affiliate-posting-affiliator').value = '';
    document.getElementById('affiliate-posting-notes').value = '';
    document.getElementById('affiliate-calculation-preview').innerHTML = '<tr><td colspan="4" style="text-align:center;">Pilih minimal 1 transaksi penjualan untuk menghitung komisi</td></tr>';
    document.getElementById('affiliate-posting-total-display').textContent = 'Rp 0';

    modal.classList.remove('hidden');

    // 1. Ambil ID transaksi yang sudah diklaim (limit agar hemat usage DB)
    const { data: claimedData, error: claimedError } = await supabase
        .from('affiliate_posting_transactions')
        .select('transaction_id')
        .limit(2000);

    const claimedIds = new Set((claimedData || []).map(row => row.transaction_id));

    // 2. Ambil transaksi yang sudah selesai (completed) pada outlet aktif (limit 100 agar hemat usage & cepat)
    const { data: trxs, error: trxError } = await supabase
        .from('transactions')
        .select('id, receipt_no, created_at, customer_name, total_amount')
        .eq('outlet_id', outletId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(100);

    if (trxError) {
        console.error('Error load unclaimed transactions:', trxError);
        showToast('Gagal memuat daftar transaksi penjualan', 'error');
        return;
    }

    // Filter yang belum ada di claimedIds
    unclaimedTransactionsList = (trxs || []).filter(t => !claimedIds.has(t.id));

    renderUnclaimedTransactionsTable();
}

/**
 * Menderetkan daftar transaksi belum diklaim dengan Checkbox
 */
function renderUnclaimedTransactionsTable() {
    const tbody = document.getElementById('affiliate-unclaimed-transactions-table')?.querySelector('tbody');
    if (!tbody) return;

    if (unclaimedTransactionsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Tidak ada transaksi penjualan yang belum diklaim</td></tr>';
        return;
    }

    tbody.innerHTML = unclaimedTransactionsList.map(trx => {
        const receiptNo = trx.receipt_no || trx.id.substring(0, 8).toUpperCase();
        const tDate = new Date(trx.created_at).toLocaleString('id-ID');
        return `
            <tr>
                <td style="text-align:center; width:40px;">
                    <input type="checkbox" class="affiliate-trx-checkbox" value="${trx.id}" onchange="window.onSelectAffiliateTransactions()">
                </td>
                <td><strong>#${escapeHtml(receiptNo)}</strong></td>
                <td>${tDate}</td>
                <td>${escapeHtml(trx.customer_name || '-')}</td>
                <td>Rp ${Number(trx.total_amount).toLocaleString('id-ID')}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Pemicu dari checkbox transaksi: mengaktifkan kalkulasi komisi otomatis
 */
window.onSelectAffiliateTransactions = async function() {
    selectedTransactionIds.clear();
    const checkboxes = document.querySelectorAll('.affiliate-trx-checkbox:checked');
    checkboxes.forEach(cb => selectedTransactionIds.add(cb.value));

    const previewTbody = document.getElementById('affiliate-calculation-preview');
    const totalDisplay = document.getElementById('affiliate-posting-total-display');

    if (selectedTransactionIds.size === 0) {
        if (previewTbody) {
            previewTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Pilih minimal 1 transaksi penjualan untuk menghitung komisi</td></tr>';
        }
        if (totalDisplay) totalDisplay.textContent = 'Rp 0';
        return;
    }

    if (previewTbody) {
        previewTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;"><i class="ph ph-spinner ph-spin"></i> Menghitung komisi item...</td></tr>';
    }

    // 1. Ambil seluruh transaction_items dari transaksi yang dipilih
    const trxIdsArray = Array.from(selectedTransactionIds);
    const { data: itemsData, error: itemsErr } = await supabase
        .from('transaction_items')
        .select('product_id, quantity, products(name)')
        .in('transaction_id', trxIdsArray);

    if (itemsErr) {
        console.error('Error fetching transaction items:', itemsErr);
        if (previewTbody) previewTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--danger);">Gagal menghitung item transaksi</td></tr>';
        return;
    }

    // 2. Akumulasi jumlah kuantitas (total_qty) per produk
    const productQtyMap = new Map();
    (itemsData || []).forEach(item => {
        const prodId = item.product_id;
        if (!prodId) return;
        const prodName = item.products?.name || 'Produk';
        const qty = parseFloat(item.quantity) || 0;
        
        if (!productQtyMap.has(prodId)) {
            productQtyMap.set(prodId, { product_id: prodId, product_name: prodName, total_qty: 0 });
        }
        productQtyMap.get(prodId).total_qty += qty;
    });

    // 3. Cocokkan dengan setting komisi produk di affiliateSettingsList
    const settingMap = new Map();
    affiliateSettingsList.forEach(s => settingMap.set(s.product_id, s));

    const calculatedItems = [];
    let grandTotalCommission = 0;

    productQtyMap.forEach(item => {
        const setting = settingMap.get(item.product_id) || {};
        const commNormal = Number(setting.commission_nominal || 0);
        const targetQty = Number(setting.bonus_target_qty !== undefined ? setting.bonus_target_qty : 15);
        const bonusNominal = Number(setting.bonus_nominal !== undefined ? setting.bonus_nominal : setting.bulk_commission_nominal || 0);

        const baseSubtotal = item.total_qty * commNormal;
        let bonusCount = 0;
        let bonusSubtotal = 0;
        if (targetQty > 0 && item.total_qty >= targetQty && bonusNominal > 0) {
            bonusCount = Math.floor(item.total_qty / targetQty);
            bonusSubtotal = bonusCount * bonusNominal;
        }

        const subtotal = baseSubtotal + bonusSubtotal;
        grandTotalCommission += subtotal;

        let rateLabel = `Rp ${commNormal.toLocaleString('id-ID')} / item`;
        if (bonusCount > 0) {
            rateLabel += ` + Bonus ${bonusCount}x Rp ${bonusNominal.toLocaleString('id-ID')} (Kelipatan ${targetQty})`;
        }

        calculatedItems.push({
            product_id: item.product_id,
            product_name: item.product_name,
            total_qty: item.total_qty,
            commission_rate: commNormal,
            bonus_count: bonusCount,
            bonus_nominal: bonusNominal,
            base_subtotal: baseSubtotal,
            bonus_subtotal: bonusSubtotal,
            rate_label: rateLabel,
            subtotal: subtotal
        });
    });

    // 4. Render hasil kalkulasi di tabel HTML
    if (previewTbody) {
        if (calculatedItems.length === 0) {
            previewTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Tidak ada item produk dalam transaksi yang dipilih</td></tr>';
        } else {
            previewTbody.innerHTML = calculatedItems.map(row => `
                <tr>
                    <td><strong>${escapeHtml(row.product_name)}</strong></td>
                    <td style="text-align:center; font-weight:600;">${row.total_qty}</td>
                    <td>
                        <span>Rp ${Number(row.commission_rate).toLocaleString('id-ID')} / item</span>
                        ${row.bonus_count > 0 ? `<br><span class="badge badge-info" style="font-size:0.78rem;">+ Bonus ${row.bonus_count}x Rp ${Number(row.bonus_nominal).toLocaleString('id-ID')} (Kelipatan ${settingMap.get(row.product_id)?.bonus_target_qty || 15})</span>` : ''}
                    </td>
                    <td style="text-align:right;">
                        <strong>Rp ${Math.round(row.subtotal).toLocaleString('id-ID')}</strong>
                        ${row.bonus_count > 0 ? `<br><small style="color:var(--text-secondary);">(Base: Rp ${Math.round(row.base_subtotal).toLocaleString('id-ID')} + Bonus: Rp ${Math.round(row.bonus_subtotal).toLocaleString('id-ID')})</small>` : ''}
                    </td>
                </tr>
            `).join('');
        }
    }

    if (totalDisplay) {
        totalDisplay.textContent = `Rp ${Math.round(grandTotalCommission).toLocaleString('id-ID')}`;
    }

    // Simpan hasil sementara untuk proses simpan
    window._affiliateCurrentCalculatedItems = calculatedItems;
    window._affiliateCurrentGrandTotal = Math.round(grandTotalCommission);
};

/**
 * Menyimpan Posting Affiliate baru beserta item dan relasi transaksi
 */
export async function handleSaveAffiliatePosting(event) {
    event.preventDefault();
    if (!isSuperAdmin()) {
        showToast('Hanya superadmin yang dapat membuat Posting Affiliate', 'error');
        return;
    }

    const outletId = getActiveOutletId();
    const affiliatorName = document.getElementById('affiliate-posting-affiliator')?.value.trim();
    const notes = document.getElementById('affiliate-posting-notes')?.value.trim() || null;

    if (!affiliatorName) {
        showToast('Nama Afiliator wajib diisi', 'error');
        return;
    }

    if (selectedTransactionIds.size === 0) {
        showToast('Pilih minimal 1 transaksi penjualan', 'error');
        return;
    }

    const calculatedItems = window._affiliateCurrentCalculatedItems || [];
    const grandTotal = window._affiliateCurrentGrandTotal || 0;

    const btnSubmit = document.getElementById('btn-submit-create-affiliate');
    if (btnSubmit) btnSubmit.disabled = true;

    // 1. Generate nomor dokumen (contoh: AFF-20260730-1234)
    const todayStr = getLocalToday().replace(/-/g, '');
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const documentNo = `AFF-${todayStr}-${randNum}`;
    const profile = getCurrentProfile();

    // 2. Insert ke affiliate_postings
    const postingPayload = {
        outlet_id: outletId,
        document_number: documentNo,
        affiliator_name: affiliatorName,
        posting_date: getLocalToday(),
        total_amount: grandTotal,
        status: 'Unpaid',
        notes: notes,
        created_by: profile ? profile.id : null
    };

    const { data: postData, error: postErr } = await supabase
        .from('affiliate_postings')
        .insert([postingPayload])
        .select()
        .single();

    if (postErr || !postData) {
        console.error('Error insert affiliate posting:', postErr);
        showToast('Gagal membuat Posting Affiliate', 'error');
        if (btnSubmit) btnSubmit.disabled = false;
        return;
    }

    const postingId = postData.id;

    // 3. Insert ke affiliate_posting_items
    const itemsPayload = calculatedItems.map(item => ({
        posting_id: postingId,
        product_id: item.product_id,
        product_name: item.product_name,
        total_qty: item.total_qty,
        commission_rate: item.commission_rate,
        subtotal: Math.round(item.subtotal)
    }));

    if (itemsPayload.length > 0) {
        const { error: itemsErr } = await supabase
            .from('affiliate_posting_items')
            .insert(itemsPayload);
        if (itemsErr) console.error('Error insert affiliate posting items:', itemsErr);
    }

    // 4. Insert ke affiliate_posting_transactions (Relasi ke transaksi-transaksi)
    const trxPayload = Array.from(selectedTransactionIds).map(trxId => ({
        posting_id: postingId,
        transaction_id: trxId
    }));

    const { error: trxLinkErr } = await supabase
        .from('affiliate_posting_transactions')
        .insert(trxPayload);

    if (trxLinkErr) {
        console.error('Error link transactions:', trxLinkErr);
    }

    if (btnSubmit) btnSubmit.disabled = false;
    showToast('Posting Affiliate berhasil dibuat', 'success');
    document.getElementById('modal-create-affiliate-posting')?.classList.add('hidden');

    loadAffiliatePostings();
}

/**
 * ----------------------------------------------------------------------------
 * 4. PEMBAYARAN DAN UPLOAD BUKTI TRANSFER
 * ----------------------------------------------------------------------------
 */

/**
 * Membuka modal pembayaran dan upload bukti transfer untuk postingan Unpaid
 */
window.openPayAffiliateModal = function(postingId) {
    if (!isSuperAdmin()) return;
    const post = affiliatePostingsList.find(p => p.id === postingId);
    if (!post) return;

    const modal = document.getElementById('modal-pay-affiliate');
    if (!modal) return;

    document.getElementById('pay-affiliate-posting-id').value = post.id;
    document.getElementById('pay-affiliate-doc-number').textContent = post.document_number;
    document.getElementById('pay-affiliate-name').textContent = post.affiliator_name;
    document.getElementById('pay-affiliate-amount').textContent = `Rp ${Number(post.total_amount).toLocaleString('id-ID')}`;
    
    // Reset file input
    const fileInput = document.getElementById('pay-affiliate-file');
    if (fileInput) fileInput.value = '';

    modal.classList.remove('hidden');
};

/**
 * Menyimpan status pembayaran (Paid) dan mengupload bukti transfer gambar
 */
export async function handleSaveAffiliatePayment(event) {
    event.preventDefault();
    if (!isSuperAdmin()) return;

    const postingId = document.getElementById('pay-affiliate-posting-id')?.value;
    const fileInput = document.getElementById('pay-affiliate-file');
    if (!postingId) return;

    const btnSubmit = document.getElementById('btn-submit-pay-affiliate');
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Memproses...';
    }

    let attachmentFileName = null;

    // 1. Proses upload gambar ke bucket privat "attachments" jika ada file
    if (fileInput && fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        let compressedFile = file;

        // Kompresi gambar di sisi klien menggunakan browser-image-compression
        try {
            if (typeof window.imageCompression === 'function') {
                compressedFile = await window.imageCompression(file, {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1280,
                    useWebWorker: true
                });
            }
        } catch (err) {
            console.warn('Gagal kompresi gambar bukti affiliate, menggunakan file asli:', err);
            compressedFile = file;
        }

        const ext = compressedFile.name.split('.').pop() || 'jpg';
        const fileName = `affiliate_${Date.now()}_${Math.random().toString(36).substr(2, 8)}.${ext}`;

        const { error: uploadErr } = await supabase.storage
            .from('attachments')
            .upload(fileName, compressedFile, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadErr) {
            console.error('Upload bukti transfer error:', uploadErr);
            showToast('Gagal mengupload file bukti transfer', 'error');
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = 'Konfirmasi Bayar';
            }
            return;
        }

        attachmentFileName = fileName;
    }

    // 2. Update status posting menjadi Paid
    const updatePayload = {
        status: 'Paid',
        paid_at: new Date().toISOString()
    };
    if (attachmentFileName) {
        updatePayload.proof_attachment = attachmentFileName;
    }

    const { error: upErr } = await supabase
        .from('affiliate_postings')
        .update(updatePayload)
        .eq('id', postingId);

    if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = 'Konfirmasi Bayar';
    }

    if (upErr) {
        console.error('Update posting status error:', upErr);
        showToast('Gagal mengubah status pembayaran', 'error');
    } else {
        showToast('Pembayaran komisi Affiliate berhasil dicatat', 'success');
        document.getElementById('modal-pay-affiliate')?.classList.add('hidden');
        loadAffiliatePostings();
    }
}

/**
 * Melihat gambar bukti transfer dari storage privat menggunakan signed URL
 */
window.viewAffiliateProof = async function(fileName) {
    if (!isSuperAdmin() || !fileName) return;

    // Buat signed URL berdurasi 1 jam (3600 detik)
    const { data, error } = await supabase.storage
        .from('attachments')
        .createSignedUrl(fileName, 3600);

    if (error || !data || !data.signedUrl) {
        console.error('Error create signed url:', error);
        showToast('Gagal memuat bukti transfer', 'error');
        return;
    }

    const modal = document.getElementById('modal-preview-affiliate-proof');
    const imgEl = document.getElementById('preview-affiliate-proof-img');
    const linkEl = document.getElementById('preview-affiliate-proof-download');

    if (imgEl) imgEl.src = data.signedUrl;
    if (linkEl) linkEl.href = data.signedUrl;
    if (modal) modal.classList.remove('hidden');
};

/**
 * ----------------------------------------------------------------------------
 * 5. LIHAT DETAIL POSTING & HAPUS
 * ----------------------------------------------------------------------------
 */

/**
 * Membuka modal detail rincian item komisi dan transaksi yang diklaim
 */
window.viewAffiliateDetails = async function(postingId) {
    if (!isSuperAdmin()) return;
    const post = affiliatePostingsList.find(p => p.id === postingId);
    if (!post) return;

    const modal = document.getElementById('modal-detail-affiliate');
    if (!modal) return;

    document.getElementById('detail-affiliate-doc').textContent = post.document_number;
    document.getElementById('detail-affiliate-name').textContent = post.affiliator_name;
    document.getElementById('detail-affiliate-date').textContent = new Date(post.posting_date).toLocaleDateString('id-ID');
    document.getElementById('detail-affiliate-status').textContent = post.status;
    document.getElementById('detail-affiliate-total').textContent = `Rp ${Number(post.total_amount).toLocaleString('id-ID')}`;

    // 1. Ambil rincian item produk & transaksi yang diklaim secara paralel (hemat waktu & responsif)
    const [ { data: itemsData }, { data: trxLinks } ] = await Promise.all([
        supabase.from('affiliate_posting_items').select('*').eq('posting_id', postingId),
        supabase.from('affiliate_posting_transactions').select('transaction_id, transactions(receipt_no, created_at, customer_name, total_amount)').eq('posting_id', postingId)
    ]);

    const itemsTbody = document.getElementById('detail-affiliate-items-tbody');
    if (itemsTbody) {
        if (!itemsData || itemsData.length === 0) {
            itemsTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Tidak ada data item</td></tr>';
        } else {
            itemsTbody.innerHTML = itemsData.map(it => `
                <tr>
                    <td><strong>${escapeHtml(it.product_name)}</strong></td>
                    <td style="text-align:center;">${it.total_qty}</td>
                    <td>Rp ${Number(it.commission_rate).toLocaleString('id-ID')}</td>
                    <td style="text-align:right;"><strong>Rp ${Number(it.subtotal).toLocaleString('id-ID')}</strong></td>
                </tr>
            `).join('');
        }
    }

    const trxTbody = document.getElementById('detail-affiliate-trx-tbody');
    if (trxTbody) {
        if (!trxLinks || trxLinks.length === 0) {
            trxTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Tidak ada transaksi tertaut</td></tr>';
        } else {
            trxTbody.innerHTML = trxLinks.map(t => {
                const tx = t.transactions || {};
                const recNo = tx.receipt_no || t.transaction_id?.substring(0, 8).toUpperCase() || '-';
                const txDate = tx.created_at ? new Date(tx.created_at).toLocaleString('id-ID') : '-';
                return `
                    <tr>
                        <td><strong>#${escapeHtml(recNo)}</strong></td>
                        <td>${txDate}</td>
                        <td>${escapeHtml(tx.customer_name || '-')}</td>
                        <td style="text-align:right;">Rp ${Number(tx.total_amount || 0).toLocaleString('id-ID')}</td>
                    </tr>
                `;
            }).join('');
        }
    }

    modal.classList.remove('hidden');
};

/**
 * Menghapus dokumen Posting Affiliate (kembali melepaskan klaim transaksi)
 */
window.deleteAffiliatePosting = async function(postingId) {
    if (!isSuperAdmin()) return;
    if (!confirm('Apakah Anda yakin ingin menghapus postingan Affiliate ini? Transaksi yang sudah diclaim akan dikembalikan menjadi belum diklaim.')) return;

    const { error } = await supabase
        .from('affiliate_postings')
        .delete()
        .eq('id', postingId);

    if (error) {
        console.error('Delete affiliate posting error:', error);
        showToast('Gagal menghapus postingan Affiliate', 'error');
    } else {
        showToast('Postingan Affiliate berhasil dihapus', 'success');
        loadAffiliatePostings();
    }
};
