import { supabase } from './supabase.js';
import { showToast, escapeHtml, showConfirm } from './app.js';
import { products } from './products.js';

// Cache: productId -> { groups: [...], modifiers: [...] }
let modifierCache = {};

export async function loadModifiersForProduct(productId) {
    if (modifierCache[productId]) return modifierCache[productId];
    
    const { data: groups, error: gErr } = await supabase
        .from('product_modifier_groups')
        .select('id, name, is_required, is_multiple')
        .eq('product_id', productId)
        .order('created_at');
    
    if (gErr) { console.error('Load modifier groups error:', gErr); return { groups: [], modifiers: [] }; }
    if (!groups || groups.length === 0) return { groups: [], modifiers: [] };

    const groupIds = groups.map(g => g.id);
    const { data: mods, error: mErr } = await supabase
        .from('product_modifiers')
        .select('id, group_id, name, price_modifier')
        .in('group_id', groupIds)
        .order('created_at');

    if (mErr) { console.error('Load modifiers error:', mErr); return { groups, modifiers: [] }; }

    const result = { groups: groups || [], modifiers: mods || [] };
    modifierCache[productId] = result;
    return result;
}

export function clearModifierCache(productId) {
    if (productId) delete modifierCache[productId];
    else modifierCache = {};
}

// =====================
// ADMIN: Modifier Manager
// =====================
window.openModifierManager = async function(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    document.getElementById('modifier-product-id').value = productId;
    document.getElementById('modifier-manager-title').textContent = `Varian: ${product.name}`;
    document.getElementById('modal-modifier-manager').classList.remove('hidden');

    clearModifierCache(productId);
    await renderModifierManager(productId);
}

async function renderModifierManager(productId) {
    const container = document.getElementById('modifier-groups-container');
    container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);"><i class="ph ph-spinner ph-spin" style="font-size:1.5rem;"></i> Memuat...</div>';

    const { groups, modifiers } = await loadModifiersForProduct(productId);

    if (groups.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);"><i class="ph ph-list-dashes" style="font-size:2rem; display:block; margin-bottom:10px;"></i>Belum ada kelompok varian. Klik tombol di bawah untuk menambahkan.</div>';
        return;
    }

    container.innerHTML = groups.map(group => {
        const groupMods = modifiers.filter(m => m.group_id === group.id);
        return `
        <div class="modifier-group-card" data-group-id="${group.id}" style="border: 1px solid var(--border); border-radius: var(--radius-md); padding: 15px; margin-bottom: 15px; background: rgba(255,255,255,0.5);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div>
                    <strong style="font-size: 1rem;">${escapeHtml(group.name)}</strong>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top:3px;">
                        ${group.is_required ? '<span class="badge badge-danger" style="font-size:0.7rem;">Wajib</span>' : '<span class="badge badge-secondary" style="font-size:0.7rem;">Opsional</span>'}
                        ${group.is_multiple ? '<span class="badge badge-info" style="font-size:0.7rem; margin-left:4px;">Multi-pilih</span>' : '<span class="badge badge-secondary" style="font-size:0.7rem; margin-left:4px;">Pilih 1</span>'}
                    </div>
                </div>
                <button class="btn btn-icon btn-danger" onclick="deleteModifierGroup('${group.id}')" title="Hapus Kelompok"><i class="ph ph-trash"></i></button>
            </div>
            <div style="margin-bottom:10px;">
                ${groupMods.length === 0 ? '<div style="font-size:0.85rem; color:var(--text-muted); font-style:italic;">Belum ada pilihan.</div>' : ''}
                ${groupMods.map(mod => `
                    <div style="display:flex; align-items:center; justify-content:space-between; padding: 6px 10px; border-bottom: 1px solid var(--border);">
                        <span>${escapeHtml(mod.name)} ${mod.price_modifier > 0 ? `<span style="color:var(--primary); font-size:0.85rem;">+Rp ${Number(mod.price_modifier).toLocaleString('id-ID')}</span>` : ''}</span>
                        <button class="btn btn-icon btn-danger" style="padding:4px;" onclick="deleteModifier('${mod.id}', '${productId}')" title="Hapus"><i class="ph ph-x" style="font-size:0.8rem;"></i></button>
                    </div>
                `).join('')}
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
                <input type="text" class="input" id="new-mod-name-${group.id}" placeholder="Nama pilihan (misal: Dada)" style="flex:1; padding:6px 10px; font-size:0.85rem;">
                <input type="number" class="input" id="new-mod-price-${group.id}" placeholder="+Harga" style="width:100px; padding:6px 10px; font-size:0.85rem;" min="0">
                <button class="btn btn-primary" style="padding:6px 12px; font-size:0.85rem;" onclick="addModifier('${group.id}', '${productId}')"><i class="ph ph-plus"></i></button>
            </div>
        </div>`;
    }).join('');
}

// Add Group Modal Trigger
document.getElementById('btn-add-modifier-group')?.addEventListener('click', () => {
    const productId = document.getElementById('modifier-product-id').value;
    if (!productId) return;
    document.getElementById('form-add-modifier-group').reset();
    document.getElementById('modal-add-modifier-group').classList.remove('hidden');
});

// Handle Save Group
document.getElementById('form-add-modifier-group')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const productId = document.getElementById('modifier-product-id').value;
    if (!productId) return;

    const name = document.getElementById('mod-group-name').value;
    const isRequired = document.getElementById('mod-group-required').checked;
    const isMultiple = document.getElementById('mod-group-multiple').checked;

    const btn = document.getElementById('btn-save-modifier-group');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    const { error } = await supabase.from('product_modifier_groups').insert([{
        product_id: productId,
        name: name.trim(),
        is_required: isRequired,
        is_multiple: isMultiple
    }]);

    btn.disabled = false;
    btn.textContent = 'Simpan Kelompok';

    if (error) return showToast('Gagal menambah kelompok: ' + error.message, 'error');
    
    document.getElementById('modal-add-modifier-group').classList.add('hidden');
    showToast('Kelompok varian ditambahkan', 'success');
    clearModifierCache(productId);
    await renderModifierManager(productId);
});

// Add Modifier to Group
window.addModifier = async function(groupId, productId) {
    const nameInput = document.getElementById(`new-mod-name-${groupId}`);
    const priceInput = document.getElementById(`new-mod-price-${groupId}`);
    const name = nameInput?.value?.trim();
    const price = parseFloat(priceInput?.value) || 0;

    if (!name) return showToast('Nama pilihan tidak boleh kosong', 'error');

    const { error } = await supabase.from('product_modifiers').insert([{
        group_id: groupId,
        name: name,
        price_modifier: price
    }]);

    if (error) return showToast('Gagal menambah pilihan: ' + error.message, 'error');
    showToast('Pilihan ditambahkan', 'success');
    clearModifierCache(productId);
    await renderModifierManager(productId);
}

// Delete Modifier
window.deleteModifier = function(modId, productId) {
    showConfirm('Hapus pilihan ini?', async () => {
        const { error } = await supabase.from('product_modifiers').delete().eq('id', modId);
        if (error) return showToast(error.message, 'error');
        showToast('Pilihan dihapus', 'success');
        clearModifierCache(productId);
        await renderModifierManager(productId);
    });
}

// Delete Modifier Group (cascade deletes modifiers)
window.deleteModifierGroup = function(groupId) {
    const productId = document.getElementById('modifier-product-id').value;
    showConfirm('Hapus kelompok varian beserta semua pilihannya?', async () => {
        const { error } = await supabase.from('product_modifier_groups').delete().eq('id', groupId);
        if (error) return showToast(error.message, 'error');
        showToast('Kelompok varian dihapus', 'success');
        clearModifierCache(productId);
        await renderModifierManager(productId);
    });
}

// =====================
// CASHIER: Modifier Selection when adding to cart
// =====================
export async function showModifierSelection(productId, addToCartCallback) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const { groups, modifiers } = await loadModifiersForProduct(productId);
    
    // No modifiers? Skip selection
    if (groups.length === 0) {
        addToCartCallback(productId, []);
        return;
    }

    document.getElementById('modifier-select-product-id').value = productId;
    document.getElementById('modifier-select-title').textContent = `Pilih Varian: ${product.name}`;

    const container = document.getElementById('modifier-select-groups-container');
    container.innerHTML = groups.map(group => {
        const groupMods = modifiers.filter(m => m.group_id === group.id);
        if (groupMods.length === 0) return '';

        const inputType = group.is_multiple ? 'checkbox' : 'radio';
        return `
        <div style="margin-bottom: 18px;">
            <div style="font-weight:600; margin-bottom:8px; font-size:0.95rem;">
                ${escapeHtml(group.name)}
                ${group.is_required ? '<span style="color:var(--danger); font-size:0.8rem;"> *wajib</span>' : ''}
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;" data-group-id="${group.id}" data-required="${group.is_required}">
                ${groupMods.map(mod => `
                    <label style="display:flex; align-items:center; gap:6px; padding:8px 14px; border:1px solid var(--border); border-radius: var(--radius-md); cursor:pointer; background:rgba(255,255,255,0.6); transition: all 0.15s ease;" class="modifier-option">
                        <input type="${inputType}" name="mod-group-${group.id}" value="${mod.id}" data-name="${escapeHtml(mod.name)}" data-price="${mod.price_modifier}" style="accent-color: var(--primary);">
                        <span>${escapeHtml(mod.name)}</span>
                        ${mod.price_modifier > 0 ? `<span style="color:var(--primary); font-size:0.8rem;">+Rp ${Number(mod.price_modifier).toLocaleString('id-ID')}</span>` : ''}
                    </label>
                `).join('')}
            </div>
        </div>`;
    }).join('');

    document.getElementById('modal-modifier-select').classList.remove('hidden');

    // Set up confirm button
    const confirmBtn = document.getElementById('btn-confirm-modifiers');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    
    newBtn.addEventListener('click', () => {
        // Validate required groups
        const groupContainers = container.querySelectorAll('[data-group-id]');
        const selectedModifiers = [];
        
        for (const gc of groupContainers) {
            const isRequired = gc.dataset.required === 'true';
            const checked = gc.querySelectorAll('input:checked');
            
            if (isRequired && checked.length === 0) {
                const groupName = gc.parentElement.querySelector('div').textContent.trim();
                showToast(`Silakan pilih "${groupName}" terlebih dahulu`, 'error');
                return;
            }
            
            checked.forEach(input => {
                selectedModifiers.push({
                    id: input.value,
                    name: input.dataset.name,
                    price: parseFloat(input.dataset.price) || 0
                });
            });
        }

        document.getElementById('modal-modifier-select').classList.add('hidden');
        addToCartCallback(productId, selectedModifiers);
    });
}
