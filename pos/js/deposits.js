import { supabase } from './supabase.js';
import { getActiveOutletId } from './state.js';
import { showToast, getLocalToday, generateRandomDocNumber, escapeHtml } from './app.js';
import { getCurrentProfile } from './auth.js';

let depositsList = [];
let depositsPage = 0;
const DEPOSITS_PAGE_SIZE = 50;
let hasMoreDeposits = true;

export async function loadDeposits(append = false) {
    if (!getActiveOutletId()) return;
    
    if (!append) {
        depositsPage = 0;
        hasMoreDeposits = true;
    }
    
    if (!hasMoreDeposits) return;
    
    const { data, error } = await supabase
        .from('sales_deposits')
        .select('*, profiles:created_by (name)')
        .eq('outlet_id', getActiveOutletId())
        .order('created_at', { ascending: false })
        .range(depositsPage * DEPOSITS_PAGE_SIZE, (depositsPage + 1) * DEPOSITS_PAGE_SIZE - 1);
        
    if (!error) {
        if (data.length < DEPOSITS_PAGE_SIZE) {
            hasMoreDeposits = false;
        }
        
        if (append) {
            depositsList = [...depositsList, ...(data || [])];
        } else {
            depositsList = data || [];
        }
        
        depositsPage++;
        renderDeposits();
    }
}

window.loadMoreDeposits = function() {
    loadDeposits(true);
};

export function renderDeposits() {
    const tbody = document.getElementById('deposits-table')?.querySelector('tbody');
    if (!tbody) return;
    
    if (depositsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Belum ada data setoran</td></tr>';
        return;
    }
    
    const role = window._managementRole || window.getCurrentProfile()?.role;
    const canEdit = ['superadmin', 'owner', 'kepala_cabang', 'kepala_toko'].includes(role);
    const canDelete = ['superadmin', 'owner', 'kepala_cabang'].includes(role);
    
    tbody.innerHTML = depositsList.map(dep => `
        <tr>
            <td>${escapeHtml(dep.document_number)}</td>
            <td>${new Date(dep.deposit_date).toLocaleDateString('id-ID')}</td>
            <td>Rp ${dep.amount.toLocaleString('id-ID')}</td>
            <td>${escapeHtml(dep.account_type || '-')}</td>
            <td>${escapeHtml(dep.notes || '-')}</td>
            <td>${escapeHtml(dep.profiles?.name || '-')}</td>
            <td style="white-space:nowrap;">
                ${dep.attachment_url ? `<button class="btn btn-icon btn-secondary" data-attachment-url="${escapeHtml(dep.attachment_url)}" onclick="window.viewAttachment(this.dataset.attachmentUrl)" title="Lihat Bukti"><i class="ph ph-image"></i></button>` : ''}
                ${canEdit ? `<button class="btn btn-icon btn-secondary" onclick="window.editDeposit('${dep.id}')" title="Edit"><i class="ph ph-pencil-simple"></i></button>` : ''}
                ${canDelete ? `<button class="btn btn-icon btn-danger" onclick="window.deleteDeposit('${dep.id}')" title="Hapus"><i class="ph ph-trash"></i></button>` : ''}
            </td>
        </tr>
    `).join('');
    
    const loadMoreBtn = document.getElementById('deposits-load-more-container');
    if (loadMoreBtn) {
        loadMoreBtn.style.display = hasMoreDeposits ? 'block' : 'none';
    }
}

export async function handleSaveDeposit(e) {
    e.preventDefault();
    if (!getActiveOutletId()) return showToast('Pilih outlet', 'error');
    
    const btn = document.getElementById('form-deposit').querySelector('button[type="submit"]');
    btn.disabled = true;
    
    const id = document.getElementById('deposit-id')?.value;
    const amount = parseFloat(document.getElementById('deposit-amount').value);
    const account_type = document.getElementById('deposit-type').value;
    const notes = document.getElementById('deposit-notes').value;
    const fileInput = document.getElementById('deposit-attachment');
    let attachment_url = null;
    
    try {
        // Upload & Compress Image if selected
        if (fileInput.files && fileInput.files.length > 0) {
            btn.innerHTML = 'Mengompres...';
            const file = fileInput.files[0];
            const options = {
                maxSizeMB: 0.5,
                maxWidthOrHeight: 1280,
                useWebWorker: true
            };
            
            let compressedFile;
            try {
                compressedFile = await imageCompression(file, options);
            } catch (err) {
                console.error('Compression error', err);
                compressedFile = file; // fallback to original
            }
            
            btn.innerHTML = 'Mengunggah...';
            const ext = compressedFile.name.split('.').pop() || 'jpg';
            const fileName = `deposit_${Date.now()}_${Math.random().toString(36).substr(2,9)}.${ext}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('attachments')
                .upload(fileName, compressedFile, {
                    cacheControl: '3600',
                    upsert: false
                });
                
            if (uploadError) throw uploadError;
            
            // Get public URL
            const { data: publicData } = supabase.storage.from('attachments').getPublicUrl(fileName);
            attachment_url = publicData.publicUrl;
        }
        
        btn.innerHTML = 'Menyimpan...';
        
        const payload = {
            outlet_id: getActiveOutletId(),
            amount,
            account_type,
            notes,
        };
        
        if (attachment_url) {
            payload.attachment_url = attachment_url;
        }
        
        if (id) {
            const { error } = await supabase.from('sales_deposits').update(payload).eq('id', id);
            if (error) throw error;
            showToast('Setoran berhasil diperbarui', 'success');
        } else {
            const docNumber = generateRandomDocNumber('ST');
            payload.document_number = docNumber;
            payload.deposit_date = getLocalToday();
            payload.created_by = getCurrentProfile().id;
            payload.status = 'Diposting';
            const { error } = await supabase.from('sales_deposits').insert([payload]);
            if (error) throw error;
            showToast('Setoran berhasil dicatat', 'success');
        }
        
        document.getElementById('modal-deposit').classList.add('hidden');
        loadDeposits();
    } catch (err) {
        showToast('Gagal mencatat setoran: ' + err.message, 'error');
    } finally {
        btn.innerHTML = 'Simpan Setoran';
        btn.disabled = false;
    }
}

export async function deleteDeposit(id) {
    if (!confirm('Hapus pencatatan setoran ini?')) return;
    const { error } = await supabase.from('sales_deposits').delete().eq('id', id);
    if (!error) {
        showToast('Berhasil dihapus', 'success');
        loadDeposits();
    }
}

window.deleteDeposit = deleteDeposit;

window.editDeposit = function(id) {
    const deposit = depositsList.find(d => d.id === id);
    if (!deposit) return;
    document.getElementById('deposit-id').value = deposit.id;
    document.getElementById('deposit-amount').value = deposit.amount;
    if (deposit.account_type) {
        document.getElementById('deposit-type').value = deposit.account_type;
    }
    document.getElementById('deposit-notes').value = deposit.notes || '';
    
    // reset file input
    document.getElementById('deposit-attachment').value = '';
    const previewContainer = document.getElementById('deposit-attachment-preview-container');
    const previewImg = document.getElementById('deposit-attachment-preview');
    if (deposit.attachment_url) {
        previewImg.src = deposit.attachment_url;
        previewContainer.classList.remove('hidden');
    } else {
        previewImg.src = '';
        previewContainer.classList.add('hidden');
    }
    
    document.getElementById('modal-deposit').classList.remove('hidden');
}

window.openAddDeposit = function() {
    const form = document.getElementById('form-deposit');
    if(form) form.reset();
    document.getElementById('deposit-id').value = '';
    document.getElementById('deposit-attachment-preview-container').classList.add('hidden');
    document.getElementById('deposit-attachment-preview').src = '';
    document.getElementById('modal-deposit').classList.remove('hidden');
}

window.viewAttachment = function(url) {
    document.getElementById('image-viewer-img').src = url;
    document.getElementById('image-viewer-download').href = url;
    document.getElementById('modal-image-viewer').classList.remove('hidden');
}

// Attach image preview listener
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('deposit-attachment');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            const previewContainer = document.getElementById('deposit-attachment-preview-container');
            const previewImg = document.getElementById('deposit-attachment-preview');
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewImg.src = e.target.result;
                    previewContainer.classList.remove('hidden');
                }
                reader.readAsDataURL(file);
            } else {
                previewImg.src = '';
                previewContainer.classList.add('hidden');
            }
        });
    }
});
