export const config = { runtime: "nodejs" };
import { JSDOM } from "jsdom";

const REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Referer': 'https://www.google.com/',
    'Cache-Control': 'no-cache'
};

const fetchWithTimeout = async (url, ms = 15000) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    try {
        const response = await fetch(url, { headers: REQUEST_HEADERS, signal: controller.signal });
        return response.ok ? await response.text() : "";
    } catch (e) { return ""; }
    finally { clearTimeout(timeout); }
};

// Helper: Extract date via RegEx to save RAM (Avoids JSDOM for simple strings)
const extractDateStealth = (html, regex) => {
    if (!html) return null;
    const match = html.match(regex);
    return match ? formatGaleriDate(match[1]) : null;
};

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        // Parallel Fetching: The "Mio Smile" Throttle Approach
        const [
            galeriHTML, bullionHTML, emasKitaHTML, sampoernaHTML, 
            lotusHTML, kingHalimHTML, ubsFixedData, ubsDynamicData
        ] = await Promise.all([
            fetchWithTimeout("https://galeri24.co.id/harga-emas"),
            fetchWithTimeout("https://idbullion.com/"),
            fetchWithTimeout("https://emaskita.id/Harga_emas"),
            fetchWithTimeout("https://sampoernagold.com/"),
            fetchWithTimeout("https://lotusarchi.com/pricing/"),
            fetchWithTimeout("https://www.kinghalim.com/goldbarwithamala"),
            fetchUBSFixed(),
            fetchUBS()
        ]);

        const rawData = [
            ...parseGaleri24(galeriHTML),
            ...parseBullion(bullionHTML, sampoernaHTML, lotusHTML),
            ...parseEmasKita(emasKitaHTML),
            ...parseKingHalim(kingHalimHTML),
            ...parseUBSLifestyle(ubsDynamicData), // Dynamic grid first
            ...parseUBSLifestyleFixed(ubsFixedData) // Fixed links overwrite/fill gaps
        ];

        // Efficiency: Unified Filter & Deduplication
        const uniqueMap = new Map();
        rawData.forEach(item => {
            const valJual = parseFloat(item.jual);
            const valGram = parseFloat(item.gram);
            
            // Skip invalid data or UBS 0.05g
            if (!valGram || !valJual || valJual === 0) return;
            if (item.category === "UBS" && valGram === 0.05) return;

            // Map keys by Code. Since Fixed UBS is added LAST, 
            // it will be the final authority if an item is out of stock in dynamic.
            uniqueMap.set(item.code, item);
        });

        const data = Array.from(uniqueMap.values()).sort((a, b) => {
            const brandA = a.category.toUpperCase();
            const brandB = b.category.toUpperCase();
            if (brandA !== brandB) return brandA.localeCompare(brandB);
            return parseFloat(a.jual) - parseFloat(b.jual);
        });

        res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(200).json({ success: true, timestamp: new Date().toISOString(), data });

    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
}

/* --- OPTIMIZED PARSERS --- */

function parseBullion(bullionHtml, sampoernaHtml, lotusHtml) {
    if (!bullionHtml) return [];
    const dom = new JSDOM(bullionHtml);
    const doc = dom.window.document;
    
    // RegEx bypass for dates to save memory
    const sUpdate = extractDateStealth(sampoernaHtml, /class="small-text"[^>]*>([^<]+)/i);
    const lUpdate = extractDateStealth(lotusHtml, /<h4>([^|]+)\|\|/i);

    const data = [];
    ["modalAntam", "modalLotus", "modalSampoerna"].forEach(id => {
        const cat = id.replace("modal", "").toUpperCase();
        const update = id === "modalLotus" ? lUpdate : (id === "modalSampoerna" ? sUpdate : "");
        const tbl = doc.getElementById(id);
        if (!tbl) return;

        tbl.querySelectorAll("table tr").forEach(row => {
            const cols = row.querySelectorAll("td");
            if (cols.length >= 2) {
                const g = cols[0].textContent.replace(/[^\d.]/g, "").replace(/^0([125])/, "0.$1");
                data.push({
                    code: cat + g.replace(".",""),
                    category: cat,
                    gram: g,
                    jual: cols[1].textContent.replace(/[^\d]/g, ""),
                    buyback: cols[2]?.textContent.replace(/[^\d]/g, "") || "0",
                    last_update: update
                });
            }
        });
    });
    dom.window.close();
    return data;
}

function parseKingHalim(html) {
    if (!html) return [];
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const result = [];

    const updateText = doc.querySelector('.kv-ee-section-subtitle')?.textContent || "";
    const formattedUpdate = formatGaleriDate(updateText);
    const buyBackText = doc.querySelector('.kv-ee-description')?.textContent || "";
    const baseBuyback = parseFloat(buyBackText.split('.')[0].replace(/[^\d]/g, "")) || 0;

    doc.querySelectorAll('.kv-ee-item').forEach(item => {
        const title = item.querySelector('.kv-ee-title')?.textContent || "";
        const price = item.querySelector('.kv-ee-price')?.textContent || "";
        
        const g = title.toLowerCase().replace(/[^\d,.]/g, "").replace(",", ".");
        const p = price.split('.')[0].replace(/[^\d]/g, "");

        if (g && p) {
            result.push({
                code: "KINGHALIM" + g.replace(".", ""),
                category: "KING HALIM",
                gram: g,
                jual: p,
                buyback: Math.floor(baseBuyback * parseFloat(g)),
                last_update: formattedUpdate
            });
        }
    });
    dom.window.close();
    return result;
}

/* --- UBS HYBRID SYSTEM --- */

async function fetchUBSFixed() {
    const urls = {
        "0.5": "https://ubslifestyle.com/fine-gold-0.5gram/",
        "1": "https://ubslifestyle.com/fine-gold-1gram/",
        "2": "https://ubslifestyle.com/ubs-gold-logam-mulia-new-born-baby-girl-2-gr/",
        "3": "https://ubslifestyle.com/ubs-gold-logam-mulia-new-born-baby-boy-3-gr/",
        "5": "https://ubslifestyle.com/fine-gold-disney-5-gr-donald-duck/",
        "10": "https://ubslifestyle.com/fine-gold-10gram/",
        "25": "https://ubslifestyle.com/ubs-logam-mulia-25-gram-classic/",
        "50": "https://ubslifestyle.com/ubs-logam-mulia-50-gram-classic/",
        "buyback": "https://ubslifestyle.com/harga-buyback-hari-ini/"
    };
    const keys = Object.keys(urls);
    const htmls = await Promise.all(keys.map(k => fetchWithTimeout(urls[k])));
    const results = {};
    keys.forEach((k, i) => results[k] = htmls[i]);
    return results;
}

function parseUBSLifestyleFixed(pages) {
    const data = [];
    const buybackMap = {};
    
    if (pages.buyback) {
        const bDoc = new JSDOM(pages.buyback).window.document;
        bDoc.querySelectorAll("table tr").forEach(row => {
            const cols = row.querySelectorAll("td");
            if (cols.length >= 3) {
                const g = cols[0].textContent.replace(/[^\d.]/g, "");
                buybackMap[g] = cols[2].textContent.replace(/[^\d]/g, "");
            }
        });
    }

    for (const gram in pages) {
        if (gram === "buyback" || !pages[gram]) continue;
        const dom = new JSDOM(pages[gram]);
        const priceEl = dom.window.document.querySelector(".product_price, .as-price-currentprice");
        if (priceEl) {
            data.push({
                code: "UBS" + gram.replace(".",""),
                category: "UBS",
                gram,
                jual: priceEl.textContent.replace(/[^\d]/g, ""),
                buyback: buybackMap[gram] || "0",
                last_update: "" 
            });
        }
        dom.window.close();
    }
    return data;
}

// ... Keep your existing parseGaleri24, parseEmasKita, fetchUBS, and parseUBSLifestyle ...
// Just ensure you add dom.window.close() at the end of each parser function.

function formatGaleriDate(text) {
    if (!text) return null;
    const months = { januari: "01", februari: "02", maret: "03", april: "04", mei: "05", juni: "06", juli: "07", agustus: "08", september: "09", oktober: "10", november: "11", desember: "12" };
    const str = text.toLowerCase();
    const mMatch = str.match(/(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)/);
    const dMatch = str.match(/\b(\d{1,2})\b/);
    const yMatch = str.match(/\b(\d{4})\b/);
    const tMatch = str.match(/(\d{1,2}:\d{2})/);
    if (mMatch && dMatch && yMatch) {
        return `${yMatch[0]}-${months[mMatch[0]]}-${dMatch[0].padStart(2, '0')}${tMatch ? ' ' + tMatch[0] + ':00' : ''}`;
    }
    return null;
}