export const config = { runtime: "nodejs" };

import { JSDOM } from "jsdom";

const fetchWithTimeout = (url, ms = 10000) =>
  Promise.race([
    fetch(url),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms))
  ]);

export default async function handler(req, res) {
  try {
    const galeriHTML = await fetchWithTimeout("https://galeri24.co.id/harga-emas").then(r => r.text());
    const bullionHTML = await fetchWithTimeout("https://idbullion.com/").then(r => r.text());
	const emasKitaHTML = await fetchWithTimeout("https://emaskita.id/Harga_emas").then(r => r.text());
    const ubsPages = await fetchUBS();

    const data = [
      ...parseGaleri24(galeriHTML),
      ...parseBullion(bullionHTML),
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
    // '#GALERI\\ 24, #ANTAM, #UBS, #ANTAM\\ MULIA\\ RETRO, #ANTAM\\ NON\\ PEGADAIAN, #LOTUS\\ ARCHI'
	'#ANTAM, #ANTAM\\ MULIA\\ RETRO, #UBS, #LOTUS\\ ARCHI'
  );

  categories.forEach(categoryEl => {
    const category = categoryEl.id;

    const rows = categoryEl.querySelectorAll(
      '.grid.grid-cols-5.divide-x.lg\\:hover\\:bg-neutral-50'
    );

    rows.forEach(row => {
      const cols = row.querySelectorAll("div");
      if (cols.length < 3) return;

      result.push({
        category: category + " - GALERI24",
        gram: cols[0].textContent.trim().replace(/[^\d]/g, "").replace("05", "0.5"),
        jual: cols[1].textContent.trim().replace(/[^\d]/g, "").replace("05", "0.5")
      });
    });
  });

  return result;
}

function parseBullion(html) {
	const dom = new JSDOM(html);
	const doc = dom.window.document;

	const data = [];

	const tblAntam = doc.getElementById("modalAntam");
	const tblGaleri = doc.getElementById("modalGaleri24");
	const tblLotus = doc.getElementById("modalLotus");
	const tblSampoerna = doc.getElementById("modalSampoerna");
	
	tblAntam.querySelectorAll("table tr").forEach(row => {
		const cols = row.querySelectorAll("td");
		if (cols.length >= 3) {
			data.push({
				category: "ANTAM",
				gram: cols[0].textContent.trim().replace(/[^\d]/g, "").replace("05", "0.5"),
				jual: cols[1].textContent.trim().replace(/[^\d]/g, "").replace("05", "0.5")
			});
		}
	});

	tblGaleri.querySelectorAll("table tr").forEach(row => {
		const cols = row.querySelectorAll("td");
		if (cols.length >= 3) {
			data.push({
				category: "GALERI24",
				gram: cols[0].textContent.trim().replace(/[^\d]/g, "").replace("05", "0.5"),
				jual: cols[1].textContent.trim().replace(/[^\d]/g, "").replace("05", "0.5")
			});
		}
	});

	tblLotus.querySelectorAll("table tr").forEach(row => {
		const cols = row.querySelectorAll("td");
		if (cols.length >= 3) {
			data.push({
				category: "LOTUS ARCHI",
				gram: cols[0].textContent.trim().replace(/[^\d]/g, "").replace("05", "0.5").replace("01", "0.1").replace("02", "0.2"),
				jual: cols[1].textContent.trim().replace(/[^\d]/g, "").replace("05", "0.5").replace("01", "0.1").replace("02", "0.2")
			});
		}
	});

	tblSampoerna.querySelectorAll("table tr").forEach(row => {
		const cols = row.querySelectorAll("td");
		if (cols.length >= 3) {
			data.push({
				category: "SAMPOERNA",
				gram: cols[0].textContent.trim().replace(/[^\d]/g, "").replace("05", "0.5"),
				jual: cols[1].textContent.trim().replace(/[^\d]/g, "").replace("05", "0.5")
			});
		}
	});

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

            // Convert Indonesian decimal comma to dot for parsing
            let gramValue = weightRaw
                .replace("gr", "")
                .replace(",", ".")
                .trim();

            // Extract numeric price
            const priceValue = Number(priceRaw.replace(/[^\d]/g, ""));

            // Only push if we have valid numbers
            if (gramValue && !isNaN(priceValue) && priceValue > 0) {
                result.push({
                    category: "EMAS KITA",
                    gram: gramValue,
                    jual: priceValue
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