import { supabase } from './supabase.js';
import { showToast, escapeHtml } from './app.js';
import { activeOutletId } from './state.js';
import { getOfflineProducts, saveOfflineProducts } from './offline.js';
import { getCurrentProfile } from './auth.js';

export let products = [];
export let productShowAll = false;
const PRODUCT_DISPLAY_LIMIT = 50;

export async function loadProducts() {
    if (!activeOutletId) return;

    if (products.length === 0) {
        const grid = document.getElementById('product-grid');
        if (grid) grid.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;gap:10px;color:var(--text-muted);"><i class="ph ph-spinner ph-spin" style="font-size:2rem;"></i><span>Memuat produk...</span></div>';
    }

    try {
        const cachedProducts = await getOfflineProducts(activeOutletId);
        if (cachedProducts && cachedProducts.length > 0) {
            products = cachedProducts;
            productShowAll = false;
            renderProducts();
        }
    } catch (err) {
        console.error('Failed to load products from cache', err);
    }

    if (!navigator.onLine) return;

    const { data, error } = await supabase.from('products').select('id, name, price, price_gofood, price_grabfood, price_shopeefood, image_url, created_at').eq('outlet_id', activeOutletId).order('name');
    if (error) {
        if (!products.length) showToast('Gagal memuat produk dari server', 'error');
        return;
    }
    
    products = data;
    productShowAll = false;
    renderProducts();
    
    await saveOfflineProducts(activeOutletId, data);
}

export function renderProducts(search = '') {
    const grid = document.getElementById('product-grid');
    const profile = getCurrentProfile();
    const canEdit = profile.role !== 'kasir';
    
    const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    
    if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-cart"><p>Tidak ada produk</p></div>`;
        return;
    }

    const shouldLimit = !search && !productShowAll && filtered.length > PRODUCT_DISPLAY_LIMIT;
    const displayProducts = shouldLimit ? filtered.slice(0, PRODUCT_DISPLAY_LIMIT) : filtered;

    grid.innerHTML = displayProducts.map(p => {
        return `
        <div class="product-card" onclick="addToCart('${p.id}')">
            ${p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" class="product-image" loading="lazy" decoding="async">` : `<div class="product-image" style="display:flex;align-items:center;justify-content:center;color:#ccc;"><i class="ph-duotone ph-image" style="font-size:2.5rem;"></i></div>`}
            <div style="flex:1; display:flex; flex-direction:column; justify-content:flex-start;">
                <div class="product-name">${escapeHtml(p.name)}</div>
                <div class="product-price">Rp ${p.price.toLocaleString('id-ID')}</div>
            </div>
            ${canEdit ? `
                <div style="margin-top:10px; display:flex; gap:5px; justify-content:center;" onclick="event.stopPropagation()">
                    <button class="btn btn-icon btn-secondary" onclick="editProduct('${p.id}')" title="Edit"><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn btn-icon btn-danger" onclick="deleteProduct('${p.id}')" title="Hapus"><i class="ph ph-trash"></i></button>
                </div>
            ` : ''}
        </div>
    `}).join('');

    if (shouldLimit) {
        grid.insertAdjacentHTML('beforeend', `
            <button class="btn-load-more" onclick="showAllProducts()">
                <i class="ph ph-arrow-down"></i> Tampilkan Semua (${filtered.length} produk)
            </button>
        `);
    }
}

export function compressImage(file, maxWidth = 300, maxHeight = 300, quality = 0.6) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round(height * (maxWidth / width));
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round(width * (maxHeight / height));
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    resolve(compressedFile);
                }, 'image/jpeg', quality);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

export async function handleSaveProduct(e) {
    e.preventDefault();
    if (!activeOutletId) return;
    
    const btn = document.getElementById('btn-save-product');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    const id = document.getElementById('product-id').value;
    const name = document.getElementById('product-name').value;
    const price = document.getElementById('product-price').value;
    const price_gofood = document.getElementById('product-price-gofood').value;
    const price_grabfood = document.getElementById('product-price-grabfood').value;
    const price_shopeefood = document.getElementById('product-price-shopeefood').value;

    const imageInput = document.getElementById('product-image');
    let image_url = null;

    try {
        if (imageInput.files && imageInput.files[0]) {
            const file = imageInput.files[0];
            
            btn.textContent = 'Mengompres Gambar...';
            const compressedFile = await compressImage(file, 800, 800, 0.7);
            
            btn.textContent = 'Mengunggah...';
            const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.jpg`;
            
            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(fileName, compressedFile, { contentType: 'image/jpeg' });
                
            if (uploadError) throw new Error('Gagal mengunggah foto: ' + uploadError.message);
            
            const { data: publicUrlData } = supabase.storage
                .from('product-images')
                .getPublicUrl(fileName);
                
            image_url = publicUrlData.publicUrl;
        }

        const payload = { 
            name, price, outlet_id: activeOutletId,
            price_gofood: price_gofood ? price_gofood : null,
            price_grabfood: price_grabfood ? price_grabfood : null,
            price_shopeefood: price_shopeefood ? price_shopeefood : null
        };
        if (image_url) payload.image_url = image_url;

        if (id) {
            const { error } = await supabase.from('products').update(payload).eq('id', id);
            if (error) throw new Error(error.message);
            showToast('Produk diperbarui', 'success');
        } else {
            const { error } = await supabase.from('products').insert([payload]);
            if (error) throw new Error(error.message);
            showToast('Produk ditambahkan', 'success');
        }
        
        document.getElementById('modal-product').classList.add('hidden');
        loadProducts();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Simpan';
    }
}

export function editProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    document.getElementById('product-id').value = p.id;
    document.getElementById('product-name').value = p.name;
    document.getElementById('product-price').value = p.price;
    document.getElementById('product-price-gofood').value = p.price_gofood || '';
    document.getElementById('product-price-grabfood').value = p.price_grabfood || '';
    document.getElementById('product-price-shopeefood').value = p.price_shopeefood || '';

    document.getElementById('product-image').value = '';
    
    if (p.image_url) {
        document.getElementById('product-image-preview').src = p.image_url;
        document.getElementById('product-image-preview-container').classList.remove('hidden');
    } else {
        document.getElementById('product-image-preview').src = '';
        document.getElementById('product-image-preview-container').classList.add('hidden');
    }

    document.getElementById('product-modal-title').textContent = 'Edit Produk';
    document.getElementById('modal-product').classList.remove('hidden');
}

export async function deleteProduct(id) {
    if(!confirm('Hapus produk ini?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if(error) showToast(error.message, 'error');
    else loadProducts();
}

export function showAllProducts() {
    productShowAll = true;
    renderProducts();
}
