export default async function handler(req, res) {
  try {
    const [galeriHTML, sampoernaHTML] = await Promise.all([
      fetch("https://galeri24.co.id/harga-emas").then(r => r.text()),
      fetch("https://sampoernagold.com/").then(r => r.text())
    ]);

    const galeri24 = parseGaleri24(galeriHTML);
    const sampoerna = parseSampoerna(sampoernaHTML);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    res.status(200).json({
      updated_at: new Date().toISOString(),
      data: [...sampoerna, ...galeri24]
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
}

/* =========================
   GALERI24 PARSER
========================= */
function parseGaleri24(html) {
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const result = [];

  const categories = doc.querySelectorAll(
    '#GALERI\\ 24, #ANTAM, #UBS, #ANTAM\\ MULIA\\ RETRO, #ANTAM\\ NON\\ PEGADAIAN, #LOTUS\\ ARCHI'
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
        category,
        gram: cols[0].textContent.trim(),
        jual: cols[1].textContent.trim(),
        buyback: cols[2].textContent.trim()
      });
    });
  });

  return result;
}

/* =========================
   SAMPOERNA PARSER
========================= */
function parseSampoerna(html) {
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const data = [];

  doc.querySelectorAll("table tr").forEach(row => {
    const cols = row.querySelectorAll("td");
    if (cols.length >= 3) {
      data.push({
        category: "SAMPOERNA",
        gram: cols[0].textContent.trim(),
        jual: cols[1].textContent.trim(),
        buyback: cols[2].textContent.trim()
      });
    }
  });

  return data;
}
