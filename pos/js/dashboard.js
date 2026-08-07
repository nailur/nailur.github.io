window.revenueChartInst = null;
window.productChartInst = null;
window.depositCompChartInst = null;
window.methodNetChartInst = null;
window.profitSharingChartInst = null;
window.peakHoursChartInst = null;

window.loadDashboard = async function() {
    if (!activeOutletId) return;

    if (!window.Chart || !window.ChartDataLabels) {
        if (!window.Chart) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        if (!window.ChartDataLabels) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        window.Chart.register(window.ChartDataLabels);
    }
    
    const startDate = document.getElementById('dashboard-date-start');
    const endDate = document.getElementById('dashboard-date-end');
    if (!startDate || !startDate.value || !endDate || !endDate.value) return;

    const startOfDay = new Date(`${startDate.value}T00:00:00`).toISOString();
    const endOfDay = new Date(`${endDate.value}T23:59:59.999`).toISOString();

    // Fetch dashboard summary
    const { data: rpcResult, error: rpcError } = await supabase.rpc('get_dashboard_summary', {
        p_outlet_id: activeOutletId,
        p_start_date: startOfDay,
        p_end_date: endOfDay
    });

    // Fetch analytics summary for charts
    // Audit Fix #4: Pass p_end_date so filtering is done in database,
    // not in browser — saves Egress Supabase quota (5 GB/month).
    const { data: analyticsResult, error: analyticsError } = await supabase.rpc('get_analytics_summary', {
        p_outlet_ids: [activeOutletId],
        p_start_date: startOfDay,
        p_end_date: endOfDay
    });

    if (rpcError || analyticsError) {
        console.error('Dashboard RPC error:', rpcError || analyticsError);
        window.showToast('Gagal memuat dashboard', 'error');
        return;
    }

    const result = rpcResult;
    const totalRevenue = Number(result.total_revenue) || 0;
    const totalTrx = Number(result.total_trx) || 0;
    const totalDiscount = Number(result.total_discount) || 0;
    const totalTax = Number(result.total_tax) || 0;
    const methodData = result.method_summary || [];
    const productData = result.product_summary || [];

    document.getElementById('dash-total-revenue').textContent = `Rp ${totalRevenue.toLocaleString('id-ID')}`;
    document.getElementById('dash-total-trx').textContent = totalTrx;
    document.getElementById('dash-total-discount').textContent = `Rp ${totalDiscount.toLocaleString('id-ID')}`;
    
    const dashTaxEl = document.getElementById('dash-total-tax');
    if (dashTaxEl) dashTaxEl.textContent = `Rp ${totalTax.toLocaleString('id-ID')}`;

    const totalVoidAmt = Number(result.total_void_amount) || 0;
    const totalVoidTrx = Number(result.total_void_trx) || 0;
    const dashVoidAmtEl = document.getElementById('dash-total-void-amount');
    const dashVoidTrxEl = document.getElementById('dash-total-void-trx');
    if (dashVoidAmtEl) dashVoidAmtEl.textContent = `Rp ${totalVoidAmt.toLocaleString('id-ID')}`;
    if (dashVoidTrxEl) dashVoidTrxEl.textContent = `${totalVoidTrx} Trx`;

    // Build method summary with defaults
    const ALL_PAYMENT_METHODS = ['Tunai', 'QRIS', 'Bank Transfer', 'Go Food', 'Grab Food', 'Shopee Food'];
    const methodSummary = {};
    ALL_PAYMENT_METHODS.forEach(m => methodSummary[m] = { count: 0, total: 0 });
    methodData.forEach(m => {
        const key = m.method || 'Tunai';
        methodSummary[key] = { count: Number(m.count), total: Number(m.total) };
    });
    window.lastMethodSummary = methodSummary;
    window.clientMethodFees = {}; // Reset for new date range

    const activeOutletObj = window.posOutletsList?.find(o => o.id === activeOutletId);
    const tbodyMethod = document.querySelector('#dashboard-method-table tbody');
    tbodyMethod.innerHTML = Object.entries(methodSummary)
        .sort((a,b) => b[1].total - a[1].total)
        .map(([method, stats]) => {
            let methodFee = 0;
            if (method !== 'Tunai' && activeOutletObj && activeOutletObj.mdr_fees && activeOutletObj.mdr_fees[method]) {
                const feeCfg = activeOutletObj.mdr_fees[method];
                if (feeCfg.type === 'percent') {
                    methodFee = stats.total * (Number(feeCfg.value) / 100);
                } else if (feeCfg.type === 'fixed') {
                    methodFee = stats.count * Number(feeCfg.value);
                }
            }
            const netAmount = Math.round(stats.total - methodFee);
            return `
            <tr>
                <td>${window.escapeHtml(method)}</td>
                <td style="text-align: right;">${stats.count}</td>
                <td style="text-align: right;">Rp ${stats.total.toLocaleString('id-ID')}</td>
                <td style="text-align: right; color: #10b981; font-weight: 600;">Rp ${netAmount.toLocaleString('id-ID')}</td>
            </tr>
            `;
        }).join('');

    const tbodyProduct = document.querySelector('#dashboard-product-table tbody');
    if (productData.length === 0) {
        tbodyProduct.innerHTML = '<tr><td colspan="3" class="text-center">Belum ada data</td></tr>';
    } else {
        tbodyProduct.innerHTML = productData.map(p => `
            <tr>
                <td>${window.escapeHtml(p.name)}</td>
                <td style="text-align: right;">${Number(p.qty)}</td>
                <td style="text-align: right;">Rp ${Number(p.revenue).toLocaleString('id-ID')}</td>
            </tr>
        `).join('');
    }
    
    if (window.enableTableSort) window.enableTableSort('dashboard-method-table');
    if (window.enableTableSort) window.enableTableSort('dashboard-product-table');

    // Chicken Bag & Packaging Box calculations
    let countDada = 0, countPahaAtas = 0, countPahaBawah = 0, countSayap = 0, countLainnya = 0;
    let countBoxM = 0, countBoxXS = 0;
    let boxM_OriDada = 0, boxM_OriPahaAtas = 0, boxM_OriPahaBawah = 0, boxM_OriSayap = 0;
    let boxM_GeprekDada = 0, boxM_GeprekPahaAtas = 0, boxM_GeprekPahaBawah = 0, boxM_GeprekSayap = 0;
    let boxXS_GeprekDada = 0, boxXS_GeprekPahaAtas = 0, boxXS_GeprekPahaBawah = 0, boxXS_GeprekSayap = 0;

    productData.forEach(p => {
        const name = (p.name || '').toLowerCase();
        const qty = Number(p.qty) || 0;
        let matchedPart = false;

        if (name.includes('dada')) {
            countDada += qty;
            matchedPart = true;
        }
        if (name.includes('paha atas') || name.includes('p.atas')) {
            countPahaAtas += qty;
            matchedPart = true;
        }
        if (name.includes('paha bawah') || name.includes('p.bawah') || (name.includes('paha') && !name.includes('paha atas') && !name.includes('p.atas'))) {
            countPahaBawah += qty;
            matchedPart = true;
        }
        if (name.includes('sayap') || name.includes('wing')) {
            countSayap += qty;
            matchedPart = true;
        }
        if (!matchedPart && (name.includes('ayam') || name.includes('chicken'))) {
            countLainnya += qty;
        }

        // Packaging Box Categorization (Box Ukuran M vs Box Ukuran XS)
        const isPaket = name.includes('paket');
        const isGeprek = name.includes('geprek');
        const isOriPaket = isPaket && !isGeprek;

        if (isOriPaket) {
            if (name.includes('dada')) { boxM_OriDada += qty; countBoxM += qty; }
            else if (name.includes('paha atas') || name.includes('p.atas')) { boxM_OriPahaAtas += qty; countBoxM += qty; }
            else if (name.includes('paha bawah') || name.includes('p.bawah') || name.includes('paha')) { boxM_OriPahaBawah += qty; countBoxM += qty; }
            else if (name.includes('sayap') || name.includes('wing')) { boxM_OriSayap += qty; countBoxM += qty; }
        } else if (isPaket && isGeprek) {
            if (name.includes('dada')) { boxM_GeprekDada += qty; countBoxM += qty; }
            else if (name.includes('paha atas') || name.includes('p.atas')) { boxM_GeprekPahaAtas += qty; countBoxM += qty; }
            else if (name.includes('paha bawah') || name.includes('p.bawah') || name.includes('paha')) { boxM_GeprekPahaBawah += qty; countBoxM += qty; }
            else if (name.includes('sayap') || name.includes('wing')) { boxM_GeprekSayap += qty; countBoxM += qty; }
        } else if (!isPaket && isGeprek) {
            if (name.includes('dada')) { boxXS_GeprekDada += qty; countBoxXS += qty; }
            else if (name.includes('paha atas') || name.includes('p.atas')) { boxXS_GeprekPahaAtas += qty; countBoxXS += qty; }
            else if (name.includes('paha bawah') || name.includes('p.bawah') || name.includes('paha')) { boxXS_GeprekPahaBawah += qty; countBoxXS += qty; }
            else if (name.includes('sayap') || name.includes('wing')) { boxXS_GeprekSayap += qty; countBoxXS += qty; }
        }
    });

    const reqDada = Math.ceil(countDada / 3);
    const reqPahaAtas = Math.ceil(countPahaAtas / 2);
    const reqPahaBawah = Math.ceil(countPahaBawah / 2);
    const reqSayap = Math.ceil(countSayap / 2);
    const totalBagsOpened = Math.max(reqDada, reqPahaAtas, reqPahaBawah, reqSayap);

    const sisaDada = Math.max(0, (totalBagsOpened * 3) - countDada);
    const sisaPahaAtas = Math.max(0, (totalBagsOpened * 2) - countPahaAtas);
    const sisaPahaBawah = Math.max(0, (totalBagsOpened * 2) - countPahaBawah);
    const sisaSayap = Math.max(0, (totalBagsOpened * 2) - countSayap);

    const totalPieces = countDada + countPahaAtas + countPahaBawah + countSayap + countLainnya;
    const equivBags = (totalPieces / 9).toFixed(1);

    const chickenCardEl = document.getElementById('chicken-bag-card');
    if (chickenCardEl) {
        chickenCardEl.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                <div>
                    <h3 style="margin: 0; display: flex; align-items: center; gap: 6px; font-size: 1.05rem; color: var(--primary);">
                        <i class="ph-fill ph-package"></i> Estimasi Kantong Ayam Dibuka
                    </h3>
                    <span style="font-size: 0.72rem; color: var(--text-muted);">1 Kantong = 9 pcs (3 Dada, 2 Paha Atas, 2 Paha Bawah, 2 Sayap)</span>
                </div>
                <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); padding: 5px 10px; border-radius: 8px; text-align: center; white-space: nowrap;">
                    <div style="font-size: 0.65rem; color: #10b981; font-weight: 600; text-transform: uppercase;">Kantong Dibuka</div>
                    <div style="font-size: 1.25rem; font-weight: 800; color: #10b981;">${totalBagsOpened} <span style="font-size: 0.75rem; font-weight: 600;">Kantong</span></div>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(59, 130, 246, 0.08); padding: 7px 10px; border-radius: 6px; font-size: 0.8rem;">
                <span style="color: var(--text-secondary); font-weight: 600;">Total Potong Ayam Terjual:</span>
                <strong style="color: var(--primary); font-size: 0.88rem;">${totalPieces} pcs (${equivBags} kantong)</strong>
            </div>

            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-weight: 700; font-size: 0.88rem;">Dada</span>
                        <span style="font-size: 0.68rem; background: rgba(99, 102, 241, 0.1); color: var(--primary); padding: 1px 5px; border-radius: 4px;">3 pcs/kantong</span>
                    </div>
                    <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-main);">${countDada} <span style="font-size: 0.75rem; font-weight: 500; color: var(--text-muted);">terjual</span></div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.73rem; color: var(--text-muted); margin-top: 6px; border-top: 1px dashed var(--border-color); padding-top: 6px;">
                        <span>Butuh: <strong style="color: var(--text-main);">${reqDada} kantong</strong></span>
                        <span>Sisa: <strong style="color: ${sisaDada > 0 ? '#10b981' : 'var(--text-main)'};">${sisaDada} pcs</strong></span>
                    </div>
                </div>

                <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-weight: 700; font-size: 0.88rem;">Paha Atas</span>
                        <span style="font-size: 0.68rem; background: rgba(99, 102, 241, 0.1); color: var(--primary); padding: 1px 5px; border-radius: 4px;">2 pcs/kantong</span>
                    </div>
                    <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-main);">${countPahaAtas} <span style="font-size: 0.75rem; font-weight: 500; color: var(--text-muted);">terjual</span></div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.73rem; color: var(--text-muted); margin-top: 6px; border-top: 1px dashed var(--border-color); padding-top: 6px;">
                        <span>Butuh: <strong style="color: var(--text-main);">${reqPahaAtas} kantong</strong></span>
                        <span>Sisa: <strong style="color: ${sisaPahaAtas > 0 ? '#10b981' : 'var(--text-main)'};">${sisaPahaAtas} pcs</strong></span>
                    </div>
                </div>

                <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-weight: 700; font-size: 0.88rem;">Paha Bawah</span>
                        <span style="font-size: 0.68rem; background: rgba(99, 102, 241, 0.1); color: var(--primary); padding: 1px 5px; border-radius: 4px;">2 pcs/kantong</span>
                    </div>
                    <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-main);">${countPahaBawah} <span style="font-size: 0.75rem; font-weight: 500; color: var(--text-muted);">terjual</span></div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.73rem; color: var(--text-muted); margin-top: 6px; border-top: 1px dashed var(--border-color); padding-top: 6px;">
                        <span>Butuh: <strong style="color: var(--text-main);">${reqPahaBawah} kantong</strong></span>
                        <span>Sisa: <strong style="color: ${sisaPahaBawah > 0 ? '#10b981' : 'var(--text-main)'};">${sisaPahaBawah} pcs</strong></span>
                    </div>
                </div>

                <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-weight: 700; font-size: 0.88rem;">Sayap</span>
                        <span style="font-size: 0.68rem; background: rgba(99, 102, 241, 0.1); color: var(--primary); padding: 1px 5px; border-radius: 4px;">2 pcs/kantong</span>
                    </div>
                    <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-main);">${countSayap} <span style="font-size: 0.75rem; font-weight: 500; color: var(--text-muted);">terjual</span></div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.73rem; color: var(--text-muted); margin-top: 6px; border-top: 1px dashed var(--border-color); padding-top: 6px;">
                        <span>Butuh: <strong style="color: var(--text-main);">${reqSayap} kantong</strong></span>
                        <span>Sisa: <strong style="color: ${sisaSayap > 0 ? '#10b981' : 'var(--text-main)'};">${sisaSayap} pcs</strong></span>
                    </div>
                </div>
            </div>
            ${countLainnya > 0 ? `<div style="font-size: 0.75rem; color: var(--warning);"><i class="ph ph-info"></i> Terdapat ${countLainnya} potong menu olahan ayam lainnya tanpa spesifikasi bagian.</div>` : ''}
        `;
    }

    const boxCardEl = document.getElementById('packaging-box-card');
    if (boxCardEl) {
        boxCardEl.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                <div>
                    <h3 style="margin: 0; display: flex; align-items: center; gap: 6px; font-size: 1.05rem; color: #f59e0b;">
                        <i class="ph-fill ph-cube"></i> Estimasi Packaging Box Terpakai
                    </h3>
                    <span style="font-size: 0.72rem; color: var(--text-muted);">Estimasi pemakaian box berdasarkan menu Paket Ori, Paket Geprek & Geprek</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); padding: 5px 8px; border-radius: 8px; text-align: center; white-space: nowrap;">
                        <div style="font-size: 0.62rem; color: #f59e0b; font-weight: 600; text-transform: uppercase;">Box M</div>
                        <div style="font-size: 1.15rem; font-weight: 800; color: #f59e0b;">${countBoxM} <span style="font-size: 0.7rem; font-weight: 600;">Box</span></div>
                    </div>
                    <div style="background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.4); padding: 5px 8px; border-radius: 8px; text-align: center; white-space: nowrap;">
                        <div style="font-size: 0.62rem; color: #8b5cf6; font-weight: 600; text-transform: uppercase;">Box XS</div>
                        <div style="font-size: 1.15rem; font-weight: 800; color: #8b5cf6;">${countBoxXS} <span style="font-size: 0.7rem; font-weight: 600;">Box</span></div>
                    </div>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(245, 158, 11, 0.08); padding: 7px 10px; border-radius: 6px; font-size: 0.8rem;">
                <span style="color: var(--text-secondary); font-weight: 600;">Total Seluruh Packaging Box Terpakai:</span>
                <strong style="color: #f59e0b; font-size: 0.88rem;">${countBoxM + countBoxXS} Box (M: ${countBoxM}, XS: ${countBoxXS})</strong>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px;">
                <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
                        <span style="font-weight: 700; font-size: 0.85rem; color: #f59e0b;">Box Ukuran M (Paket Ayam Ori & Geprek)</span>
                        <span style="font-size: 0.72rem; font-weight: 700; color: #f59e0b;">${countBoxM} Box Terpakai</span>
                    </div>
                    <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Paket Ayam Ori</div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; text-align: center; margin-bottom: 8px;">
                        <div style="background: rgba(245, 158, 11, 0.08); padding: 4px; border-radius: 4px;">
                            <div style="font-size: 0.65rem; color: var(--text-muted);">Dada</div>
                            <div style="font-weight: 700; font-size: 0.82rem;">${boxM_OriDada}</div>
                        </div>
                        <div style="background: rgba(245, 158, 11, 0.08); padding: 4px; border-radius: 4px;">
                            <div style="font-size: 0.65rem; color: var(--text-muted);">Paha Atas</div>
                            <div style="font-weight: 700; font-size: 0.82rem;">${boxM_OriPahaAtas}</div>
                        </div>
                        <div style="background: rgba(245, 158, 11, 0.08); padding: 4px; border-radius: 4px;">
                            <div style="font-size: 0.65rem; color: var(--text-muted);">Paha Bawah</div>
                            <div style="font-weight: 700; font-size: 0.82rem;">${boxM_OriPahaBawah}</div>
                        </div>
                        <div style="background: rgba(245, 158, 11, 0.08); padding: 4px; border-radius: 4px;">
                            <div style="font-size: 0.65rem; color: var(--text-muted);">Sayap</div>
                            <div style="font-weight: 700; font-size: 0.82rem;">${boxM_OriSayap}</div>
                        </div>
                    </div>
                    <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Paket Ayam Geprek</div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; text-align: center;">
                        <div style="background: rgba(245, 158, 11, 0.08); padding: 4px; border-radius: 4px;">
                            <div style="font-size: 0.65rem; color: var(--text-muted);">Dada</div>
                            <div style="font-weight: 700; font-size: 0.82rem;">${boxM_GeprekDada}</div>
                        </div>
                        <div style="background: rgba(245, 158, 11, 0.08); padding: 4px; border-radius: 4px;">
                            <div style="font-size: 0.65rem; color: var(--text-muted);">Paha Atas</div>
                            <div style="font-weight: 700; font-size: 0.82rem;">${boxM_GeprekPahaAtas}</div>
                        </div>
                        <div style="background: rgba(245, 158, 11, 0.08); padding: 4px; border-radius: 4px;">
                            <div style="font-size: 0.65rem; color: var(--text-muted);">Paha Bawah</div>
                            <div style="font-weight: 700; font-size: 0.82rem;">${boxM_GeprekPahaBawah}</div>
                        </div>
                        <div style="background: rgba(245, 158, 11, 0.08); padding: 4px; border-radius: 4px;">
                            <div style="font-size: 0.65rem; color: var(--text-muted);">Sayap</div>
                            <div style="font-weight: 700; font-size: 0.82rem;">${boxM_GeprekSayap}</div>
                        </div>
                    </div>
                </div>

                <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
                        <span style="font-weight: 700; font-size: 0.85rem; color: #8b5cf6;">Box Ukuran XS (Ayam Geprek Non-Paket)</span>
                        <span style="font-size: 0.72rem; font-weight: 700; color: #8b5cf6;">${countBoxXS} Box Terpakai</span>
                    </div>
                    <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Ayam Geprek</div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; text-align: center;">
                        <div style="background: rgba(139, 92, 246, 0.08); padding: 4px; border-radius: 4px;">
                            <div style="font-size: 0.65rem; color: var(--text-muted);">Dada</div>
                            <div style="font-weight: 700; font-size: 0.82rem;">${boxXS_GeprekDada}</div>
                        </div>
                        <div style="background: rgba(139, 92, 246, 0.08); padding: 4px; border-radius: 4px;">
                            <div style="font-size: 0.65rem; color: var(--text-muted);">Paha Atas</div>
                            <div style="font-weight: 700; font-size: 0.82rem;">${boxXS_GeprekPahaAtas}</div>
                        </div>
                        <div style="background: rgba(139, 92, 246, 0.08); padding: 4px; border-radius: 4px;">
                            <div style="font-size: 0.65rem; color: var(--text-muted);">Paha Bawah</div>
                            <div style="font-weight: 700; font-size: 0.82rem;">${boxXS_GeprekPahaBawah}</div>
                        </div>
                        <div style="background: rgba(139, 92, 246, 0.08); padding: 4px; border-radius: 4px;">
                            <div style="font-size: 0.65rem; color: var(--text-muted);">Sayap</div>
                            <div style="font-weight: 700; font-size: 0.82rem;">${boxXS_GeprekSayap}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    if (typeof window.renderHPPSummaryCard === 'function') {
        window.renderHPPSummaryCard();
    }

    // Render Charts
    // Audit Fix #4: dailyData is already filtered by p_end_date in database.
    // Client-side filtering is no longer needed.
    const dailyData = analyticsResult.daily_revenue || [];

    const revCtx = document.getElementById('revenueChart');
    if(!revCtx) return;

    const { data: costsData } = await supabase
        .from('operational_costs')
        .select('cost_date, total_amount, payment_method')
        .eq('outlet_id', activeOutletId)
        .gte('cost_date', startDate.value)
        .lte('cost_date', endDate.value);
        
    const expensesByDate = {};
    const operationalExpensesByDate = {};
    const operationalCashExpensesByDate = {};
    const stockExpensesByDate = {};
    const allDatesSet = new Set(dailyData.map(d => d.date));
    let totalOperationalExpenseAmt = 0;
    let totalStockExpenseAmt = 0;
    let totalExpenseAmt = 0;
    
    if (costsData) {
        costsData.forEach(c => {
            allDatesSet.add(c.cost_date);
            const amt = Number(c.total_amount) || 0;
            operationalExpensesByDate[c.cost_date] = (operationalExpensesByDate[c.cost_date] || 0) + amt;
            if (!c.payment_method || c.payment_method === 'Tunai') {
                operationalCashExpensesByDate[c.cost_date] = (operationalCashExpensesByDate[c.cost_date] || 0) + amt;
            }
            expensesByDate[c.cost_date] = (expensesByDate[c.cost_date] || 0) + amt;
            totalOperationalExpenseAmt += amt;
            totalExpenseAmt += amt;
        });
    }

    // Include stock addition costs (inventory_postings type = 'in') as separate Stock Expenses
    try {
        const { data: stockInPostings, error: stockInErr } = await supabase
            .from('inventory_postings')
            .select(`
                id,
                posting_date,
                inventory_posting_items (price)
            `)
            .eq('outlet_id', activeOutletId)
            .eq('type', 'in')
            .gte('posting_date', startDate.value)
            .lte('posting_date', endDate.value);

        if (!stockInErr && stockInPostings) {
            stockInPostings.forEach(p => {
                const itemsCost = (p.inventory_posting_items || []).reduce((sum, item) => sum + (Number(item.price) || 0), 0);
                if (itemsCost > 0) {
                    allDatesSet.add(p.posting_date);
                    stockExpensesByDate[p.posting_date] = (stockExpensesByDate[p.posting_date] || 0) + itemsCost;
                    expensesByDate[p.posting_date] = (expensesByDate[p.posting_date] || 0) + itemsCost;
                    totalStockExpenseAmt += itemsCost;
                    totalExpenseAmt += itemsCost;
                }
            });
        }
    } catch (e) {
        console.warn('Could not load stock posting costs for dashboard:', e);
    }

    const dashOpExpenseEl = document.getElementById('dash-operational-expense');
    if (dashOpExpenseEl) dashOpExpenseEl.textContent = `Rp ${totalOperationalExpenseAmt.toLocaleString('id-ID')}`;

    const dashStockExpenseEl = document.getElementById('dash-stock-expense');
    if (dashStockExpenseEl) dashStockExpenseEl.textContent = `Rp ${totalStockExpenseAmt.toLocaleString('id-ID')}`;
    
    const allDates = Array.from(allDatesSet).sort();
    const chartLabels = allDates.map(d => new Date(d).toLocaleDateString('id-ID', {day: 'numeric', month:'short'}));
    
    const revData = allDates.map(d => {
        const found = dailyData.find(x => x.date === d);
        return found ? found.revenue : 0;
    });
    
    const opExpData = allDates.map(d => operationalExpensesByDate[d] || 0);
    const stockExpData = allDates.map(d => stockExpensesByDate[d] || 0);

    // Shared datalabel options (white text for readability)
    const whiteLabelOpts = {
        color: '#ffffff',
        font: { weight: 'bold', size: 11 },
        anchor: 'center',
        align: 'center',
        formatter: (val) => val > 0 ? val.toLocaleString('id-ID') : ''
    };

    if (window.revenueChartInst) window.revenueChartInst.destroy();
    window.revenueChartInst = new Chart(revCtx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [
                {
                    label: 'Pendapatan (Rp)',
                    data: revData,
                    backgroundColor: '#6366f1',
                    borderRadius: 4,
                    datalabels: whiteLabelOpts
                },
                {
                    label: 'Pengeluaran Operasional (Rp)',
                    data: opExpData,
                    backgroundColor: '#ef4444',
                    borderRadius: 4,
                    datalabels: whiteLabelOpts
                },
                {
                    label: 'Pengeluaran Stock (Rp)',
                    data: stockExpData,
                    backgroundColor: '#f59e0b',
                    borderRadius: 4,
                    datalabels: whiteLabelOpts
                }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // ── Chart 2: Omset Bersih vs Setoran ────────────────────────

    const depCtx = document.getElementById('depositComparisonChart');
    if (!depCtx) return;

    // Fetch deposits within date range
    const { data: depositsData } = await supabase
        .from('sales_deposits')
        .select('deposit_date, amount')
        .eq('outlet_id', activeOutletId)
        .gte('deposit_date', startDate.value)
        .lte('deposit_date', endDate.value);

    const depositsByDate = {};
    if (depositsData) {
        depositsData.forEach(d => {
            depositsByDate[d.deposit_date] = (depositsByDate[d.deposit_date] || 0) + Number(d.amount);
        });
    }

    // Fetch raw sales for Cash vs Total revenue calculation
    const { data: salesData } = await supabase
        .from('transactions')
        .select('created_at, total_amount, discount_amount, tax_amount, payment_method, status, mdr_fee_amount')
        .eq('outlet_id', activeOutletId)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .eq('status', 'completed');

    const salesByDate = {};
    if (salesData) {
        salesData.forEach(s => {
            const dateStr = new Date(s.created_at);
            dateStr.setMinutes(dateStr.getMinutes() - dateStr.getTimezoneOffset());
            const localDate = dateStr.toISOString().split('T')[0];
            
            if (!salesByDate[localDate]) {
                salesByDate[localDate] = { count: 0, total: 0, discount: 0, tax: 0, cash: 0, fees: 0, methodNet: {} };
            }
            const amt = Number(s.total_amount) || 0;
            salesByDate[localDate].count += 1;
            salesByDate[localDate].total += amt;
            salesByDate[localDate].discount += Number(s.discount_amount) || 0;
            salesByDate[localDate].tax += Number(s.tax_amount) || 0;
            if (s.payment_method === 'Tunai') {
                salesByDate[localDate].cash += amt;
            }
            
            let methodFee = 0;
            if (s.payment_method !== 'Tunai') {
                if (s.mdr_fee_amount != null) {
                    // Use historical MDR fee recorded at transaction time
                    methodFee = Number(s.mdr_fee_amount);
                } else {
                    // Fallback for old transactions without mdr_fee_amount
                    const activeOutletObj = window.posOutletsList?.find(o => o.id === activeOutletId);
                    if (activeOutletObj && activeOutletObj.mdr_fees && activeOutletObj.mdr_fees[s.payment_method]) {
                        const feeCfg = activeOutletObj.mdr_fees[s.payment_method];
                        if (feeCfg.type === 'percent') {
                            methodFee = amt * (Number(feeCfg.value) / 100);
                        } else if (feeCfg.type === 'fixed') {
                            methodFee = Number(feeCfg.value);
                        }
                    }
                }
            }
            salesByDate[localDate].fees += methodFee;
            
            const netForThisTx = amt - methodFee;
            if (!salesByDate[localDate].methodNet[s.payment_method]) {
                salesByDate[localDate].methodNet[s.payment_method] = 0;
            }
            salesByDate[localDate].methodNet[s.payment_method] += netForThisTx;
            
            // Accumulate method fees globally for later use in table and excel
            window.clientMethodFees = window.clientMethodFees || {};
            window.clientMethodFees[s.payment_method] = (window.clientMethodFees[s.payment_method] || 0) + methodFee;
        });
        
        // Re-render method table with accurate historical fees
        const tbodyMethod = document.querySelector('#dashboard-method-table tbody');
        if (tbodyMethod && window.lastMethodSummary) {
            tbodyMethod.innerHTML = Object.entries(window.lastMethodSummary)
                .sort((a,b) => b[1].total - a[1].total)
                .map(([method, stats]) => {
                    const exactMethodFee = window.clientMethodFees[method] || 0;
                    const netAmount = Math.round(stats.total - exactMethodFee);
                    return `
                    <tr>
                        <td>${window.escapeHtml(method)}</td>
                        <td style="text-align: right;">${stats.count}</td>
                        <td style="text-align: right;">Rp ${stats.total.toLocaleString('id-ID')}</td>
                        <td style="text-align: right; color: #10b981; font-weight: 600;">Rp ${netAmount.toLocaleString('id-ID')}</td>
                    </tr>
                    `;
                }).join('');
        }
    }

    // Merge dates for a unified x-axis
    const compDatesSet = new Set(allDates);
    Object.keys(depositsByDate).forEach(d => compDatesSet.add(d));
    Object.keys(salesByDate).forEach(d => compDatesSet.add(d));
    const compDates = Array.from(compDatesSet).sort();
    const compLabels = compDates.map(d => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));

    // Net Revenue Total = Total Revenue - Total Fees - Expenses (per day)
    const netTotalRevenueData = compDates.map(d => {
        const rev = salesByDate[d] ? salesByDate[d].total : 0;
        const fees = salesByDate[d] ? salesByDate[d].fees : 0;
        const expense = expensesByDate[d] || 0;
        return Math.round(rev - fees - expense);
    });

    // Net Revenue Cash = Cash Revenue - Operational Expenses (Tunai only, per day)
    const netCashRevenueData = compDates.map(d => {
        const cash = salesByDate[d] ? salesByDate[d].cash : 0;
        const expense = operationalCashExpensesByDate[d] || 0;
        return Math.round(cash - expense);
    });

    const depositData = compDates.map(d => depositsByDate[d] || 0);

    // Calculate difference (selisih) per day: Setoran - Omset Bersih Cash
    // If Deposit < Net Cash Revenue -> Negative (Under-deposited, highlighted in red)
    const selisihData = compDates.map((d, i) => Math.round(depositData[i] - netCashRevenueData[i]));

    const baseDatasets = [
        {
            label: 'Omset Bersih Cash (Rp)',
            data: netCashRevenueData,
            backgroundColor: '#3b82f6',
            borderRadius: 4,
            datalabels: { ...whiteLabelOpts }
        }
    ];

    baseDatasets.push(
        {
            label: 'Setoran (Rp)',
            data: depositData,
            backgroundColor: '#8b5cf6',
            borderRadius: 4,
            datalabels: { ...whiteLabelOpts }
        },
        {
            label: 'Selisih (Rp)',
            data: selisihData,
            backgroundColor: selisihData.map(v => v < 0 ? '#ef4444' : '#f59e0b'),
            borderRadius: 4,
            datalabels: { ...whiteLabelOpts }
        }
    );

    if (window.depositCompChartInst) window.depositCompChartInst.destroy();
    window.depositCompChartInst = new Chart(depCtx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: compLabels,
            datasets: baseDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // ── Chart: Omset Bersih Payment Method (Setelah Potongan MDR) ─────
    const methodNetCtx = document.getElementById('methodNetChart');
    if (methodNetCtx) {
        const methodNetDatasets = [];
        const methodColors = {
            'Tunai': '#3b82f6',
            'QRIS': '#0284c7',
            'Bank Transfer': '#7c3aed',
            'Go Food': '#e11d48',
            'Grab Food': '#16a34a',
            'Shopee Food': '#ea580c'
        };
        ALL_PAYMENT_METHODS.filter(m => m !== 'Tunai').forEach(method => {
            const methodData = compDates.map(d => {
                return Math.round(salesByDate[d] && salesByDate[d].methodNet[method] ? salesByDate[d].methodNet[method] : 0);
            });
            if (methodData.some(val => val > 0)) {
                methodNetDatasets.push({
                    label: `Omset Bersih ${method} (Rp)`,
                    data: methodData,
                    backgroundColor: methodColors[method] || '#64748b',
                    borderRadius: 4,
                    datalabels: { ...whiteLabelOpts }
                });
            }
        });

        if (window.methodNetChartInst) window.methodNetChartInst.destroy();
        window.methodNetChartInst = new Chart(methodNetCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: compLabels,
                datasets: methodNetDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    const hourlyCounts = new Array(24).fill(0);
    const hourlyRevenues = new Array(24).fill(0);
    if (salesData) {
        salesData.forEach(s => {
            const dt = new Date(s.created_at);
            const hour = dt.getHours();
            hourlyCounts[hour] += 1;
            hourlyRevenues[hour] += (Number(s.total_amount) || 0);
        });
    }

    // ── Chart: Transaction Peak Hours (00:00 - 23:00) ────────
    const peakCtx = document.getElementById('peakHoursChart');
    if (peakCtx) {
        const hourLabels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

        if (window.peakHoursChartInst) window.peakHoursChartInst.destroy();
        window.peakHoursChartInst = new Chart(peakCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: hourLabels,
                datasets: [{
                    label: 'Jumlah Transaksi',
                    data: hourlyCounts,
                    backgroundColor: '#6366f1',
                    borderRadius: 4,
                    datalabels: {
                        color: '#ffffff',
                        font: { weight: 'bold', size: 10 },
                        formatter: (val) => val > 0 ? val : ''
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: { maxRotation: 45, minRotation: 0 }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            afterLabel: function(context) {
                                const hr = context.dataIndex;
                                const rev = hourlyRevenues[hr] || 0;
                                return `Omzet: Rp ${rev.toLocaleString('id-ID')}`;
                            }
                        }
                    }
                }
            }
        });
    }

    // ── Chart 3: Estimasi Bagi Hasil & Estimasi Laba Bersih ────────

    const profitCtx = document.getElementById('profitSharingChart');
    if (!profitCtx) return;

    // Total Omset Bersih for the selected period
    const totalNetRevenue = netTotalRevenueData.reduce((sum, val) => sum + val, 0);
    const THRESHOLD = 3500000;

    let ownerShare = 0;
    let investorShare = 0;

    if (totalNetRevenue > THRESHOLD) {
        // Tahap 1: Up to Threshold
        ownerShare += THRESHOLD * 0.8;
        investorShare += THRESHOLD * 0.2;
        
        // Tahap 2: Above Threshold
        const remaining = totalNetRevenue - THRESHOLD;
        ownerShare += remaining * 0.75;
        investorShare += remaining * 0.25;
    } else {
        // Tahap 1 only
        ownerShare += totalNetRevenue * 0.8;
        investorShare += totalNetRevenue * 0.2;
    }

    if (window.profitSharingChartInst) window.profitSharingChartInst.destroy();
    window.profitSharingChartInst = new Chart(profitCtx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Bisnis Owner', 'Investor'],
            datasets: [{
                data: [Math.round(ownerShare), Math.round(investorShare)],
                backgroundColor: ['#3b82f6', '#f59e0b'],
                borderWidth: 0,
                datalabels: {
                    color: '#ffffff',
                    font: { weight: 'bold', size: 12 },
                    formatter: (val, ctx) => {
                        const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                        if (total === 0) return '';
                        const percentage = Math.round((val / total) * 100) + '%';
                        return `Rp ${val.toLocaleString('id-ID')}\n(${percentage})`;
                    },
                    align: 'center'
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: 'var(--text-main)' }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` ${context.label}: Rp ${context.raw.toLocaleString('id-ID')}`;
                        }
                    }
                }
            }
        }
    });

    const totalGrossRevenue = Object.values(salesByDate).reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    const totalFeesMDR = Object.values(salesByDate).reduce((sum, item) => sum + (Number(item.fees) || 0), 0);
    const totalOpExp = Object.values(operationalExpensesByDate).reduce((sum, val) => sum + Number(val || 0), 0);
    const totalStockExp = Object.values(stockExpensesByDate).reduce((sum, val) => sum + Number(val || 0), 0);
    const totalNetProfit = Math.round(totalGrossRevenue - totalFeesMDR - totalOpExp - totalStockExp);

    // Render Estimasi Laba Bersih Card
    const netProfitCard = document.getElementById('net-profit-card');
    if (netProfitCard) {
        netProfitCard.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px; height: 100%; justify-content: center;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border); padding-bottom: 8px;">
                    <span style="color: var(--text-secondary); font-size: 0.95rem;">Total Pendapatan Kotor</span>
                    <span style="font-weight: 600; color: var(--text-main);">Rp ${totalGrossRevenue.toLocaleString('id-ID')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border); padding-bottom: 8px;">
                    <span style="color: var(--text-secondary); font-size: 0.95rem;">Potongan MDR / Fee</span>
                    <span style="font-weight: 600; color: var(--danger);">- Rp ${totalFeesMDR.toLocaleString('id-ID')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border); padding-bottom: 8px;">
                    <span style="color: var(--text-secondary); font-size: 0.95rem;">Pengeluaran Operasional</span>
                    <span style="font-weight: 600; color: var(--danger);">- Rp ${totalOpExp.toLocaleString('id-ID')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border); padding-bottom: 8px;">
                    <span style="color: var(--text-secondary); font-size: 0.95rem;">Pengeluaran Stock</span>
                    <span style="font-weight: 600; color: #f59e0b;">- Rp ${totalStockExp.toLocaleString('id-ID')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981; padding: 10px 12px; border-radius: 6px; margin-top: 4px;">
                    <div>
                        <div style="font-weight: 700; color: #10b981; font-size: 1.05rem;">ESTIMASI LABA BERSIH</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Omset Bersih sebelum Bagi Hasil</div>
                    </div>
                    <div style="font-size: 1.35rem; font-weight: 800; color: #10b981;">Rp ${totalNetProfit.toLocaleString('id-ID')}</div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px;">
                    <div style="background: rgba(59, 130, 246, 0.1); padding: 8px 10px; border-radius: 6px; text-align: center;">
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Bisnis Owner</div>
                        <div style="font-weight: 700; color: #3b82f6; font-size: 0.95rem;">Rp ${Math.round(ownerShare).toLocaleString('id-ID')}</div>
                    </div>
                    <div style="background: rgba(245, 158, 11, 0.1); padding: 8px 10px; border-radius: 6px; text-align: center;">
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Investor</div>
                        <div style="font-weight: 700; color: #f59e0b; font-size: 0.95rem;">Rp ${Math.round(investorShare).toLocaleString('id-ID')}</div>
                    </div>
                </div>
            </div>
        `;
    }

    window._lastDashboardData = {
        startDate: startDate.value,
        endDate: endDate.value,
        compDates: compDates,
        salesByDate: salesByDate,
        expensesByDate: expensesByDate,
        operationalExpensesByDate: operationalExpensesByDate,
        operationalCashExpensesByDate: operationalCashExpensesByDate,
        stockExpensesByDate: stockExpensesByDate,
        netTotalRevenueData: netTotalRevenueData,
        netCashRevenueData: netCashRevenueData,
        depositData: depositData,
        selisihData: selisihData,
        depositsByDate: depositsByDate,
        ALL_PAYMENT_METHODS: ALL_PAYMENT_METHODS,
        summaryCards: {
            totalRevenue: totalGrossRevenue,
            totalTrx,
            totalDiscount,
            totalTax,
            totalVoidAmt,
            totalVoidTrx,
            totalOpExp,
            totalStockExp,
            totalFeesMDR,
            totalNetProfit,
            ownerShare: Math.round(ownerShare),
            investorShare: Math.round(investorShare)
        },
        methodSummary: methodSummary,
        productData: productData,
        chickenBagStats: {
            countDada, countPahaAtas, countPahaBawah, countSayap, countLainnya,
            reqDada, reqPahaAtas, reqPahaBawah, reqSayap,
            totalBagsOpened,
            sisaDada, sisaPahaAtas, sisaPahaBawah, sisaSayap,
            totalPieces
        },
        packagingBoxStats: {
            boxM_OriDada, boxM_OriPahaAtas, boxM_OriPahaBawah, boxM_OriSayap,
            boxM_GeprekDada, boxM_GeprekPahaAtas, boxM_GeprekPahaBawah, boxM_GeprekSayap,
            boxXS_GeprekDada, boxXS_GeprekPahaAtas, boxXS_GeprekPahaBawah, boxXS_GeprekSayap,
            countBoxM, countBoxXS
        },
        hourlyCounts: hourlyCounts,
        hourlyRevenues: hourlyRevenues
    };
};

// ── MDR Settings Modal Logic ────────────────────────────────────────

const btnOpenMdr = document.getElementById('btn-open-mdr-settings');
const modalMdr = document.getElementById('modal-mdr');
const formMdr = document.getElementById('form-mdr-settings');
const mdrContainer = document.getElementById('mdr-fields-container');

if (btnOpenMdr) {
    btnOpenMdr.addEventListener('click', () => {
        const activeOutletObj = window.posOutletsList?.find(o => o.id === window.activeOutletId);
        if (!activeOutletObj) return window.showToast('Pilih outlet terlebih dahulu', 'error');

        const currentFees = activeOutletObj.mdr_fees || {};
        
        // Exclude Tunai
        const paymentMethods = window.ALL_PAYMENT_METHODS?.filter(m => m !== 'Tunai') || ['QRIS', 'Bank Transfer', 'Go Food', 'Grab Food', 'Shopee Food'];
        
        mdrContainer.innerHTML = paymentMethods.map(method => {
            const fee = currentFees[method] || { type: 'percent', value: 0 };
            return `
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
                    <label style="font-weight: 600; width: 110px; flex-shrink: 0; margin: 0; font-size: 0.9rem;">${method}</label>
                    <select class="input mdr-type" data-method="${method}" style="flex: 1; padding: 6px; font-size: 0.85rem;">
                        <option value="percent" ${fee.type === 'percent' ? 'selected' : ''}>%</option>
                        <option value="fixed" ${fee.type === 'fixed' ? 'selected' : ''}>Rp</option>
                    </select>
                    <input type="number" class="input mdr-value" data-method="${method}" value="${fee.value}" step="any" min="0" style="flex: 2; padding: 6px; font-size: 0.9rem;" placeholder="0">
                </div>
            `;
        }).join('');

        modalMdr.classList.remove('hidden');
    });
}

if (formMdr) {
    formMdr.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newFees = {};
        const types = formMdr.querySelectorAll('.mdr-type');
        const values = formMdr.querySelectorAll('.mdr-value');
        
        for (let i = 0; i < types.length; i++) {
            const method = types[i].dataset.method;
            const type = types[i].value;
            const value = Number(values[i].value) || 0;
            
            if (value > 0) {
                newFees[method] = { type, value };
            }
        }

        try {
            const { error } = await supabase.from('outlets').update({ mdr_fees: newFees }).eq('id', window.activeOutletId);
            if (error) throw error;
            
            window.showToast('Pengaturan potongan MDR berhasil disimpan', 'success');
            modalMdr.classList.add('hidden');
            
            // Update local object
            const activeOutletObj = window.posOutletsList?.find(o => o.id === window.activeOutletId);
            if (activeOutletObj) activeOutletObj.mdr_fees = newFees;
            
            // Reload dashboard to apply
            window.loadDashboard();
        } catch (err) {
            console.error(err);
            window.showToast('Gagal menyimpan: ' + err.message, 'error');
        }
    });
}

// ── Export Dashboard Excel (2 Sheet) ──────────────────────────────────

window.exportDashboardExcel = async function() {
    if (!window._lastDashboardData && typeof window.loadDashboard === 'function') {
        await window.loadDashboard();
    }
    if (!window._lastDashboardData) {
        return window.showToast('Silakan muat data dashboard terlebih dahulu', 'error');
    }
    const {
        startDate,
        endDate,
        compDates = [],
        salesByDate = {},
        expensesByDate = {},
        operationalExpensesByDate = {},
        operationalCashExpensesByDate = {},
        stockExpensesByDate = {},
        netCashRevenueData = [],
        depositData = [],
        selisihData = [],
        ALL_PAYMENT_METHODS = ['Tunai', 'QRIS', 'Bank Transfer', 'Go Food', 'Grab Food', 'Shopee Food'],
        summaryCards = {},
        methodSummary = {},
        productData = [],
        chickenBagStats = {},
        packagingBoxStats = {},
        hourlyCounts = [],
        hourlyRevenues = []
    } = window._lastDashboardData;

    if (!window.XLSX) {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = './assets/lib/xlsx.full.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    if (!window.XLSX) {
        return window.showToast('Library XLSX gagal dimuat', 'error');
    }

    const applyRpFormat = (ws, colLetters, skipRowIndices = []) => {
        for (let cell in ws) {
            if (cell[0] === '!') continue;
            const col = cell.replace(/[0-9]/g, '');
            const row = parseInt(cell.replace(/\D/g, ''), 10);
            if (colLetters.includes(col) && row > 1 && !skipRowIndices.includes(row)) {
                ws[cell].z = '"Rp "#,##0;-"Rp "#,##0;"Rp "0';
            }
        }
    };

    // Sheet 1: Ringkasan Total & Laba (Summary Cards + Estimasi Laba Bersih & Bagi Hasil)
    const sheet1Rows = [
        { "Keterangan": "Total Pendapatan Kotor", "Nilai": Number(summaryCards.totalRevenue || 0) },
        { "Keterangan": "Total Transaksi", "Nilai": Number(summaryCards.totalTrx || 0) },
        { "Keterangan": "Total Diskon", "Nilai": Number(summaryCards.totalDiscount || 0) },
        { "Keterangan": "Total Pajak", "Nilai": Number(summaryCards.totalTax || 0) },
        { "Keterangan": "Total Batal (Rp)", "Nilai": Number(summaryCards.totalVoidAmt || 0) },
        { "Keterangan": "Jumlah Transaksi Batal", "Nilai": Number(summaryCards.totalVoidTrx || 0) },
        { "Keterangan": "Potongan MDR / Fee", "Nilai": Number(summaryCards.totalFeesMDR || 0) },
        { "Keterangan": "Pengeluaran Operasional", "Nilai": Number(summaryCards.totalOpExp || 0) },
        { "Keterangan": "Pengeluaran Stock", "Nilai": Number(summaryCards.totalStockExp || 0) },
        { "Keterangan": "ESTIMASI LABA BERSIH", "Nilai": Number(summaryCards.totalNetProfit || 0) },
        { "Keterangan": "Bagi Hasil - Bisnis Owner", "Nilai": Number(summaryCards.ownerShare || 0) },
        { "Keterangan": "Bagi Hasil - Investor", "Nilai": Number(summaryCards.investorShare || 0) }
    ];

    // Sheet 2: Arus Kas & Setoran (Omset Bersih Tunai vs Setoran chart per day)
    const sheet2Rows = [];
    let totCashRev2 = 0, totOpCashExp2 = 0, totNetCash2 = 0, totDeposit2 = 0, totSelisih2 = 0;
    compDates.forEach((d, i) => {
        const cashRev = salesByDate[d] ? Number(salesByDate[d].cash || 0) : 0;
        const opCashExp = Number(operationalCashExpensesByDate[d] || 0);
        const netCash = Number(netCashRevenueData[i] || 0);
        const dep = Number(depositData[i] || 0);
        const selisih = Number(selisihData[i] || 0);

        totCashRev2 += cashRev;
        totOpCashExp2 += opCashExp;
        totNetCash2 += netCash;
        totDeposit2 += dep;
        totSelisih2 += selisih;

        let status = "Sesuai";
        if (selisih < 0) status = "Kurang Setor";
        else if (selisih > 0) status = "Lebih Setor";

        sheet2Rows.push({
            "Tanggal": d,
            "Pendapatan Tunai (Rp)": cashRev,
            "Pengeluaran Operasional Tunai (Rp)": opCashExp,
            "Omset Bersih Cash (Rp)": netCash,
            "Setoran Kasir (Rp)": dep,
            "Selisih (Setoran - Omset Bersih) (Rp)": selisih,
            "Status": status
        });
    });
    let statusTot2 = "Sesuai";
    if (totSelisih2 < 0) statusTot2 = "Kurang Setor";
    else if (totSelisih2 > 0) statusTot2 = "Lebih Setor";
    sheet2Rows.push({
        "Tanggal": "TOTAL",
        "Pendapatan Tunai (Rp)": totCashRev2,
        "Pengeluaran Operasional Tunai (Rp)": totOpCashExp2,
        "Omset Bersih Cash (Rp)": totNetCash2,
        "Setoran Kasir (Rp)": totDeposit2,
        "Selisih (Setoran - Omset Bersih) (Rp)": totSelisih2,
        "Status": statusTot2
    });

    // Sheet 3: Pendapatan & Pengeluaran (Daily breakdown of Revenue vs Expenses chart & cards)
    const sheet3Rows = [];
    let totTrx3 = 0, totGross3 = 0, totDisc3 = 0, totTax3 = 0, totVoidAmt3 = 0, totOpExp3 = 0, totStockExp3 = 0, totExp3 = 0, totNet3 = 0;
    compDates.forEach(d => {
        const s = salesByDate[d] || {};
        const trx = Number(s.count || 0);
        const gross = Number(s.total || 0);
        const disc = Number(s.discount || 0);
        const tax = Number(s.tax || 0);
        const voidAmt = Number(s.voidAmount || 0);
        const opExp = Number(operationalExpensesByDate[d] || 0);
        const stockExp = Number(stockExpensesByDate[d] || 0);
        const exp = Number(expensesByDate[d] || 0);
        const net = gross - exp;

        totTrx3 += trx;
        totGross3 += gross;
        totDisc3 += disc;
        totTax3 += tax;
        totVoidAmt3 += voidAmt;
        totOpExp3 += opExp;
        totStockExp3 += stockExp;
        totExp3 += exp;
        totNet3 += net;

        sheet3Rows.push({
            "Tanggal": d,
            "Jumlah Transaksi": trx,
            "Pendapatan Kotor (Rp)": gross,
            "Diskon (Rp)": disc,
            "Pajak (Rp)": tax,
            "Batal / Void (Rp)": voidAmt,
            "Pengeluaran Operasional (Rp)": opExp,
            "Pengeluaran Stock (Rp)": stockExp,
            "Total Pengeluaran (Rp)": exp,
            "Net (Pendapatan - Total Pengeluaran) (Rp)": net
        });
    });
    sheet3Rows.push({
        "Tanggal": "TOTAL",
        "Jumlah Transaksi": totTrx3,
        "Pendapatan Kotor (Rp)": totGross3,
        "Diskon (Rp)": totDisc3,
        "Pajak (Rp)": totTax3,
        "Batal / Void (Rp)": totVoidAmt3,
        "Pengeluaran Operasional (Rp)": totOpExp3,
        "Pengeluaran Stock (Rp)": totStockExp3,
        "Total Pengeluaran (Rp)": totExp3,
        "Net (Pendapatan - Total Pengeluaran) (Rp)": totNet3
    });

    // Sheet 4: Metode Pembayaran (Table #dashboard-method-table)
    const sheet4Rows = [];
    let totMethodCount = 0, totMethodGross = 0, totMethodFee = 0, totMethodNet = 0;

    Object.entries(methodSummary)
        .sort((a, b) => b[1].total - a[1].total)
        .forEach(([method, stats]) => {
            const methodFee = window.clientMethodFees ? (window.clientMethodFees[method] || 0) : 0;
            const netAmount = Math.round(stats.total - methodFee);

            totMethodCount += Number(stats.count || 0);
            totMethodGross += Number(stats.total || 0);
            totMethodFee += Math.round(methodFee);
            totMethodNet += netAmount;

            sheet4Rows.push({
                "Metode Pembayaran": method,
                "Jumlah Transaksi (Trx)": Number(stats.count || 0),
                "Omset Kotor (Rp)": Number(stats.total || 0),
                "Potongan MDR / Fee (Rp)": Math.round(methodFee),
                "Omset Bersih (Rp)": netAmount
            });
        });

    sheet4Rows.push({
        "Metode Pembayaran": "TOTAL",
        "Jumlah Transaksi (Trx)": totMethodCount,
        "Omset Kotor (Rp)": totMethodGross,
        "Potongan MDR / Fee (Rp)": totMethodFee,
        "Omset Bersih (Rp)": totMethodNet
    });

    // Sheet 5: Omset Bersih Per Metode (Daily breakdown of #methodNetChart)
    const sheet5Rows = [];
    const methodTotals5 = {};
    ALL_PAYMENT_METHODS.forEach(m => methodTotals5[m] = 0);
    let totalAllMethodsSum5 = 0;

    compDates.forEach(d => {
        const row = { "Tanggal": d };
        let daySum = 0;
        ALL_PAYMENT_METHODS.forEach(m => {
            const val = salesByDate[d] && salesByDate[d].methodNet && salesByDate[d].methodNet[m] ? Math.round(salesByDate[d].methodNet[m]) : 0;
            row[`Omset Bersih ${m} (Rp)`] = val;
            methodTotals5[m] += val;
            daySum += val;
        });
        row["Total Omset Bersih Hari Ini (Rp)"] = daySum;
        totalAllMethodsSum5 += daySum;
        sheet5Rows.push(row);
    });

    const totalRow5 = { "Tanggal": "TOTAL" };
    ALL_PAYMENT_METHODS.forEach(m => {
        totalRow5[`Omset Bersih ${m} (Rp)`] = methodTotals5[m];
    });
    totalRow5["Total Omset Bersih Hari Ini (Rp)"] = totalAllMethodsSum5;
    sheet5Rows.push(totalRow5);

    // Sheet 6: Produk Terjual (Table #dashboard-product-table)
    const sheet6Rows = [];
    let totProdQty = 0, totProdRev = 0;
    productData.forEach(p => {
        const qty = Number(p.qty || 0);
        const rev = Number(p.revenue || 0);
        totProdQty += qty;
        totProdRev += rev;
        sheet6Rows.push({
            "Nama Produk": p.name || "-",
            "Qty Terjual": qty,
            "Total Omset (Rp)": rev
        });
    });
    sheet6Rows.push({
        "Nama Produk": "TOTAL",
        "Qty Terjual": totProdQty,
        "Total Omset (Rp)": totProdRev
    });

    // Sheet 7: Estimasi Kantong Ayam (Card #chicken-bag-card)
    const sheet7Rows = [
        {
            "Bagian Ayam": "Dada",
            "Qty Terjual (Potong)": chickenBagStats.countDada || 0,
            "Kapasitas / Kantong": "3 Potong / Kantong",
            "Kebutuhan Kantong": chickenBagStats.reqDada || 0,
            "Estimasi Sisa Potong": chickenBagStats.sisaDada || 0
        },
        {
            "Bagian Ayam": "Paha Atas",
            "Qty Terjual (Potong)": chickenBagStats.countPahaAtas || 0,
            "Kapasitas / Kantong": "2 Potong / Kantong",
            "Kebutuhan Kantong": chickenBagStats.reqPahaAtas || 0,
            "Estimasi Sisa Potong": chickenBagStats.sisaPahaAtas || 0
        },
        {
            "Bagian Ayam": "Paha Bawah",
            "Qty Terjual (Potong)": chickenBagStats.countPahaBawah || 0,
            "Kapasitas / Kantong": "2 Potong / Kantong",
            "Kebutuhan Kantong": chickenBagStats.reqPahaBawah || 0,
            "Estimasi Sisa Potong": chickenBagStats.sisaPahaBawah || 0
        },
        {
            "Bagian Ayam": "Sayap",
            "Qty Terjual (Potong)": chickenBagStats.countSayap || 0,
            "Kapasitas / Kantong": "2 Potong / Kantong",
            "Kebutuhan Kantong": chickenBagStats.reqSayap || 0,
            "Estimasi Sisa Potong": chickenBagStats.sisaSayap || 0
        },
        {
            "Bagian Ayam": "Lainnya (Ayam Non-Spesifik)",
            "Qty Terjual (Potong)": chickenBagStats.countLainnya || 0,
            "Kapasitas / Kantong": "-",
            "Kebutuhan Kantong": 0,
            "Estimasi Sisa Potong": 0
        },
        {
            "Bagian Ayam": "TOTAL POTONG AYAM",
            "Qty Terjual (Potong)": chickenBagStats.totalPieces || 0,
            "Kapasitas / Kantong": "TOTAL KANTONG DIBUKA",
            "Kebutuhan Kantong": chickenBagStats.totalBagsOpened || 0,
            "Estimasi Sisa Potong": "-"
        }
    ];

    // Sheet 8: Estimasi Packaging Box (Card #packaging-box-card)
    const sheet8Rows = [
        { "Kategori Box": "Box Ukuran M (Paket Original)", "Bagian Ayam": "Dada", "Qty Box Terpakai": packagingBoxStats.boxM_OriDada || 0 },
        { "Kategori Box": "Box Ukuran M (Paket Original)", "Bagian Ayam": "Paha Atas", "Qty Box Terpakai": packagingBoxStats.boxM_OriPahaAtas || 0 },
        { "Kategori Box": "Box Ukuran M (Paket Original)", "Bagian Ayam": "Paha Bawah", "Qty Box Terpakai": packagingBoxStats.boxM_OriPahaBawah || 0 },
        { "Kategori Box": "Box Ukuran M (Paket Original)", "Bagian Ayam": "Sayap", "Qty Box Terpakai": packagingBoxStats.boxM_OriSayap || 0 },
        { "Kategori Box": "TOTAL BOX UKURAN M (ORIGINAL)", "Bagian Ayam": "-", "Qty Box Terpakai": (packagingBoxStats.boxM_OriDada||0)+(packagingBoxStats.boxM_OriPahaAtas||0)+(packagingBoxStats.boxM_OriPahaBawah||0)+(packagingBoxStats.boxM_OriSayap||0) },
        { "Kategori Box": "Box Ukuran M (Paket Geprek)", "Bagian Ayam": "Dada", "Qty Box Terpakai": packagingBoxStats.boxM_GeprekDada || 0 },
        { "Kategori Box": "Box Ukuran M (Paket Geprek)", "Bagian Ayam": "Paha Atas", "Qty Box Terpakai": packagingBoxStats.boxM_GeprekPahaAtas || 0 },
        { "Kategori Box": "Box Ukuran M (Paket Geprek)", "Bagian Ayam": "Paha Bawah", "Qty Box Terpakai": packagingBoxStats.boxM_GeprekPahaBawah || 0 },
        { "Kategori Box": "Box Ukuran M (Paket Geprek)", "Bagian Ayam": "Sayap", "Qty Box Terpakai": packagingBoxStats.boxM_GeprekSayap || 0 },
        { "Kategori Box": "TOTAL BOX UKURAN M (GEPREK)", "Bagian Ayam": "-", "Qty Box Terpakai": (packagingBoxStats.boxM_GeprekDada||0)+(packagingBoxStats.boxM_GeprekPahaAtas||0)+(packagingBoxStats.boxM_GeprekPahaBawah||0)+(packagingBoxStats.boxM_GeprekSayap||0) },
        { "Kategori Box": "TOTAL KESELURUHAN BOX UKURAN M", "Bagian Ayam": "Paket Ori + Geprek", "Qty Box Terpakai": packagingBoxStats.countBoxM || 0 },
        { "Kategori Box": "Box Ukuran XS (Geprek Satuan)", "Bagian Ayam": "Dada", "Qty Box Terpakai": packagingBoxStats.boxXS_GeprekDada || 0 },
        { "Kategori Box": "Box Ukuran XS (Geprek Satuan)", "Bagian Ayam": "Paha Atas", "Qty Box Terpakai": packagingBoxStats.boxXS_GeprekPahaAtas || 0 },
        { "Kategori Box": "Box Ukuran XS (Geprek Satuan)", "Bagian Ayam": "Paha Bawah", "Qty Box Terpakai": packagingBoxStats.boxXS_GeprekPahaBawah || 0 },
        { "Kategori Box": "Box Ukuran XS (Geprek Satuan)", "Bagian Ayam": "Sayap", "Qty Box Terpakai": packagingBoxStats.boxXS_GeprekSayap || 0 },
        { "Kategori Box": "TOTAL BOX UKURAN XS (GEPREK SATUAN)", "Bagian Ayam": "Geprek Satuan", "Qty Box Terpakai": packagingBoxStats.countBoxXS || 0 }
    ];

    // Sheet 9: Jam Sibuk (Chart #peakHoursChart)
    const sheet9Rows = [];
    let totHCount = 0, totHRev = 0;
    for (let i = 0; i < 24; i++) {
        const hourLabel = `${String(i).padStart(2, '0')}:00 - ${String(i).padStart(2, '0')}:59`;
        const c = Number(hourlyCounts[i] || 0);
        const r = Number(hourlyRevenues[i] || 0);
        totHCount += c;
        totHRev += r;
        sheet9Rows.push({
            "Jam / Waktu": hourLabel,
            "Jumlah Transaksi": c,
            "Omset / Pendapatan (Rp)": r
        });
    }
    sheet9Rows.push({
        "Jam / Waktu": "TOTAL",
        "Jumlah Transaksi": totHCount,
        "Omset / Pendapatan (Rp)": totHRev
    });

    // Create Worksheets
    const ws1 = window.XLSX.utils.json_to_sheet(sheet1Rows);
    const ws2 = window.XLSX.utils.json_to_sheet(sheet2Rows);
    const ws3 = window.XLSX.utils.json_to_sheet(sheet3Rows);
    const ws4 = window.XLSX.utils.json_to_sheet(sheet4Rows);
    const ws5 = window.XLSX.utils.json_to_sheet(sheet5Rows);
    const ws6 = window.XLSX.utils.json_to_sheet(sheet6Rows);
    const ws7 = window.XLSX.utils.json_to_sheet(sheet7Rows);
    const ws8 = window.XLSX.utils.json_to_sheet(sheet8Rows);
    const ws9 = window.XLSX.utils.json_to_sheet(sheet9Rows);

    // Apply currency formatting
    applyRpFormat(ws1, ['B'], [2, 6]); // row 1 is header, row 2 is Total Transaksi, row 6 is Jumlah Transaksi Batal
    applyRpFormat(ws2, ['B', 'C', 'D', 'E', 'F']);
    applyRpFormat(ws3, ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
    applyRpFormat(ws4, ['C', 'D', 'E']);
    applyRpFormat(ws5, ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
    applyRpFormat(ws6, ['C']);
    applyRpFormat(ws9, ['C']);

    // Column widths
    ws1['!cols'] = [{ wch: 30 }, { wch: 24 }];
    ws2['!cols'] = [{ wch: 15 }, { wch: 24 }, { wch: 32 }, { wch: 24 }, { wch: 20 }, { wch: 35 }, { wch: 18 }];
    ws3['!cols'] = [{ wch: 15 }, { wch: 18 }, { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 26 }, { wch: 24 }, { wch: 24 }, { wch: 36 }];
    ws4['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 24 }, { wch: 24 }, { wch: 24 }];
    const ws5Cols = [{ wch: 15 }];
    for (let i = 0; i <= ALL_PAYMENT_METHODS.length; i++) {
        ws5Cols.push({ wch: 28 });
    }
    ws5['!cols'] = ws5Cols;
    ws6['!cols'] = [{ wch: 35 }, { wch: 18 }, { wch: 24 }];
    ws7['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 25 }, { wch: 22 }, { wch: 22 }];
    ws8['!cols'] = [{ wch: 34 }, { wch: 20 }, { wch: 20 }];
    ws9['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 26 }];

    // Create Workbook
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws1, "Ringkasan Total & Laba");
    window.XLSX.utils.book_append_sheet(wb, ws2, "Arus Kas & Setoran");
    window.XLSX.utils.book_append_sheet(wb, ws3, "Pendapatan & Pengeluaran");
    window.XLSX.utils.book_append_sheet(wb, ws4, "Metode Pembayaran");
    window.XLSX.utils.book_append_sheet(wb, ws5, "Omset Bersih Per Metode");
    window.XLSX.utils.book_append_sheet(wb, ws6, "Produk Terjual");
    window.XLSX.utils.book_append_sheet(wb, ws7, "Estimasi Kantong Ayam");
    window.XLSX.utils.book_append_sheet(wb, ws8, "Estimasi Packaging Box");
    window.XLSX.utils.book_append_sheet(wb, ws9, "Jam Sibuk (Peak Hours)");

    const filenameDate = startDate === endDate ? startDate : `${startDate}_sd_${endDate}`;
    window.XLSX.writeFile(wb, `Laporan_Dashboard_${filenameDate}.xlsx`);
    if (typeof window.showToast === 'function') window.showToast('Laporan Excel berhasil diunduh (9 Sheet Lengkap)', 'success');
};

function bindDashboardButtons() {
    const btnExportExcel = document.getElementById('btn-export-dashboard-excel');
    if (btnExportExcel) {
        btnExportExcel.onclick = () => {
            if (typeof window.exportDashboardExcel === 'function') {
                window.exportDashboardExcel();
            }
        };
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindDashboardButtons);
} else {
    bindDashboardButtons();
}

