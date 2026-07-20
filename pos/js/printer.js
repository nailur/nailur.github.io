// Web Bluetooth API Logic for ESC/POS Thermal Printers

let bluetoothDevice = null;
let printCharacteristic = null;
let isConnected = false;

const OPTIONAL_SERVICES = [
    '000018f0-0000-1000-8000-00805f9b34fb', // Standard/Generic BLE Printer
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Another common one
    '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC
    '0000fee7-0000-1000-8000-00805f9b34fb'  // WeiHeng
];

// ── UI Updates ──────────────────────────────────────────────────

function updatePrinterStatusUI(connected, deviceName = '') {
    // Navbar icon (existing behavior preserved)
    const iconEl = document.getElementById('printer-status-icon');
    const btnEl = document.getElementById('btn-connect-printer');
    
    if (iconEl) {
        if (connected) {
            iconEl.style.color = 'var(--success)';
            if (btnEl) btnEl.title = `Printer Terhubung: ${deviceName} (Klik untuk pengaturan)`;
        } else {
            iconEl.style.color = 'var(--danger)';
            if (btnEl) btnEl.title = 'Koneksikan Printer Bluetooth (Terputus)';
        }
    }

    // Modal elements
    const statusDot = document.getElementById('printer-modal-status-dot');
    const statusText = document.getElementById('printer-modal-status-text');
    const deviceLabel = document.getElementById('printer-modal-device-name');
    const btnConnect = document.getElementById('btn-printer-connect');
    const btnDisconnect = document.getElementById('btn-printer-disconnect');

    if (statusDot) statusDot.style.color = connected ? 'var(--success)' : 'var(--danger)';
    if (statusText) statusText.textContent = connected ? 'Terhubung' : 'Tidak Terhubung';
    if (deviceLabel) deviceLabel.textContent = connected ? deviceName : '-';
    if (btnConnect) {
        if (connected) {
            btnConnect.classList.add('hidden');
        } else {
            btnConnect.classList.remove('hidden');
        }
    }
    if (btnDisconnect) {
        if (connected) {
            btnDisconnect.classList.remove('hidden');
        } else {
            btnDisconnect.classList.add('hidden');
        }
    }
}

// ── Core Connection Logic ───────────────────────────────────────

export function isPrinterConnected() {
    return isConnected && printCharacteristic !== null;
}

/**
 * Internal helper: given a BluetoothDevice, connects to GATT, discovers
 * a writable characteristic, and updates UI.  Returns true on success.
 */
async function connectToDevice(device) {
    device.addEventListener('gattserverdisconnected', onDisconnected);

    console.log('Connecting to GATT Server...');
    const server = await device.gatt.connect();

    console.log('Getting Services...');
    const services = await server.getPrimaryServices();
    
    let validService = null;
    for (const service of services) {
        if (OPTIONAL_SERVICES.includes(service.uuid)) {
            validService = service;
            break;
        }
    }

    if (!validService) {
        // Fallback: just try to get any service and characteristic if they have it
        if (services.length > 0) {
            validService = services[0];
        } else {
            throw new Error('Tidak ada service Bluetooth yang didukung ditemukan pada perangkat ini.');
        }
    }

    console.log('Getting Characteristics...');
    const characteristics = await validService.getCharacteristics();
    
    // Find a characteristic that supports 'write' or 'writeWithoutResponse'
    for (const c of characteristics) {
        if (c.properties.write || c.properties.writeWithoutResponse) {
            printCharacteristic = c;
            break;
        }
    }

    if (!printCharacteristic) {
        throw new Error('Tidak menemukan karakteristik tulis (Write) pada printer ini.');
    }

    bluetoothDevice = device;
    isConnected = true;
    updatePrinterStatusUI(true, device.name || 'Printer');
    return true;
}

/**
 * Prompt the user for a new Bluetooth device (shows the browser pairing dialog).
 */
export async function connectPrinter() {
    if (isConnected && bluetoothDevice) {
        // Disconnect
        bluetoothDevice.gatt.disconnect();
        return;
    }

    try {
        console.log('Requesting Bluetooth Device...');
        const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: OPTIONAL_SERVICES
        });

        await connectToDevice(device);

        // Save device name for auto-reconnect
        if (device.name) {
            localStorage.setItem('pos_printer_device_name', device.name);
        }

        if (window.showToast) window.showToast('Printer Bluetooth berhasil terhubung!', 'success');

    } catch (error) {
        console.error('Bluetooth Error:', error);
        isConnected = false;
        printCharacteristic = null;
        bluetoothDevice = null;
        if (window.showToast) {
            if (error.name === 'NotFoundError') {
                window.showToast('Koneksi dibatalkan.', 'info');
            } else {
                window.showToast('Gagal koneksi printer: ' + error.message, 'error');
            }
        }
    }
}

/**
 * Disconnect the currently connected printer.
 */
export function disconnectPrinter() {
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
        bluetoothDevice.gatt.disconnect();
    }
}

function onDisconnected() {
    console.log('Device disconnected');
    isConnected = false;
    printCharacteristic = null;
    bluetoothDevice = null;
    updatePrinterStatusUI(false);
    if (window.showToast) window.showToast('Printer Bluetooth terputus', 'error');
}

// ── Auto-Connect ────────────────────────────────────────────────

/**
 * Attempt to silently reconnect to a previously-paired printer using
 * the Web Bluetooth `getDevices()` API (Chrome 85+).
 * This runs at app startup and requires NO user gesture.
 */
export async function autoConnectPrinter() {
    // Guard: user must have opted-in
    if (localStorage.getItem('pos_auto_connect_printer') !== 'true') return;

    // Guard: browser support
    if (!navigator.bluetooth || !navigator.bluetooth.getDevices) {
        console.log('[AutoConnect] Browser does not support getDevices().');
        return;
    }

    const savedName = localStorage.getItem('pos_printer_device_name');
    if (!savedName) {
        console.log('[AutoConnect] No saved printer name found.');
        return;
    }

    try {
        console.log(`[AutoConnect] Looking for "${savedName}" …`);
        const devices = await navigator.bluetooth.getDevices();
        const target = devices.find(d => d.name === savedName);

        if (!target) {
            console.log('[AutoConnect] Saved device not found among permitted devices.');
            return;
        }

        // watchAdvertisements + connect on first advertisement
        const abortController = new AbortController();

        target.addEventListener('advertisementreceived', async () => {
            abortController.abort(); // stop watching
            console.log(`[AutoConnect] Found "${savedName}", connecting…`);
            try {
                await connectToDevice(target);
                console.log('[AutoConnect] Printer connected successfully!');
                if (window.showToast) window.showToast(`Printer "${savedName}" terhubung otomatis!`, 'success');
            } catch (err) {
                console.error('[AutoConnect] Connection failed:', err);
            }
        }, { once: true });

        await target.watchAdvertisements({ signal: abortController.signal });

        // Timeout: stop watching after 8 seconds to avoid hanging
        setTimeout(() => {
            if (!isConnected) {
                abortController.abort();
                console.log('[AutoConnect] Timeout – printer not found in range.');
            }
        }, 8000);

    } catch (error) {
        console.error('[AutoConnect] Error:', error);
    }
}

// ── Modal Initialization ────────────────────────────────────────

/**
 * Bind all event listeners inside the Printer Settings modal.
 * Called once at app startup.
 */
export function initPrinterModal() {
    const modal = document.getElementById('modal-printer');
    const btnConnect = document.getElementById('btn-printer-connect');
    const btnDisconnect = document.getElementById('btn-printer-disconnect');
    const chkAutoConnect = document.getElementById('chk-auto-connect-printer');

    // Restore checkbox state
    if (chkAutoConnect) {
        chkAutoConnect.checked = localStorage.getItem('pos_auto_connect_printer') === 'true';
        chkAutoConnect.addEventListener('change', () => {
            localStorage.setItem('pos_auto_connect_printer', chkAutoConnect.checked ? 'true' : 'false');
            // If turning off, also clear saved device name
            if (!chkAutoConnect.checked) {
                localStorage.removeItem('pos_printer_device_name');
            }
        });
    }

    if (btnConnect) {
        btnConnect.addEventListener('click', async () => {
            await connectPrinter();
            // If user connected and auto-connect is ON, ensure device name is saved
            if (isConnected && chkAutoConnect && chkAutoConnect.checked && bluetoothDevice?.name) {
                localStorage.setItem('pos_printer_device_name', bluetoothDevice.name);
            }
        });
    }

    if (btnDisconnect) {
        btnDisconnect.addEventListener('click', () => {
            disconnectPrinter();
        });
    }
}

/**
 * Open the printer settings modal.
 */
export function openPrinterModal() {
    const modal = document.getElementById('modal-printer');
    if (modal) {
        // Sync UI state before showing
        updatePrinterStatusUI(isConnected, bluetoothDevice?.name || '');
        modal.classList.remove('hidden');
    }
}

// Kick cash drawer open immediately via Bluetooth
export async function kickDrawer() {
    if (!isConnected || !printCharacteristic) return false;
    try {
        const kickBuffer = new Uint8Array([
            0x1B, 0x70, 0x00, 0x40, 0x50, // Drawer Kick Pin 2
            0x1B, 0x70, 0x01, 0x40, 0x50  // Drawer Kick Pin 5
        ]);
        await printCharacteristic.writeValue(kickBuffer);
        return true;
    } catch (e) {
        console.error('Drawer kick error:', e);
        return false;
    }
}

export async function printReceiptNative(text, logoUrl = null, openDrawer = false) {
    if (!isConnected || !printCharacteristic) {
        if (window.showToast) window.showToast('Printer belum terhubung!', 'error');
        return false;
    }

    try {
        // 1. If openDrawer, send drawer kick IMMEDIATELY as separate BLE write
        if (openDrawer) {
            await kickDrawer();
        }

        // 2. Init printer
        const initBuffer = new Uint8Array([0x1B, 0x40]);
        await printCharacteristic.writeValue(initBuffer);
        await new Promise(resolve => setTimeout(resolve, 30));

        let finalBuffer = new Uint8Array(0);

        // 2. Decode logo if provided
        if (logoUrl) {
            try {
                const logoBuffer = await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = "Anonymous";
                    img.onload = () => {
                        const targetWidth = 384; 
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        
                        const height = Math.round((targetWidth / img.width) * img.height);
                        canvas.width = targetWidth;
                        canvas.height = height;
                        
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, targetWidth, height);
                        ctx.drawImage(img, 0, 0, targetWidth, height);
                        
                        const pixels = ctx.getImageData(0, 0, targetWidth, height).data;
                        const widthBytes = Math.ceil(targetWidth / 8);
                        const imageBuffer = new Uint8Array(widthBytes * height);
                        
                        for (let y = 0; y < height; y++) {
                            for (let x = 0; x < targetWidth; x++) {
                                const idx = (y * targetWidth + x) * 4;
                                const r = pixels[idx], g = pixels[idx+1], b = pixels[idx+2], a = pixels[idx+3];
                                const luminance = (0.299*r + 0.587*g + 0.114*b);
                                if (luminance < 128 && a > 128) {
                                    imageBuffer[y * widthBytes + Math.floor(x / 8)] |= (1 << (7 - (x % 8)));
                                }
                            }
                        }
                        
                        const header = new Uint8Array([
                            0x1B, 0x61, 0x01, // Center align
                            0x1D, 0x76, 0x30, 0x00, // Print raster image
                            widthBytes & 0xFF, (widthBytes >> 8) & 0xFF,
                            height & 0xFF, (height >> 8) & 0xFF
                        ]);
                        
                        const combined = new Uint8Array(header.length + imageBuffer.length + 1);
                        combined.set(header, 0);
                        combined.set(imageBuffer, header.length);
                        combined[combined.length - 1] = 0x0A; 
                        resolve(combined);
                    };
                    img.onerror = () => resolve(new Uint8Array(0));
                    img.src = logoUrl;
                });
                
                finalBuffer = new Uint8Array(logoBuffer.length);
                finalBuffer.set(logoBuffer, 0);
            } catch (e) {
                console.error("Failed to load logo", e);
            }
        }

        // 3. Decode text
        const encoder = new TextEncoder();
        const textData = text + "\x0A\x0A\x0A\x0A"; 
        const textBuffer = encoder.encode(textData);
        
        // 4. Cut Command
        const cutBuffer = new Uint8Array([0x1D, 0x56, 0x00]);

        // 5. Combine Logo -> Text -> Cut
        const sendBuffer = new Uint8Array(finalBuffer.length + textBuffer.length + cutBuffer.length);
        let offset = 0;
        sendBuffer.set(finalBuffer, offset); offset += finalBuffer.length;
        sendBuffer.set(textBuffer, offset); offset += textBuffer.length;
        sendBuffer.set(cutBuffer, offset);
        
        // 6. Send in chunks
        const CHUNK_SIZE = 100;
        for (let i = 0; i < sendBuffer.length; i += CHUNK_SIZE) {
            const chunk = sendBuffer.slice(i, i + CHUNK_SIZE);
            await printCharacteristic.writeValue(chunk);
            await new Promise(resolve => setTimeout(resolve, 20));
        }

        return true;
    } catch (error) {
        console.error('Print Error:', error);
        if (window.showToast) window.showToast('Gagal mencetak: ' + error.message, 'error');
        return false;
    }
}
