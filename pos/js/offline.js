import { supabase } from './supabase.js';
import { showToast } from './app.js';

let _dbInstance = null;
export async function initDB() {
    if (_dbInstance) return _dbInstance;
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('POSDatabase', 2);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('offline_transactions')) {
                db.createObjectStore('offline_transactions', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('offline_products')) {
                db.createObjectStore('offline_products', { keyPath: 'outlet_id' });
            }
        };
        request.onsuccess = () => {
            _dbInstance = request.result;
            _dbInstance.onclose = () => { _dbInstance = null; };
            resolve(_dbInstance);
        };
        request.onerror = () => reject(request.error);
    });
}

export async function getOfflineProducts(outletId) {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('offline_products', 'readonly');
            const store = tx.objectStore('offline_products');
            const req = store.get(outletId);
            req.onsuccess = () => resolve(req.result ? req.result.products : null);
            req.onerror = () => reject(req.error);
        });
    } catch(e) { return null; }
}

export async function saveOfflineProducts(outletId, productsData) {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('offline_products', 'readwrite');
            const store = tx.objectStore('offline_products');
            store.put({ outlet_id: outletId, products: productsData, updated_at: new Date().toISOString() });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch(e) { console.error('Failed saving offline products', e); }
}

export async function saveOfflineTransaction(trx) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('offline_transactions', 'readwrite');
        const store = tx.objectStore('offline_transactions');
        store.put(trx);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function getOfflineTransactions() {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('offline_transactions', 'readonly');
        const store = tx.objectStore('offline_transactions');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function clearOfflineTransaction(id) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('offline_transactions', 'readwrite');
        const store = tx.objectStore('offline_transactions');
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

window.addEventListener('online', async () => {
    console.log('Online! Menyinkronkan data...');
    await syncOfflineTransactions();
});

let isSyncing = false;
let syncRetryCount = 0;
const MAX_SYNC_RETRIES = 5;

export async function syncOfflineTransactions() {
    if (!navigator.onLine || isSyncing) return;
    
    isSyncing = true;
    let failCount = 0;
    try {
        const pending = await getOfflineTransactions();
        if (pending.length === 0) {
            syncRetryCount = 0;
            return;
        }
    
    showToast(`Menyinkronkan ${pending.length} transaksi offline...`, 'info');
    let successCount = 0;
    for (const trx of pending) {
        try {
            const { error: trxError } = await supabase.from('transactions').insert({
                id: trx.id,
                outlet_id: trx.outlet_id,
                cashier_id: trx.cashier_id,
                subtotal_amount: trx.subtotal_amount,
                discount_amount: trx.discount_amount,
                tax_amount: trx.tax_amount,
                total_amount: trx.total_amount,
                payment_method: trx.payment_method,
                customer_name: trx.customer_name,
                cash_received: trx.cash_received || 0,
                change_amount: trx.change_amount || 0,
                receipt_no: trx.receipt_no
            });
            
            if (!trxError) {
                const itemsToInsert = trx.items.map(item => ({
                    transaction_id: trx.id,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    price: item.price,
                    modifiers: item.modifiers
                }));
                const { error: itemsError } = await supabase.from('transaction_items').insert(itemsToInsert);
                if (itemsError) {
                    console.error("Insert Items Offline Sync Error:", itemsError);
                    const itemsFallback = trx.items.map(item => ({
                        transaction_id: trx.id,
                        product_id: item.product_id,
                        quantity: item.quantity,
                        price: item.price
                    }));
                    await supabase.from('transaction_items').insert(itemsFallback);
                }
                
                await clearOfflineTransaction(trx.id);
                successCount++;
            } else {
                console.error('Offline Sync Error:', trxError);
                trx.sync_error = trxError.message;
                await saveOfflineTransaction(trx);
                failCount++;
            }
        } catch (e) {
            console.error('Failed to sync offline transaction', e);
            trx.sync_error = e.message || 'Unknown error';
            await saveOfflineTransaction(trx);
            failCount++;
        }
    }
    
    if (successCount > 0) {
        showToast(`${successCount} transaksi offline berhasil disinkronkan!`, 'success');
        if (typeof window.loadHistory === 'function') window.loadHistory();
    }
    } finally {
        isSyncing = false;
    }

    if (failCount > 0 && syncRetryCount < MAX_SYNC_RETRIES) {
        syncRetryCount++;
        const delay = Math.min(5000 * Math.pow(2, syncRetryCount - 1), 60000); // 5s, 10s, 20s, 40s, 60s max
        showToast(`${failCount} transaksi gagal sync, mencoba ulang dalam ${delay / 1000} detik...`, 'warning');
        setTimeout(() => syncOfflineTransactions(), delay);
    } else if (failCount > 0) {
        showToast(`${failCount} transaksi masih gagal setelah ${MAX_SYNC_RETRIES}x percobaan. Coba refresh manual.`, 'error');
        syncRetryCount = 0;
    } else {
        syncRetryCount = 0;
    }
}
