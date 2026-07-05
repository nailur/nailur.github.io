const REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
    'Referer': 'https://www.google.com/',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
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

window.fetchCustomMarketData = async function() {
    try {
		const [galeriHTML, emasKitaHTML, sampoernaHTML, lotusHTML, kingHalimHTML, ubsPagesFixed ] = await Promise.all([
            fetchWithTimeout("https://galeri24.co.id/harga-emas").catch(() => ""),
            fetchWithTimeout("https://emaskita.id/Harga_emas").catch(() => ""),
            fetchWithTimeout("https://sampoernagold.com/").catch(() => ""),
            fetchWithTimeout("https://lotusarchi.com/pricing/").catch(() => ""),
			fetchWithTimeout("https://www.kinghalim.com/goldbarwithamala").catch(() => ""),
            fetchUBSFixed().catch(() => ({}))
        ]);

        const rawData = [
            ...(galeriHTML ? parseGaleri24(galeriHTML) : []),
            ...(emasKitaHTML ? parseEmasKita(emasKitaHTML) : []),
			...(sampoernaHTML ? parseSampoerna(sampoernaHTML) : []),
			...(kingHalimHTML ? parseKingHalim(kingHalimHTML) : []),
			...parseUBSLifestyleFixed(ubsPagesFixed)
        ];

		const filteredData = rawData.filter(item => {
			const hasGram = item.gram && String(item.gram).trim() !== "";
			const hasPrice = item.jual && item.jual !== 0 && item.jual !== "0";
    		const isUbs005 = item.category === "UBS" && (item.gram === "0.05" || item.gram === 0.05);
			return hasGram && hasPrice && !isUbs005;
		});

		const uniqueMap = new Map();
		filteredData.forEach(item => {
			uniqueMap.set(item.code, item);
		});

		const data = Array.from(uniqueMap.values());

		data.sort((a, b) => {
			const brandA = String(a.category || "").toUpperCase();
    		const brandB = String(b.category || "").toUpperCase();
			if (brandA < brandB) return -1;
			if (brandA > brandB) return 1;
			const priceA = parseFloat(String(a.jual).replace(/[^\d]/g, "")) || 0;
			const priceB = parseFloat(String(b.jual).replace(/[^\d]/g, "")) || 0;
			return priceA - priceB;
		});

        return data;
    } catch (e) {
        console.error("Custom Market Fetch Error:", e);
        return [];
    }
}

function parseGaleri24(html) {
    if (!html) return [];
    const doc = new DOMParser().parseFromString(html, "text/html");
    const result = [];
	const categories = doc.querySelectorAll('#GALERI\\ 24');

    categories.forEach(categoryEl => {
        const category = categoryEl.id;
        const updateHeader = categoryEl.querySelector('.text-lg.font-semibold.mb-4');
        const formattedUpdate = formatGaleriDate(updateHeader?.textContent || "");

        const rows = categoryEl.querySelectorAll('.grid.grid-cols-5.divide-x');
        rows.forEach(row => {
            const cols = row.querySelectorAll("div");
            if (cols.length < 3) return;
            result.push({
				code: category.trim().replace(/\s+/g, "")+cols[0].textContent.trim().replace(/[^\d]/g, ""),
				category: `${category}`,
                gram: cols[0].textContent.trim().replace(/[^\d]/g, "").replace("01", "0.1").replace("02", "0.2").replace("03", "0.3").replace("04", "0.4").replace("05", "0.5"),
                jual: cols[1].textContent.trim().replace(/[^\d]/g, ""),
                buyback: cols[2].textContent.trim().replace(/[^\d]/g, ""),
                last_update: formattedUpdate 
            });
        });
    });
    return result;
}

function parseEmasKita(html) {
    if (!html) return [];
    const doc = new DOMParser().parseFromString(html, "text/html");
    const result = [];
    const rows = Array.from(doc.querySelectorAll("table tr")).slice(3);
    const updateEl = doc.querySelector(".d-flex.justify-content-center.mt-3");
    const lUpdate = formatGaleriDate(updateEl?.textContent || "");

    rows.forEach((row) => {
        const cols = row.querySelectorAll("td");
        if (cols.length >= 4) {
            const gramValue = cols[0].textContent.trim().toLowerCase().replace("gr", "").replace(",", ".").trim();
            const priceValue = cols[1].textContent.trim().replace(/[^\d]/g, "");
			const buybackValue = cols[3].textContent.trim().replace(/[^\d]/g, "");
            if (gramValue && priceValue) {
                result.push({
					code: "EMASKITA" + gramValue.replace(".",""),
                    category: "EMAS KITA",
                    gram: gramValue,
                    jual: priceValue,
                    buyback: buybackValue,
                    last_update : lUpdate
                });
            }
        }
    });
    return result;
}

function parseSampoerna(html) {
    if (!html) return [];
    try {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const result = [];
        const formattedUpdate = formatGaleriDate(doc.querySelector(".small-text")?.textContent || "");
        const table = doc.querySelector('.table-emas');
        if (!table) return [];

        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cols = row.querySelectorAll('td');
            if (cols.length >= 3) {
                const gramRaw = cols[0].textContent.trim();
                const priceRaw = cols[1].textContent.trim();
                const buybackRaw = cols[cols.length - 1].textContent.trim();

                const gramValue = gramRaw.toLowerCase().replace(/[^\d,.]/g, "").replace(",", ".");
                const priceValue = priceRaw.replace(/[^\d]/g, "");
                const buybackValue = buybackRaw.replace(/[^\d]/g, "");

                if (gramValue && priceValue && priceValue !== "0") {
                    result.push({
                        code: "SAMPOERNA" + gramValue.replace(".", ""),
                        category: "SAMPOERNA",
                        gram: gramValue,
                        jual: priceValue,
                        buyback: buybackValue || "0",
                        last_update: formattedUpdate
                    });
                }
            }
        });
        return result;
    } catch (e) {
        console.error("Sampoerna Parse Error:", e);
        return [];
    }
}

function parseKingHalim(html) {
    if (!html) return [];
    try {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const result = [];
        const updateEl = doc.querySelector('.kv-ee-section-subtitle.kv-ee-section-subtitle--sm');
        const formattedUpdate = formatGaleriDate(updateEl?.textContent || "");
		const buyBackPrice = doc.querySelector('.kv-ee-section-description.kv-ee-description.kv-ee-body--md').textContent.trim().split('.')[0].replace(/[^\d]/g, "");
        const items = doc.querySelectorAll('.kv-ee-item');

        items.forEach((item) => {
            const titleEl = item.querySelector('.kv-ee-title.kv-ee-title--md');
            const priceEl = item.querySelector('.kv-ee-price.kv-ee-section-title--lg');
            if (titleEl && priceEl) {
                const gramRaw = titleEl.textContent.trim();
                const jualRaw = priceEl.textContent.trim();
				const cleanJual = jualRaw.split('.')[0].replace(/[^\d]/g, "");
                const gramValue = gramRaw.toLowerCase().replace(/[^\d,.]/g, "").replace(",", ".").trim();
                if (gramValue && cleanJual && cleanJual !== "0") {
                    result.push({
                        code: "KINGHALIM" + gramValue.replace(".", ""),
                        category: "KING HALIM",
                        gram: gramValue,
                        jual: cleanJual,
                        buyback: buyBackPrice * gramValue,
                        last_update: formattedUpdate
                    });
                }
            }
        });
        return result;
    } catch (e) {
        console.error("King Halim Parse Error:", e.message);
        return [];
    }
}

async function fetchUBSFixed() {
    const urls = {
        "0.1": "https://ubslifestyle.com/ubs-logam-mulia-disney-mickey-minnie-mouse-thank-you-0-1-gr/",
		"0.25": "https://ubslifestyle.com/ubs-logam-mulia-disney-minnie-mouse-daisy-duck-thank-you-0-25-gr/",
		"0.5": "https://ubslifestyle.com/ubs-logam-mulia-new-born-0-5-gr/",
        "1": "https://ubslifestyle.com/fine-gold-1gram/",
		"2": "https://ubslifestyle.com/ubs-gold-logam-mulia-new-born-baby-girl-2-gr/",
		"3": "https://ubslifestyle.com/ubs-gold-logam-mulia-new-born-baby-boy-3-gr/",
		"4": "https://ubslifestyle.com/fine-gold-4gram/",
		"5": "https://ubslifestyle.com/fine-gold-disney-5-gr-donald-duck/",
        "10": "https://ubslifestyle.com/fine-gold-10gram/",
        "25": "https://ubslifestyle.com/ubs-logam-mulia-25-gram-classic/",
        "50": "https://ubslifestyle.com/ubs-logam-mulia-50-gram-classic/",
		"100": "https://ubslifestyle.com/ubs-logam-mulia-100-gram-classic/",
        "buyback": "https://ubslifestyle.com/harga-buyback-hari-ini/"
    };
    const keys = Object.keys(urls);
    const results = {};
    const htmls = await Promise.all(keys.map(k => fetchWithTimeout(urls[k]).catch(() => "")));
    keys.forEach((k, i) => results[k] = htmls[i]);
    return results;
}

function parseUBSLifestyleFixed(pages) {
    const data = [];
    const buybackMap = {};
    let ubsUpdate = "";
    if (pages.buyback) {
        const bDoc = new DOMParser().parseFromString(pages.buyback, "text/html");
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
        const doc = new DOMParser().parseFromString(pages[gram], "text/html");
        const priceEl = doc.querySelector(".product_price");
        if (priceEl) {
            data.push({
				code: "UBS" + gram.replace(".",""),
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