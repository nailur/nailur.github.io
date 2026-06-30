// Web Bluetooth API Logic for ESC/POS Thermal Printers

let bluetoothDevice = null;
let printCharacteristic = null;
let isConnected = false;

// Optional: you can update the UI directly from here or use callbacks
function updatePrinterStatusUI(connected, deviceName = '') {
    const statusEl = document.getElementById('printer-status-text');
    const btnEl = document.getElementById('btn-connect-printer');
    if (statusEl) {
        if (connected) {
            statusEl.innerHTML = `<span style="color:var(--success)">🟢 Terhubung: ${deviceName}</span>`;
            if (btnEl) btnEl.textContent = 'Putuskan Printer';
        } else {
            statusEl.innerHTML = `<span style="color:var(--danger)">🔴 Tidak Terhubung</span>`;
            if (btnEl) btnEl.textContent = 'Koneksikan Printer';
        }
    }
}

export async function connectPrinter() {
    if (isConnected && bluetoothDevice) {
        // Disconnect
        bluetoothDevice.gatt.disconnect();
        return;
    }

    try {
        console.log('Requesting Bluetooth Device...');
        // We accept all devices because ESC/POS BLE UUIDs vary wildly between manufacturers
        // However, we must specify optionalServices we might want to communicate with.
        const optionalServices = [
            '000018f0-0000-1000-8000-00805f9b34fb', // Standard/Generic BLE Printer
            'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Another common one
            '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC
            '0000fee7-0000-1000-8000-00805f9b34fb'  // WeiHeng
        ];

        bluetoothDevice = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: optionalServices
        });

        bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);

        console.log('Connecting to GATT Server...');
        const server = await bluetoothDevice.gatt.connect();

        console.log('Getting Services...');
        const services = await server.getPrimaryServices();
        
        let validService = null;
        for (const service of services) {
            if (optionalServices.includes(service.uuid)) {
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

        isConnected = true;
        updatePrinterStatusUI(true, bluetoothDevice.name || 'Printer');
        
        // window.showToast if available
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

function onDisconnected() {
    console.log('Device disconnected');
    isConnected = false;
    printCharacteristic = null;
    bluetoothDevice = null;
    updatePrinterStatusUI(false);
    if (window.showToast) window.showToast('Printer Bluetooth terputus', 'error');
}

export async function printReceiptNative(text) {
    if (!isConnected || !printCharacteristic) {
        if (window.showToast) window.showToast('Printer belum terhubung!', 'error');
        return false;
    }

    try {
        // Encode string ke Uint8Array (Windows-1252 / ASCII compatible)
        const encoder = new TextEncoder();
        
        // Tambahkan ESC/POS init command (ESC @) dan print (LF)
        // \x1B\x40 = Initialize printer
        // \x0A = Line feed
        const data = "\x1B\x40" + text + "\x0A\x0A\x0A"; 
        
        const buffer = encoder.encode(data);
        
        // Chunking the data. BLE usually has MTU limits (e.g. 20-512 bytes). 
        // We use a safe chunk size of 100 bytes.
        const CHUNK_SIZE = 100;
        
        for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
            const chunk = buffer.slice(i, i + CHUNK_SIZE);
            await printCharacteristic.writeValue(chunk);
            // Brief pause between chunks can help older printers
            await new Promise(resolve => setTimeout(resolve, 20));
        }

        return true;
    } catch (error) {
        console.error('Print Error:', error);
        if (window.showToast) window.showToast('Gagal mencetak: ' + error.message, 'error');
        return false;
    }
}
