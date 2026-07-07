export const config = { runtime: "nodejs" };
import { createClient } from "@supabase/supabase-js";
import handler from "./harga-emas.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://iwsacljessokrqhfmdbv.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3c2FjbGplc3Nva3JxaGZtZGJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxODcyNTMsImV4cCI6MjA4Mzc2MzI1M30.jQ_8KR76Xbbn1Heest75p3I78J6oiSt9V-H31cWWLOo";

const sbClient = createClient(SUPABASE_URL, SUPABASE_KEY);

class MockResponse {
    constructor() {
        this.statusCode = 200;
        this.data = null;
    }
    status(code) {
        this.statusCode = code;
        return this;
    }
    json(data) {
        this.data = data;
        return this;
    }
    setHeader() {}
}

export default async function cronHandler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const mockReq = { method: 'GET' };
    const mockRes = new MockResponse();
    
    await handler(mockReq, mockRes);
    
    if (mockRes.statusCode !== 200 || !mockRes.data) {
        return res.status(500).json({ error: 'Failed to scrape prices' });
    }

    const scrapedData = Array.isArray(mockRes.data) ? mockRes.data : (mockRes.data.data || []);
    const recordsToInsert = [];
    
    scrapedData.forEach(apiItem => {
        const weight = Number(apiItem.product?.weight || 0);
        const productName = apiItem.product?.name || "GOLD";
        
        let brandName = "";
        const prodName = productName.toLowerCase();
        if (prodName.includes('antam')) brandName = 'Antam';
        else if (prodName.includes('ubs')) brandName = 'UBS';
        else if (prodName.includes('lotus')) brandName = 'Lotus Archi';
        else if (prodName.includes('galeri')) brandName = 'Galeri24';
        else if (prodName.includes('sampoerna')) brandName = 'Sampoerna';
        else if (prodName.includes('emas kita')) brandName = 'Emas Kita';
        else if (prodName.includes('king')) brandName = 'KingHalim';
        else brandName = apiItem.vendor?.name || "Unknown";

        if (!brandName || brandName === "Unknown") return;

        const brandIdToSave = {
            "Antam": "3_2",
            "Emas Kita": "19_14",
            "Galeri24": "2_3",
            "Lotus Archi": "4_5",
            "Sampoerna": "5_10",
            "UBS": "ubs",
            "KingHalim": "kinghalim"
        }[brandName];

        if (brandIdToSave) {
            recordsToInsert.push({
                brand_id: brandIdToSave,
                weight_grams: weight,
                price: Number(apiItem.buy_price || 0),
                buyback_price: Number(apiItem.buyback_price || apiItem.buy_price || 0)
            });
            
            if (brandName === 'Antam') {
                recordsToInsert.push({ brand_id: 'antam_retro', weight_grams: weight, price: Number(apiItem.buy_price || 0), buyback_price: Number(apiItem.buyback_price || apiItem.buy_price || 0) });
                recordsToInsert.push({ brand_id: 'antam_series', weight_grams: weight, price: Number(apiItem.buy_price || 0), buyback_price: Number(apiItem.buyback_price || apiItem.buy_price || 0) });
            }
            if (brandName === 'UBS') {
                recordsToInsert.push({ brand_id: 'ubs_old', weight_grams: weight, price: Number(apiItem.buy_price || 0), buyback_price: Number(apiItem.buyback_price || apiItem.buy_price || 0) });
            }
        }
    });

    if (recordsToInsert.length === 0) {
        return res.status(200).json({ status: 'success', message: 'No records to insert' });
    }

    const { error } = await sbClient.from('tblpricelog').insert(recordsToInsert);

    if (error) {
        console.error("Supabase Insert Error:", error);
        return res.status(500).json({ error: 'Failed to save to database', details: error.message });
    }

    // --- Send OneSignal Web Push Notification ---
    try {
        const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
        const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

        if (ONESIGNAL_APP_ID && ONESIGNAL_API_KEY) {
            // Find 1g prices for top brands
            const getPrice1g = (bId) => {
                const rec = recordsToInsert.find(r => r.brand_id === bId && r.weight_grams === 1);
                return rec ? `Rp ${rec.price.toLocaleString('id-ID')}` : '-';
            };

            const msg = `Antam: ${getPrice1g('3_2')}\nGaleri24: ${getPrice1g('2_3')}\nUBS: ${getPrice1g('ubs')}\nLotus Archi: ${getPrice1g('4_5')}`;
            const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

            const pushRes = await fetch("https://onesignal.com/api/v1/notifications", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Basic ${ONESIGNAL_API_KEY}`
                },
                body: JSON.stringify({
                    app_id: ONESIGNAL_APP_ID,
                    included_segments: ["Subscribed Users"],
                    headings: { "en": `Harga Emas 1g ${dateStr}` },
                    contents: { "en": msg },
                    url: "https://nailur.github.io/goldapp/",
                    chrome_web_icon: "https://nailur.github.io/goldapp/res/img/icon.png"
                })
            });
            
            const pushData = await pushRes.json();
            if (!pushRes.ok) {
                console.error("OneSignal API Rejected:", pushData);
                return res.status(200).json({ status: 'success_but_push_failed', inserted: recordsToInsert.length, onesignal_error: pushData });
            }
            
            // Return the pushData on success so we can inspect it!
            return res.status(200).json({ status: 'success', inserted: recordsToInsert.length, onesignal_response: pushData });
        } else {
            console.warn("OneSignal Env Vars Missing!");
            return res.status(200).json({ status: 'success_but_push_skipped', inserted: recordsToInsert.length, reason: "Missing ENV vars" });
        }
    } catch (pushErr) {
        console.error("OneSignal push error:", pushErr);
        return res.status(200).json({ status: 'success_but_push_error', inserted: recordsToInsert.length, error: pushErr.message });
    }

    return res.status(200).json({ status: 'success', inserted: recordsToInsert.length });
}
