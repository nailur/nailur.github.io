export default async function handler(req, res) {
  try {
    const [galeri24, sampoerna] = await Promise.all([
      fetchGaleri24(),
      fetchSampoerna()
    ]);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    res.status(200).json({
      updated_at: new Date().toISOString(),
      galeri24,
      sampoerna
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/* ======================
   GALERI24
   ====================== */
async function fetchGaleri24() {
  const html = await fetch(
    "https://galeri24.co.id/harga-emas",
    { headers: { "User-Agent": "Mozilla/5.0" } }
  ).then(r => r.text());

  const result = [];
  const blocks = html.split("Gram");

  blocks.forEach(block => {
    const gram = block.match(/(\d+(?:\.\d+)?)/);
    const jual = block.match(/Jual\s*Rp[\s.:]*([\d.,]+)/i);
    const buy = block.match(/Buyback\s*Rp[\s.:]*([\d.,]+)/i);

    if (gram && jual) {
      result.push({
        gram: `${gram[1]} Gram`,
        jual: Number(jual[1].replace(/[^\d]/g, "")),
        buyback: buy
          ? Number(buy[1].replace(/[^\d]/g, ""))
          : null
      });
    }
  });

  return unique(result, "gram");
}

/* ======================
   SAMPOERNA
   ====================== */
async function fetchSampoerna() {
  const html = await fetch(
    "https://sampoernagold.com/",
    { headers: { "User-Agent": "Mozilla/5.0" } }
  ).then(r => r.text());

  const rows = html.match(/<tr[^>]*>(.*?)<\/tr>/gis) || [];
  const data = [];

  rows.forEach(row => {
    const cols = row.match(/<td[^>]*>(.*?)<\/td>/gis);
    if (cols && cols.length >= 3) {
      data.push({
        gram: clean(cols[0]),
        jual: toNum(clean(cols[1])),
        buyback: toNum(clean(cols[2]))
      });
    }
  });

  return data;
}

/* ======================
   HELPERS
   ====================== */
function clean(str) {
  return str.replace(/<[^>]+>/g, "").trim();
}
function toNum(str) {
  return Number(str.replace(/[^\d]/g, ""));
}
function unique(arr, key) {
  return [...new Map(arr.map(i => [i[key], i])).values()];
}
