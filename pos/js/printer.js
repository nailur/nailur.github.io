// Web Bluetooth API Logic for ESC/POS Thermal Printers

let bluetoothDevice = null;
let printCharacteristic = null;
let isConnected = false;

// Optional: you can update the UI directly from here or use callbacks
function updatePrinterStatusUI(connected, deviceName = '') {
    const iconEl = document.getElementById('printer-status-icon');
    const btnEl = document.getElementById('btn-connect-printer');
    
    if (iconEl) {
        if (connected) {
            iconEl.style.color = 'var(--success)';
            if (btnEl) btnEl.title = `Printer Terhubung: ${deviceName} (Klik untuk memutus)`;
        } else {
            iconEl.style.color = 'var(--danger)';
            if (btnEl) btnEl.title = 'Koneksikan Printer Bluetooth (Terputus)';
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

export async function printReceiptNative(text, logoUrl = null) {
    if (!isConnected || !printCharacteristic) {
        if (window.showToast) window.showToast('Printer belum terhubung!', 'error');
        return false;
    }

    try {
        let finalBuffer = new Uint8Array(0);

        // 1. Decode logo if provided
        if (logoUrl) {
            try {
                const logoBuffer = await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = "Anonymous";
                    img.onload = () => {
                        const targetWidth = 384; // 58mm printer width
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
                            0x1B, 0x40, // Init
                            0x1B, 0x61, 0x01, // Center align
                            0x1D, 0x76, 0x30, 0x00, // Print raster image
                            widthBytes & 0xFF, (widthBytes >> 8) & 0xFF,
                            height & 0xFF, (height >> 8) & 0xFF
                        ]);
                        
                        const combined = new Uint8Array(header.length + imageBuffer.length + 1);
                        combined.set(header, 0);
                        combined.set(imageBuffer, header.length);
                        combined[combined.length - 1] = 0x0A; // Line feed after image
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

        // 2. Decode text
        const encoder = new TextEncoder();
        const textData = (!logoUrl ? "\x1B\x40" : "") + text + "\x0A\x0A\x0A"; 
        const textBuffer = encoder.encode(textData);
        
        // 3. Combine buffers
        const sendBuffer = new Uint8Array(finalBuffer.length + textBuffer.length);
        sendBuffer.set(finalBuffer, 0);
        sendBuffer.set(textBuffer, finalBuffer.length);
        
        // 4. Send in chunks
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
