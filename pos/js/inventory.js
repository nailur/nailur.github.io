import { supabase } from './supabase.js';
import { activeOutletId } from './state.js';
import { showToast } from './app.js';

let inventoryList = [];

export async function loadInventory() {
    if (!activeOutletId) return;
    
    const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('outlet_id', activeOutletId)
        .order('name');
        
    if (error) {
        console.error('Error loading inventory:', error);
        return;
    }
    
    inventoryList = data || [];
    renderInventory();
}

export function renderInventory() {
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;
    
    if (inventoryList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Belum ada data inventaris/bahan baku</td></tr>';
        return;
    }
    
    tbody.innerHTML = inventoryList.map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${item.item_code}</td>
            <td>${item.name}</td>
            <td>${item.category || '-'}</td>
            <td>${item.stock_quantity || 0}</td>
            <td>${item.base_unit}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-icon btn-secondary" onclick="window.editInventory('${item.id}')" title="Edit">
                        <i class="ph ph-pencil-simple"></i>
                    </button>
                    <button class="btn btn-icon btn-danger" onclick="window.deleteInventory('${item.id}')" title="Hapus">
                        <i class="ph ph-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

export function openInventoryModal(id = null) {
    const form = document.getElementById('form-inventory');
    const modal = document.getElementById('modal-inventory');
    const title = document.getElementById('inventory-modal-title');
    
    form.reset();
    document.getElementById('inventory-id').value = '';
    
    if (id) {
        const item = inventoryList.find(i => i.id === id);
        if (item) {
            title.textContent = 'Edit Item';
            document.getElementById('inventory-id').value = item.id;
            document.getElementById('inventory-name').value = item.name;
            document.getElementById('inventory-category').value = item.category || 'Bahan Baku';
            document.getElementById('inventory-purchase-unit').value = item.purchase_unit || '';
            document.getElementById('inventory-base-unit').value = item.base_unit || '';
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
    if (!activeOutletId) return showToast('Pilih outlet terlebih dahulu', 'error');
    
    const btn = document.getElementById('btn-save-inventory');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';
    
    const id = document.getElementById('inventory-id').value;
    const payload = {
        outlet_id: activeOutletId,
        item_code: document.getElementById('inventory-name').value.substring(0,3).toUpperCase() + '-' + Math.floor(Math.random() * 10000), // generated
        name: document.getElementById('inventory-name').value,
        category: document.getElementById('inventory-category').value,
        purchase_unit: document.getElementById('inventory-purchase-unit').value,
        base_unit: document.getElementById('inventory-base-unit').value,
        conversion_factor: parseFloat(document.getElementById('inventory-conversion').value) || 1,
        stock_quantity: parseFloat(document.getElementById('inventory-stock').value) || 0
    };
    
    try {
        if (id) {
            const { error } = await supabase.from('inventory_items').update(payload).eq('id', id);
            if (error) throw error;
            showToast('Item berhasil diperbarui', 'success');
        } else {
            const { error } = await supabase.from('inventory_items').insert([payload]);
            if (error) throw error;
            showToast('Item berhasil ditambahkan', 'success');
        }
        
        document.getElementById('modal-inventory').classList.add('hidden');
        loadInventory();
    } catch (err) {
        showToast('Gagal menyimpan item: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Simpan';
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
