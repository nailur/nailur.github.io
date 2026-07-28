import { supabase } from './supabase.js';
import { getActiveOutletId } from './state.js';
import { showToast, escapeHtml } from './app.js';

let inventoryList = [];

export async function loadInventory() {
    if (!getActiveOutletId()) return;
    
    const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('outlet_id', getActiveOutletId())
        .order('name');
        
    if (error) {
        console.error('Error loading inventory:', error);
        return;
    }
    
    inventoryList = data || [];
    renderInventory();
}

export function renderInventory() {
    const tbody = document.getElementById('inventory-table-body') || document.getElementById('inventory-table')?.querySelector('tbody');
    if (!tbody) return;
    
    if (inventoryList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Belum ada data inventaris/bahan baku</td></tr>';
        return;
    }
    
    const role = window._managementRole || window.getCurrentProfile()?.role;
    const canEdit = ['superadmin', 'owner', 'kepala_cabang', 'kepala_toko'].includes(role);
    const canDelete = ['superadmin', 'owner', 'kepala_cabang'].includes(role);
    
    tbody.innerHTML = inventoryList.map((item, index) => `
        <tr>
            <td>${escapeHtml(item.code || '-')}</td>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.category || '-')}</td>
            <td>${escapeHtml(item.unit_large || '-')}</td>
            <td>${escapeHtml(item.unit_small || '-')}</td>
            <td>${item.conversion_factor || 1}</td>
            <td>${item.price > 0 ? 'Rp ' + parseFloat(item.price).toLocaleString('id-ID') : '-'}</td>
            <td>${item.stock_quantity || 0}</td>
            <td>
                <div class="action-buttons">
                    ${canEdit ? `<button class="btn btn-icon btn-secondary" onclick="window.editInventory('${item.id}')" title="Edit"><i class="ph ph-pencil-simple"></i></button>` : ''}
                    ${canDelete ? `<button class="btn btn-icon btn-danger" onclick="window.deleteInventory('${item.id}')" title="Hapus"><i class="ph ph-trash"></i></button>` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

export function openInventoryModal(id = null) {
    const form = document.getElementById('form-inventory');
    const modal = document.getElementById('modal-inventory');
    const title = document.getElementById('modal-inventory-title');
    
    form.reset();
    document.getElementById('inventory-id').value = '';
    
    if (id) {
        const item = inventoryList.find(i => i.id === id);
        if (item) {
            title.textContent = 'Edit Item';
            document.getElementById('inventory-id').value = item.id;
            document.getElementById('inventory-name').value = item.name;
            document.getElementById('inventory-category').value = item.category || 'Bahan Baku';
            document.getElementById('inventory-purchase-unit').value = item.unit_large || '';
            document.getElementById('inventory-base-unit').value = item.unit_small || '';
            document.getElementById('inventory-conversion').value = item.conversion_factor || 1;
            document.getElementById('inventory-price').value = item.price || '';
            document.getElementById('inventory-stock').value = item.stock_quantity;
        }
    } else {
        document.getElementById('inventory-stock').value = '';
        document.getElementById('inventory-price').value = '';
        title.textContent = 'Tambah Item';
    }
    
    modal.classList.remove('hidden');
}

export async function handleSaveInventory(e) {
    e.preventDefault();
    if (!getActiveOutletId()) return showToast('Pilih outlet terlebih dahulu', 'error');
    
    const btn = document.getElementById('form-inventory')?.querySelector('button[type="submit"]');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Menyimpan...';
    }
    
    const id = document.getElementById('inventory-id').value;
    const payload = {
        outlet_id: getActiveOutletId(),
        name: document.getElementById('inventory-name').value,
        category: document.getElementById('inventory-category').value,
        unit_large: document.getElementById('inventory-purchase-unit').value,
        unit_small: document.getElementById('inventory-base-unit').value,
        conversion_factor: parseFloat(document.getElementById('inventory-conversion').value) || 1,
        price: parseFloat(document.getElementById('inventory-price').value) || 0
    };
    
    try {
        if (id) {
            let res = await supabase.from('inventory_items').update(payload).eq('id', id);
            if (res.error && res.error.message && res.error.message.includes('price')) {
                delete payload.price;
                res = await supabase.from('inventory_items').update(payload).eq('id', id);
                console.warn('Kolom price belum tersedia pada tabel inventory_items.');
            }
            if (res.error) throw res.error;
            showToast('Item berhasil diperbarui', 'success');
        } else {
            payload.code = document.getElementById('inventory-name').value.substring(0,3).toUpperCase() + '-' + Math.floor(Math.random() * 10000);
            let res = await supabase.from('inventory_items').insert([payload]);
            if (res.error && res.error.message && res.error.message.includes('price')) {
                delete payload.price;
                res = await supabase.from('inventory_items').insert([payload]);
                console.warn('Kolom price belum tersedia pada tabel inventory_items.');
            }
            if (res.error) throw res.error;
            showToast('Item berhasil ditambahkan', 'success');
        }
        
        document.getElementById('modal-inventory').classList.add('hidden');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Simpan Barang';
        }
        loadInventory();
    } catch (err) {
        showToast(err.message, 'error');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Simpan Barang';
        }
    }
}

export async function deleteInventory(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus item ini?')) return;
    
    try {
        const { error } = await supabase.from('inventory_items').delete().eq('id', id);
        if (error) throw error;
        showToast('Item berhasil dihapus', 'success');
        loadInventory();
    } catch (err) {
        showToast('Gagal menghapus item: ' + err.message, 'error');
    }
}

// Bind to window for HTML inline event handlers
window.editInventory = openInventoryModal;
window.deleteInventory = deleteInventory;

let postingsList = { in: [], out: [] };

export async function loadStockPostings() {
    if (!getActiveOutletId()) return;
    
    const { data, error } = await supabase
        .from('inventory_postings')
        .select(`
            id, document_number, posting_date, type, notes, created_at,
            profiles:created_by (name)
        `)
        .eq('outlet_id', getActiveOutletId())
        .order('posting_date', { ascending: false })
        .order('created_at', { ascending: false });
        
    if (error) {
        console.error('Error loading postings:', error);
        return;
    }
    
    postingsList.in = data.filter(p => p.type === 'in') || [];
    postingsList.out = data.filter(p => p.type === 'out') || [];
    
    renderStockPostings('in');
    renderStockPostings('out');
}

function renderStockPostings(type) {
    const tbody = document.getElementById(`stock-${type}-table`)?.querySelector('tbody');
    if (!tbody) return;
    
    const list = postingsList[type];
    
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem;">Belum ada data posting ${type === 'in' ? 'penambahan' : 'pemakaian'}</td></tr>`;
        return;
    }
    
    tbody.innerHTML = list.map(item => `
        <tr>
            <td>${escapeHtml(item.document_number)}</td>
            <td>${new Date(item.posting_date).toLocaleDateString('id-ID')}</td>
            <td>${escapeHtml(item.notes || '-')}</td>
            <td>${escapeHtml(item.profiles?.name || 'Sistem')}</td>
            <td>
                <button class="btn btn-icon btn-secondary" onclick="window.viewPostingDetails('${item.id}', '${type}')" title="Detail"><i class="ph ph-eye"></i></button>
            </td>
        </tr>
    `).join('');
}

window.openStockPostingModal = function(type) {
    const form = document.getElementById('form-stock-posting');
    const modal = document.getElementById('modal-stock-posting');
    const title = document.getElementById('modal-stock-posting-title');
    const typeInput = document.getElementById('stock-posting-type');
    const qtyColHeader = document.getElementById('stock-posting-qty-col-header');
    const priceColHeader = document.getElementById('stock-posting-price-col-header');
    const tfoot = document.getElementById('stock-posting-tfoot');
    const itemsTbody = document.getElementById('stock-posting-items-table').querySelector('tbody');
    
    form.reset();
    typeInput.value = type;
    
    if (type === 'in') {
        title.textContent = 'Posting Penambahan Stok';
        qtyColHeader.textContent = 'Jml Ditambahkan';
        if (priceColHeader) priceColHeader.classList.remove('hidden');
        if (tfoot) tfoot.classList.remove('hidden');
    } else {
        title.textContent = 'Posting Pemakaian Stok (COGS)';
        qtyColHeader.textContent = 'Sisa Stok Akhir';
        if (priceColHeader) priceColHeader.classList.add('hidden');
        if (tfoot) tfoot.classList.add('hidden');
    }
    
    // Auto generate doc number
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    document.getElementById('stock-posting-doc').value = `${type.toUpperCase()}-${dateStr}-${Math.floor(Math.random()*1000)}`;
    document.getElementById('stock-posting-date').value = new Date().toISOString().split('T')[0];
    
    const colCount = type === 'in' ? 6 : 5;
    if (inventoryList.length === 0) {
        itemsTbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center;">Belum ada master barang. Tambahkan inventaris terlebih dahulu.</td></tr>`;
        form.querySelector('button[type="submit"]').disabled = true;
    } else {
        form.querySelector('button[type="submit"]').disabled = false;
        itemsTbody.innerHTML = inventoryList.map(item => `
            <tr>
                <td>${escapeHtml(item.code || '-')}</td>
                <td>${escapeHtml(item.name)}</td>
                <td>${escapeHtml(item.unit_small || '-')}</td>
                <td>${item.stock_quantity || 0}</td>
                <td>
                    <input type="number" class="input posting-qty-input" data-itemid="${item.id}" data-currentstock="${item.stock_quantity || 0}" placeholder="${type === 'out' ? (item.stock_quantity || 0) : '0'}" min="0" step="any" style="width: 100px;" oninput="window.updateStockPostingTotal && window.updateStockPostingTotal()">
                </td>
                ${type === 'in' ? `
                <td>
                    <input type="number" class="input posting-price-input" data-itemid="${item.id}" value="" placeholder="0" min="0" step="any" style="width: 140px;" oninput="window.updateStockPostingTotal && window.updateStockPostingTotal()">
                </td>` : ''}
            </tr>
        `).join('');
        if (window.updateStockPostingTotal) window.updateStockPostingTotal();
    }
    
    modal.classList.remove('hidden');
}

window.updateStockPostingTotal = function() {
    const type = document.getElementById('stock-posting-type')?.value;
    if (type !== 'in') return;
    
    let totalCost = 0;
    const qtyInputs = document.querySelectorAll('.posting-qty-input');
    qtyInputs.forEach(qtyInput => {
        const qty = parseFloat(qtyInput.value) || 0;
        if (qty > 0) {
            const itemId = qtyInput.dataset.itemid;
            const priceInput = document.querySelector(`.posting-price-input[data-itemid="${itemId}"]`);
            const price = priceInput ? (parseFloat(priceInput.value) || 0) : 0;
            totalCost += price;
        }
    });
    
    const totalEl = document.getElementById('stock-posting-total-cost');
    if (totalEl) {
        totalEl.textContent = 'Rp ' + totalCost.toLocaleString('id-ID');
    }
};

window.handleSaveStockPosting = async function(e) {
    e.preventDefault();
    const type = document.getElementById('stock-posting-type').value;
    const docNumber = document.getElementById('stock-posting-doc').value;
    const postDate = document.getElementById('stock-posting-date').value;
    const notes = document.getElementById('stock-posting-notes').value;
    
    const qtyInputs = document.querySelectorAll('.posting-qty-input');
    const items = [];
    let hasInvalidCogs = false;
    
    qtyInputs.forEach(input => {
        if (input.value.trim() !== '') {
            let inputVal = parseFloat(input.value);
            let qty = inputVal;
            
            if (type === 'out') {
                const currentStock = parseFloat(input.dataset.currentstock);
                qty = currentStock - inputVal;
                if (qty < 0) hasInvalidCogs = true;
            }
            
            if (qty > 0) {
                const itemId = input.dataset.itemid;
                let price = 0;
                if (type === 'in') {
                    const priceInput = document.querySelector(`.posting-price-input[data-itemid="${itemId}"]`);
                    if (priceInput && priceInput.value.trim() !== '') {
                        price = parseFloat(priceInput.value) || 0;
                    }
                }
                items.push({
                    item_id: itemId,
                    quantity: qty,
                    price: price
                });
            }
        }
    });
    
    if (hasInvalidCogs) {
        return showToast('Sisa stok akhir tidak boleh lebih besar dari stok saat ini. Gunakan Penambahan Stok!', 'error');
    }
    
    if (items.length === 0) {
        return showToast('Isi setidaknya satu jumlah barang yang diposting!', 'error');
    }
    
    const btn = document.getElementById('form-stock-posting').querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Memproses...';
    
    try {
        const profile = window.getCurrentProfile();
        
        // 1. Insert Header
        const { data: postingData, error: headerErr } = await supabase
            .from('inventory_postings')
            .insert([{
                outlet_id: getActiveOutletId(),
                document_number: docNumber,
                posting_date: postDate,
                type: type,
                notes: notes,
                created_by: profile?.id
            }])
            .select()
            .single();
            
        if (headerErr) throw headerErr;
        
        // 2. Insert Details
        const detailsPayload = items.map(item => {
            const payload = {
                posting_id: postingData.id,
                item_id: item.item_id,
                quantity: item.quantity
            };
            if (item.price !== undefined && item.price > 0) {
                payload.price = item.price;
            }
            return payload;
        });
        
        let detailsRes = await supabase
            .from('inventory_posting_items')
            .insert(detailsPayload);
            
        if (detailsRes.error && detailsRes.error.message && detailsRes.error.message.includes('price')) {
            const fallbackPayload = items.map(item => ({
                posting_id: postingData.id,
                item_id: item.item_id,
                quantity: item.quantity
            }));
            detailsRes = await supabase
                .from('inventory_posting_items')
                .insert(fallbackPayload);
            console.warn('Kolom price belum tersedia di database inventory_posting_items. Menyimpan kuantitas stok saja.');
        }
            
        if (detailsRes.error) throw detailsRes.error;
        
        // 3. Update harga beli/satuan terakhir pada tabel inventory_items (jika posting penambahan memiliki harga)
        if (type === 'in') {
            for (const item of items) {
                if (item.price > 0 && item.quantity > 0) {
                    const unitPrice = Math.round((item.price / item.quantity) * 100) / 100;
                    try {
                        await supabase
                            .from('inventory_items')
                            .update({ price: unitPrice })
                            .eq('id', item.item_id);
                    } catch (err) {
                        console.warn('Kolom price belum tersedia pada tabel inventory_items:', err);
                    }
                }
            }
        }
        
        showToast('Posting stok berhasil disimpan!', 'success');
        document.getElementById('modal-stock-posting').classList.add('hidden');
        
        // Reload everything
        await loadInventory();
        await loadStockPostings();
        
    } catch (err) {
        showToast('Gagal memproses posting: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Simpan Posting';
    }
}

window.viewPostingDetails = async function(postingId, type) {
    const posting = postingsList[type]?.find(p => p.id === postingId);
    if (!posting) return;
    
    document.getElementById('detail-posting-doc').textContent = posting.document_number;
    document.getElementById('detail-posting-date').textContent = new Date(posting.posting_date).toLocaleDateString('id-ID');
    document.getElementById('detail-posting-user').textContent = posting.profiles?.name || 'Sistem';
    document.getElementById('detail-posting-notes').textContent = posting.notes || '-';
    
    const tbody = document.getElementById('detail-posting-items-table').querySelector('tbody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Memuat detail...</td></tr>';
    
    document.getElementById('modal-posting-details').classList.remove('hidden');
    
    const priceHeader = document.getElementById('detail-posting-price-col-header');
    if (type === 'in') {
        if (priceHeader) priceHeader.classList.remove('hidden');
    } else {
        if (priceHeader) priceHeader.classList.add('hidden');
    }
    
    try {
        let data, error;
        const res = await supabase
            .from('inventory_posting_items')
            .select(`
                quantity,
                price,
                inventory_items (code, name, unit_small)
            `)
            .eq('posting_id', postingId);
            
        if (res.error && res.error.message && res.error.message.includes('price')) {
            const fallbackRes = await supabase
                .from('inventory_posting_items')
                .select(`
                    quantity,
                    inventory_items (code, name, unit_small)
                `)
                .eq('posting_id', postingId);
            data = fallbackRes.data;
            error = fallbackRes.error;
        } else {
            data = res.data;
            error = res.error;
        }
            
        if (error) throw error;
        
        const colCount = type === 'in' ? 5 : 4;
        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center;">Tidak ada item</td></tr>`;
            return;
        }
        
        let totalVal = 0;
        tbody.innerHTML = data.map(item => {
            const qty = parseFloat(item.quantity) || 0;
            const price = parseFloat(item.price) || 0;
            if (type === 'in') totalVal += price;
            return `
            <tr>
                <td>${escapeHtml(item.inventory_items?.code || '-')}</td>
                <td>${escapeHtml(item.inventory_items?.name || '-')}</td>
                <td>${escapeHtml(item.inventory_items?.unit_small || '-')}</td>
                <td style="text-align: right;"><strong>${qty}</strong></td>
                ${type === 'in' ? `
                <td style="text-align: right;"><strong>${price > 0 ? 'Rp ' + price.toLocaleString('id-ID') : '-'}</strong></td>
                ` : ''}
            </tr>
            `;
        }).join('');
        
        if (type === 'in' && totalVal > 0) {
            tbody.innerHTML += `
            <tr style="background: rgba(var(--primary-rgb), 0.05); font-weight: bold;">
                <td colspan="4" style="text-align: right;">TOTAL BIAYA PENAMBAHAN:</td>
                <td style="text-align: right; color: var(--primary);">Rp ${totalVal.toLocaleString('id-ID')}</td>
            </tr>
            `;
        }
        
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: red;">Gagal memuat detail: ${err.message}</td></tr>`;
    }
}
