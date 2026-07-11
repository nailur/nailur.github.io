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
        stock_quantity: parseFloat(document.getElementById('inventory-stock').value) || 0
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
