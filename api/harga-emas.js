export const config = { runtime: "nodejs" };
import { JSDOM } from "jsdom";

const REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
    'Referer': 'https://www.google.com/',
    'Upgrade-Insecure-Requests': '1'
};

const fetchWithTimeout = async (url, ms = 15000) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    try {
        const response = await fetch(url, { headers: REQUEST_HEADERS, signal: controller.signal });
        return await response.text();
    } finally {
        clearTimeout(timeout);
    }
};

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const [galeriHTML, bullionHTML, emasKitaHTML, sampoernaHTML, lotusHTML, ubsPages, kingHalimHTML] = await Promise.all([
            fetchWithTimeout("https://galeri24.co.id/harga-emas").catch(() => ""),
            fetchWithTimeout("https://idbullion.com/").catch(() => ""),
            fetchWithTimeout("https://emaskita.id/Harga_emas").catch(() => ""),
            fetchWithTimeout("https://sampoernagold.com/").catch(() => ""),
            fetchWithTimeout("https://lotusarchi.com/pricing/").catch(() => ""),
			// fetchWithTimeout("https://www.kinghalim.com/gold-bar").catch(() => ""),
            fetchUBS().catch(() => ({}))
        ]);

        const rawData = [
            ...(galeriHTML ? parseGaleri24(galeriHTML) : []),
            ...(bullionHTML ? parseBullion(bullionHTML, sampoernaHTML, lotusHTML) : []),
            ...(emasKitaHTML ? parseEmasKita(emasKitaHTML) : []),
			...(kingHalimHTML ? parseKingHalim(kingHalimHTML) : []),
            ...parseUBSLifestyle(ubsPages)
        ];

		const data = rawData.filter(item => {
			const hasGram = item.gram && String(item.gram).trim() !== "";
			const hasPrice = item.jual && item.jual !== 0 && item.jual !== "0";
			return hasGram && hasPrice;
		});

        res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
        res.setHeader("Access-Control-Allow-Origin", "*"); // Change to your domain in production
        res.setHeader("Content-Type", "application/json");
        
        res.status(200).json({ 
            success: true,
            timestamp: new Date().toISOString(),
            count: data.length,
            data 
        });

    } catch (e) {
        // res.status(500).json({ success: false, error: "Internal Server Error" });
		res.status(500).json({ success: false, error: e.message, stack: e.stack });
    }
}

function parseGaleri24(html) {
    if (!html) return [];
    const { window } = new JSDOM(html);
    const doc = window.document;
    const result = [];

    const categories = doc.querySelectorAll('#ANTAM, #ANTAM\\ MULIA\\ RETRO, #GALERI\\ 24, #UBS, #LOTUS\\ ARCHI');

    categories.forEach(categoryEl => {
        const category = categoryEl.id;
        const updateHeader = categoryEl.querySelector('.text-lg.font-semibold.mb-4');
        const formattedUpdate = formatGaleriDate(updateHeader?.textContent || "");

        const rows = categoryEl.querySelectorAll('.grid.grid-cols-5.divide-x');
        rows.forEach(row => {
            const cols = row.querySelectorAll("div");
            if (cols.length < 3) return;
            result.push({
                category: `${category} - GALERI24`,
                gram: cols[0].textContent.trim().replace(/[^\d]/g, "").replace("01", "0.1").replace("02", "0.2").replace("03", "0.3").replace("04", "0.4").replace("05", "0.5"),
                jual: cols[1].textContent.trim().replace(/[^\d]/g, ""),
                buyback: cols[2].textContent.trim().replace(/[^\d]/g, ""),
                last_update: formattedUpdate 
            });
        });
    });
    return result;
}

function parseBullion(bullionHtml, sampoernaHtml, lotusHtml) {
    if (!bullionHtml) return [];
    const doc = new JSDOM(bullionHtml).window.document;

    let sampoernaUpdate = "";
    if (sampoernaHtml) {
        const sDoc = new JSDOM(sampoernaHtml).window.document;
        sampoernaUpdate = formatGaleriDate(sDoc.querySelector(".small-text")?.textContent || "");
    }

    let lotusUpdate = "";
    if (lotusHtml) {
        const lDoc = new JSDOM(lotusHtml).window.document;
        const lUpdateEl = lDoc.querySelector(".section-content.relative h4") || lDoc.querySelector(".elementor-widget-container h4");
        lotusUpdate = lUpdateEl ? formatGaleriDate(lUpdateEl.textContent.split("||")[0]) : "";
    }

    const data = [];
    const processTable = (id, category, updateDate = "") => {
        const tbl = doc.getElementById(id);
        if (!tbl) return;
        tbl.querySelectorAll("table tr").forEach(row => {
            const cols = row.querySelectorAll("td");
            if (cols.length >= 3) {
                data.push({
                    category,
                    gram: cols[0].textContent.trim().replace(/[^\d]/g, "").replace(/^0([125])/, "0.$1"),
                    jual: cols[1].textContent.trim().replace(/[^\d]/g, ""),
                    buyback: cols[2].textContent.trim().replace(/[^\d]/g, ""),
                    last_update: updateDate
                });
            }
        });
    };

    processTable("modalAntam", "ANTAM");
    processTable("modalLotus", "LOTUS ARCHI", lotusUpdate);
    processTable("modalSampoerna", "SAMPOERNA", sampoernaUpdate);

    return data;
}

function parseEmasKita(html) {
    if (!html) return [];
    const doc = new JSDOM(html).window.document;
    const result = [];
    const rows = doc.querySelectorAll("table tr");
    const updateEl = doc.querySelector(".d-flex.justify-content-center.mt-3");
    const lUpdate = formatGaleriDate(updateEl?.textContent || "");

    rows.forEach((row, index) => {
        if (index === 0) return;
        const cols = row.querySelectorAll("td");
        if (cols.length >= 2) {
            const gramValue = cols[0].textContent.trim().toLowerCase().replace("gr", "").replace(",", ".").trim();
            const priceValue = cols[1].textContent.trim().replace(/[^\d]/g, "");
            if (gramValue && priceValue) {
                result.push({
                    category: "EMAS KITA",
                    gram: gramValue,
                    jual: priceValue,
                    buyback: priceValue,
                    last_update : lUpdate,
                });
            }
        }
    });
    return result;
}

function parseKingHalim(html) {
    if (!html) return [];
    try {
        const { window } = new JSDOM(html);
        const doc = window.document;
        const result = [];

        const updateEl = doc.querySelector('.kv-ee-section-subtitle.kv-ee-section-subtitle--sm');
        const formattedUpdate = formatGaleriDate(updateEl?.textContent || "");

        const items = doc.querySelectorAll('.kv-ee-item');

        items.forEach((item) => {
            const titleEl = item.querySelector('.kv-ee-title.kv-ee-title--md');
            const priceEl = item.querySelector('.kv-ee-price.kv-ee-section-title--lg');

            if (titleEl && priceEl) {
                const gramRaw = titleEl.textContent.trim();
                // Safer price extraction
                const jualRaw = priceEl.textContent.trim();

                const gramValue = gramRaw.toLowerCase().replace(/[^\d,.]/g, "").replace(",", ".").trim();
                const priceValue = jualRaw.replace(/[^\d]/g, "");

                if (gramValue && priceValue) {
                    result.push({
                        category: "KING HALIM",
                        gram: gramValue,
                        jual: priceValue,
                        buyback: 0,
                        last_update: formattedUpdate
                    });
                }
            }
        });
        window.close(); // Memory cleanup
        return result;
    } catch (e) { return []; }
}

async function fetchUBS() {
    const urls = {
        "0.5": "https://ubslifestyle.com/fine-gold-0.5gram/",
        "1": "https://ubslifestyle.com/fine-gold-1gram/",
        "3": "https://ubslifestyle.com/fine-gold-3gram/",
        "5": "https://ubslifestyle.com/fine-gold-5gram/",
        "10": "https://ubslifestyle.com/fine-gold-10gram/",
        "25": "https://ubslifestyle.com/ubs-logam-mulia-25-gram-classic/",
        "50": "https://ubslifestyle.com/ubs-logam-mulia-50-gram-classic/",
        "buyback": "https://ubslifestyle.com/harga-buyback-hari-ini/"
    };
    const keys = Object.keys(urls);
    const results = {};
    const htmls = await Promise.all(keys.map(k => fetchWithTimeout(urls[k]).catch(() => "")));
    keys.forEach((k, i) => results[k] = htmls[i]);
    return results;
}

function parseUBSLifestyle(pages) {
    const data = [];
    const buybackMap = {};
    let ubsUpdate = "";

    if (pages.buyback) {
        const bDoc = new JSDOM(pages.buyback).window.document;
        ubsUpdate = formatGaleriDate(bDoc.querySelector('.text-xs.font-semibold')?.textContent || "");
        bDoc.querySelectorAll("table tr").forEach(row => {
            const cols = row.querySelectorAll("td");
            if (cols.length >= 3) {
                const gram = cols[0].textContent.trim().replace(" Gram", "").replace(",", ".");
                buybackMap[gram] = cols[2].textContent.trim().replace(/[^\d]/g, "");
            }
        });
    }

    for (const gram in pages) {
        if (gram === "buyback") continue;
        const doc = new JSDOM(pages[gram]).window.document;
        const priceEl = doc.querySelector(".product_price");
        if (priceEl) {
            data.push({
                category: "UBS",
                gram,
                jual: priceEl.textContent.replace(/[^\d]/g, ""),
                buyback: buybackMap[gram] || "",
                last_update: ubsUpdate
            });
        }
    }
    return data;
}

// Global Formatter
function formatGaleriDate(text) {
    let str = String(text || "").trim();
    if (!str) return null;
    str = str.replace(/["']/g, "").replace(/[^\w\s:|]/g, " ").replace(/\s+/g, " ");

    const months = {
        januari: "01", january: "01", februari: "02", february: "02",
        maret: "03", march: "03", april: "04", mei: "05", may: "05",
        juni: "06", june: "06", juli: "07", july: "07", agustus: "08", 
        august: "08", september: "09", oktober: "10", october: "10",
        november: "11", desember: "12", december: "12"
    };

    const monthMatch = str.match(/(januari|january|februari|february|maret|march|april|mei|may|juni|june|juli|july|agustus|august|september|oktober|october|november|desember|december)/i);
    const dayMatch = str.match(/\b(\d{1,2})\b/);
    const yearMatch = str.match(/\b(\d{4})\b/);
    const timeMatch = str.match(/(\d{1,2}:\d{2})/);

    if (monthMatch && dayMatch && yearMatch) {
        const month = months[monthMatch[0].toLowerCase()];
        const day = dayMatch[0].padStart(2, '0');
        const year = yearMatch[0];
        const time = timeMatch ? ` ${timeMatch[0]}:00` : "";
        return `${year}-${month}-${day}${time}`;
    }
    return null;
}