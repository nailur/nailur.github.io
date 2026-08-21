/**
 * ============================================================================
 * NTPOS - Affiliate Module (Superadmin only)
 * ============================================================================
 * Handles:
 * 1. Affiliate Period & Commission Settings (normal & bulk order >= 15 qty)
 * 2. Affiliate Postings / Claims with multi-select unclaimed transactions
 * 3. Automatic commission calculation based on accumulated product quantities
 * 4. Payment processing (Unpaid -> Paid) with transfer proof attachment upload
 * ============================================================================
 */

import { supabase } from './supabase.js';
import { getActiveOutletId } from './state.js';
import { showToast, getLocalToday, generateRandomDocNumber, escapeHtml } from './utils.js';
import { getCurrentProfile } from './auth.js';

// Internal state
let affiliatePeriodsList = [];
let currentActivePeriodId = null;
let affiliateSettingsList = [];
let affiliateProductsMaster = [];
let affiliatePostingsList = [];
let unclaimedTransactionsList = [];
let selectedTransactionIds = new Set();
let editingAffiliatePostingId = null;
let currentUnclaimedPage = 1;
const UNCLAIMED_PAGE_SIZE = 15;
let selectedUnpaidPostingIds = new Set();
let currentPayingPostingIds = [];

/**
 * Check if current user is superadmin
 */
export function isSuperAdmin() {
    const profile = getCurrentProfile();
    return profile && profile.role === 'superadmin';
}

export function isOwner() {
    const profile = getCurrentProfile();
    return profile && profile.role === 'owner';
}

export function canAccessAffiliate() {
    const profile = getCurrentProfile();
    return profile && (profile.role === 'superadmin' || profile.role === 'owner');
}

/**
 * ----------------------------------------------------------------------------
 * 1. AFFILIATE MASTER - PERIODS
 * ----------------------------------------------------------------------------
 */

/**
 * Load Affiliate Periods and products for active outlet
 */
export async function loadAffiliateSettings() {
    if (!canAccessAffiliate()) return;
    const outletId = getActiveOutletId();
    if (!outletId) return;

    // 1. Fetch all Affiliate Periods
    const { data: periodsData, error: periodErr } = await supabase
        .from('affiliate_periods')
        .select('*')
        .eq('outlet_id', outletId)
        .order('effective_date', { ascending: false });

    if (periodErr && periodErr.code !== 'PGRST116') {
        // If affiliate_periods table does not exist, display helpful migration warning
        console.warn('Tabel affiliate_periods belum tersedia. Jalankan migration SQL terlebih dahulu.', periodErr);
        const tbody = document.getElementById('affiliate-periods-table')?.querySelector('tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--warning);">Tabel periode belum ada. Jalankan migration SQL dari affiliate_schema.sql di Supabase.</td></tr>';
        return;
    }

    affiliatePeriodsList = periodsData || [];

    // 2. Fetch all products in active outlet (local cache)
    const { data: productsData } = await supabase
        .from('products')
        .select('id, name, price')
        .eq('outlet_id', outletId)
        .order('name');
    affiliateProductsMaster = productsData || [];

    // 3. Fetch all settings (for commission calculation on postings)
    const { data: settingsData } = await supabase
        .from('affiliate_settings')
        .select('*')
        .eq('outlet_id', outletId);
    affiliateSettingsList = (settingsData || []).map(s => ({
        id: s.id,
        period_id: s.period_id || null,
        product_id: s.product_id,
        commission_nominal: Number(s.commission_nominal || 0),
        bonus_target_qty: Number(s.bonus_target_qty || 15),
        bonus_nominal: Number(s.bonus_nominal !== undefined ? s.bonus_nominal : (s.bulk_commission_nominal || 0)),
        bulk_commission_nominal: Number(s.bulk_commission_nominal || 0)
    }));

    renderAffiliatePeriods();

    // Hide write buttons for Owner role
    const btnAddPeriod = document.getElementById('btn-add-affiliate-period');
    if (btnAddPeriod) btnAddPeriod.style.display = isSuperAdmin() ? 'inline-block' : 'none';
}

/**
 * Render Affiliate Periods list in Master tab table
 */
export function renderAffiliatePeriods() {
    const tbody = document.getElementById('affiliate-periods-table')?.querySelector('tbody');
    if (!tbody) return;

    if (affiliatePeriodsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Belum ada periode komisi affiliate. Klik "+ Tambah Periode Affiliate" untuk memulai.</td></tr>';
        return;
    }

    tbody.innerHTML = affiliatePeriodsList.map(period => {
        const startStr = period.effective_date
            ? new Date(period.effective_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
            : '-';
        const endStr = period.end_date
            ? new Date(period.end_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
            : 'Sekarang';
        const periodName = period.name ? escapeHtml(period.name) : `Periode ${startStr}`;
        const statusBadge = period.is_active
            ? '<span class="badge badge-success">Aktif</span>'
            : '<span class="badge badge-secondary">Nonaktif</span>';

        return `
            <tr>
                <td><strong>${periodName}</strong></td>
                <td>${startStr} s/d ${endStr}</td>
                <td>${statusBadge}</td>
                <td style="white-space:nowrap; text-align:right;">
                    <button class="btn btn-icon btn-secondary" title="Lihat & Edit Komisi Produk" onclick="window.openPeriodDetailModal('${period.id}')">
                        <i class="ph ph-pencil-simple"></i>
                    </button>
                    ${isSuperAdmin() ? `
                    <button class="btn btn-icon btn-danger" title="Hapus Periode" onclick="window.deleteAffiliatePeriod('${period.id}')">
                        <i class="ph ph-trash"></i>
                    </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

// Backward-compatible alias for renderAffiliateSettings callers
export const renderAffiliateSettings = renderAffiliatePeriods;

/**
 * Open Create Affiliate Period modal (empty form)
 */
window.openCreateAffiliatePeriodModal = function() {
    if (!canAccessAffiliate()) return;
    const modal = document.getElementById('modal-affiliate-period-form');
    if (!modal) return;

    const btnSave = document.getElementById('btn-save-affiliate-period');
    if (btnSave) btnSave.style.display = isSuperAdmin() ? 'inline-block' : 'none';

    document.getElementById('affiliate-period-id').value = '';
    document.getElementById('affiliate-period-name').value = '';
    document.getElementById('affiliate-period-effective-date').value = new Date().toISOString().substring(0, 10);
    document.getElementById('affiliate-period-end-date').value = '';
    document.getElementById('affiliate-period-is-active').checked = true;

    modal.classList.remove('hidden');
};

/**
 * Open Edit Affiliate Period modal form (populate existing data)
 */
window.editAffiliatePeriod = function(periodId) {
    const period = affiliatePeriodsList.find(p => p.id === periodId);
    if (!period) return;
    const modal = document.getElementById('modal-affiliate-period-form');
    if (!modal) return;

    const btnSave = document.getElementById('btn-save-affiliate-period');
    if (btnSave) btnSave.style.display = isSuperAdmin() ? 'inline-block' : 'none';

    document.getElementById('affiliate-period-id').value = period.id;
    document.getElementById('affiliate-period-name').value = period.name || '';
    document.getElementById('affiliate-period-effective-date').value = period.effective_date || '';
    document.getElementById('affiliate-period-end-date').value = period.end_date || '';
    document.getElementById('affiliate-period-is-active').checked = period.is_active !== false;

    modal.classList.remove('hidden');
};

/**
 * When "Edit Period Info" button in detail modal is clicked, open period form with active period data
 */
window.editCurrentPeriodFromDetail = function() {
    if (currentActivePeriodId) {
        window.editAffiliatePeriod(currentActivePeriodId);
    }
};

/**
 * Save Affiliate Period (Insert or Update)
 */
export async function handleSaveAffiliatePeriod(event) {
    event.preventDefault();
    if (!isSuperAdmin()) {
        showToast('Hanya Superadmin yang dapat menyimpan periode affiliate', 'error');
        return;
    }

    const outletId = getActiveOutletId();
    if (!outletId) return;

    const periodId = document.getElementById('affiliate-period-id')?.value || '';
    const name = document.getElementById('affiliate-period-name')?.value.trim() || null;
    const effectiveDate = document.getElementById('affiliate-period-effective-date')?.value;
    const endDateVal = document.getElementById('affiliate-period-end-date')?.value || '';
    const endDate = endDateVal || null;
    const isActive = document.getElementById('affiliate-period-is-active')?.checked !== false;

    if (!effectiveDate) {
        showToast('Tanggal mulai wajib diisi', 'warning');
        return;
    }
    if (endDate && effectiveDate > endDate) {
        showToast('Tanggal mulai tidak boleh lebih akhir dari tanggal selesai', 'warning');
        return;
    }

    const btnSubmit = document.getElementById('btn-save-affiliate-period');
    if (btnSubmit) btnSubmit.disabled = true;

    const payload = { outlet_id: outletId, name, effective_date: effectiveDate, end_date: endDate, is_active: isActive };

    let error = null;
    if (periodId) {
        const res = await supabase.from('affiliate_periods').update(payload).eq('id', periodId);
        error = res.error;
    } else {
        const res = await supabase.from('affiliate_periods').insert([payload]);
        error = res.error;
    }

    if (btnSubmit) btnSubmit.disabled = false;

    if (error) {
        console.error('Save affiliate period error:', error);
        showToast('Gagal menyimpan periode affiliate: ' + error.message, 'error');
    } else {
        showToast('Periode affiliate berhasil disimpan', 'success');
        document.getElementById('modal-affiliate-period-form')?.classList.add('hidden');
        await loadAffiliateSettings();
        // Refresh header if detail modal is open for the same period being edited
        if (currentActivePeriodId && (periodId === currentActivePeriodId || !periodId)) {
            const updatedPeriod = affiliatePeriodsList.find(p => p.id === (periodId || currentActivePeriodId));
            if (updatedPeriod) _updatePeriodDetailHeader(updatedPeriod);
        }
    }
}

/**
 * Delete Affiliate Period along with all its product settings (cascade)
 */
window.deleteAffiliatePeriod = async function(periodId) {
    if (!isSuperAdmin()) return;
    const period = affiliatePeriodsList.find(p => p.id === periodId);
    const label = period?.name || 'periode ini';
    if (!confirm(`Hapus "${label}" beserta seluruh aturan komisi produk di dalamnya?`)) return;

    const { error } = await supabase.from('affiliate_periods').delete().eq('id', periodId);

    if (error) {
        console.error('Delete affiliate period error:', error);
        showToast('Gagal menghapus periode: ' + error.message, 'error');
    } else {
        showToast('Periode affiliate berhasil dihapus', 'success');
        loadAffiliateSettings();
    }
};

/**
 * ----------------------------------------------------------------------------
 * 1b. PERIOD DETAIL — PRODUCT COMMISSION RULES
 * ----------------------------------------------------------------------------
 */

/**
 * Open period detail modal and display product commission rules for this period
 */
window.openPeriodDetailModal = async function(periodId) {
    if (!canAccessAffiliate()) return;
    const period = affiliatePeriodsList.find(p => p.id === periodId);
    if (!period) return;

    currentActivePeriodId = periodId;

    const modal = document.getElementById('modal-affiliate-period-detail');
    if (!modal) return;

    _updatePeriodDetailHeader(period);

    // Visibility of write/destructive action buttons
    const btnAddSetting = document.getElementById('btn-add-period-setting');
    if (btnAddSetting) btnAddSetting.style.display = isSuperAdmin() ? 'inline-block' : 'none';
    const btnEditPeriod = document.getElementById('btn-edit-current-period-from-detail');
    if (btnEditPeriod) btnEditPeriod.style.display = isSuperAdmin() ? 'inline-block' : 'none';

    modal.classList.remove('hidden');

    // Load commission settings for this period
    await _loadAndRenderPeriodProducts(periodId);
};

function _updatePeriodDetailHeader(period) {
    const nameEl = document.getElementById('period-detail-header-name');
    const datesEl = document.getElementById('period-detail-header-dates');
    if (nameEl) nameEl.textContent = period.name || `Periode ${period.effective_date}`;
    if (datesEl) {
        const startStr = period.effective_date ? new Date(period.effective_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
        const endStr = period.end_date ? new Date(period.end_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sekarang';
        datesEl.textContent = `${startStr} s/d ${endStr}`;
    }
}

async function _loadAndRenderPeriodProducts(periodId) {
    const tbody = document.getElementById('affiliate-period-products-table')?.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;"><i class="ph ph-spinner ph-spin"></i> Memuat...</td></tr>';

    // Fetch commission settings for this period
    const { data: settingsData, error } = await supabase
        .from('affiliate_settings')
        .select('*, products(name, price)')
        .eq('period_id', periodId)
        .order('created_at', { ascending: true });

    if (error && error.code !== 'PGRST116') {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--danger);">Gagal memuat data komisi produk</td></tr>';
        return;
    }

    const settings = settingsData || [];

    if (settings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">Belum ada komisi produk di periode ini. Klik "+ Atur Komisi Produk" untuk menambah.</td></tr>';
        return;
    }

    // Cache in state so openCreateAffiliateSettingModal can filter available products
    affiliateSettingsList = settings.map(s => ({
        id: s.id,
        period_id: periodId,
        product_id: s.product_id,
        product_name: s.products?.name || '-',
        product_price: s.products?.price || 0,
        commission_nominal: Number(s.commission_nominal || 0),
        bonus_target_qty: Number(s.bonus_target_qty || 15),
        bonus_nominal: Number(s.bonus_nominal !== undefined ? s.bonus_nominal : (s.bulk_commission_nominal || 0)),
        bulk_commission_nominal: Number(s.bulk_commission_nominal || 0)
    }));

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
                <td style="white-space:nowrap; text-align:right;">
                    <button class="btn btn-icon btn-secondary" title="Edit Komisi" onclick="window.editAffiliateSetting('${item.id}', '${item.product_id}')">
                        <i class="ph ph-pencil-simple"></i>
                    </button>
                    ${isSuperAdmin() ? `
                    <button class="btn btn-icon btn-danger" title="Hapus Komisi Produk Ini" onclick="window.deleteAffiliateSetting('${item.id}')">
                        <i class="ph ph-trash"></i>
                    </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Open commission setting modal for a single product (edit from pencil button in period detail)
 */
window.editAffiliateSetting = function(settingId, productId) {
    if (!canAccessAffiliate()) return;
    const item = affiliateSettingsList.find(i => i.id === settingId);
    if (!item) return;

    const modal = document.getElementById('modal-affiliate-setting');
    const nameEl = document.getElementById('affiliate-setting-product-name');
    const selectEl = document.getElementById('affiliate-setting-product-select');
    if (!modal) return;

    const btnSave = document.getElementById('btn-save-affiliate-setting');
    if (btnSave) btnSave.style.display = isSuperAdmin() ? 'inline-block' : 'none';

    if (nameEl) { nameEl.textContent = item.product_name; nameEl.style.display = 'block'; }
    if (selectEl) selectEl.style.display = 'none';

    populateSettingForm(item, false);
    modal.classList.remove('hidden');
};

/**
 * Open commission setting modal with dropdown of products not yet added in this period
 */
export function openCreateAffiliateSettingModal() {
    if (!canAccessAffiliate()) return;
    if (!currentActivePeriodId) {
        showToast('Buka detail periode terlebih dahulu', 'warning');
        return;
    }

    const modal = document.getElementById('modal-affiliate-setting');
    const selectEl = document.getElementById('affiliate-setting-product-select');
    const nameEl = document.getElementById('affiliate-setting-product-name');
    if (!modal || !selectEl) return;

    const btnSave = document.getElementById('btn-save-affiliate-setting');
    if (btnSave) btnSave.style.display = isSuperAdmin() ? 'inline-block' : 'none';

    // Only show products NOT YET configured in this period
    const existingProductIds = new Set(affiliateSettingsList.map(s => s.product_id));
    const availableProducts = affiliateProductsMaster.filter(p => !existingProductIds.has(p.id));

    if (availableProducts.length === 0) {
        showToast('Semua produk sudah memiliki aturan komisi di periode ini', 'info');
        return;
    }

    selectEl.innerHTML = availableProducts.map(prod => `<option value="${prod.id}">${escapeHtml(prod.name)}</option>`).join('');
    selectEl.style.display = 'block';
    if (nameEl) nameEl.style.display = 'none';

    const blankItem = { id: null, product_id: availableProducts[0]?.id, commission_nominal: 0, bonus_target_qty: 15, bonus_nominal: 0 };
    populateSettingForm(blankItem, true);

    selectEl.onchange = () => {
        const newBlank = { id: null, product_id: selectEl.value, commission_nominal: 0, bonus_target_qty: 15, bonus_nominal: 0 };
        populateSettingForm(newBlank, true);
    };

    modal.classList.remove('hidden');
}

function populateSettingForm(item, forceNew = false) {
    document.getElementById('affiliate-setting-id').value = forceNew ? '' : (item.id || '');
    document.getElementById('affiliate-setting-product-id').value = item.product_id || '';
    document.getElementById('affiliate-setting-period-id').value = item.period_id || currentActivePeriodId || '';
    document.getElementById('affiliate-setting-normal').value = item.commission_nominal > 0 ? item.commission_nominal : '';
    document.getElementById('affiliate-setting-target-qty').value = item.bonus_target_qty || 15;
    document.getElementById('affiliate-setting-bonus-nominal').value = item.bonus_nominal > 0 ? item.bonus_nominal : '';
    if (window.updateAffiliateSettingPreview) window.updateAffiliateSettingPreview();
}

/**
 * Delete product commission rule from period
 */
window.deleteAffiliateSetting = async function(settingId) {
    if (!isSuperAdmin()) {
        showToast('Hanya Superadmin yang dapat menghapus pengaturan komisi affiliate', 'error');
        return;
    }

    const item = affiliateSettingsList.find(i => String(i.id) === String(settingId));
    const prodName = item ? item.product_name : 'Produk ini';

    if (!confirm(`Hapus aturan komisi untuk produk "${prodName}" dari periode ini?`)) return;

    const { error } = await supabase.from('affiliate_settings').delete().eq('id', settingId);

    if (error) {
        console.error('Error delete affiliate setting:', error);
        showToast('Gagal menghapus komisi produk: ' + error.message, 'error');
        return;
    }

    showToast('Komisi produk berhasil dihapus', 'success');
    if (currentActivePeriodId) _loadAndRenderPeriodProducts(currentActivePeriodId);
};

/**
 * Live simulation of commission and tier bonus calculation in Setting Modal
 */
window.updateAffiliateSettingPreview = function() {
    const previewEl = document.getElementById('affiliate-setting-live-preview');
    if (!previewEl) return;

    const commNormal = parseFloat(document.getElementById('affiliate-setting-normal')?.value) || 0;
    const targetQty = parseInt(document.getElementById('affiliate-setting-target-qty')?.value) || 15;
    const bonusNominal = parseFloat(document.getElementById('affiliate-setting-bonus-nominal')?.value) || 0;

    const calc = (qty) => {
        const base = qty * commNormal;
        let bCount = 0, bTotal = 0;
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

    const r1 = calc(q1), r2 = calc(q2), r3 = calc(q3), r4 = calc(q4);

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
 * Save / update product commission rule into affiliate_settings table
 */
export async function handleSaveAffiliateSetting(event) {
    event.preventDefault();
    if (!isSuperAdmin()) {
        showToast('Hanya superadmin yang dapat mengubah setting Affiliate', 'error');
        return;
    }

    const outletId = getActiveOutletId();
    const settingId = document.getElementById('affiliate-setting-id')?.value || '';
    const productId = document.getElementById('affiliate-setting-product-id')?.value
        || document.getElementById('affiliate-setting-product-select')?.value;
    const periodId = document.getElementById('affiliate-setting-period-id')?.value || currentActivePeriodId;
    const commNormal = parseFloat(document.getElementById('affiliate-setting-normal')?.value) || 0;
    const targetQty = parseInt(document.getElementById('affiliate-setting-target-qty')?.value) || 15;
    const bonusNominal = parseFloat(document.getElementById('affiliate-setting-bonus-nominal')?.value) || 0;

    if (!outletId || !productId || !periodId) {
        showToast('Data tidak lengkap, pastikan periode dan produk sudah dipilih', 'warning');
        return;
    }

    const btnSubmit = document.getElementById('btn-save-affiliate-setting');
    if (btnSubmit) btnSubmit.disabled = true;

    const payload = {
        outlet_id: outletId,
        period_id: periodId,
        product_id: productId,
        commission_nominal: commNormal,
        bonus_target_qty: targetQty,
        bonus_nominal: bonusNominal,
        bulk_commission_nominal: bonusNominal
    };

    let error = null;
    if (settingId) {
        const res = await supabase.from('affiliate_settings').update(payload).eq('id', settingId);
        error = res.error;
    } else {
        const res = await supabase.from('affiliate_settings').insert([payload]);
        error = res.error;
    }

    if (btnSubmit) btnSubmit.disabled = false;

    if (error) {
        console.error('Save affiliate setting error:', error);
        showToast('Gagal menyimpan setting komisi Affiliate: ' + error.message, 'error');
    } else {
        showToast('Setting komisi Affiliate berhasil disimpan', 'success');
        document.getElementById('modal-affiliate-setting')?.classList.add('hidden');
        if (currentActivePeriodId) _loadAndRenderPeriodProducts(currentActivePeriodId);
    }
}


/**
 * ----------------------------------------------------------------------------
 * 2. AFFILIATE POSTING (COMMISSION RECAP LIST)
 * ----------------------------------------------------------------------------
 */

/**
 * Load affiliate posting history for active outlet
 */
export async function loadAffiliatePostings() {
    if (!canAccessAffiliate()) return;
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

    // Hide write buttons for Owner role
    const btnAddPosting = document.getElementById('btn-add-affiliate-posting');
    if (btnAddPosting) btnAddPosting.style.display = isSuperAdmin() ? 'inline-block' : 'none';
}

/**
 * Render affiliate postings history in HTML table
 */
export function renderAffiliatePostings() {
    const tbody = document.getElementById('affiliate-postings-table')?.querySelector('tbody');
    if (!tbody) return;

    const existingUnpaidIds = new Set(
        affiliatePostingsList.filter(p => p.status === 'Unpaid').map(p => p.id)
    );
    Array.from(selectedUnpaidPostingIds).forEach(id => {
        if (!existingUnpaidIds.has(id)) selectedUnpaidPostingIds.delete(id);
    });
    updateSelectedUnpaidBar();

    if (affiliatePostingsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Belum ada postingan komisi Affiliate</td></tr>';
        return;
    }

    tbody.innerHTML = affiliatePostingsList.map(post => {
        const isPaid = post.status === 'Paid';
        const badgeClass = isPaid ? 'badge-success' : 'badge-warning';
        const dateFormatted = new Date(post.posting_date).toLocaleDateString('id-ID');
        const adminName = post.profiles?.name || '-';

        return `
            <tr>
                <td style="text-align:center; width:40px;">
                    ${!isPaid && isSuperAdmin() ? `
                        <input type="checkbox" class="unpaid-posting-checkbox" value="${post.id}" ${selectedUnpaidPostingIds.has(post.id) ? 'checked' : ''} onchange="window.onSelectUnpaidPostingChange(this)">
                    ` : ''}
                </td>
                <td><strong>${escapeHtml(post.document_number)}</strong></td>
                <td>${dateFormatted}</td>
                <td><strong>${escapeHtml(post.affiliator_name)}</strong></td>
                <td>Rp ${Number(post.total_amount).toLocaleString('id-ID')}</td>
                <td><span class="badge ${badgeClass}">${escapeHtml(post.status)}</span></td>
                <td style="white-space:nowrap; text-align:center;">
                    ${isPaid && post.proof_attachment ? `
                        <button class="btn btn-icon btn-secondary" onclick="window.viewAffiliateProof('${escapeHtml(post.proof_attachment)}')" title="Lihat Bukti">
                            <i class="ph ph-image"></i>
                        </button>
                    ` : '<span style="color:var(--text-secondary);">-</span>'}
                </td>
                <td>${escapeHtml(adminName)}</td>
                <td style="white-space:nowrap; text-align:right;">
                    ${!isPaid && isSuperAdmin() ? `
                        <button class="btn btn-icon btn-success" onclick="window.openPayAffiliateModal('${post.id}')" title="Bayar Komisi">
                            <i class="ph ph-money"></i>
                        </button>
                        <button class="btn btn-icon btn-secondary" onclick="window.editAffiliatePosting('${post.id}')" title="Edit Posting">
                            <i class="ph ph-pencil-simple"></i>
                        </button>
                    ` : ''}
                    <button class="btn btn-icon btn-secondary" onclick="window.viewAffiliateDetails('${post.id}')" title="Lihat Detail">
                        <i class="ph ph-eye"></i>
                    </button>
                    ${!isPaid && isSuperAdmin() ? `
                    <button class="btn btn-icon btn-danger" onclick="window.deleteAffiliatePosting('${post.id}')" title="Hapus">
                        <i class="ph ph-trash"></i>
                    </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Toggle select all unpaid postings
 */
window.toggleAllUnpaidPostings = function(masterCheckbox) {
    const checkboxes = document.querySelectorAll('.unpaid-posting-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = masterCheckbox.checked;
        if (masterCheckbox.checked) {
            selectedUnpaidPostingIds.add(cb.value);
        } else {
            selectedUnpaidPostingIds.delete(cb.value);
        }
    });
    updateSelectedUnpaidBar();
};

/**
 * Handle individual unpaid posting checkbox toggle
 */
window.onSelectUnpaidPostingChange = function(checkbox) {
    if (checkbox) {
        if (checkbox.checked) {
            selectedUnpaidPostingIds.add(checkbox.value);
        } else {
            selectedUnpaidPostingIds.delete(checkbox.value);
        }
    }
    updateSelectedUnpaidBar();
};

/**
 * Update the accumulated pay bar button above the table
 */
function updateSelectedUnpaidBar() {
    const btnPaySelected = document.getElementById('btn-pay-selected-affiliate');
    const countEl = document.getElementById('count-selected-unpaid');
    const checkAllEl = document.getElementById('check-all-unpaid-postings');

    const unpaidCount = affiliatePostingsList.filter(p => p.status === 'Unpaid').length;
    if (checkAllEl) {
        checkAllEl.checked = unpaidCount > 0 && selectedUnpaidPostingIds.size === unpaidCount;
    }

    if (!btnPaySelected) return;

    const selectedCount = selectedUnpaidPostingIds.size;
    if (selectedCount > 0 && isSuperAdmin()) {
        let totalAcc = 0;
        affiliatePostingsList.forEach(p => {
            if (selectedUnpaidPostingIds.has(p.id)) {
                totalAcc += Number(p.total_amount || 0);
            }
        });
        if (countEl) countEl.textContent = `${selectedCount} | Rp ${totalAcc.toLocaleString('id-ID')}`;
        btnPaySelected.style.display = 'inline-block';
        btnPaySelected.classList.remove('hidden');
    } else {
        btnPaySelected.style.display = 'none';
        btnPaySelected.classList.add('hidden');
    }
}

/**
 * ----------------------------------------------------------------------------
 * 3. CREATE NEW AFFILIATE POSTING (MULTI-TRANSACTION CLAIM)
 * ----------------------------------------------------------------------------
 */

/**
 * Open Add Affiliate Posting modal & load unclaimed transactions
 */
export async function openCreateAffiliateModal(editPostingId = null) {
    if (!canAccessAffiliate()) {
        showToast('Anda tidak memiliki hak akses untuk membuat Posting Affiliate', 'error');
        return;
    }
    if (editPostingId && !isSuperAdmin()) {
        showToast('Hanya superadmin yang dapat mengedit Posting Affiliate', 'error');
        return;
    }
    const outletId = getActiveOutletId();
    if (!outletId) return;

    selectedTransactionIds.clear();
    editingAffiliatePostingId = editPostingId || null;

    const modal = document.getElementById('modal-create-affiliate-posting');
    if (!modal) return;

    const btnSubmit = document.getElementById('btn-submit-create-affiliate');
    if (btnSubmit) {
        btnSubmit.style.display = isSuperAdmin() ? 'inline-block' : 'none';
        btnSubmit.textContent = editingAffiliatePostingId ? 'Simpan Perubahan' : 'Simpan Posting';
    }

    const editPost = editingAffiliatePostingId ? affiliatePostingsList.find(p => p.id === editingAffiliatePostingId) : null;
    const titleEl = modal.querySelector('h3');
    if (titleEl) {
        titleEl.innerHTML = editPost 
            ? `<i class="ph ph-pencil-simple"></i> Edit Posting Affiliate (${escapeHtml(editPost.document_number)})`
            : `<i class="ph ph-plus-circle"></i> Catat Klaim Affiliate Baru`;
    }

    // Reset / Set form
    document.getElementById('affiliate-posting-affiliator').value = editPost ? (editPost.affiliator_name || '') : '';
    document.getElementById('affiliate-posting-notes').value = editPost ? (editPost.notes || '') : '';
    document.getElementById('affiliate-calculation-preview').innerHTML = '<tr><td colspan="4" style="text-align:center;">Pilih minimal 1 transaksi penjualan untuk menghitung komisi</td></tr>';
    document.getElementById('affiliate-posting-total-display').textContent = 'Rp 0';

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const dateFilterEl = document.getElementById('affiliate-unclaimed-date-filter');
    if (dateFilterEl) dateFilterEl.value = todayStr;

    modal.classList.remove('hidden');

    await window.loadUnclaimedTransactions(todayStr);

    if (editingAffiliatePostingId && selectedTransactionIds.size > 0) {
        await window.onSelectAffiliateTransactions(null, true);
    }
}

/**
 * Load unclaimed transactions filtered by date (for resource optimization)
 */
window.loadUnclaimedTransactions = async function(dateStr) {
    const outletId = window.activeOutletId;
    if (!outletId) return;

    const tbody = document.getElementById('affiliate-unclaimed-transactions-table')?.querySelector('tbody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Memuat data transaksi...</td></tr>';
    }

    // 1. Fetch transaction IDs that have already been claimed
    //    Join to affiliate_postings so we can check posting status.
    //    Transactions tied to a Paid posting must ALWAYS be excluded.
    //    Transactions tied to an Unpaid posting by another affiliator are also excluded.
    const { data: claimedData, error: claimedError } = await supabase
        .from('affiliate_posting_transactions')
        .select('transaction_id, posting_id, affiliate_postings!inner(id, status, outlet_id)')
        .eq('affiliate_postings.outlet_id', outletId)
        .limit(5000);

    const claimedIdsByOthers = new Set();
    const myTrxIds = new Set();
    (claimedData || []).forEach(row => {
        const postingStatus = row.affiliate_postings?.status || '';
        const isPaid = postingStatus === 'Paid';
        const isMyPosting = editingAffiliatePostingId && String(row.posting_id) === String(editingAffiliatePostingId);

        if (isMyPosting && !isPaid) {
            // Edit mode: include own posting's transactions as pre-selected (only if still Unpaid)
            myTrxIds.add(row.transaction_id);
        } else {
            // All other claimed transactions (including Paid postings) → exclude from list
            claimedIdsByOthers.add(row.transaction_id);
        }
    });

    myTrxIds.forEach(id => selectedTransactionIds.add(id));

    // 2. Build query for completed transactions
    let query = supabase
        .from('transactions')
        .select('id, receipt_no, created_at, customer_name, total_amount, status, payment_method')
        .eq('outlet_id', outletId)
        .eq('status', 'completed')
        .neq('status', 'voided')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

    if (dateStr) {
        const startOfDay = new Date(`${dateStr}T00:00:00`).toISOString();
        const endOfDay = new Date(`${dateStr}T23:59:59.999`).toISOString();
        query = query.gte('created_at', startOfDay).lte('created_at', endOfDay).limit(1000);
    } else {
        query = query.limit(1000);
    }

    const { data: trxs, error: trxError } = await query;

    if (trxError) {
        console.error('Error load unclaimed transactions:', trxError);
        showToast('Gagal memuat daftar transaksi penjualan', 'error');
        return;
    }

    // Double-check in JavaScript: ensure transaction not claimed by others and not void/cancel
    unclaimedTransactionsList = (trxs || []).filter(t => {
        if (claimedIdsByOthers.has(t.id)) return false;
        const st = String(t.status || '').toLowerCase();
        if (st === 'voided' || st === 'void' || st === 'cancelled' || st === 'cancel' || st === 'batal') {
            return false;
        }
        return true;
    });

    // Ensure transactions already checked (in edit mode or previously checked) are present in the list
    const allCheckedIds = Array.from(selectedTransactionIds);
    if (allCheckedIds.length > 0) {
        const existingIds = new Set(unclaimedTransactionsList.map(t => t.id));
        const missingIds = allCheckedIds.filter(id => !existingIds.has(id));
        if (missingIds.length > 0) {
            const { data: missingTrxs } = await supabase
                .from('transactions')
                .select('id, receipt_no, created_at, customer_name, total_amount, status, payment_method')
                .in('id', missingIds);
            if (missingTrxs && missingTrxs.length > 0) {
                unclaimedTransactionsList.unshift(...missingTrxs);
            }
        }
    }

    currentUnclaimedPage = 1;
    renderUnclaimedTransactionsTable();
};

/**
 * Handle date filter change in unclaimed transactions table
 */
window.onAffiliateUnclaimedDateChange = async function() {
    const dateFilterEl = document.getElementById('affiliate-unclaimed-date-filter');
    const dateStr = dateFilterEl ? dateFilterEl.value : '';
    await window.loadUnclaimedTransactions(dateStr);
};

/**
 * Render list of unclaimed transactions with Checkbox & Pagination
 */
function renderUnclaimedTransactionsTable() {
    const tbody = document.getElementById('affiliate-unclaimed-transactions-table')?.querySelector('tbody');
    if (!tbody) return;

    const totalTrx = unclaimedTransactionsList.length;
    const totalPages = Math.max(1, Math.ceil(totalTrx / UNCLAIMED_PAGE_SIZE));
    if (currentUnclaimedPage > totalPages) currentUnclaimedPage = totalPages;
    if (currentUnclaimedPage < 1) currentUnclaimedPage = 1;

    // Update pagination text
    const totalTextEl = document.getElementById('affiliate-total-unclaimed-text');
    if (totalTextEl) totalTextEl.textContent = `(Total ${totalTrx} belum diklaim)`;

    const pageInfoEl = document.getElementById('affiliate-page-info');
    if (pageInfoEl) pageInfoEl.textContent = `Halaman ${currentUnclaimedPage} / ${totalPages}`;

    const prevBtn = document.getElementById('btn-unclaimed-prev');
    if (prevBtn) prevBtn.disabled = (currentUnclaimedPage <= 1);

    const nextBtn = document.getElementById('btn-unclaimed-next');
    if (nextBtn) nextBtn.disabled = (currentUnclaimedPage >= totalPages);

    if (totalTrx === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Tidak ada transaksi penjualan yang belum diklaim</td></tr>';
        updateSelectedCountDisplay();
        return;
    }

    const startIdx = (currentUnclaimedPage - 1) * UNCLAIMED_PAGE_SIZE;
    const endIdx = startIdx + UNCLAIMED_PAGE_SIZE;
    const pageItems = unclaimedTransactionsList.slice(startIdx, endIdx);

    tbody.innerHTML = pageItems.map(trx => {
        const receiptNo = trx.receipt_no || trx.id.substring(0, 8).toUpperCase();
        const tDate = new Date(trx.created_at).toLocaleString('id-ID');
        const isChecked = selectedTransactionIds.has(trx.id);
        return `
            <tr>
                <td style="text-align:center; width:40px;">
                    <input type="checkbox" class="affiliate-trx-checkbox" value="${trx.id}" ${isChecked ? 'checked' : ''} onchange="window.onSelectAffiliateTransactions(this)">
                </td>
                <td><strong>#${escapeHtml(receiptNo)}</strong></td>
                <td>${tDate}</td>
                <td>${escapeHtml(trx.customer_name || '-')}</td>
                <td><span class="badge badge-secondary">${escapeHtml(trx.payment_method || '-')}</span></td>
                <td>Rp ${Number(trx.total_amount).toLocaleString('id-ID')}</td>
            </tr>
        `;
    }).join('');

    updateSelectedCountDisplay();
}

/**
 * Change page of unclaimed transactions table
 */
window.changeUnclaimedPage = function(delta) {
    const totalPages = Math.max(1, Math.ceil(unclaimedTransactionsList.length / UNCLAIMED_PAGE_SIZE));
    currentUnclaimedPage += delta;
    if (currentUnclaimedPage < 1) currentUnclaimedPage = 1;
    if (currentUnclaimedPage > totalPages) currentUnclaimedPage = totalPages;
    renderUnclaimedTransactionsTable();
};

/**
 * Update selected transaction count badge display
 */
function updateSelectedCountDisplay() {
    const countEl = document.getElementById('affiliate-selected-count');
    if (countEl) {
        countEl.textContent = selectedTransactionIds.size;
    }
}

/**
 * Triggered by transaction checkbox selection: enables automatic cross-page commission calculation
 */
window.onSelectAffiliateTransactions = async function(changedCheckbox, skipCheckboxSync = false) {
    if (!skipCheckboxSync) {
        if (changedCheckbox && changedCheckbox instanceof HTMLInputElement) {
            if (changedCheckbox.checked) {
                selectedTransactionIds.add(changedCheckbox.value);
            } else {
                selectedTransactionIds.delete(changedCheckbox.value);
            }
        } else if (changedCheckbox !== null) {
            // Fallback when called without parameter (check all visible checkboxes on page)
            const checkboxes = document.querySelectorAll('.affiliate-trx-checkbox');
            checkboxes.forEach(cb => {
                if (cb.checked) selectedTransactionIds.add(cb.value);
                else selectedTransactionIds.delete(cb.value);
            });
        }
    }

    updateSelectedCountDisplay();

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

    // 1. Fetch all transaction_items for selected transactions (with created_at for effective period matching)
    const trxIdsArray = Array.from(selectedTransactionIds);
    const { data: itemsData, error: itemsErr } = await supabase
        .from('transaction_items')
        .select('product_id, quantity, products(name), transactions(created_at)')
        .in('transaction_id', trxIdsArray);

    if (itemsErr) {
        console.error('Error fetching transaction items:', itemsErr);
        if (previewTbody) previewTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--danger);">Gagal menghitung item transaksi</td></tr>';
        return;
    }

    // Helper function to find active commission rules based on transaction date
    // 1. Find active period covering transaction date
    // 2. Within that period, find setting for the specific product
    const findSettingForDate = (prodId, trxDate) => {
        // Find periods covering transaction date, sorted most recent first
        const matchingPeriods = affiliatePeriodsList.filter(p => {
            if (!p.is_active) return false;
            if (p.effective_date && p.effective_date > trxDate) return false;
            if (p.end_date && p.end_date < trxDate) return false;
            return true;
        });
        matchingPeriods.sort((a, b) => (b.effective_date || '').localeCompare(a.effective_date || ''));

        // Find product setting within matched period
        for (const period of matchingPeriods) {
            const setting = affiliateSettingsList.find(s => s.period_id === period.id && s.product_id === prodId);
            if (setting) return setting;
        }

        // Fallback: find any setting for product if period unknown
        const anyActive = affiliateSettingsList.filter(s => s.product_id === prodId && s.id);
        if (anyActive.length > 0) return anyActive[0];
        return null;
    };


    // 2. Accumulate quantity (total_qty) per product & effective period valid on transaction date
    const productPeriodMap = new Map();
    (itemsData || []).forEach(item => {
        const prodId = item.product_id;
        if (!prodId) return;
        const prodName = item.products?.name || 'Produk';
        const qty = parseFloat(item.quantity) || 0;
        const trxDate = item.transactions?.created_at ? String(item.transactions.created_at).substring(0, 10) : new Date().toISOString().substring(0, 10);
        
        const setting = findSettingForDate(prodId, trxDate) || {};
        const groupKey = `${prodId}__${setting.id || 'default'}`;

        if (!productPeriodMap.has(groupKey)) {
            productPeriodMap.set(groupKey, { 
                product_id: prodId, 
                product_name: prodName, 
                total_qty: 0,
                setting: setting 
            });
        }
        productPeriodMap.get(groupKey).total_qty += qty;
    });

    const calculatedItems = [];
    let grandTotalCommission = 0;

    productPeriodMap.forEach(item => {
        const setting = item.setting || {};
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

        let periodLabel = '';
        if (setting.effective_date) {
            const startStr = new Date(setting.effective_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
            const endStr = setting.end_date ? new Date(setting.end_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sekarang';
            periodLabel = `Periode: ${startStr} s/d ${endStr}`;
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
            period_label: periodLabel,
            subtotal: subtotal,
            setting_id: setting.id || null
        });
    });

    // 4. Render calculation results in HTML table
    if (previewTbody) {
        if (calculatedItems.length === 0) {
            previewTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Tidak ada item produk dalam transaksi yang dipilih</td></tr>';
        } else {
            previewTbody.innerHTML = calculatedItems.map(row => `
                <tr>
                    <td>
                        <strong>${escapeHtml(row.product_name)}</strong>
                        ${row.period_label ? `<br><small style="color:var(--text-secondary);">${escapeHtml(row.period_label)}</small>` : ''}
                    </td>
                    <td style="text-align:center; font-weight:600;">${row.total_qty}</td>
                    <td>
                        <span>Rp ${Number(row.commission_rate).toLocaleString('id-ID')} / item</span>
                        ${row.bonus_count > 0 ? `<br><span class="badge badge-info" style="font-size:0.78rem;">+ Bonus ${row.bonus_count}x Rp ${Number(row.bonus_nominal).toLocaleString('id-ID')}</span>` : ''}
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

    // Cache calculated results for save process
    window._affiliateCurrentCalculatedItems = calculatedItems;
    window._affiliateCurrentGrandTotal = Math.round(grandTotalCommission);
};

/**
 * Save new Affiliate Posting along with items and transaction links
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

    let postingId = null;

    if (editingAffiliatePostingId) {
        postingId = editingAffiliatePostingId;
        const updatePayload = {
            affiliator_name: affiliatorName,
            total_amount: grandTotal,
            notes: notes
        };

        const { error: upErr } = await supabase
            .from('affiliate_postings')
            .update(updatePayload)
            .eq('id', postingId);

        if (upErr) {
            console.error('Error update affiliate posting:', upErr);
            showToast('Gagal memperbarui Posting Affiliate: ' + upErr.message, 'error');
            if (btnSubmit) btnSubmit.disabled = false;
            return;
        }

        // Purge old items & transaction links before inserting new ones
        await Promise.all([
            supabase.from('affiliate_posting_items').delete().eq('posting_id', postingId),
            supabase.from('affiliate_posting_transactions').delete().eq('posting_id', postingId)
        ]);
    } else {
        // 1. Generate document number (e.g., AFF-20260730-1234)
        const todayStr = getLocalToday().replace(/-/g, '');
        const randNum = Math.floor(1000 + Math.random() * 9000);
        const documentNo = `AFF-${todayStr}-${randNum}`;
        const profile = getCurrentProfile();

        // 2. Insert into affiliate_postings
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

        postingId = postData.id;
    }

    // 3. Insert into affiliate_posting_items
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

    // 4. Insert into affiliate_posting_transactions (link to claimed transactions)
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
    showToast(editingAffiliatePostingId ? 'Posting Affiliate berhasil diperbarui' : 'Posting Affiliate berhasil dibuat', 'success');
    document.getElementById('modal-create-affiliate-posting')?.classList.add('hidden');
    editingAffiliatePostingId = null;

    loadAffiliatePostings();
}

/**
 * ----------------------------------------------------------------------------
 * 4. PAYMENT & TRANSFER PROOF UPLOAD
 * ----------------------------------------------------------------------------
 */

/**
 * Open payment and transfer proof upload modal for Unpaid postings
 */
window.openPayAffiliateModal = function(postingId) {
    if (!isSuperAdmin()) return;
    const post = affiliatePostingsList.find(p => p.id === postingId);
    if (!post) return;

    const modal = document.getElementById('modal-pay-affiliate');
    if (!modal) return;

    currentPayingPostingIds = [post.id];
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
 * Open payment and transfer proof upload modal for Selected Unpaid postings (Accumulated)
 */
window.openPaySelectedAffiliateModal = function() {
    if (!isSuperAdmin()) return;
    const selectedIds = Array.from(selectedUnpaidPostingIds);
    if (selectedIds.length === 0) {
        showToast('Pilih minimal 1 postingan unpaid', 'error');
        return;
    }

    const modal = document.getElementById('modal-pay-affiliate');
    if (!modal) return;

    const selectedPosts = affiliatePostingsList.filter(p => selectedIds.includes(p.id));
    if (selectedPosts.length === 0) return;

    currentPayingPostingIds = selectedIds;
    document.getElementById('pay-affiliate-posting-id').value = selectedIds.join(',');

    const docNumbers = selectedPosts.map(p => p.document_number).join(', ');
    const totalAcc = selectedPosts.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
    const uniqueNames = [...new Set(selectedPosts.map(p => p.affiliator_name))];

    document.getElementById('pay-affiliate-doc-number').textContent = selectedPosts.length === 1 
        ? docNumbers 
        : `${selectedPosts.length} Postings Akumulasi (${docNumbers})`;

    document.getElementById('pay-affiliate-name').textContent = uniqueNames.length === 1 
        ? `${uniqueNames[0]} (${selectedPosts.length} posting)` 
        : `Multi Afiliator: ${uniqueNames.join(', ')}`;

    document.getElementById('pay-affiliate-amount').textContent = `Rp ${Number(totalAcc).toLocaleString('id-ID')}`;

    const fileInput = document.getElementById('pay-affiliate-file');
    if (fileInput) fileInput.value = '';

    modal.classList.remove('hidden');
};

/**
 * Save payment status (Paid) and upload image transfer proof (Single or Multi/Accumulated)
 */
export async function handleSaveAffiliatePayment(event) {
    event.preventDefault();
    if (!isSuperAdmin()) return;

    let targetIds = [];
    if (currentPayingPostingIds && currentPayingPostingIds.length > 0) {
        targetIds = currentPayingPostingIds;
    } else {
        const rawId = document.getElementById('pay-affiliate-posting-id')?.value;
        if (rawId) {
            targetIds = rawId.split(',').map(s => s.trim()).filter(Boolean);
        }
    }
    if (targetIds.length === 0) {
        showToast('Tidak ada data posting yang akan dibayar', 'error');
        return;
    }

    const fileInput = document.getElementById('pay-affiliate-file');

    const btnSubmit = document.getElementById('btn-submit-pay-affiliate');
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Memproses...';
    }

    let attachmentFileName = null;

    // 1. Upload image to private "attachments" bucket if file provided
    if (fileInput && fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        let compressedFile = file;

        // Client-side image compression using browser-image-compression
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

    // 2. Update posting status to Paid
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
        .in('id', targetIds);

    if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = 'Konfirmasi Bayar';
    }

    if (upErr) {
        console.error('Update posting status error:', upErr);
        showToast('Gagal mengubah status pembayaran', 'error');
    } else {
        const msg = targetIds.length > 1 
            ? `Pembayaran akumulasi (${targetIds.length} posting) berhasil dicatat` 
            : 'Pembayaran komisi Affiliate berhasil dicatat';
        showToast(msg, 'success');
        selectedUnpaidPostingIds.clear();
        currentPayingPostingIds = [];
        updateSelectedUnpaidBar();
        document.getElementById('modal-pay-affiliate')?.classList.add('hidden');
        loadAffiliatePostings();
    }
}

/**
 * View transfer proof image from private storage using signed URL
 */
window.viewAffiliateProof = async function(fileName) {
    if (!canAccessAffiliate() || !fileName) return;

    // Create 1-hour signed URL (3600 seconds)
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
 * 5. VIEW POSTING DETAILS & DELETE
 * ----------------------------------------------------------------------------
 */

/**
 * Open modal showing commission item details and claimed transactions
 */
window.viewAffiliateDetails = async function(postingId) {
    if (!canAccessAffiliate()) return;
    const post = affiliatePostingsList.find(p => p.id === postingId);
    if (!post) return;

    const modal = document.getElementById('modal-detail-affiliate');
    if (!modal) return;

    document.getElementById('detail-affiliate-doc').textContent = post.document_number;
    document.getElementById('detail-affiliate-name').textContent = post.affiliator_name;
    document.getElementById('detail-affiliate-date').textContent = new Date(post.posting_date).toLocaleDateString('id-ID');
    document.getElementById('detail-affiliate-status').textContent = post.status;
    document.getElementById('detail-affiliate-total').textContent = `Rp ${Number(post.total_amount).toLocaleString('id-ID')}`;

    // 1. Fetch claimed product items & transaction links in parallel (responsive performance)
    const [ { data: itemsData }, { data: trxLinks } ] = await Promise.all([
        supabase.from('affiliate_posting_items').select('*').eq('posting_id', postingId),
        supabase.from('affiliate_posting_transactions').select('transaction_id, transactions(receipt_no, created_at, customer_name, total_amount, payment_method)').eq('posting_id', postingId)
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
                        <td><span class="badge badge-secondary">${escapeHtml(tx.payment_method || '-')}</span></td>
                        <td style="text-align:right;">Rp ${Number(tx.total_amount || 0).toLocaleString('id-ID')}</td>
                    </tr>
                `;
            }).join('');
        }
    }

    const btnEditDetail = document.getElementById('btn-edit-detail-affiliate');
    if (btnEditDetail) {
        if (post.status === 'Unpaid' && isSuperAdmin()) {
            btnEditDetail.style.display = 'inline-block';
            btnEditDetail.onclick = () => {
                modal.classList.add('hidden');
                window.editAffiliatePosting(postingId);
            };
        } else {
            btnEditDetail.style.display = 'none';
        }
    }

    modal.classList.remove('hidden');
};

/**
 * Open edit modal for Unpaid postings (Superadmin only)
 */
window.editAffiliatePosting = async function(postingId) {
    if (!isSuperAdmin()) {
        showToast('Hanya superadmin yang dapat mengedit Posting Affiliate', 'error');
        return;
    }
    const post = affiliatePostingsList.find(p => p.id === postingId);
    if (!post) {
        showToast('Data posting tidak ditemukan', 'error');
        return;
    }
    if (post.status === 'Paid') {
        showToast('Posting dengan status Paid tidak dapat diedit', 'warning');
        return;
    }
    await openCreateAffiliateModal(postingId);
};

/**
 * Delete Affiliate Posting document (releases claimed transactions)
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
