export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { title, body, target } = req.body;

    if (!title || !body || !target) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
    const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
        return res.status(500).json({ error: 'OneSignal credentials not configured' });
    }

    try {
        const payload = {
            app_id: ONESIGNAL_APP_ID,
            contents: { en: body },
            headings: { en: title },
            chrome_web_icon: 'https://nailur.github.io/pos/assets/img/icon-192.png',
            chrome_web_badge: 'https://nailur.github.io/pos/assets/img/icon-192.png'
        };

        if (target === 'all') {
            payload.included_segments = ['Subscribed Users'];
        } else {
            payload.include_aliases = { external_id: [target] };
            payload.target_channel = 'push';
        }

        const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${ONESIGNAL_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('OneSignal Error:', data);
            return res.status(response.status).json({ error: data });
        }

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Failed to send broadcast:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
