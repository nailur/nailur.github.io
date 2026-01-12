export default async function handler(req, res) {
  try {
    const [galeriHTML, bullionHTML, ubsHTML] = await Promise.all([
      fetch("https://galeri24.co.id/harga-emas").then(r => r.text()),
	  fetch("https://idbullion.com/").then(r => r.text()),
	  fetchUBSLifestyle()
    ]);

    const galeri24 = parseGaleri24(galeriHTML);
	const idbullion = parseBullion(bullionHTML);
	const ubs = parseUBSLifestyle(ubsHTML);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET");
    res.status(200).json({
      data: [...galeri24, ...idbullion, ...ubs]
    });

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
}

function parseGaleri24(html) {
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const result = [];

  const categories = doc.querySelectorAll(
    // '#GALERI\\ 24, #ANTAM, #UBS, #ANTAM\\ MULIA\\ RETRO, #ANTAM\\ NON\\ PEGADAIAN, #LOTUS\\ ARCHI'
	'#ANTAM, #UBS, #LOTUS\\ ARCHI'
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
	const { JSDOM } = require("jsdom");
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

async function fetchUBSLifestyle() {
	const urls = [
		["0.5","https://ubslifestyle.com/fine-gold-0.5gram/"],
		["1","https://ubslifestyle.com/fine-gold-1gram/"],
		["3","https://ubslifestyle.com/fine-gold-3gram/"],
		["5","https://ubslifestyle.com/fine-gold-5gram/"],
		["10","https://ubslifestyle.com/fine-gold-10gram/"],
		["25","https://ubslifestyle.com/ubs-logam-mulia-25-gram-classic/"],
		["50","https://ubslifestyle.com/ubs-logam-mulia-50-gram-classic/"]
	];

	const pages = await Promise.all(urls.map(u => fetch(u[1]).then(r => r.text())));
	return urls.map((u,i)=>({ gram:u[0], html:pages[i] }));
}

function parseUBSLifestyle(pages) {
	const { JSDOM } = require("jsdom");
	const data = [];

	pages.forEach(p => {
		const dom = new JSDOM(p.html);
		const doc = dom.window.document;
		const priceEl = doc.querySelector(".product_price");
		if (!priceEl) return;

		data.push({
			category: "UBS",
			gram: p.gram,
			jual: Number(priceEl.textContent.replace(/[^\d]/g,""))
		});
	});

	return data;
}