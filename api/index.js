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

function normalizeToArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "object" && value !== null)
    return Object.values(value);
  return [];
}

function toNum(v) {
  if (!v) return null;
  return Number(String(v).replace(/[^\d]/g, ""));
}

function normalizeToArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "object" && value !== null)
    return Object.values(value);
  return [];
}

/* ======================
   GALERI24
====================== */
async function fetchGaleri24() {
  const res = await fetch(
    "https://galeri24.co.id/api/v1/gold-price",
    {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
      }
    }
  );

  const json = await res.json();
  const result = [];

  for (const category in json) {
    const rawItems = normalizeToArray(json[category]?.data || json[category]);

    const items = rawItems
      .map(item => ({
        gram: item.weight || item.gram || null,
        jual: toNum(item.sell_price || item.sell),
        buyback: toNum(item.buyback_price || item.buyback)
      }))
      .filter(i => i.gram && i.jual);

    if (items.length) {
      result.push({
        category,
        items
      });
    }
  }

  return result;
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
