export const config = { runtime: "nodejs" };

import { JSDOM } from "jsdom";

const fetchWithTimeout = (url, ms = 60000) =>
  Promise.race([
    fetch(url),
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
    '#ANTAM, #ANTAM\\ MULIA\\ RETRO, #UBS, #LOTUS\\ ARCHI'
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
    const lDoc = new JSDOM(lotusHtml).window.document;
    const lUpdateEl = lDoc.querySelector(".section-content.relative .text") || 
                      lDoc.querySelector(".section-content.relative h4"); // Fallback to any h4 tag inside
    // We look for the line containing "Update" inside that relative container
    const lotusUpdate = lUpdateEl ? formatGaleriDate(lUpdateEl.textContent.trim()) : "";

	const data = [];

	// Helper to process standard tables from idbullion
    const processTable = (id, category, updateDate = null) => {
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
    processTable("modalGaleri24", "GALERI24");
    processTable("modalLotus", "LOTUS ARCHI", lotusUpdate); // Pass Lotus Update
    processTable("modalSampoerna", "SAMPOERNA", sampoernaUpdate); // Pass Sampoerna Update

	return data;
}

function parseEmasKita(html) {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const result = [];

    // EmasKITA prices are usually in the first table of the page content
    const rows = doc.querySelectorAll("table tr");

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
					buyback: buybackValue
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
		"50": "https://ubslifestyle.com/ubs-logam-mulia-50-gram-classic/"
	};

	const result = {};
	for (const g in urls) {
		const html = await fetchWithTimeout(urls[g], 8000).then(r => r.text());
		result[g] = html;
	}

	return result;
}

function parseUBSLifestyle(pages) {
	const data = [];
	for (const gram in pages) {
		const dom = new JSDOM(pages[gram]);
		const priceEl = dom.window.document.querySelector(".product_price");

		if (priceEl) {
			data.push({
				category: "UBS",
				gram,
				jual: Number(priceEl.textContent.replace(/[^\d]/g,""))
			});
		}
	}
	return data;
}

function formatGaleriDate(text) {
  if (!text) return null;

  const months = {
    januari: "01", februari: "02", maret: "03", april: "04", mei: "05", juni: "06",
    juli: "07", agustus: "08", september: "09", oktober: "10", november: "11", desember: "12"
  };

  // 1. Try to match Date AND Time (e.g., "23 Januari 2026 10:45")
  const dateTimeMatch = text.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})\s+(\d{1,2}:\d{2})/);
  
  // 2. Try to match Date ONLY (e.g., "23 Januari 2026")
  const dateOnlyMatch = text.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);

  if (dateTimeMatch) {
    const [_, day, monthName, year, time] = dateTimeMatch;
    const month = months[monthName.toLowerCase()];
    // Return yyyy-mm-dd hh:mm:ss (adding :00 for seconds)
    return `${year}-${month}-${day.padStart(2, '0')} ${time}:00`;
  } 
  
  if (dateOnlyMatch) {
    const [_, day, monthName, year] = dateOnlyMatch;
    const month = months[monthName.toLowerCase()];
    // Return yyyy-mm-dd only
    return `${year}-${month}-${day.padStart(2, '0')}`;
  }

  return null;
}