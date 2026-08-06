/**
 * hpp.js - HPP (Harga Pokok Penjualan) & Margin Profitability Calculator
 * Supports Equal Chicken Cost Allocation, OPEX Absorption per Portion, Offline vs Online Margin Analysis,
 * and pulling real average cost data from Supabase DB (inventory_postings & operational_costs).
 */

import { supabase } from './supabase.js';
import { getActiveOutletId } from './state.js';
import { showToast } from './utils.js';

const HPPSettingsManager = {
    STORAGE_KEY: 'ntpos_hpp_settings_v1',
    _cachedSettings: null,

    getDefaultSettings() {
        return {
            // Raw material prices (Rp)
            price_ayam_kantong: 36000,      // 1 kantong = 9 potong
            price_saos_pack: 24000,         // 1 pack = 24 bungkus
            price_minyak_15kg: 270000,      // 1 box 15kg
            price_tepung_biang_kg: 25000,   // Rp 25,000 / kg
            price_tepung_serbaguna_kg: 12000, // Rp 12,000 / kg
            
            // Extra ingredients
            price_beras_1_liter: 14400,     // 1 Liter = 10 porsi
            
            // Sambal ingredients
            price_cabe_merah_kg: 60000,
            price_cabe_hijau_kg: 40000,
            price_bawang_kg: 40000,
            price_minyak_cair_liter: 16000,
            price_kaldu_kg: 50000,          // Kiloan kaldu
            price_garam_kg: 12000,          // Kiloan garam
            price_gula_kg: 18000,
            price_sasa_kg: 40000,           // Kiloan sasa
            price_kencur_kg: 30000,
            
            // Packaging
            price_box_m: 1036,
            price_box_xs: 1036,
            price_kertas_nasi: 500,
            price_kertas_pembungkus: 270,
            price_plastik_kecil: 150,
            price_plastik_besar: 300,
            price_estee_porsi: 1500,
            
            // Saus Tambahan
            price_saus_gourmet_1kg: 15000,
            price_saus_bbq_250g: 9500,
            price_saus_tomat_250g: 12500,
            price_wijen: 11500,
            price_saus_keju_500g: 27000,
            price_cup_saus_30: 5100,

            // Monthly OPEX & Electricity
            opex_listrik_kwh_bulanan: 163, // Total estimate kWh
            kwh_rate: 1444.7,
            opex_gas_monthly: 330000,      // 3 tabung * frekuensi
            opex_trash_bag: 45000,
            opex_sarung_tangan: 55000,     // 1 box isi 100
            opex_masker: 20000,            // 1 box isi 50
            opex_tissue: 30000,            // 10 pcs
            opex_solatip: 3000,            // 1 pcs
            opex_thermal: 5000,            // 1 roll

            target_daily_volume: 100
        };
    },

    loadSettings() {
        if (this._cachedSettings) return this._cachedSettings;
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

    async fetchSettingsFromDB() {
        try {
            const outletId = getActiveOutletId();
            if (!outletId || !supabase) return this.loadSettings();

            const { data, error } = await supabase
                .from('hpp_settings')
                .select('settings')
                .eq('outlet_id', outletId)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') {
                console.warn('Error fetching HPP settings from DB:', error);
                return this.loadSettings();
            }

            if (data && data.settings) {
                const newSettings = { ...this.getDefaultSettings(), ...data.settings };
                this._cachedSettings = newSettings;
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newSettings));
                return newSettings;
            }
        } catch (e) {
            console.warn('Exception fetching HPP settings from DB:', e);
        }
        return this.loadSettings();
    },

    async saveSettings(settings) {
        try {
            // Update local memory and storage immediately for snappy UI
            this._cachedSettings = { ...this.getDefaultSettings(), ...settings };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._cachedSettings));

            // Sync to Supabase DB
            const outletId = getActiveOutletId();
            if (outletId && supabase) {
                const { error } = await supabase
                    .from('hpp_settings')
                    .upsert({
                        outlet_id: outletId,
                        settings: this._cachedSettings,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'outlet_id' });
                
                if (error) throw error;
            }

            if (typeof showToast === 'function') {
                showToast('Pengaturan HPP berhasil disimpan ke Database!', 'success');
            }
        } catch (e) {
            console.warn('Could not save HPP settings to DB:', e);
            if (typeof showToast === 'function') {
                showToast('Tersimpan di perangkat, tapi gagal sinkron ke Database.', 'warning');
            }
        }
    }
};

/**
 * Menu Catalog Definition
 */
const HPP_MENU_CATALOG = [
    // Ala Carte
    { category: 'Ala Carte', name: 'Ayam Dada', price: 12000, part: 'dada', isGeprek: false, isPaket: false },
    { category: 'Ala Carte', name: 'Ayam Paha Atas', price: 12000, part: 'paha_atas', isGeprek: false, isPaket: false },
    { category: 'Ala Carte', name: 'Ayam Paha Bawah', price: 9000, part: 'paha_bawah', isGeprek: false, isPaket: false },
    { category: 'Ala Carte', name: 'Ayam Sayap', price: 8000, part: 'sayap', isGeprek: false, isPaket: false },
    { category: 'Ala Carte', name: 'Ayam Geprek Dada', price: 15000, part: 'dada', isGeprek: true, isPaket: false },
    { category: 'Ala Carte', name: 'Ayam Geprek Paha Atas', price: 15000, part: 'paha_atas', isGeprek: true, isPaket: false },
    { category: 'Ala Carte', name: 'Ayam Geprek Paha Bawah', price: 12000, part: 'paha_bawah', isGeprek: true, isPaket: false },
    { category: 'Ala Carte', name: 'Ayam Geprek Sayap', price: 11000, part: 'sayap', isGeprek: true, isPaket: false },

    // Paket Ayam + Nasi
    { category: 'Paket Ayam + Nasi', name: 'Paket Dada', price: 15000, part: 'dada', isGeprek: false, isPaket: true },
    { category: 'Paket Ayam + Nasi', name: 'Paket P.Atas', price: 15000, part: 'paha_atas', isGeprek: false, isPaket: true },
    { category: 'Paket Ayam + Nasi', name: 'Paket P.bawah', price: 13000, part: 'paha_bawah', isGeprek: false, isPaket: true },
    { category: 'Paket Ayam + Nasi', name: 'Paket Sayap', price: 12000, part: 'sayap', isGeprek: false, isPaket: true },
    { category: 'Paket Ayam + Nasi', name: 'Paket Geprek Dada', price: 18000, part: 'dada', isGeprek: true, isPaket: true },
    { category: 'Paket Ayam + Nasi', name: 'Paket Geprek P.atas', price: 18000, part: 'paha_atas', isGeprek: true, isPaket: true },
    { category: 'Paket Ayam + Nasi', name: 'Paket Geprek P.bawah', price: 16000, part: 'paha_bawah', isGeprek: true, isPaket: true },
    { category: 'Paket Ayam + Nasi', name: 'Paket Geprek Sayap', price: 15000, part: 'sayap', isGeprek: true, isPaket: true },

    // Extra
    { category: 'Extra', name: 'Nasi', price: 4000, part: null, isGeprek: false, isPaket: false, isNasiOnly: true },
    { category: 'Extra', name: 'Sambel Geprek Merah', price: 4000, part: null, isGeprek: true, isPaket: false, isSambalOnly: true },
    { category: 'Extra', name: 'Sambel Geprek Hijau', price: 4000, part: null, isGeprek: true, isPaket: false, isSambalOnly: true },
    { category: 'Extra', name: 'Saus Kocak', price: 4000, part: null, isGeprek: false, isPaket: false, isSausKocak: true },
    { category: 'Extra', name: 'Saus Keju', price: 4000, part: null, isGeprek: false, isPaket: false, isSausKeju: true },
    { category: 'Extra', name: 'Estee', price: 3000, part: null, isGeprek: false, isPaket: false, isDrink: true }
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
        breakdown.push({ label: `Saos (${saosQty} pcs)`, amount: saosCost });

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

    // 5. Nasi cost (Beras 1 Liter = 10 porsi)
    if (item.isPaket || item.isNasiOnly) {
        const nasiCost = Number(settings.price_beras_1_liter) / 10;
        rawCOGS += nasiCost;
        breakdown.push({ label: 'Nasi (170g)', amount: nasiCost });
        if (item.isPaket) {
            rawCOGS += Number(settings.price_kertas_nasi);
            breakdown.push({ label: 'Kertas Nasi Custom', amount: Number(settings.price_kertas_nasi) });
        }
    }

    // 6. Sambal Geprek cost
    if (item.isGeprek || item.isSambalOnly) {
        const cabeWeight = (item.part === 'dada' || item.part === 'paha_atas') ? 20 : ((item.part === 'paha_bawah' || item.part === 'sayap') ? 15 : 20);
        let sambalCost = 0;
        const garamPerGr = Number(settings.price_garam_kg) / 1000;
        const sasaPerGr = Number(settings.price_sasa_kg) / 1000;
        const kalduPerGr = Number(settings.price_kaldu_kg) / 1000;
        
        if (item.name.includes('Hijau')) {
            sambalCost += (cabeWeight / 1000) * Number(settings.price_cabe_hijau_kg);
            sambalCost += (4 / 1000) * Number(settings.price_bawang_kg);
            sambalCost += (30 / 1000) * Number(settings.price_gula_kg); // 2 sendok gula
            sambalCost += (2 / 1000) * Number(settings.price_kencur_kg);
            sambalCost += 2 * sasaPerGr; // micin 2g
            sambalCost += 2 * garamPerGr; // garam 2g
            sambalCost += (30 / 1000) * Number(settings.price_minyak_cair_liter); // 2 sendok minyak (30ml)
        } else {
            // Merah (default for Ayam Geprek)
            sambalCost += (cabeWeight / 1000) * Number(settings.price_cabe_merah_kg);
            sambalCost += (4 / 1000) * Number(settings.price_bawang_kg);
            sambalCost += 10 * kalduPerGr; // kaldu 1 sendok (10g)
            sambalCost += 5 * garamPerGr;  // garam 5g
            sambalCost += 2 * sasaPerGr;   // penyedap 2g
            sambalCost += (30 / 1000) * Number(settings.price_minyak_cair_liter);
        }
        
        rawCOGS += sambalCost;
        breakdown.push({ label: `Sambal Geprek (~${cabeWeight}g cabe)`, amount: sambalCost });
    }

    // 7. Drink cost
    if (item.isDrink) {
        rawCOGS += Number(settings.price_estee_porsi);
        breakdown.push({ label: 'Bahan Estee & Cup', amount: Number(settings.price_estee_porsi) });
    }

    // 8. Saus Tambahan (Kocak & Keju)
    if (item.isSausKocak) {
        const totalBahanKocak = Number(settings.price_saus_gourmet_1kg) + 
                                Number(settings.price_saus_bbq_250g) + 
                                Number(settings.price_saus_tomat_250g) + 
                                Number(settings.price_wijen);
        const kocakCost = totalBahanKocak / 30; // 30 porsi
        rawCOGS += kocakCost;
        breakdown.push({ label: 'Bahan Saus Kocak (1 Porsi)', amount: kocakCost });
    }

    if (item.isSausKeju) {
        const sausKejuCost = (Number(settings.price_saus_keju_500g) / 500) * 35; // 35gr per porsi
        const cupCost = Number(settings.price_cup_saus_30) / 30; // 30 cup
        rawCOGS += sausKejuCost + cupCost;
        breakdown.push({ label: 'Saus Keju (35gr)', amount: sausKejuCost });
        breakdown.push({ label: 'Cup Saus', amount: cupCost });
    }

    // 9. Packaging Box & Bags
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
    const totalElectricityKwh = Number(settings.opex_listrik_kwh_bulanan) || 0;
    const totalElectricityRp = totalElectricityKwh * Number(settings.kwh_rate);
    const totalMonthlyOpexRp = totalElectricityRp + Number(settings.opex_gas_monthly) +
        Number(settings.opex_trash_bag) + Number(settings.opex_sarung_tangan) +
        Number(settings.opex_masker) + Number(settings.opex_tissue) +
        Number(settings.opex_solatip) + Number(settings.opex_thermal);

    const dailyVol = Math.max(1, Number(settings.target_daily_volume) || 100);
    const monthlyVol = dailyVol * 30;
    const opexPerPortion = totalMonthlyOpexRp / monthlyVol;

    // Total Fully Absorbed HPP
    const totalHPP = rawCOGS + opexPerPortion;

    // Margins
    const marginRp = item.price - totalHPP;
    const marginPct = item.price > 0 ? (marginRp / item.price) * 100 : 0;

    return {
        rawCOGS,
        opexPerPortion,
        totalHPP,
        marginRp,
        marginPct,
        breakdown
    };
}

/**
 * Renders HPP Calculator Summary Card inside Dashboard tab (#hpp-summary-card)
 */
async function renderHPPSummaryCard() {
    const cardEl = document.getElementById('hpp-summary-card');
    if (!cardEl) return;

    if (!cardEl.innerHTML.trim() || !cardEl.innerHTML.includes('Rata-rata Profit')) {
        cardEl.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted);"><i class="ph ph-spinner ph-spin" style="font-size: 1.5rem; margin-bottom: 8px;"></i><br>Memuat Data HPP dari Database...</div>`;
    }

    const settings = await HPPSettingsManager.fetchSettingsFromDB();

    // Calculate average margins across all catalog items
    let sumMarginPct = 0;
    let count = 0;

    HPP_MENU_CATALOG.forEach(item => {
        const res = calculateMenuItemHPP(item, settings);
        sumMarginPct += res.marginPct;
        count++;
    });

    const avgMarginPct = count > 0 ? (sumMarginPct / count).toFixed(1) : '0';

    const totalElectricityKwh = Number(settings.opex_listrik_kwh_bulanan) || 0;
    const totalElectricityRp = totalElectricityKwh * Number(settings.kwh_rate);
    const totalMonthlyOpexRp = totalElectricityRp + Number(settings.opex_gas_monthly) +
        Number(settings.opex_trash_bag) + Number(settings.opex_sarung_tangan) +
        Number(settings.opex_masker) + Number(settings.opex_tissue) +
        Number(settings.opex_solatip) + Number(settings.opex_thermal);
    const opexPerPortion = Math.round(totalMonthlyOpexRp / (Math.max(1, Number(settings.target_daily_volume)) * 30));

    cardEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
            <div>
                <h3 style="margin: 0; display: flex; align-items: center; gap: 6px; font-size: 1.05rem; color: var(--primary);">
                    <i class="ph-fill ph-calculator"></i> Rata-rata Profit Margin & HPP
                </h3>
                <span style="font-size: 0.72rem; color: var(--text-muted);">Analisis HPP Bahan Baku & Overhead Operasional per Porsi</span>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr; gap: 10px;">
            <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 10px; text-align: center;">
                <div style="font-size: 0.68rem; color: #10b981; font-weight: 700; text-transform: uppercase;">Rata-rata Margin Laba</div>
                <div style="font-size: 1.3rem; font-weight: 800; color: #10b981;">${avgMarginPct}%</div>
            </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(245, 158, 11, 0.08); padding: 8px 10px; border-radius: 6px; font-size: 0.8rem;">
            <span style="color: var(--text-secondary); font-weight: 600;">Overhead OPEX & Listrik:</span>
            <strong style="color: #f59e0b; font-size: 0.88rem;">Rp ${opexPerPortion.toLocaleString('id-ID')} / porsi</strong>
        </div>

        <div style="font-size: 0.72rem; color: var(--text-muted); display: flex; justify-content: space-between;">
            <span>Ayam (1 Kantong / 9 pcs): <strong>Rp ${Number(settings.price_ayam_kantong).toLocaleString('id-ID')}</strong></span>
            <span>Beras 1 Liter: <strong>Rp ${Number(settings.price_beras_1_liter).toLocaleString('id-ID')}</strong></span>
        </div>

        <button type="button" class="btn btn-primary" onclick="openHPPCalculatorModal('margin-table')" style="width: 100%; padding: 8px; font-size: 0.82rem; display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 4px;">
            <i class="ph ph-table"></i> Lihat Tabel HPP & Laba per Produk
        </button>
    `;
}

/**
 * Opens HPP Calculator Modal and initializes form controls
 */
async function openHPPCalculatorModal(initialTab = 'margin-table') {
    const modal = document.getElementById('modal-hpp-calculator');
    if (!modal) return;

    modal.onclick = (e) => {
        if (e.target === modal) {
            closeHPPCalculatorModal();
        }
    };

    const settings = await HPPSettingsManager.fetchSettingsFromDB();

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };

    setVal('hpp-input-ayam', settings.price_ayam_kantong);
    setVal('hpp-input-saos', settings.price_saos_pack);
    setVal('hpp-input-minyak', settings.price_minyak_15kg);
    setVal('hpp-input-tepung-biang', settings.price_tepung_biang_kg);
    setVal('hpp-input-tepung-serbaguna', settings.price_tepung_serbaguna_kg);
    setVal('hpp-input-beras', settings.price_beras_1_liter);
    setVal('hpp-input-cabe-merah', settings.price_cabe_merah_kg);
    setVal('hpp-input-cabe-hijau', settings.price_cabe_hijau_kg);
    setVal('hpp-input-bawang', settings.price_bawang_kg);
    setVal('hpp-input-minyak-cair', settings.price_minyak_cair_liter);
    setVal('hpp-input-kaldu', settings.price_kaldu_kg);
    setVal('hpp-input-garam', settings.price_garam_kg);
    setVal('hpp-input-gula', settings.price_gula_kg);
    setVal('hpp-input-sasa', settings.price_sasa_kg);
    setVal('hpp-input-kencur', settings.price_kencur_kg);
    setVal('hpp-input-box-m', settings.price_box_m);
    setVal('hpp-input-box-xs', settings.price_box_xs);
    setVal('hpp-input-kertas-nasi', settings.price_kertas_nasi);
    setVal('hpp-input-kertas-bungkus', settings.price_kertas_pembungkus);
    setVal('hpp-input-plastik-kecil', settings.price_plastik_kecil);
    setVal('hpp-input-plastik-besar', settings.price_plastik_besar);

    setVal('hpp-input-saus-gourmet', settings.price_saus_gourmet_1kg);
    setVal('hpp-input-saus-bbq', settings.price_saus_bbq_250g);
    setVal('hpp-input-saus-tomat', settings.price_saus_tomat_250g);
    setVal('hpp-input-wijen', settings.price_wijen);
    setVal('hpp-input-saus-keju', settings.price_saus_keju_500g);
    setVal('hpp-input-cup-saus', settings.price_cup_saus_30);

    setVal('hpp-input-kwh-total', settings.opex_listrik_kwh_bulanan);
    setVal('hpp-input-kwh-rate', settings.kwh_rate);
    setVal('hpp-input-opex-gas', settings.opex_gas_monthly);
    setVal('hpp-input-opex-trash', settings.opex_trash_bag);
    setVal('hpp-input-opex-sarung', settings.opex_sarung_tangan);
    setVal('hpp-input-opex-masker', settings.opex_masker);
    setVal('hpp-input-tissue', settings.opex_tissue);
    setVal('hpp-input-solatip', settings.opex_solatip);
    setVal('hpp-input-thermal', settings.opex_thermal);
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


/**
 * Renders interactive HPP Margin Table inside Modal matching 6-column spreadsheet layout
 */
function renderHPPCalculatorTable(settings) {
    const tbody = document.getElementById('hpp-table-body');
    if (!tbody) return;

    const totalElectricityKwh = Number(settings.opex_listrik_kwh_bulanan) || 0;
    const totalElectricityRp = totalElectricityKwh * Number(settings.kwh_rate);
    const totalMonthlyOpexRp = totalElectricityRp + Number(settings.opex_gas_monthly) +
        Number(settings.opex_trash_bag) + Number(settings.opex_sarung_tangan) +
        Number(settings.opex_masker) + Number(settings.opex_tissue) +
        Number(settings.opex_solatip) + Number(settings.opex_thermal);
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
        const hargaJual = item.price;
        const labaBersih = res.marginRp;
        const marginPct = res.marginPct;

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
        const hargaJual = item.price;
        const labaBersih = res.marginRp;
        const marginPct = res.marginPct;

        rows.push({
            'Menu (Ala Carte)': item.name,
            'Kategori': item.category,
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
    window.XLSX.utils.book_append_sheet(workbook, worksheet, 'HPP & Margin');
    window.XLSX.writeFile(workbook, `Laporan_HPP_Profitabilitas.xlsx`);

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
        price_beras_1_liter: Number(document.getElementById('hpp-input-beras')?.value || 14400),
        price_cabe_merah_kg: Number(document.getElementById('hpp-input-cabe-merah')?.value || 60000),
        price_cabe_hijau_kg: Number(document.getElementById('hpp-input-cabe-hijau')?.value || 40000),
        price_bawang_kg: Number(document.getElementById('hpp-input-bawang')?.value || 40000),
        price_minyak_cair_liter: Number(document.getElementById('hpp-input-minyak-cair')?.value || 16000),
        price_kaldu_kg: Number(document.getElementById('hpp-input-kaldu')?.value || 50000),
        price_garam_kg: Number(document.getElementById('hpp-input-garam')?.value || 12000),
        price_gula_kg: Number(document.getElementById('hpp-input-gula')?.value || 18000),
        price_sasa_kg: Number(document.getElementById('hpp-input-sasa')?.value || 40000),
        price_kencur_kg: Number(document.getElementById('hpp-input-kencur')?.value || 30000),
        price_box_m: Number(document.getElementById('hpp-input-box-m')?.value || 1036),
        price_box_xs: Number(document.getElementById('hpp-input-box-xs')?.value || 1036),
        price_kertas_nasi: Number(document.getElementById('hpp-input-kertas-nasi')?.value || 500),
        price_kertas_pembungkus: Number(document.getElementById('hpp-input-kertas-bungkus')?.value || 270),
        price_plastik_kecil: Number(document.getElementById('hpp-input-plastik-kecil')?.value || 150),
        price_plastik_besar: Number(document.getElementById('hpp-input-plastik-besar')?.value || 300),

        price_saus_gourmet_1kg: Number(document.getElementById('hpp-input-saus-gourmet')?.value || 15000),
        price_saus_bbq_250g: Number(document.getElementById('hpp-input-saus-bbq')?.value || 9500),
        price_saus_tomat_250g: Number(document.getElementById('hpp-input-saus-tomat')?.value || 12500),
        price_wijen: Number(document.getElementById('hpp-input-wijen')?.value || 11500),
        price_saus_keju_500g: Number(document.getElementById('hpp-input-saus-keju')?.value || 27000),
        price_cup_saus_30: Number(document.getElementById('hpp-input-cup-saus')?.value || 5100),

        opex_listrik_kwh_bulanan: Number(document.getElementById('hpp-input-kwh-total')?.value || 163),
        kwh_rate: Number(document.getElementById('hpp-input-kwh-rate')?.value || 1444.7),
        opex_gas_monthly: Number(document.getElementById('hpp-input-opex-gas')?.value || 330000),
        opex_trash_bag: Number(document.getElementById('hpp-input-opex-trash')?.value || 45000),
        opex_sarung_tangan: Number(document.getElementById('hpp-input-opex-sarung')?.value || 55000),
        opex_masker: Number(document.getElementById('hpp-input-opex-masker')?.value || 20000),
        opex_tissue: Number(document.getElementById('hpp-input-tissue')?.value || 30000),
        opex_solatip: Number(document.getElementById('hpp-input-solatip')?.value || 3000),
        opex_thermal: Number(document.getElementById('hpp-input-thermal')?.value || 5000),
        target_daily_volume: Number(document.getElementById('hpp-input-daily-vol')?.value || 100)
    };

    renderHPPCalculatorTable(updatedSettings);
}

/**
 * Saves current HPP form settings to localStorage
 */
async function saveHPPSettingsFromForm() {
    const btn = document.querySelector('#modal-hpp-calculator .btn-primary');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Menyimpan...';
    }

    const updatedSettings = {
        ...HPPSettingsManager.getDefaultSettings(),
        price_ayam_kantong: Number(document.getElementById('hpp-input-ayam')?.value || 36000),
        price_saos_pack: Number(document.getElementById('hpp-input-saos')?.value || 24000),
        price_minyak_15kg: Number(document.getElementById('hpp-input-minyak')?.value || 270000),
        price_tepung_biang_kg: Number(document.getElementById('hpp-input-tepung-biang')?.value || 25000),
        price_tepung_serbaguna_kg: Number(document.getElementById('hpp-input-tepung-serbaguna')?.value || 12000),
        price_beras_1_liter: Number(document.getElementById('hpp-input-beras')?.value || 14400),
        price_cabe_merah_kg: Number(document.getElementById('hpp-input-cabe-merah')?.value || 60000),
        price_cabe_hijau_kg: Number(document.getElementById('hpp-input-cabe-hijau')?.value || 40000),
        price_bawang_kg: Number(document.getElementById('hpp-input-bawang')?.value || 40000),
        price_minyak_cair_liter: Number(document.getElementById('hpp-input-minyak-cair')?.value || 16000),
        price_kaldu_kg: Number(document.getElementById('hpp-input-kaldu')?.value || 50000),
        price_garam_kg: Number(document.getElementById('hpp-input-garam')?.value || 12000),
        price_gula_kg: Number(document.getElementById('hpp-input-gula')?.value || 18000),
        price_sasa_kg: Number(document.getElementById('hpp-input-sasa')?.value || 40000),
        price_kencur_kg: Number(document.getElementById('hpp-input-kencur')?.value || 30000),
        price_box_m: Number(document.getElementById('hpp-input-box-m')?.value || 1036),
        price_box_xs: Number(document.getElementById('hpp-input-box-xs')?.value || 1036),
        price_kertas_nasi: Number(document.getElementById('hpp-input-kertas-nasi')?.value || 500),
        price_kertas_pembungkus: Number(document.getElementById('hpp-input-kertas-bungkus')?.value || 270),
        price_plastik_kecil: Number(document.getElementById('hpp-input-plastik-kecil')?.value || 150),
        price_plastik_besar: Number(document.getElementById('hpp-input-plastik-besar')?.value || 300),

        price_saus_gourmet_1kg: Number(document.getElementById('hpp-input-saus-gourmet')?.value || 15000),
        price_saus_bbq_250g: Number(document.getElementById('hpp-input-saus-bbq')?.value || 9500),
        price_saus_tomat_250g: Number(document.getElementById('hpp-input-saus-tomat')?.value || 12500),
        price_wijen: Number(document.getElementById('hpp-input-wijen')?.value || 11500),
        price_saus_keju_500g: Number(document.getElementById('hpp-input-saus-keju')?.value || 27000),
        price_cup_saus_30: Number(document.getElementById('hpp-input-cup-saus')?.value || 5100),

        opex_listrik_kwh_bulanan: Number(document.getElementById('hpp-input-kwh-total')?.value || 163),
        kwh_rate: Number(document.getElementById('hpp-input-kwh-rate')?.value || 1444.7),
        opex_gas_monthly: Number(document.getElementById('hpp-input-opex-gas')?.value || 330000),
        opex_trash_bag: Number(document.getElementById('hpp-input-opex-trash')?.value || 45000),
        opex_sarung_tangan: Number(document.getElementById('hpp-input-opex-sarung')?.value || 55000),
        opex_masker: Number(document.getElementById('hpp-input-opex-masker')?.value || 20000),
        opex_tissue: Number(document.getElementById('hpp-input-tissue')?.value || 30000),
        opex_solatip: Number(document.getElementById('hpp-input-solatip')?.value || 3000),
        opex_thermal: Number(document.getElementById('hpp-input-thermal')?.value || 5000),
        target_daily_volume: Number(document.getElementById('hpp-input-daily-vol')?.value || 100)
    };

    await HPPSettingsManager.saveSettings(updatedSettings);
    renderHPPSummaryCard();
    closeHPPCalculatorModal();

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
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
        const outletId = getActiveOutletId();
        if (!outletId || !supabase) {
            throw new Error('Supabase client atau outlet aktif tidak terdeteksi.');
        }

        // 1. Fetch latest Stock In postings for raw materials
        const { data: postingItems, error: postingErr } = await supabase
            .from('inventory_posting_items')
            .select(`
                price,
                inventory_items (name, unit_large, outlet_id)
            `)
            .gt('price', 0)
            .order('id', { ascending: false })
            .limit(100);

        let pulledCount = 0;
        let pulledAyam = false;
        let pulledSaos = false;
        let pulledBeras = false;

        if (!postingErr && postingItems) {
            postingItems.forEach(pi => {
                // Ignore items belonging to a different outlet if outlet_id is present
                if (pi.inventory_items && pi.inventory_items.outlet_id && pi.inventory_items.outlet_id !== outletId) {
                    return;
                }
                const name = (pi.inventory_items?.name || '').toLowerCase();
                const price = Number(pi.price) || 0;
                if (price > 0) {
                    if (name.includes('ayam') && !pulledAyam) {
                        const inputEl = document.getElementById('hpp-input-ayam');
                        if (inputEl) {
                            inputEl.value = Math.round(price);
                            pulledAyam = true;
                            pulledCount++;
                        }
                    } else if ((name.includes('saos') || name.includes('saus')) && !pulledSaos) {
                        const inputEl = document.getElementById('hpp-input-saos');
                        if (inputEl) {
                            inputEl.value = Math.round(price);
                            pulledSaos = true;
                            pulledCount++;
                        }
                    } else if (name.includes('beras') && !pulledBeras) {
                        const inputEl = document.getElementById('hpp-input-beras');
                        if (inputEl) {
                            inputEl.value = Math.round(price);
                            pulledBeras = true;
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
        if (pulledCount > 0) {
            showToast(`Berhasil menarik ${pulledCount} referensi biaya dari sistem DB!`, 'success');
        } else {
            showToast('Tidak ada data referensi biaya baru yang ditemukan di DB.', 'info');
        }
    } catch (e) {
        console.warn('Could not pull HPP costs from DB:', e);
        showToast('Gagal menarik data dari DB. Periksa koneksi Supabase Anda.', 'error');
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
window.exportHPPMarginTableExcel = exportHPPMarginTableExcel;
