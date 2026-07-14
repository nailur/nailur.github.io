import { supabase } from './supabase.js';
import { showToast, escapeHtml, generateOrderId } from './app.js';
import { activeOutletId, posOutletsList } from './state.js';
import { products, loadProducts } from './products.js';
import { saveOfflineTransaction } from './offline.js';
import { getCurrentProfile } from './auth.js';
import { printReceiptNative } from './printer.js';
import { showModifierSelection } from './modifiers.js';

export let cart = [];
try {
    cart = JSON.parse(localStorage.getItem('pos_cart')) || [];
    // Migrate old cart items that don't have _cartKey
    cart = cart.map(item => {
        if (!item._cartKey) {
            const modKey = (item.modifiers || []).map(m => m.id).sort().join(',');
            item._cartKey = `${item.product_id}__${modKey}`;
            item.modifiers = item.modifiers || [];
            item.modifier_price = item.modifier_price || 0;
            item.base_price = item.base_price || item.price;
        }
        return item;
    });
} catch (e) {
    cart = [];
}

export function addToCart(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    // Check if product has modifiers - if so, show selection first
    showModifierSelection(id, addToCartWithModifiers);
}

export function addToCartWithModifiers(id, selectedModifiers = []) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    
    const modifierKey = selectedModifiers.map(m => m.id).sort().join(',');
    const cartKey = `${id}__${modifierKey}`;
    
    const existing = cart.find(item => item._cartKey === cartKey);

    const modifierPrice = selectedModifiers.reduce((sum, m) => sum + (m.price || 0), 0);
    const totalPrice = product.price + modifierPrice;
    
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            _cartKey: cartKey,
            product_id: product.id,
            name: product.name,
            price: totalPrice,
            base_price: product.price,
            product: product,
            quantity: 1,
            modifiers: selectedModifiers,
            modifier_price: modifierPrice
        });
    }
    renderCart();
}

export function updateQty(cartKey, delta) {
    const item = cart.find(i => i._cartKey === cartKey);
    if (!item) return;

    
    item.quantity += delta;
    if (item.quantity <= 0) cart = cart.filter(i => i._cartKey !== cartKey);
    renderCart();
}

export function emptyCart() {
    cart = [];
    renderCart();
}

let _prevCartIds = [];

export function renderCart(forceRebuild = false) {
    localStorage.setItem('pos_cart', JSON.stringify(cart));
    const container = document.getElementById('cart-items-container');
    if(!container) return; // For pages without cart
    
    const subtotalEl = document.getElementById('cart-subtotal');
    const totalEl = document.getElementById('cart-total');
    
    const methodEl = document.getElementById('modal-payment-method');
    const method = methodEl ? methodEl.value : 'Tunai';
    
    if (products.length > 0) {
        cart = cart.filter(item => {
            const freshProduct = products.find(p => p.id === item.product_id);
            if (!freshProduct) return false;
            item.product = freshProduct;
            item.name = freshProduct.name;
            return true;
        });
    }

    cart.forEach(item => {
        let effectiveBasePrice = item.product.price;
        if (method === 'Go Food' && item.product.price_gofood) effectiveBasePrice = item.product.price_gofood;
        else if (method === 'Grab Food' && item.product.price_grabfood) effectiveBasePrice = item.product.price_grabfood;
        else if (method === 'Shopee Food' && item.product.price_shopeefood) effectiveBasePrice = item.product.price_shopeefood;
        item.base_price = effectiveBasePrice;
        item.price = effectiveBasePrice + (item.modifier_price || 0);
    });

    if (cart.length === 0) {
        container.innerHTML = `<div class="empty-cart"><i class="ph-duotone ph-shopping-cart"></i><p>Keranjang kosong</p></div>`;
        if(subtotalEl) subtotalEl.textContent = 'Rp 0';
        if(totalEl) totalEl.textContent = 'Rp 0';
        const btnCheckout = document.getElementById('btn-checkout');
        if(btnCheckout) btnCheckout.disabled = true;
        _prevCartIds = [];
        calculateChange();
        return;
    }

    const currentKeys = cart.map(i => i._cartKey);
    const keysMatch = !forceRebuild && currentKeys.length === _prevCartIds.length && currentKeys.every((k, idx) => k === _prevCartIds[idx]);

    if (keysMatch) {
        cart.forEach(item => {
            const el = container.querySelector(`[data-cart-key="${item._cartKey}"]`);
            if (el) {
                el.querySelector('.qty-display').textContent = item.quantity;
                el.querySelector('.cart-item-price').textContent = `Rp ${(item.price * item.quantity).toLocaleString('id-ID')}`;
            }
        });
    } else {
        container.innerHTML = cart.map(item => {
            const modText = item.modifiers && item.modifiers.length > 0
                ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${item.modifiers.map(m => m.name).join(', ')}</div>`
                : '';
            return `
            <div class="cart-item" data-cart-key="${item._cartKey}">
                <div class="cart-item-info">
                    <div class="cart-item-name">${escapeHtml(item.name)}</div>
                    ${modText}
                    <div class="cart-item-price">Rp ${(item.price * item.quantity).toLocaleString('id-ID')}</div>
                </div>
                <div class="cart-item-controls">
                    <button class="qty-btn" onclick="updateQty('${item._cartKey}', -1)"><i class="ph ph-minus"></i></button>
                    <div class="qty-display">${item.quantity}</div>
                    <button class="qty-btn" onclick="updateQty('${item._cartKey}', 1)"><i class="ph ph-plus"></i></button>
                </div>
            </div>
        `}).join('');
        _prevCartIds = [...currentKeys];
    }
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if(subtotalEl) subtotalEl.textContent = `Rp ${total.toLocaleString('id-ID')}`;
    if(totalEl) totalEl.textContent = `Rp ${total.toLocaleString('id-ID')}`;
    const btnCheckout = document.getElementById('btn-checkout');
    if(btnCheckout) btnCheckout.disabled = false;
    calculateChange();
}

function calculateTotals() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const dp = document.getElementById('modal-discount-percent');
    const dn = document.getElementById('modal-discount-nominal');
    let discountPercent = dp ? (parseFloat(dp.value) || 0) : 0;
    let discountNominal = dn ? (parseFloat(dn.value) || 0) : 0;
    
    let discount = (subtotal * discountPercent / 100) + discountNominal;
    if (discount > subtotal) discount = subtotal;
    
    const afterDiscount = subtotal - discount;
    
    const activeOutlet = posOutletsList.find(o => o.id === activeOutletId) || {};
    const taxRate = activeOutlet.tax_rate_percent || 0;
    
    const tax = Math.round(afterDiscount * taxRate / 100);
    const total = afterDiscount + tax;
    
    return { subtotal, discount, tax, taxRate, total };
}

export function calculateChange() {
    const totals = calculateTotals();
    const total = totals.total;
    
    const subtotalEl = document.getElementById('modal-checkout-subtotal');
    const discountEl = document.getElementById('modal-checkout-discount');
    const taxEl = document.getElementById('modal-checkout-tax');
    const taxRateEl = document.getElementById('modal-checkout-tax-rate');
    const modalTotalEl = document.getElementById('modal-checkout-total');
    
    if (subtotalEl) subtotalEl.textContent = `Rp ${totals.subtotal.toLocaleString('id-ID')}`;
    if (discountEl) discountEl.textContent = `-Rp ${totals.discount.toLocaleString('id-ID')}`;
    if (taxEl) taxEl.textContent = `Rp ${totals.tax.toLocaleString('id-ID')}`;
    if (taxRateEl) taxRateEl.textContent = totals.taxRate;
    if (modalTotalEl) modalTotalEl.textContent = `Rp ${total.toLocaleString('id-ID')}`;
    
    const methodEl = document.getElementById('modal-payment-method');
    if(!methodEl) return;
    const method = methodEl.value;
    const cashGroup = document.getElementById('modal-cash-input-group');
    const changeGroup = document.getElementById('modal-change-group');
    const changeEl = document.getElementById('modal-cart-change');
    const btn = document.getElementById('btn-confirm-payment');
    
    if (method === 'Tunai') {
        if(cashGroup) cashGroup.classList.remove('hidden');
        if (changeGroup) changeGroup.classList.remove('hidden');
        const receivedStr = document.getElementById('modal-cash-received').value;
        const received = receivedStr ? parseFloat(receivedStr) : 0;
        const change = received - total;
        
        if (received >= total && total > 0) {
            if(changeEl) { changeEl.textContent = `Rp ${change.toLocaleString('id-ID')}`; changeEl.className = 'text-success'; }
            if(btn) btn.disabled = false;
        } else {
            if(changeEl) { changeEl.textContent = `Kurang Rp ${Math.abs(change).toLocaleString('id-ID')}`; changeEl.className = 'text-muted'; }
            if(btn) btn.disabled = true;
        }
    } else {
        if(cashGroup) cashGroup.classList.add('hidden');
        if (changeGroup) changeGroup.classList.add('hidden');
        if(changeEl) { changeEl.textContent = 'Rp 0'; changeEl.className = 'text-success'; }
        if(btn) btn.disabled = total <= 0;
    }
}

export function openCheckoutModal() {
    if (cart.length === 0 || !activeOutletId) return;
    
    document.getElementById('modal-payment-method').value = 'Tunai';
    document.getElementById('modal-cash-received').value = '';
    document.getElementById('modal-customer-name').value = '';
    document.getElementById('modal-discount-percent').value = '';
    document.getElementById('modal-discount-nominal').value = '';
    
    renderCart();
    calculateChange();
    document.getElementById('modal-checkout').classList.remove('hidden');
}

export async function finalizeCheckout() {
    if (cart.length === 0 || !activeOutletId) return;
    
    const totals = calculateTotals();
    const method = document.getElementById('modal-payment-method').value;
    let received = totals.total;
    
    if (method === 'Tunai') {
        received = parseFloat(document.getElementById('modal-cash-received').value) || 0;
        if (received < totals.total) return showToast('Uang tunai kurang!', 'error');
    }

    const btn = document.getElementById('btn-confirm-payment');
    btn.disabled = true;
    btn.textContent = 'Memproses...';

    const profile = getCurrentProfile();
    const customer_name = document.getElementById('modal-customer-name').value || null;

    const itemsPayload = cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        modifiers: item.modifiers && item.modifiers.length > 0 ? item.modifiers : null
    }));

    function generateUUID() {
        if (crypto.randomUUID) return crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    let isOffline = !navigator.onLine;
    let trxData = { 
        id: generateUUID(), 
        created_at: new Date().toISOString(),
        outlet_id: activeOutletId
    };
    
    const currOutlet = posOutletsList.find(o => o.id === activeOutletId) || {};
    const kodeOutlet = currOutlet.code ? currOutlet.code.toUpperCase() : (currOutlet.name ? currOutlet.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() : 'DOC');
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    let receiptNo = `${kodeOutlet}-${randomDigits}`;
    
    if (!isOffline) {
        try {
            const { error: trxError } = await supabase.from('transactions').insert({
                id: trxData.id,
                outlet_id: activeOutletId,
                cashier_id: profile.id,
                subtotal_amount: totals.subtotal,
                discount_amount: totals.discount,
                tax_amount: totals.tax,
                total_amount: totals.total,
                payment_method: method,
                customer_name: customer_name,
                cash_received: received,
                change_amount: received - totals.total,
                receipt_no: receiptNo
            });

            if (trxError) {
                console.error("Insert Transaction Error:", trxError);
                isOffline = true;
            } else {
                const itemsToInsert = itemsPayload.map(item => ({
                    transaction_id: trxData.id,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    price: item.price,
                    modifiers: item.modifiers
                }));
                const { error: itemsError } = await supabase.from('transaction_items').insert(itemsToInsert);
                if (itemsError) {
                    console.error("Insert Items Error (Possibly modifiers column missing):", itemsError);
                    const itemsFallback = itemsPayload.map(item => ({
                        transaction_id: trxData.id,
                        product_id: item.product_id,
                        quantity: item.quantity,
                        price: item.price
                    }));
                    await supabase.from('transaction_items').insert(itemsFallback);
                }
            }
        } catch (e) {
            console.error("Insert Exception:", e);
            isOffline = true;
        }
    }
    
    if (isOffline) {
        const offlineTrx = {
            id: trxData.id,
            outlet_id: activeOutletId,
            cashier_id: profile.id,
            subtotal_amount: totals.subtotal,
            discount_amount: totals.discount,
            tax_amount: totals.tax,
            total_amount: totals.total,
            payment_method: method,
            customer_name: customer_name,
            cash_received: received,
            change_amount: received - totals.total,
            items: itemsPayload,
            created_at: trxData.created_at,
            receipt_no: receiptNo
        };
        await saveOfflineTransaction(offlineTrx);
        showToast('Offline! Transaksi disimpan di perangkat.', 'warning');
    }
    
    for (const item of cart) {
        const p = products.find(x => x.id === item.product_id);

    }
    
    const change = received - totals.total;
    const cartClone = [...cart];
    const finalTotals = { ...totals };
    
    document.getElementById('modal-checkout').classList.add('hidden');
    
    emptyCart(); // Resets cart and renders
    
    btn.textContent = 'Konfirmasi & Cetak';
    btn.disabled = false;
    
    const activeOutlet = posOutletsList.find(o => o.id === activeOutletId) || {};
    const outletName = activeOutlet.name || 'Toko Kami';
    let displayName = profile.name || profile.email;
    
    const ESC_INIT = "\x1B\x40";
    const ALIGN_CENTER = "\x1B\x61\x01";
    const ALIGN_LEFT = "\x1B\x61\x00";
    const BOLD_ON = "\x1B\x45\x01";
    const BOLD_OFF = "\x1B\x45\x00";

    const tLine = (str) => str.length > 32 ? str.substring(0, 32) : str;
    
    const wrapLine = (str, len = 32) => {
        if (!str) return [];
        const lines = [];
        let curr = '';
        str.split(' ').forEach(word => {
            if ((curr + word).length > len) {
                if (curr) lines.push(curr.trim());
                curr = word + ' ';
            } else {
                curr += word + ' ';
            }
        });
        if (curr) lines.push(curr.trim());
        return lines;
    };

    let text = ESC_INIT;
    text += ALIGN_CENTER + BOLD_ON + tLine(outletName) + "\n" + BOLD_OFF;
    
    if (activeOutlet.address) {
        wrapLine(activeOutlet.address).forEach(line => {
            text += line + "\n";
        });
    }
    
    if(activeOutlet.phone) text += tLine(activeOutlet.phone) + "\n";
    text += ALIGN_LEFT;
    text += `--------------------------------\n`;
    text += tLine(`No      : ${receiptNo}`) + `\n`;
    text += tLine(`Tanggal : ${new Date(trxData.created_at).toLocaleString('id-ID')}`) + `\n`;
    text += tLine(`Kasir   : ${displayName}`) + `\n`;
    if (customer_name) {
        text += tLine(`Customer: ${customer_name}`) + `\n`;
    }
    text += tLine(`Metode  : ${method}`) + `\n`;
    text += `--------------------------------\n`;
    
    cartClone.forEach(item => {
        text += tLine(`${item.name}`) + `\n`;
        const qtyStr = `${item.quantity}x`;
        const priceStr = item.price.toLocaleString('id-ID');
        const subtotalStr = (item.price * item.quantity).toLocaleString('id-ID');
        
        let line = ` ${qtyStr}   ${priceStr}`;
        let spaces = 32 - line.length - subtotalStr.length;
        if(spaces < 1) spaces = 1;
        line += " ".repeat(spaces) + subtotalStr;
        text += `${line}\n`;
    });
    
    text += `--------------------------------\n`;
    
    const subtotalStr = finalTotals.subtotal.toLocaleString('id-ID');
    text += `Subtotal: ${" ".repeat(32 - 10 - subtotalStr.length)}${subtotalStr}\n`;
    
    if (finalTotals.discount > 0) {
        const discountStr = "-" + finalTotals.discount.toLocaleString('id-ID');
        text += `Diskon  : ${" ".repeat(32 - 10 - discountStr.length)}${discountStr}\n`;
    }
    
    if (finalTotals.tax > 0) {
        const taxStr = finalTotals.tax.toLocaleString('id-ID');
        text += `Pajak   : ${" ".repeat(32 - 10 - taxStr.length)}${taxStr}\n`;
    }

    const totalStr = finalTotals.total.toLocaleString('id-ID');
    text += `Total   : ${" ".repeat(32 - 10 - totalStr.length)}${totalStr}\n`;
    const receivedStr = received.toLocaleString('id-ID');
    text += `Tunai   : ${" ".repeat(32 - 10 - receivedStr.length)}${receivedStr}\n`;
    const changeStr = change.toLocaleString('id-ID');
    text += `Kembali : ${" ".repeat(32 - 10 - changeStr.length)}${changeStr}\n`;
    text += `--------------------------------\n`;
    text += ALIGN_CENTER;
    text += `Terima Kasih\n`;
    text += `Follow Us On @D.OneChicken\n`;
    text += `#ChickenRasaNo1\n`;
    text += `\n\n\n`; 
    
    const logoUrl = window.location.origin + window.location.pathname.replace('index.html', '') + 'assets/img/receipt_logo_print.png';
    printReceiptNative(text, logoUrl);
    
    const changeAmountEl = document.getElementById('success-change-amount');
    if (changeAmountEl) changeAmountEl.textContent = 'Rp ' + change.toLocaleString('id-ID');
    document.getElementById('modal-checkout-success').classList.remove('hidden');

    setTimeout(() => {
        document.getElementById('modal-checkout-success').classList.add('hidden');
    }, 1000);

    showToast('Transaksi Berhasil!', 'success');
    generateOrderId();
    await loadProducts();
    btn.textContent = 'Bayar & Cetak';
}

export function printReceipt(trxId, cartItems, total, received, method, trxDate = null, cashierName = null, customerName = null, totalsObj = null) {
    const dateStr = trxDate ? new Date(trxDate).toLocaleString('id-ID') : new Date().toLocaleString('id-ID');
    const change = received - total;
    
    const activeOutlet = posOutletsList.find(o => o.id === activeOutletId) || {};
    const outletName = activeOutlet.name || 'Toko Kami';
    const outletAddress = activeOutlet.address || '';
    const outletPhone = activeOutlet.phone || '';

    document.getElementById('receipt-store-name').textContent = outletName;
    document.getElementById('receipt-store-address').textContent = outletAddress;
    document.getElementById('receipt-store-phone').textContent = outletPhone;
    
    document.getElementById('receipt-date').textContent = dateStr;
    document.getElementById('receipt-id').textContent = trxId;
    
    let displayName = cashierName;
    if (!displayName) {
        const profile = getCurrentProfile();
        displayName = profile.name || profile.email;
    }
    document.getElementById('receipt-cashier').textContent = displayName;
    document.getElementById('receipt-method').textContent = method;
    
    const customerEl = document.getElementById('receipt-customer-row');
    if (customerName) {
        document.getElementById('receipt-customer-name').textContent = customerName;
        customerEl.style.display = 'block';
    } else {
        customerEl.style.display = 'none';
    }

    const itemsHtml = cartItems.map(item => {
        const modLine = item.modifiers && item.modifiers.length > 0
            ? `<tr><td colspan="3" style="font-size:0.75rem; color:#666; padding-left:10px;">${item.modifiers.map(m => m.name).join(', ')}</td></tr>`
            : '';
        return `
        <tr><td colspan="3">${item.name}</td></tr>
        ${modLine}
        <tr>
            <td>${item.quantity}x</td>
            <td>${item.price.toLocaleString('id-ID')}</td>
            <td class="text-right">${(item.price * item.quantity).toLocaleString('id-ID')}</td>
        </tr>
    `}).join('');
    document.getElementById('receipt-items').innerHTML = itemsHtml;
    
    if (totalsObj) {
        document.getElementById('receipt-subtotal').textContent = totalsObj.subtotal.toLocaleString('id-ID');
        if (totalsObj.discount > 0) {
            document.getElementById('receipt-discount-row').style.display = 'flex';
            document.getElementById('receipt-discount').textContent = '-' + totalsObj.discount.toLocaleString('id-ID');
        } else {
            document.getElementById('receipt-discount-row').style.display = 'none';
        }
        if (totalsObj.tax > 0) {
            document.getElementById('receipt-tax-row').style.display = 'flex';
            document.getElementById('receipt-tax').textContent = totalsObj.tax.toLocaleString('id-ID');
        } else {
            document.getElementById('receipt-tax-row').style.display = 'none';
        }
    } else {
        document.getElementById('receipt-subtotal').textContent = total.toLocaleString('id-ID');
        document.getElementById('receipt-discount-row').style.display = 'none';
        document.getElementById('receipt-tax-row').style.display = 'none';
    }

    document.getElementById('receipt-total').textContent = total.toLocaleString('id-ID');
    document.getElementById('receipt-cash').textContent = received.toLocaleString('id-ID');
    document.getElementById('receipt-change').textContent = change.toLocaleString('id-ID');

    window.print();
}

export function printReceiptRawBT(trxId, cartItems, total, received, method, trxDate = null, cashierName = null, customerName = null, totalsObj = null) {
    const dateStr = trxDate ? new Date(trxDate).toLocaleString('id-ID') : new Date().toLocaleString('id-ID');
    const change = received - total;
    
    const activeOutlet = posOutletsList.find(o => o.id === activeOutletId) || {};
    const outletName = activeOutlet.name || 'Toko Kami';
    
    let displayName = cashierName;
    if (!displayName) {
        const profile = getCurrentProfile();
        displayName = profile.name || profile.email;
    }

    const tLine = (str) => str.length > 32 ? str.substring(0, 32) : str;

    const wrapLine = (str, len = 32) => {
        if (!str) return [];
        const lines = [];
        let curr = '';
        str.split(' ').forEach(word => {
            if ((curr + word).length > len) {
                if (curr) lines.push(curr.trim());
                curr = word + ' ';
            } else {
                curr += word + ' ';
            }
        });
        if (curr) lines.push(curr.trim());
        return lines;
    };

    let text = `[C]<img>https://nailur.github.io/pos/assets/img/receipt_logo_print.png</img>\n`;
    text += `[C]<b>${tLine(outletName)}</b>\n`;
    
    if (activeOutlet.address) {
        wrapLine(activeOutlet.address).forEach(line => {
            text += `[C]${line}\n`;
        });
    }
    
    if (activeOutlet.phone) text += `[C]${tLine(activeOutlet.phone)}\n`;
    text += `--------------------------------\n`;
    text += tLine(`No      : ${trxId}`) + `\n`;
    text += tLine(`Tanggal : ${dateStr}`) + `\n`;
    text += tLine(`Kasir   : ${displayName}`) + `\n`;
    if (customerName) {
        text += tLine(`Customer: ${customerName}`) + `\n`;
    }
    text += tLine(`Metode  : ${method}`) + `\n`;
    text += `--------------------------------\n`;
    
    cartItems.forEach(item => {
        text += tLine(`${item.name}`) + `\n`;
        if (item.modifiers && item.modifiers.length > 0) {
            text += `  ${item.modifiers.map(m => m.name).join(', ')}\n`;
        }
        const qtyStr = `${item.quantity}x`;
        const priceStr = item.price.toLocaleString('id-ID');
        const subtotalStr = (item.price * item.quantity).toLocaleString('id-ID');
        
        let line = ` ${qtyStr}   ${priceStr}`;
        let spaces = 32 - line.length - subtotalStr.length;
        if(spaces < 1) spaces = 1;
        line += " ".repeat(spaces) + subtotalStr;
        text += `${line}\n`;
    });
    
    text += `--------------------------------\n`;

    if (totalsObj) {
        const subtotalStr = totalsObj.subtotal.toLocaleString('id-ID');
        text += `Subtotal: ${" ".repeat(32 - 10 - subtotalStr.length)}${subtotalStr}\n`;
        
        if (totalsObj.discount > 0) {
            const discountStr = "-" + totalsObj.discount.toLocaleString('id-ID');
            text += `Diskon  : ${" ".repeat(32 - 10 - discountStr.length)}${discountStr}\n`;
        }
        
        if (totalsObj.tax > 0) {
            const taxStr = totalsObj.tax.toLocaleString('id-ID');
            text += `Pajak   : ${" ".repeat(32 - 10 - taxStr.length)}${taxStr}\n`;
        }
    }
    
    const totalStr = total.toLocaleString('id-ID');
    text += `Total   : ${" ".repeat(32 - 10 - totalStr.length)}${totalStr}\n`;
    
    const receivedStr = received.toLocaleString('id-ID');
    text += `Tunai   : ${" ".repeat(32 - 10 - receivedStr.length)}${receivedStr}\n`;
    
    const changeStr = change.toLocaleString('id-ID');
    text += `Kembali : ${" ".repeat(32 - 10 - changeStr.length)}${changeStr}\n`;
    
    text += `--------------------------------\n`;
    text += `[C]Terima Kasih\n`;
    text += `[C]Follow Us On @D.OneChicken\n`;
    text += `[C]#ChickenRasaNo1\n`;
    text += `\n\n`; 

    const rawbt_url = "intent:" + encodeURI(text) + "#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;";
    window.location.href = rawbt_url;
}
