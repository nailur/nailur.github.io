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
            document.getElementById('inventory-stock').value = item.stock_quantity;
        }
    } else {
        document.getElementById('inventory-stock').value = '';
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
        conversion_factor: parseFloat(document.getElementById('inventory-conversion').value) || 1
    };
    
    try {
        if (id) {
            const { error } = await supabase.from('inventory_items').update(payload).eq('id', id);
            if (error) throw error;
            showToast('Item berhasil diperbarui', 'success');
        } else {
            payload.code = document.getElementById('inventory-name').value.substring(0,3).toUpperCase() + '-' + Math.floor(Math.random() * 10000);
            const { error } = await supabase.from('inventory_items').insert([payload]);
            if (error) throw error;
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
            <td><strong>${escapeHtml(item.document_number)}</strong></td>
            <td>${new Date(item.posting_date).toLocaleDateString('id-ID')}</td>
            <td>${escapeHtml(item.notes || '-')}</td>
            <td>${escapeHtml(item.profiles?.name || 'Sistem')}</td>
            <td>
                <button class="btn btn-icon btn-secondary" onclick="window.viewPostingDetails('${item.id}', '${type}')" title="Detail"><i class="ph ph-eye"></i></button>
                <span class="badge badge-${type === 'in' ? 'success' : 'danger'}" style="margin-left: 5px;">Posted</span>
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
    const itemsTbody = document.getElementById('stock-posting-items-table').querySelector('tbody');
    
    form.reset();
    typeInput.value = type;
    
    if (type === 'in') {
        title.textContent = 'Posting Penambahan Stok';
        qtyColHeader.textContent = 'Jml Ditambahkan';
    } else {
        title.textContent = 'Posting Pemakaian Stok (COGS)';
        qtyColHeader.textContent = 'Jml Terpakai';
    }
    
    // Auto generate doc number
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    document.getElementById('stock-posting-doc').value = `${type.toUpperCase()}-${dateStr}-${Math.floor(Math.random()*1000)}`;
    document.getElementById('stock-posting-date').value = new Date().toISOString().split('T')[0];
    
    if (inventoryList.length === 0) {
        itemsTbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Belum ada master barang. Tambahkan inventaris terlebih dahulu.</td></tr>';
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
                    <input type="number" class="input posting-qty-input" data-itemid="${item.id}" placeholder="0" min="0" step="any" style="width: 100px;">
                </td>
            </tr>
        `).join('');
    }
    
    modal.classList.remove('hidden');
}

window.handleSaveStockPosting = async function(e) {
    e.preventDefault();
    const type = document.getElementById('stock-posting-type').value;
    const docNumber = document.getElementById('stock-posting-doc').value;
    const postDate = document.getElementById('stock-posting-date').value;
    const notes = document.getElementById('stock-posting-notes').value;
    
    const qtyInputs = document.querySelectorAll('.posting-qty-input');
    const items = [];
    
    qtyInputs.forEach(input => {
        const qty = parseFloat(input.value);
        if (qty > 0) {
            items.push({
                item_id: input.dataset.itemid,
                quantity: qty
            });
        }
    });
    
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
        const detailsPayload = items.map(item => ({
            posting_id: postingData.id,
            item_id: item.item_id,
            quantity: item.quantity
        }));
        
        const { error: detailsErr } = await supabase
            .from('inventory_posting_items')
            .insert(detailsPayload);
            
        if (detailsErr) throw detailsErr;
        
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
    
    try {
        const { data, error } = await supabase
            .from('inventory_posting_items')
            .select(\
                quantity,
                inventory_items (code, name, unit_small)
            \)
            .eq('posting_id', postingId);
            
        if (error) throw error;
        
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Tidak ada item</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.map(item => \
            <tr>
                <td>\</td>
                <td>\</td>
                <td>\</td>
                <td style="text-align: right;"><strong>\</strong></td>
            </tr>
        \).join('');
        
    } catch (err) {
        tbody.innerHTML = \<tr><td colspan="4" style="text-align: center; color: red;">Gagal memuat detail: \</td></tr>\;
    }
}
