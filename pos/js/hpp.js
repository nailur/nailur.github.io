/**
 * hpp.js - HPP (Harga Pokok Penjualan) & Margin Profitability Calculator
 * Supports Equal Chicken Cost Allocation, OPEX Absorption per Portion, Offline vs Online Margin Analysis,
 * and pulling real average cost data from Supabase DB (inventory_postings & operational_costs).
 */

const HPPSettingsManager = {
    STORAGE_KEY: 'ntpos_hpp_settings_v1',

    getDefaultSettings() {
        return {
            // Raw material prices (Rp)
            price_ayam_kantong: 36000,      // 1 kantong = 9 potong (Rp 4,000 / potong)
            price_saos_pack: 24000,         // 1 pack = 24 bungkus (Rp 1,000 / bungkus)
            price_minyak_15kg: 270000,      // 1 box 15kg = Rp 18 / gr
            price_tepung_biang_kg: 25000,   // Rp 25,000 / kg
            price_tepung_serbaguna_kg: 12000, // Rp 12,000 / kg
            price_beras_5kg: 72000,         // 5kg = 72 porsi (Rp 1,000 / porsi)
            price_sambal_porsi: 1200,       // Rp 1,200 / porsi default
            price_box_m: 1036,              // Rp 1,036.4 / pc (Paket variants)
            price_box_xs: 1036,             // Rp 1,036.4 / pc (Geprek variants)
            price_kertas_nasi: 500,         // Rp 500 / pc
            price_kertas_pembungkus: 270,   // Rp 270 / pc
            price_plastik_kecil: 150,       // Rp 150 / pc (1 potong)
            price_plastik_besar: 300,       // Rp 300 / pc (2-3 potong)
            price_estee_porsi: 1500,        // Rp 1,500 / porsi

            // Monthly OPEX & Electricity
            kwh_rate: 1444.7,
            kwh_freezer: 66.96,             // 90W * 24h * 31d
            kwh_warmer: 54.00,              // 150W * 12h * 30d
            kwh_kipas: 6.30,                // 70W * 3h * 30d
            kwh_printer: 1.80,              // 5W * 12h * 30d
            kwh_charger: 0.50,              // 18W * 1h * 30d
            kwh_magic_cook: 10.50,          // 350W * 1h * 30d
            kwh_magic_warm: 23.10,          // 70W * 11h * 30d

            opex_gas_monthly: 330000,       // 3 tabung * 15 kali * Rp 22,000
            opex_trash_bag: 45968,          // Rp 22,984 / 15 * 30
            opex_sarung_tangan: 55521,      // 100 pcs
            opex_masker: 15378,             // 60 pcs / bulan
            opex_consumables_lain: 100000,  // Tissue, solatip, thermal

            target_daily_volume: 100        // Asumsi rata-rata porsi terjual harian
        };
    },

    loadSettings() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return { ...this.getDefaultSettings(), ...parsed };
            }
        } catch (e) {
            console.warn('Could not load HPP settings from localStorage:', e);
        }
        return this.getDefaultSettings();
    },

    saveSettings(settings) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
            if (typeof showToast === 'function') {
                showToast('Pengaturan HPP & Margin berhasil disimpan!', 'success');
            }
        } catch (e) {
            console.warn('Could not save HPP settings to localStorage:', e);
            if (typeof showToast === 'function') {
                showToast('Gagal menyimpan pengaturan HPP ke peramban.', 'error');
            }
        }
    }
};

/**
 * Menu Catalog Definition with Offline and Online base prices
 */
const HPP_MENU_CATALOG = [
    // Ala Carte
    { category: 'Ala Carte', name: 'Ayam Dada', offline: 12000, online: 16000, part: 'dada', isGeprek: false, isPaket: false },
    { category: 'Ala Carte', name: 'Ayam Paha Atas', offline: 12000, online: 16000, part: 'paha_atas', isGeprek: false, isPaket: false },
    { category: 'Ala Carte', name: 'Ayam Paha Bawah', offline: 9000, online: 13000, part: 'paha_bawah', isGeprek: false, isPaket: false },
    { category: 'Ala Carte', name: 'Ayam Sayap', offline: 8000, online: 12000, part: 'sayap', isGeprek: false, isPaket: false },
    { category: 'Ala Carte', name: 'Ayam Geprek Dada', offline: 15000, online: 19000, part: 'dada', isGeprek: true, isPaket: false },
    { category: 'Ala Carte', name: 'Ayam Geprek Paha Atas', offline: 15000, online: 19000, part: 'paha_atas', isGeprek: true, isPaket: false },
    { category: 'Ala Carte', name: 'Ayam Geprek Paha Bawah', offline: 12000, online: 16000, part: 'paha_bawah', isGeprek: true, isPaket: false },
    { category: 'Ala Carte', name: 'Ayam Geprek Sayap', offline: 11000, online: 15000, part: 'sayap', isGeprek: true, isPaket: false },

    // Paket Ayam + Nasi
    { category: 'Paket Ayam + Nasi', name: 'Paket Dada', offline: 15000, online: 19000, part: 'dada', isGeprek: false, isPaket: true },
    { category: 'Paket Ayam + Nasi', name: 'Paket P.Atas', offline: 15000, online: 19000, part: 'paha_atas', isGeprek: false, isPaket: true },
    { category: 'Paket Ayam + Nasi', name: 'Paket P.bawah', offline: 13000, online: 17000, part: 'paha_bawah', isGeprek: false, isPaket: true },
    { category: 'Paket Ayam + Nasi', name: 'Paket Sayap', offline: 12000, online: 16000, part: 'sayap', isGeprek: false, isPaket: true },
    { category: 'Paket Ayam + Nasi', name: 'Paket Geprek Dada', offline: 18000, online: 22000, part: 'dada', isGeprek: true, isPaket: true },
    { category: 'Paket Ayam + Nasi', name: 'Paket Geprek P.atas', offline: 18000, online: 22000, part: 'paha_atas', isGeprek: true, isPaket: true },
    { category: 'Paket Ayam + Nasi', name: 'Paket Geprek P.bawah', offline: 16000, online: 20000, part: 'paha_bawah', isGeprek: true, isPaket: true },
    { category: 'Paket Ayam + Nasi', name: 'Paket Geprek Sayap', offline: 15000, online: 19000, part: 'sayap', isGeprek: true, isPaket: true },

    // Extra
    { category: 'Extra', name: 'Nasi', offline: 4000, online: 8000, part: null, isGeprek: false, isPaket: false, isNasiOnly: true },
    { category: 'Extra', name: 'Sambel Geprek Merah', offline: 4000, online: 8000, part: null, isGeprek: true, isPaket: false, isSambalOnly: true },
    { category: 'Extra', name: 'Sambel Geprek Hijau', offline: 4000, online: 8000, part: null, isGeprek: true, isPaket: false, isSambalOnly: true },
    { category: 'Extra', name: 'Estee', offline: 3000, online: 7000, part: null, isGeprek: false, isPaket: false, isDrink: true }
];

/**
 * Calculates raw HPP and absorbed OPEX for a specific menu item given current settings
 */
function calculateMenuItemHPP(item, settings) {
    let rawCOGS = 0;
    const breakdown = [];

    // 1. Ayam Marinasi cost (Equal cost per piece = 1 kantong price / 9)
    if (item.part) {
        const ayamCostPerPiece = Number(settings.price_ayam_kantong) / 9;
        rawCOGS += ayamCostPerPiece;
        breakdown.push({ label: 'Ayam (1 potong)', amount: ayamCostPerPiece });

        // 2. Saos cost (Dada & Paha Atas = 2 bungkus, Paha Bawah & Sayap = 1 bungkus)
        const saosPerBungkus = Number(settings.price_saos_pack) / 24;
        const saosQty = (item.part === 'dada' || item.part === 'paha_atas') ? 2 : 1;
        const saosCost = saosQty * saosPerBungkus;
        rawCOGS += saosCost;
        breakdown.push({ label: `Saos (${saosQty} bgs)`, amount: saosCost });

        // 3. Minyak Beku cost (200 gr per 9 pcs + 42.86 gr replacement per 9 pcs = ~26.98 gr/piece)
        const minyaksPerGr = Number(settings.price_minyak_15kg) / 15000;
        const minyakGrPerPiece = (200 + 42.86) / 9; // ~26.98g
        const minyakCost = minyakGrPerPiece * minyaksPerGr;
        rawCOGS += minyakCost;
        breakdown.push({ label: 'Minyak Goreng (~27g)', amount: minyakCost });

        // 4. Tepung cost (10 kg formula for 27 kantong = 243 pieces)
        const cost1BatchMix = (0.1 * Number(settings.price_tepung_biang_kg)) + (1.0 * Number(settings.price_tepung_serbaguna_kg));
        const cost10KgMix = (10 / 1.1) * cost1BatchMix;
        const tepungCostPerPiece = cost10KgMix / 243;
        rawCOGS += tepungCostPerPiece;
        breakdown.push({ label: 'Tepung Bumbu (~41g)', amount: tepungCostPerPiece });
    }

    // 5. Nasi cost (Beras 5kg = 72 porsi)
    if (item.isPaket || item.isNasiOnly) {
        const nasiCost = Number(settings.price_beras_5kg) / 72;
        rawCOGS += nasiCost;
        breakdown.push({ label: 'Nasi (170g)', amount: nasiCost });
        if (item.isPaket) {
            rawCOGS += Number(settings.price_kertas_nasi);
            breakdown.push({ label: 'Kertas Nasi Custom', amount: Number(settings.price_kertas_nasi) });
        }
    }

    // 6. Sambal Geprek cost
    if (item.isGeprek || item.isSambalOnly) {
        const sambalCost = Number(settings.price_sambal_porsi);
        rawCOGS += sambalCost;
        breakdown.push({ label: 'Sambal Geprek', amount: sambalCost });
    }

    // 7. Drink cost
    if (item.isDrink) {
        rawCOGS += Number(settings.price_estee_porsi);
        breakdown.push({ label: 'Bahan Estee & Cup', amount: Number(settings.price_estee_porsi) });
    }

    // 8. Packaging Box & Bags
    if (item.isPaket) {
        rawCOGS += Number(settings.price_box_m);
        rawCOGS += Number(settings.price_plastik_besar);
        breakdown.push({ label: 'Box Custom M', amount: Number(settings.price_box_m) });
        breakdown.push({ label: 'Plastik Besar', amount: Number(settings.price_plastik_besar) });
    } else if (item.isGeprek && !item.isPaket && !item.isSambalOnly) {
        rawCOGS += Number(settings.price_box_xs);
        rawCOGS += Number(settings.price_plastik_kecil);
        breakdown.push({ label: 'Box Custom XS', amount: Number(settings.price_box_xs) });
        breakdown.push({ label: 'Plastik Kecil', amount: Number(settings.price_plastik_kecil) });
    } else if (item.part && !item.isPaket && !item.isGeprek) {
        rawCOGS += Number(settings.price_kertas_pembungkus);
        rawCOGS += Number(settings.price_plastik_kecil);
        breakdown.push({ label: 'Kertas & Plastik Kecil', amount: Number(settings.price_kertas_pembungkus) + Number(settings.price_plastik_kecil) });
    }

    // OPEX Absorption calculation
    const totalElectricityKwh = Number(settings.kwh_freezer) + Number(settings.kwh_warmer) +
        Number(settings.kwh_kipas) + Number(settings.kwh_printer) + Number(settings.kwh_charger) +
        Number(settings.kwh_magic_cook) + Number(settings.kwh_magic_warm);
    const totalElectricityRp = totalElectricityKwh * Number(settings.kwh_rate);
    const totalMonthlyOpexRp = totalElectricityRp + Number(settings.opex_gas_monthly) +
        Number(settings.opex_trash_bag) + Number(settings.opex_sarung_tangan) +
        Number(settings.opex_masker) + Number(settings.opex_consumables_lain);

    const dailyVol = Math.max(1, Number(settings.target_daily_volume) || 100);
    const monthlyVol = dailyVol * 30;
    const opexPerPortion = totalMonthlyOpexRp / monthlyVol;

    // Total Fully Absorbed HPP
    const totalHPP = rawCOGS + opexPerPortion;

    // Margins
    const offlineMarginRp = item.offline - totalHPP;
    const offlineMarginPct = item.offline > 0 ? (offlineMarginRp / item.offline) * 100 : 0;

    // Online: Harga online +4rb, potongan aplikasi 20%
    const onlineNetRevenue = item.online * 0.80;
    const onlineMarginRp = onlineNetRevenue - totalHPP;
    const onlineMarginPct = item.online > 0 ? (onlineMarginRp / item.online) * 100 : 0;

    return {
        rawCOGS,
        opexPerPortion,
        totalHPP,
        offlineMarginRp,
        offlineMarginPct,
        onlineNetRevenue,
        onlineMarginRp,
        onlineMarginPct,
        breakdown
    };
}

/**
 * Renders HPP Calculator Summary Card inside Dashboard tab (#hpp-summary-card)
 */
function renderHPPSummaryCard() {
    const cardEl = document.getElementById('hpp-summary-card');
    if (!cardEl) return;

    const settings = HPPSettingsManager.loadSettings();

    // Calculate average margins across all catalog items
    let sumOfflinePct = 0;
    let sumOnlinePct = 0;
    let count = 0;

    HPP_MENU_CATALOG.forEach(item => {
        const res = calculateMenuItemHPP(item, settings);
        sumOfflinePct += res.offlineMarginPct;
        sumOnlinePct += res.onlineMarginPct;
        count++;
    });

    const avgOfflinePct = count > 0 ? (sumOfflinePct / count).toFixed(1) : '0';
    const avgOnlinePct = count > 0 ? (sumOnlinePct / count).toFixed(1) : '0';

    const totalElectricityKwh = Number(settings.kwh_freezer) + Number(settings.kwh_warmer) +
        Number(settings.kwh_kipas) + Number(settings.kwh_printer) + Number(settings.kwh_charger) +
        Number(settings.kwh_magic_cook) + Number(settings.kwh_magic_warm);
    const totalElectricityRp = totalElectricityKwh * Number(settings.kwh_rate);
    const totalMonthlyOpexRp = totalElectricityRp + Number(settings.opex_gas_monthly) +
        Number(settings.opex_trash_bag) + Number(settings.opex_sarung_tangan) +
        Number(settings.opex_masker) + Number(settings.opex_consumables_lain);
    const opexPerPortion = Math.round(totalMonthlyOpexRp / (Math.max(1, Number(settings.target_daily_volume)) * 30));

    cardEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
            <div>
                <h3 style="margin: 0; display: flex; align-items: center; gap: 6px; font-size: 1.05rem; color: var(--primary);">
                    <i class="ph-fill ph-calculator"></i> Rata-rata Profit Margin & HPP
                </h3>
                <span style="font-size: 0.72rem; color: var(--text-muted);">Analisis HPP Bahan Baku & Overhead Operasional per Porsi</span>
            </div>
            <button class="btn btn-secondary" onclick="openHPPCalculatorModal('bahan-baku')" style="padding: 4px 10px; font-size: 0.75rem; display: flex; align-items: center; gap: 4px;" title="Atur Harga Bahan Baku & Biaya Operasional">
                <i class="ph ph-gear"></i> Kelola HPP
            </button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
            <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 10px; text-align: center;">
                <div style="font-size: 0.68rem; color: #10b981; font-weight: 700; text-transform: uppercase;">Margin Offline (Rata-rata)</div>
                <div style="font-size: 1.3rem; font-weight: 800; color: #10b981;">${avgOfflinePct}%</div>
            </div>
            <div style="background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; padding: 10px; text-align: center;">
                <div style="font-size: 0.68rem; color: var(--primary); font-weight: 700; text-transform: uppercase;">Margin Online (-20% MDR)</div>
                <div style="font-size: 1.3rem; font-weight: 800; color: var(--primary);">${avgOnlinePct}%</div>
            </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(245, 158, 11, 0.08); padding: 8px 10px; border-radius: 6px; font-size: 0.8rem;">
            <span style="color: var(--text-secondary); font-weight: 600;">Overhead OPEX & Listrik:</span>
            <strong style="color: #f59e0b; font-size: 0.88rem;">Rp ${opexPerPortion.toLocaleString('id-ID')} / porsi</strong>
        </div>

        <div style="font-size: 0.72rem; color: var(--text-muted); display: flex; justify-content: space-between;">
            <span>Ayam (1 Kantong / 9 pcs): <strong>Rp ${Number(settings.price_ayam_kantong).toLocaleString('id-ID')}</strong></span>
            <span>Beras 5Kg: <strong>Rp ${Number(settings.price_beras_5kg).toLocaleString('id-ID')}</strong></span>
        </div>

        <button type="button" class="btn btn-primary" onclick="openHPPCalculatorModal('margin-table')" style="width: 100%; padding: 8px; font-size: 0.82rem; display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 4px;">
            <i class="ph ph-table"></i> Lihat Tabel HPP & Laba per Produk
        </button>
    `;
}

/**
 * Opens HPP Calculator Modal and initializes form controls
 */
function openHPPCalculatorModal(initialTab = 'margin-table') {
    const modal = document.getElementById('modal-hpp-calculator');
    if (!modal) return;

    modal.onclick = (e) => {
        if (e.target === modal) {
            closeHPPCalculatorModal();
        }
    };

    const settings = HPPSettingsManager.loadSettings();

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };

    setVal('hpp-input-ayam', settings.price_ayam_kantong);
    setVal('hpp-input-saos', settings.price_saos_pack);
    setVal('hpp-input-minyak', settings.price_minyak_15kg);
    setVal('hpp-input-tepung-biang', settings.price_tepung_biang_kg);
    setVal('hpp-input-tepung-serbaguna', settings.price_tepung_serbaguna_kg);
    setVal('hpp-input-beras', settings.price_beras_5kg);
    setVal('hpp-input-sambal', settings.price_sambal_porsi);
    setVal('hpp-input-box-m', settings.price_box_m);
    setVal('hpp-input-box-xs', settings.price_box_xs);
    setVal('hpp-input-kertas-nasi', settings.price_kertas_nasi);
    setVal('hpp-input-kertas-bungkus', settings.price_kertas_pembungkus);
    setVal('hpp-input-plastik-kecil', settings.price_plastik_kecil);
    setVal('hpp-input-plastik-besar', settings.price_plastik_besar);

    setVal('hpp-input-kwh-rate', settings.kwh_rate);
    setVal('hpp-input-opex-gas', settings.opex_gas_monthly);
    setVal('hpp-input-opex-trash', settings.opex_trash_bag);
    setVal('hpp-input-opex-sarung', settings.opex_sarung_tangan);
    setVal('hpp-input-opex-masker', settings.opex_masker);
    setVal('hpp-input-opex-lain', settings.opex_consumables_lain);
    setVal('hpp-input-daily-vol', settings.target_daily_volume);

    renderHPPCalculatorTable(settings);
    switchHPPTab(initialTab);

    modal.classList.remove('hidden');
}

/**
 * Closes HPP Calculator Modal
 */
function closeHPPCalculatorModal() {
    const modal = document.getElementById('modal-hpp-calculator');
    if (modal) modal.classList.add('hidden');
}

/**
 * Switches tab inside HPP Modal
 */
function switchHPPTab(tabName) {
    const tabBtns = document.querySelectorAll('.hpp-tab-btn');
    const tabContents = document.querySelectorAll('.hpp-tab-content');

    tabBtns.forEach(btn => {
        if (btn.dataset.hppTab === tabName) {
            btn.classList.add('active');
            btn.style.borderColor = 'var(--primary)';
            btn.style.color = 'var(--primary)';
            btn.style.background = 'rgba(59, 130, 246, 0.1)';
        } else {
            btn.classList.remove('active');
            btn.style.borderColor = 'transparent';
            btn.style.color = 'var(--text-secondary)';
            btn.style.background = 'transparent';
        }
    });

    tabContents.forEach(content => {
        content.style.display = content.id === `hpp-tab-${tabName}` ? 'block' : 'none';
    });
}

let currentPriceMode = 'offline';

/**
 * Switches between Offline and Online price modes in the HPP table
 */
function switchHPPPriceMode(mode) {
    currentPriceMode = mode;
    const btnOffline = document.getElementById('btn-hpp-mode-offline');
    const btnOnline = document.getElementById('btn-hpp-mode-online');
    if (btnOffline && btnOnline) {
        if (mode === 'offline') {
            btnOffline.classList.add('active');
            btnOffline.style.background = 'var(--primary)';
            btnOffline.style.color = '#fff';
            btnOnline.classList.remove('active');
            btnOnline.style.background = 'transparent';
            btnOnline.style.color = 'var(--text-main)';
        } else {
            btnOnline.classList.add('active');
            btnOnline.style.background = 'var(--primary)';
            btnOnline.style.color = '#fff';
            btnOffline.classList.remove('active');
            btnOffline.style.background = 'transparent';
            btnOffline.style.color = 'var(--text-main)';
        }
    }
    const settings = HPPSettingsManager.loadSettings();
    renderHPPCalculatorTable(settings);
}

/**
 * Renders interactive HPP Margin Table inside Modal matching 6-column spreadsheet layout
 */
function renderHPPCalculatorTable(settings) {
    const tbody = document.getElementById('hpp-table-body');
    if (!tbody) return;

    const totalElectricityKwh = Number(settings.kwh_freezer) + Number(settings.kwh_warmer) +
        Number(settings.kwh_kipas) + Number(settings.kwh_printer) + Number(settings.kwh_charger) +
        Number(settings.kwh_magic_cook) + Number(settings.kwh_magic_warm);
    const totalElectricityRp = totalElectricityKwh * Number(settings.kwh_rate);
    const totalMonthlyOpexRp = totalElectricityRp + Number(settings.opex_gas_monthly) +
        Number(settings.opex_trash_bag) + Number(settings.opex_sarung_tangan) +
        Number(settings.opex_masker) + Number(settings.opex_consumables_lain);
    const opexPerPortion = Math.round(totalMonthlyOpexRp / (Math.max(1, Number(settings.target_daily_volume)) * 30));

    const lblOpex = document.getElementById('lbl-hpp-opex-portion');
    if (lblOpex) {
        lblOpex.textContent = `Rp ${opexPerPortion.toLocaleString('id-ID')}`;
    }

    let html = '';
    let currentCategory = '';

    HPP_MENU_CATALOG.forEach(item => {
        if (item.category !== currentCategory) {
            currentCategory = item.category;
            html += `
                <tr style="background: rgba(59, 130, 246, 0.12); font-weight: 700; color: var(--primary);">
                    <td colspan="6" style="padding: 8px 12px; font-size: 0.9rem;">
                        <i class="ph ph-squares-four"></i> ${currentCategory}
                    </td>
                </tr>
            `;
        }

        const res = calculateMenuItemHPP(item, settings);
        const hargaJual = currentPriceMode === 'offline' ? item.offline : item.online;
        const labaBersih = currentPriceMode === 'offline' ? res.offlineMarginRp : res.onlineMarginRp;
        const marginPct = currentPriceMode === 'offline' ? res.offlineMarginPct : res.onlineMarginPct;

        const marginColor = marginPct >= 30 ? '#10b981' : (marginPct >= 15 ? '#f59e0b' : '#ef4444');
        const labaColor = labaBersih >= 0 ? '#10b981' : '#ef4444';

        html += `
            <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.2s;">
                <td style="padding: 10px 12px; font-weight: 600;">${item.name}</td>
                <td style="padding: 10px 12px; text-align: right;">Rp${hargaJual.toLocaleString('id-ID')}</td>
                <td style="padding: 10px 12px; text-align: right; color: var(--text-secondary);">Rp${Math.round(res.rawCOGS).toLocaleString('id-ID')}</td>
                <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: var(--text-main);">Rp${Math.round(res.totalHPP).toLocaleString('id-ID')}</td>
                <td style="padding: 10px 12px; text-align: right; font-weight: 600; color: ${labaColor};">Rp${Math.round(labaBersih).toLocaleString('id-ID')}</td>
                <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: ${marginColor};">${marginPct.toFixed(1).replace('.', ',')}%</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

/**
 * Exports the HPP Margin Table to Excel (.xlsx)
 */
async function exportHPPMarginTableExcel() {
    if (!window.XLSX) {
        try {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = './assets/lib/xlsx.full.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        } catch (e) {
            if (typeof showToast === 'function') showToast('Library Excel tidak tersedia.', 'error');
            return;
        }
    }

    const settings = HPPSettingsManager.loadSettings();
    const rows = [];

    HPP_MENU_CATALOG.forEach(item => {
        const res = calculateMenuItemHPP(item, settings);
        const hargaJual = currentPriceMode === 'offline' ? item.offline : item.online;
        const labaBersih = currentPriceMode === 'offline' ? res.offlineMarginRp : res.onlineMarginRp;
        const marginPct = currentPriceMode === 'offline' ? res.offlineMarginPct : res.onlineMarginPct;

        rows.push({
            'Menu (Ala Carte)': item.name,
            'Kategori': item.category,
            'Mode Harga': currentPriceMode === 'offline' ? 'Offline (Toko)' : 'Online (Ojol - Potongan 20% + Rp 4.000)',
            'Harga Jual': hargaJual,
            'HPP Bahan': Math.round(res.rawCOGS),
            'OPEX / Porsi': Math.round(res.opexPerPortion),
            'HPP Final (+ Operasional)': Math.round(res.totalHPP),
            'Laba Bersih': Math.round(labaBersih),
            'Margin Laba (%)': Number(marginPct.toFixed(1))
        });
    });

    const worksheet = window.XLSX.utils.json_to_sheet(rows);
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, 'HPP & Margin NTPOS');
    window.XLSX.writeFile(workbook, `Laporan_HPP_Profitabilitas_NTPOS_${currentPriceMode.toUpperCase()}.xlsx`);

    if (typeof showToast === 'function') {
        showToast('Laporan HPP berhasil diexport ke Excel!', 'success');
    }
}

/**
 * Handles Live Form Recalculation on Input Change
 */
function handleHPPInputChange() {
    const updatedSettings = {
        ...HPPSettingsManager.getDefaultSettings(),
        price_ayam_kantong: Number(document.getElementById('hpp-input-ayam')?.value || 36000),
        price_saos_pack: Number(document.getElementById('hpp-input-saos')?.value || 24000),
        price_minyak_15kg: Number(document.getElementById('hpp-input-minyak')?.value || 270000),
        price_tepung_biang_kg: Number(document.getElementById('hpp-input-tepung-biang')?.value || 25000),
        price_tepung_serbaguna_kg: Number(document.getElementById('hpp-input-tepung-serbaguna')?.value || 12000),
        price_beras_5kg: Number(document.getElementById('hpp-input-beras')?.value || 72000),
        price_sambal_porsi: Number(document.getElementById('hpp-input-sambal')?.value || 1200),
        price_box_m: Number(document.getElementById('hpp-input-box-m')?.value || 1036),
        price_box_xs: Number(document.getElementById('hpp-input-box-xs')?.value || 1036),
        price_kertas_nasi: Number(document.getElementById('hpp-input-kertas-nasi')?.value || 500),
        price_kertas_pembungkus: Number(document.getElementById('hpp-input-kertas-bungkus')?.value || 270),
        price_plastik_kecil: Number(document.getElementById('hpp-input-plastik-kecil')?.value || 150),
        price_plastik_besar: Number(document.getElementById('hpp-input-plastik-besar')?.value || 300),

        kwh_rate: Number(document.getElementById('hpp-input-kwh-rate')?.value || 1444.7),
        opex_gas_monthly: Number(document.getElementById('hpp-input-opex-gas')?.value || 330000),
        opex_trash_bag: Number(document.getElementById('hpp-input-opex-trash')?.value || 45968),
        opex_sarung_tangan: Number(document.getElementById('hpp-input-opex-sarung')?.value || 55521),
        opex_masker: Number(document.getElementById('hpp-input-opex-masker')?.value || 15378),
        opex_consumables_lain: Number(document.getElementById('hpp-input-opex-lain')?.value || 100000),
        target_daily_volume: Number(document.getElementById('hpp-input-daily-vol')?.value || 100)
    };

    renderHPPCalculatorTable(updatedSettings);
}

/**
 * Saves current HPP form settings to localStorage
 */
function saveHPPSettingsFromForm() {
    const updatedSettings = {
        ...HPPSettingsManager.getDefaultSettings(),
        price_ayam_kantong: Number(document.getElementById('hpp-input-ayam')?.value || 36000),
        price_saos_pack: Number(document.getElementById('hpp-input-saos')?.value || 24000),
        price_minyak_15kg: Number(document.getElementById('hpp-input-minyak')?.value || 270000),
        price_tepung_biang_kg: Number(document.getElementById('hpp-input-tepung-biang')?.value || 25000),
        price_tepung_serbaguna_kg: Number(document.getElementById('hpp-input-tepung-serbaguna')?.value || 12000),
        price_beras_5kg: Number(document.getElementById('hpp-input-beras')?.value || 72000),
        price_sambal_porsi: Number(document.getElementById('hpp-input-sambal')?.value || 1200),
        price_box_m: Number(document.getElementById('hpp-input-box-m')?.value || 1036),
        price_box_xs: Number(document.getElementById('hpp-input-box-xs')?.value || 1036),
        price_kertas_nasi: Number(document.getElementById('hpp-input-kertas-nasi')?.value || 500),
        price_kertas_pembungkus: Number(document.getElementById('hpp-input-kertas-bungkus')?.value || 270),
        price_plastik_kecil: Number(document.getElementById('hpp-input-plastik-kecil')?.value || 150),
        price_plastik_besar: Number(document.getElementById('hpp-input-plastik-besar')?.value || 300),

        kwh_rate: Number(document.getElementById('hpp-input-kwh-rate')?.value || 1444.7),
        opex_gas_monthly: Number(document.getElementById('hpp-input-opex-gas')?.value || 330000),
        opex_trash_bag: Number(document.getElementById('hpp-input-opex-trash')?.value || 45968),
        opex_sarung_tangan: Number(document.getElementById('hpp-input-opex-sarung')?.value || 55521),
        opex_masker: Number(document.getElementById('hpp-input-opex-masker')?.value || 15378),
        opex_consumables_lain: Number(document.getElementById('hpp-input-opex-lain')?.value || 100000),
        target_daily_volume: Number(document.getElementById('hpp-input-daily-vol')?.value || 100)
    };

    HPPSettingsManager.saveSettings(updatedSettings);
    renderHPPSummaryCard();
    closeHPPCalculatorModal();
}

/**
 * Pulls real average costs from Supabase (inventory_postings & operational_costs)
 */
async function pullHPPCostsFromDatabase() {
    const btn = document.getElementById('btn-pull-db-costs');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Menarik Data DB...';
    }

    try {
        const outletId = typeof getActiveOutletId === 'function' ? getActiveOutletId() : null;
        if (!outletId || typeof supabase === 'undefined') {
            throw new Error('Supabase client atau outlet aktif tidak terdeteksi.');
        }

        // 1. Fetch latest Stock In postings for raw materials
        const { data: postingItems, error: postingErr } = await supabase
            .from('inventory_posting_items')
            .select(`
                price,
                inventory_items (name, unit_large)
            `)
            .gt('price', 0)
            .order('id', { ascending: false })
            .limit(100);

        let pulledCount = 0;
        if (!postingErr && postingItems) {
            postingItems.forEach(pi => {
                const name = (pi.inventory_items?.name || '').toLowerCase();
                const price = Number(pi.price) || 0;
                if (price > 0) {
                    if (name.includes('ayam') && !pulledCount) {
                        // If price per kg/package is stored
                        const inputEl = document.getElementById('hpp-input-ayam');
                        if (inputEl) {
                            inputEl.value = Math.round(price);
                            pulledCount++;
                        }
                    } else if (name.includes('saos') || name.includes('saus')) {
                        const inputEl = document.getElementById('hpp-input-saos');
                        if (inputEl) {
                            inputEl.value = Math.round(price);
                            pulledCount++;
                        }
                    } else if (name.includes('beras')) {
                        const inputEl = document.getElementById('hpp-input-beras');
                        if (inputEl) {
                            inputEl.value = Math.round(price);
                            pulledCount++;
                        }
                    }
                }
            });
        }

        // 2. Fetch current month operational costs
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

        const { data: opexData, error: opexErr } = await supabase
            .from('operational_costs')
            .select('total_amount')
            .eq('outlet_id', outletId)
            .gte('cost_date', startOfMonth)
            .lte('cost_date', endOfMonth);

        if (!opexErr && opexData && opexData.length > 0) {
            const totalMonthlyOpex = opexData.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);
            const inputOpexLain = document.getElementById('hpp-input-opex-lain');
            if (inputOpexLain && totalMonthlyOpex > 0) {
                inputOpexLain.value = Math.round(totalMonthlyOpex);
                pulledCount++;
            }
        }

        handleHPPInputChange();
        if (typeof showToast === 'function') {
            showToast(`Berhasil menarik ${pulledCount} referensi biaya dari sistem DB!`, 'success');
        }
    } catch (e) {
        console.warn('Could not pull HPP costs from DB:', e);
        if (typeof showToast === 'function') {
            showToast('Gagal menarik data dari DB. Periksa koneksi Supabase Anda.', 'error');
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="ph ph-database"></i> Tarik dari Sistem (DB)';
        }
    }
}

// Expose globally
window.HPPSettingsManager = HPPSettingsManager;
window.openHPPCalculatorModal = openHPPCalculatorModal;
window.closeHPPCalculatorModal = closeHPPCalculatorModal;
window.switchHPPTab = switchHPPTab;
window.handleHPPInputChange = handleHPPInputChange;
window.saveHPPSettingsFromForm = saveHPPSettingsFromForm;
window.pullHPPCostsFromDatabase = pullHPPCostsFromDatabase;
window.renderHPPSummaryCard = renderHPPSummaryCard;
window.switchHPPPriceMode = switchHPPPriceMode;
window.exportHPPMarginTableExcel = exportHPPMarginTableExcel;
