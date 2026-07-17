import { supabase } from './supabase.js';
import { showToast } from './app.js';
import { activeOutletId } from './state.js';
import { getOfflineDiscounts, saveOfflineDiscounts } from './offline.js';

let discounts = [];
const paymentMethodsList = ['Tunai', 'QRIS', 'Go Food', 'Grab Food', 'Shopee Food'];

export async function loadDiscounts() {
    if (!activeOutletId) return;
    
    try {
        const cachedDiscounts = await getOfflineDiscounts(activeOutletId);
        if (cachedDiscounts && cachedDiscounts.length > 0) {
            discounts = cachedDiscounts;
            renderDiscounts();
        }
    } catch (err) {
        console.error('Failed to load discounts from cache', err);
    }
    
    if (!navigator.onLine) return;
    
    const { data, error } = await supabase
        .from('global_discounts')
        .select('*')
        .eq('outlet_id', activeOutletId)
        .order('created_at', { ascending: false });
        
    if (error) {
        console.error('Error loading discounts:', error);
        return;
    }
    
    discounts = data;
    renderDiscounts();
    
    await saveOfflineDiscounts(activeOutletId, data);
}

function renderDiscounts() {
    const tbody = document.querySelector('#discounts-table tbody');
    if (!tbody) return;
    
    if (discounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Belum ada diskon.</td></tr>';
        return;
    }
    
    tbody.innerHTML = discounts.map(discount => {
        const isActive = discount.is_active;
        const statusBadge = isActive ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-secondary">Nonaktif</span>';
        const startDate = new Date(discount.start_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        const endDate = new Date(discount.end_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        
        return `
            <tr>
                <td><strong>${escapeHtml(discount.name)}</strong></td>
                <td>${startDate} s/d ${endDate}</td>
                <td>${statusBadge}</td>
                <td style="text-align: center;">
                    <button class="btn btn-icon" title="Edit" onclick="editDiscount('${discount.id}')" style="color: var(--primary);">
                        <i class="ph ph-pencil-simple"></i>
                    </button>
                    <button class="btn btn-icon" title="Hapus" onclick="deleteDiscount('${discount.id}')" style="color: var(--danger);">
                        <i class="ph ph-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

window.editDiscount = (id) => {
    const discount = discounts.find(d => d.id === id);
    if (!discount) return;
    
    document.getElementById('discount-id').value = discount.id;
    document.getElementById('discount-name').value = discount.name;
    document.getElementById('discount-start-date').value = discount.start_date;
    document.getElementById('discount-end-date').value = discount.end_date;
    document.getElementById('discount-is-active').checked = discount.is_active;
    
    renderPaymentMethodInputs(discount.payment_discounts);
    
    document.getElementById('modal-discount-title').textContent = 'Edit Diskon';
    document.getElementById('modal-discount').classList.remove('hidden');
};

window.deleteDiscount = async (id) => {
    if (!confirm('Apakah Anda yakin ingin menghapus diskon ini?')) return;
    
    const { error } = await supabase.from('global_discounts').delete().eq('id', id);
    if (error) {
        showToast('Gagal menghapus diskon', 'error');
        return;
    }
    
    showToast('Diskon berhasil dihapus', 'success');
    loadDiscounts();
};

export function setupDiscountForm() {
    const form = document.getElementById('form-discount');
    const btnAdd = document.getElementById('btn-add-discount');
    
    if (btnAdd) {
        btnAdd.addEventListener('click', () => {
            document.getElementById('form-discount').reset();
            document.getElementById('discount-id').value = '';
            document.getElementById('modal-discount-title').textContent = 'Tambah Diskon';
            
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('discount-start-date').value = today;
            document.getElementById('discount-end-date').value = today;
            
            renderPaymentMethodInputs({});
            document.getElementById('modal-discount').classList.remove('hidden');
        });
    }
    
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!activeOutletId) return showToast('Pilih outlet terlebih dahulu', 'error');
            
            const btn = document.getElementById('btn-save-discount');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = 'Menyimpan...';
            
            const id = document.getElementById('discount-id').value;
            const name = document.getElementById('discount-name').value;
            const startDate = document.getElementById('discount-start-date').value;
            const endDate = document.getElementById('discount-end-date').value;
            const isActive = document.getElementById('discount-is-active').checked;
            
            // Gather payment method discounts
            const payment_discounts = {};
            paymentMethodsList.forEach(pm => {
                const checked = document.getElementById(`pm-check-${pm.replace(/\s+/g, '-')}`).checked;
                if (checked) {
                    const pct = parseFloat(document.getElementById(`pm-pct-${pm.replace(/\s+/g, '-')}`).value) || 0;
                    const nom = parseFloat(document.getElementById(`pm-nom-${pm.replace(/\s+/g, '-')}`).value) || 0;
                    payment_discounts[pm] = { percent: pct, nominal: nom };
                }
            });
            
            const payload = {
                outlet_id: activeOutletId,
                name,
                start_date: startDate,
                end_date: endDate,
                is_active: isActive,
                payment_discounts
            };
            
            // If setting this to active, maybe we need to deactivate others for this outlet
            if (isActive) {
                await supabase
                    .from('global_discounts')
                    .update({ is_active: false })
                    .eq('outlet_id', activeOutletId);
            }
            
            let resError = null;
            if (id) {
                const { error } = await supabase.from('global_discounts').update(payload).eq('id', id);
                resError = error;
            } else {
                const { error } = await supabase.from('global_discounts').insert([payload]);
                resError = error;
            }
            
            btn.disabled = false;
            btn.innerHTML = originalText;
            
            if (resError) {
                showToast('Gagal menyimpan diskon', 'error');
                console.error(resError);
                return;
            }
            
            showToast('Diskon berhasil disimpan', 'success');
            document.getElementById('modal-discount').classList.add('hidden');
            loadDiscounts();
        });
    }
}

function renderPaymentMethodInputs(existingData = {}) {
    const container = document.getElementById('discount-payment-methods-container');
    if (!container) return;
    
    container.innerHTML = paymentMethodsList.map(pm => {
        const idSafe = pm.replace(/\s+/g, '-');
        const data = existingData[pm];
        const isChecked = !!data;
        const pct = data ? data.percent : 0;
        const nom = data ? data.nominal : 0;
        
        return `
            <div style="border: 1px solid var(--border); padding: 10px; border-radius: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <input type="checkbox" id="pm-check-${idSafe}" ${isChecked ? 'checked' : ''} onchange="toggleDiscountInputs('${idSafe}')">
                    <label for="pm-check-${idSafe}" style="margin: 0; font-weight: 600;">${pm}</label>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; ${isChecked ? '' : 'opacity: 0.5; pointer-events: none;'}" id="pm-inputs-${idSafe}">
                    <div>
                        <label style="font-size: 0.8rem;">Diskon (%)</label>
                        <input type="number" id="pm-pct-${idSafe}" value="${pct}" min="0" max="100" style="width: 100%; padding: 6px; border: 1px solid var(--border); border-radius: 4px;">
                    </div>
                    <div>
                        <label style="font-size: 0.8rem;">Diskon (Rp)</label>
                        <input type="number" id="pm-nom-${idSafe}" value="${nom}" min="0" style="width: 100%; padding: 6px; border: 1px solid var(--border); border-radius: 4px;">
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.toggleDiscountInputs = (idSafe) => {
    const isChecked = document.getElementById(`pm-check-${idSafe}`).checked;
    const inputsDiv = document.getElementById(`pm-inputs-${idSafe}`);
    if (isChecked) {
        inputsDiv.style.opacity = '1';
        inputsDiv.style.pointerEvents = 'auto';
    } else {
        inputsDiv.style.opacity = '0.5';
        inputsDiv.style.pointerEvents = 'none';
        document.getElementById(`pm-pct-${idSafe}`).value = 0;
        document.getElementById(`pm-nom-${idSafe}`).value = 0;
    }
};

export function getActiveDiscount() {
    const today = new Date().toISOString().split('T')[0];
    const active = discounts.find(d => d.is_active && d.start_date <= today && d.end_date >= today);
    return active;
}
