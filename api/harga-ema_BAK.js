export const config = { runtime: "nodejs" };

import { JSDOM } from "jsdom";

const fetchWithTimeout = (url, ms = 120000) =>
  Promise.race([
    fetch(url, {
		headers: {
        // High-quality browser fingerprint
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': 'https://www.google.com/',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Upgrade-Insecure-Requests': '1'
      }
	}),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms))
  ]);

export default async function handler(req, res) {
  try {
    const galeriHTML = await fetchWithTimeout("https://galeri24.co.id/harga-emas").then(r => r.text());
    const bullionHTML = await fetchWithTimeout("https://idbullion.com/").then(r => r.text());
	const emasKitaHTML = await fetchWithTimeout("https://emaskita.id/Harga_emas").then(r => r.text());
	const sampoernaHTML = await fetchWithTimeout("https://sampoernagold.com/").then(r => r.text());
	const lotusHTML = await fetchWithTimeout("https://lotusarchi.com/pricing/").then(r => r.text());
    const ubsPages = await fetchUBS();

    const data = [
      ...parseGaleri24(galeriHTML),
      ...parseBullion(bullionHTML, sampoernaHTML, lotusHTML),
	  ...parseEmasKita(emasKitaHTML),
      ...parseUBSLifestyle(ubsPages)
    ];

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({ data });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

function parseGaleri24(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const result = [];

  const categories = doc.querySelectorAll(
    '#ANTAM, #ANTAM\\ MULIA\\ RETRO, #GALERI\\ 24, #UBS, #LOTUS\\ ARCHI'
  );

  categories.forEach(categoryEl => {
    const category = categoryEl.id;

    // --- NEW LOGIC: Extract the Update Date ---
    // We look for the specific class you mentioned within this category
    const updateHeader = categoryEl.querySelector('.text-lg.font-semibold.mb-4');
    const rawUpdateText = updateHeader ? updateHeader.textContent.trim() : "";

	// Format it to 2026-01-23
	const formattedUpdate = formatGaleriDate(rawUpdateText);

    const rows = categoryEl.querySelectorAll(
      '.grid.grid-cols-5.divide-x.lg\\:hover\\:bg-neutral-50'
    );

    rows.forEach(row => {
      const cols = row.querySelectorAll("div");
      if (cols.length < 3) return;

      result.push({
        category: category + " - GALERI24",
        gram: cols[0].textContent.trim().replace(/[^\d]/g, "").replace("05", "0.5"),
        jual: cols[1].textContent.trim().replace(/[^\d]/g, "").replace("05", "0.5"),
        buyback: cols[2].textContent.trim().replace(/[^\d]/g, "").replace("05", "0.5"),
        // Attach the update string to each record
        last_update: formattedUpdate 
      });
    });
  });

  return result;
}

function parseBullion(bullionHtml, sampoernaHtml, lotusHtml) {
	const dom = new JSDOM(bullionHtml);
	const doc = dom.window.document;

	// Extract Sampoerna Last Update from official site
    const sDom = new JSDOM(sampoernaHtml);
    const sDoc = sDom.window.document;
    const sampoernaUpdateEl = sDoc.querySelector(".small-text");
    const sampoernaUpdate = sampoernaUpdateEl ? formatGaleriDate(sampoernaUpdateEl.textContent.trim()) : "";

	// NEW: Scrape Lotus Archi Update
    const lDom = new JSDOM(lotusHtml);
	const lDoc = lDom.window.document;
	const lUpdateEl = lDoc.querySelector(".section-content.relative h4") || 
                      lDoc.querySelector(".elementor-widget-container h4");

    let lotusUpdate = "";
	if (lUpdateEl) {
        const rawContent = lUpdateEl.textContent.trim();
        // Split by the double pipe "||"
        const parts = rawContent.split("||");
        lotusUpdate = formatGaleriDate(parts[0].trim()) || "";
    }

	const data = [];

	// Helper to process standard tables from idbullion
    const processTable = (id, category, updateDate = "") => {
        const tbl = doc.getElementById(id);
        if (!tbl) return;
        tbl.querySelectorAll("table tr").forEach(row => {
            const cols = row.querySelectorAll("td");
            if (cols.length >= 3) {
                data.push({
                    category: category,
                    gram: cols[0].textContent.trim().replace(/[^\d]/g, "").replace("05", "0.5").replace("01", "0.1").replace("02", "0.2"),
                    jual: cols[1].textContent.trim().replace(/[^\d]/g, "").replace("05", "0.5").replace("01", "0.1").replace("02", "0.2"),
                    buyback: cols[2].textContent.trim().replace(/[^\d]/g, "").replace("05", "0.5").replace("01", "0.1").replace("02", "0.2"),
                    last_update: updateDate
                });
            }
        });
    };

    processTable("modalAntam", "ANTAM");
    // processTable("modalGaleri24", "GALERI24");
    processTable("modalLotus", "LOTUS ARCHI", lotusUpdate); // Pass Lotus Update
    processTable("modalSampoerna", "SAMPOERNA", sampoernaUpdate); // Pass Sampoerna Update

	// data.push({debug: lotusHtml, debug_1: lDom, debug_2: lDoc, debug_3: lUpdateEl});

	return data;
}

function parseEmasKita(html) {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const result = [];

    // EmasKITA prices are usually in the first table of the page content
    const rows = doc.querySelectorAll("table tr");

	const lUpdate = formatGaleriDate(doc.getElementsByClassName("d-flex justify-content-center mt-3")[0].textContent);

    rows.forEach((row, index) => {
        // Skip header row if it exists
        if (index === 0) return;

        const cols = row.querySelectorAll("td");
        if (cols.length >= 2) {
            const weightRaw = cols[0].textContent.trim().toLowerCase(); // e.g., "1 gr" or "0,5 gr"
            const priceRaw = cols[1].textContent.trim(); // e.g., "1.411.600"
			const buybackRaw = cols[1].textContent.trim(); // e.g., "1.411.600"

            // Convert Indonesian decimal comma to dot for parsing
            let gramValue = weightRaw
                .replace("gr", "")
                .replace(",", ".")
                .trim();

            // Extract numeric price
            const priceValue = Number(priceRaw.replace(/[^\d]/g, ""));
			const buybackValue = Number(buybackRaw.replace(/[^\d]/g, ""));

            // Only push if we have valid numbers
            if (gramValue && !isNaN(priceValue) && priceValue > 0) {
                result.push({
                    category: "EMAS KITA",
                    gram: gramValue,
                    jual: priceValue,
					buyback: buybackValue,
					last_update : lUpdate,
                });
            }
        }
    });

    return result;
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

	const result = {};
    const keys = Object.keys(urls);
    const htmls = await Promise.all(keys.map(k => fetchWithTimeout(urls[k], 10000).then(r => r.text())));
    
    keys.forEach((key, i) => { result[key] = htmls[i]; });

    return result;
}

function parseUBSLifestyle(pages) {
    const data = [];
    const buybackMap = {};
    let ubsUpdate = "";

    // 1. Parse the Buyback Table First
    if (pages.buyback) {
        const bDom = new JSDOM(pages.buyback);
        const bDoc = bDom.window.document;
        
        // Extract Update Time
        const dateEl = bDoc.querySelector('.text-xs.font-semibold'); // "23 January 2026"
        ubsUpdate = formatGaleriDate(`${dateEl?.textContent || ""}`);

        // Scrape the table rows
        const rows = bDoc.querySelectorAll("table tr");
        rows.forEach(row => {
            const cols = row.querySelectorAll("td");
            if (cols.length >= 3) {
                const gram = cols[0].textContent.trim().replace(" Gram", "").replace(",", ".");
                const buybackPrice = cols[2].textContent.trim().replace(/[^\d]/g, "");
                buybackMap[gram] = buybackPrice;
            }
        });
    }

    // 2. Parse Individual Selling Prices and Attach Buyback
    for (const gram in pages) {
        if (gram === "buyback") continue;

        const dom = new JSDOM(pages[gram]);
        const priceEl = dom.window.document.querySelector(".product_price");

        if (priceEl) {
            data.push({
                category: "UBS",
                gram: gram,
                jual: Number(priceEl.textContent.replace(/[^\d]/g, "")),
                buyback: buybackMap[gram] || "", // Map from our buyback table
                last_update: ubsUpdate
            });
        }
    }
    return data;
}

function formatGaleriDate(text) {
  // 1. Convert to string and handle null/undefined
  let str = String(text || "").trim();
  if (!str) return null;

  // 2. CLEANING STEP: Remove quotes (") and special characters that cause issues
  // This keeps spaces, letters, numbers, colons, and pipes
  str = str.replace(/["']/g, "") // Remove all quotes
           .replace(/[^\w\s:|]/g, " ") // Replace other special chars with a space
           .replace(/\s+/g, " "); // Collapse multiple spaces into one

  const months = {
    januari: "01", january: "01", februari: "02", february: "02",
    maret: "03", march: "03", april: "04", mei: "05", may: "05",
    juni: "06", june: "06", juli: "07", july: "07", agustus: "08", 
    august: "08", september: "09", oktober: "10", october: "10",
    november: "11", desember: "12", december: "12"
  };

  // 3. Match Month, Day, Year, and optional Time
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