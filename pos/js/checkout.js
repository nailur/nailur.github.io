/**
 * checkout.js — NTPOS Checkout & Payment Module
 *
 * Official facade for the entire checkout flow: open modal, validate cash amount,
 * calculate payment method discounts, process transaction (online/offline),
 * deduct stock via RPC, and print receipt (browser print & Bluetooth ESC/POS).
 *
 * All implementations reside in cart.js; this module re-exports and registers
 * to window so it can be invoked from HTML and other modules without direct coupling.
 */

export {
    openCheckoutModal,
    finalizeCheckout,
    calculateChange,
    printReceipt,
    printReceiptBluetooth
} from './cart.js';

import {
    openCheckoutModal,
    finalizeCheckout,
    calculateChange,
    printReceipt,
    printReceiptBluetooth
} from './cart.js';

// Register to window for inline HTML (onclick=) and non-module access
window.openCheckoutModal = openCheckoutModal;
window.finalizeCheckout = finalizeCheckout;
window.calculateChange = calculateChange;
window.printReceipt = printReceipt;
window.printReceiptBluetooth = printReceiptBluetooth;

