import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nnizooudxhvjyfaahydc.supabase.co';
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uaXpvb3VkeGh2anlmYWFoeWRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzcyODE1NywiZXhwIjoyMTAzMzA0MTU3fQ.8CjJAPFkJbFfo5Hrn1eOU3u8AnFSmx-KCnE0L2xAVnE';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
        return res.status(200).json({ status: 'active', message: 'Dompetku & NTGold Unified Bot Webhook is running.' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const update = req.body;
    if (!update) return res.status(200).end();

    try {
        if (update.message) {
            await handleTelegramMessage(update.message);
        } else if (update.callback_query) {
            await handleTelegramCallback(update.callback_query);
        }
        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('Webhook processing error:', err);
        return res.status(200).json({ ok: false, error: err.message });
    }
}

// ==========================================
// TELEGRAM MESSAGE HANDLER
// ==========================================
async function handleTelegramMessage(msg) {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    const text = msg.text ? msg.text.trim() : '';

    if (!text) return;

    // 1. COMMAND: /start or /start <LINK_CODE>
    if (text.startsWith('/start')) {
        const parts = text.split(' ');
        if (parts.length > 1 && parts[1]) {
            await handleLinkAccount(chatId, parts[1].trim(), msg.from?.username);
            return;
        }
        await sendTelegramMessage(chatId, `👋 *Halo! Selamat datang di Bot Asisten Keuangan Dompetku & NTGold.*\n\nUntuk memulai, tautkan akun Anda dengan perintah:\n• \`/link <KODE_PAIRING>\` (Dapatkan di menu Pengaturan Web)\n• Atau ketik \`/login email@domain.com password\`\n\n*Fitur Utama:*\n💵 Catat pengeluaran: _"beli kopi 15rb"_\n📈 Cek target tabungan emas: _"berapa lagi target untuk Dana Pensiun"_\n🪙 Cek harga emas: _"harga emas antam hari ini"_`, { parse_mode: 'Markdown' });
        return;
    }

    // 2. COMMAND: /link <CODE>
    if (text.startsWith('/link')) {
        const parts = text.split(' ');
        if (parts.length < 2) {
            await sendTelegramMessage(chatId, `⚠️ Format salah. Gunakan: \`/link <KODE_PAIRING>\`\n\nContoh: \`/link AB12CD\``, { parse_mode: 'Markdown' });
            return;
        }
        await handleLinkAccount(chatId, parts[1].trim(), msg.from?.username);
        return;
    }

    // 3. COMMAND: /login <email> <password>
    if (text.startsWith('/login')) {
        // Auto delete message to keep password secret
        await deleteTelegramMessage(chatId, messageId);

        const parts = text.split(' ');
        if (parts.length < 3) {
            await sendTelegramMessage(chatId, `⚠️ Format login salah.\nGunakan: \`/login email@domain.com password\``, { parse_mode: 'Markdown' });
            return;
        }

        const email = parts[1].trim();
        const password = parts.slice(2).join(' ');

        await handleDirectLogin(chatId, email, password, msg.from?.username);
        return;
    }

    // 4. CHECK USER PROFILE BY TELEGRAM CHAT ID
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('telegram_chat_id', chatId)
        .maybeSingle();

    if (!profile) {
        await sendTelegramMessage(chatId, `🔒 *Akun Belum Terhubung*\n\nSilakan tautkan akun Anda terlebih dahulu:\n• Ketik \`/link <KODE_PAIRING>\`\n• Atau ketik \`/login email password\``, { parse_mode: 'Markdown' });
        return;
    }

    // 5. INTENT CLASSIFICATION & PARSING (DOMPETKU vs NTGOLD)
    await processSmartUserInput(chatId, messageId, text, profile);
}

// ==========================================
// SMART INTENT & NLP PROCESSING
// ==========================================
async function processSmartUserInput(chatId, messageId, text, profile) {
    const lowerText = text.toLowerCase();

    // Skenario A: Kueri Target Tabungan Emas NTGold ("berapa lagi target untuk Dana Pensiun")
    if (lowerText.includes('target') || lowerText.includes('pensiun') || lowerText.includes('haji') || (lowerText.includes('sisa') && lowerText.includes('emas'))) {
        await handleNTGoldGoalQuery(chatId, profile.id, text);
        return;
    }

    // Skenario B: Kueri Harga Emas Terkini ("harga emas hari ini", "harga antam")
    if (lowerText.includes('harga emas') || lowerText.includes('harga antam') || lowerText.includes('harga ubs')) {
        await handleNTGoldPriceQuery(chatId);
        return;
    }

    // Skenario C: Kueri Total Kekayaan ("total kekayaan", "net worth", "rekap saldo")
    if (lowerText.includes('kekayaan') || lowerText.includes('net worth') || lowerText.includes('rekap keuangan')) {
        await handleNetWorthQuery(chatId, profile.id);
        return;
    }

    // Skenario D: Pencatatan Transaksi Dompetku ("beli kopi 15rb", "belanja bulanan 1.2jt", "gaji 5jt")
    await handleDompetkuTransaction(chatId, profile, text);
}

// ==========================================
// DOMPETKU EXPENSE/INCOME LOGIC
// ==========================================
async function handleDompetkuTransaction(chatId, profile, text) {
    // 1. Fetch user's categories and wallets
    const [{ data: categories }, { data: wallets }] = await Promise.all([
        supabaseAdmin.from('categories').select('*').or(`user_id.eq.${profile.id},user_id.is.null`),
        supabaseAdmin.from('wallets').select('*').eq('user_id', profile.id)
    ]);

    const parsed = parseExpenseTextNLP(text, categories || [], wallets || []);

    if (!parsed || parsed.amount <= 0) {
        await sendTelegramMessage(chatId, `❓ Maaf, saya belum memahami nominal transaksi tersebut.\n\nContoh yang bisa Anda ketik:\n• _"beli kopi 15rb"_\n• _"belanja bulanan 1.200.000"_\n• _"bensin 50k pake gopay"_\n• _"gaji bulanan 8jt masuk ke BCA"_`, { parse_mode: 'Markdown' });
        return;
    }

    const defaultWallet = (wallets || []).find(w => w.id === profile.default_wallet_id) || (wallets || [])[0];
    const targetWallet = parsed.wallet || defaultWallet;

    if (!targetWallet) {
        await sendTelegramMessage(chatId, `⚠️ Anda belum memiliki dompet di Dompetku. Buka aplikasi web untuk membuat dompet terlebih dahulu.`);
        return;
    }

    // Update wallet balance
    const currentBal = Number(targetWallet.balance || 0);
    const newBal = parsed.type === 'expense' ? currentBal - parsed.amount : currentBal + parsed.amount;

    await supabaseAdmin.from('wallets').update({ balance: newBal }).eq('id', targetWallet.id);

    // Insert transaction
    const { data: newTx, error: txErr } = await supabaseAdmin.from('transactions').insert({
        user_id: profile.id,
        wallet_id: targetWallet.id,
        category_id: parsed.category ? parsed.category.id : null,
        type: parsed.type,
        amount: parsed.amount,
        description: parsed.description || 'Pengeluaran',
        source: 'telegram',
        transaction_date: new Date().toISOString()
    }).select().single();

    if (txErr) {
        await sendTelegramMessage(chatId, `❌ Gagal mencatat: ${txErr.message}`);
        return;
    }

    const typeEmoji = parsed.type === 'expense' ? '🔴' : '🟢';
    const typeLabel = parsed.type === 'expense' ? 'Pengeluaran' : 'Pemasukan';
    const formattedAmount = formatCurrency(parsed.amount);
    const formattedBal = formatCurrency(newBal);

    const responseMsg = `✅ *${typeLabel} Berhasil Dicatat!*
━━━━━━━━━━━━━━━━━━━━━━
📝 *Keterangan* : ${parsed.description}
💰 *Nominal*    : ${typeEmoji} ${formattedAmount}
📁 *Kategori*   : ${parsed.category ? parsed.category.name : 'Umum'}
💳 *Dompet*     : ${targetWallet.name} (Sisa: ${formattedBal})
📅 *Waktu*      : ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
━━━━━━━━━━━━━━━━━━━━━━`;

    const inlineKeyboard = {
        inline_keyboard: [
            [{ text: '🗑️ Batalkan', callback_data: `tx_cancel:${newTx.id}` }]
        ]
    };

    await sendTelegramMessage(chatId, responseMsg, {
        parse_mode: 'Markdown',
        reply_markup: JSON.stringify(inlineKeyboard)
    });
}

// ==========================================
// NTGOLD TARGET QUERY LOGIC
// ==========================================
async function handleNTGoldGoalQuery(chatId, userId, text) {
    // 1. Search for wallet/goal in tblwallet
    const { data: goals, error: gErr } = await supabaseAdmin
        .from('tblwallet')
        .select('*')
        .eq('user_id', userId);

    if (gErr || !goals || goals.length === 0) {
        await sendTelegramMessage(chatId, `⚠️ Belum ada target/goal tabungan emas yang ditemukan di akun NTGold Anda.`);
        return;
    }

    // Match closest goal name or use first
    let matchedGoal = goals.find(g => text.toLowerCase().includes((g.wallet_name || '').toLowerCase())) || goals[0];

    // 2. Sum inventory grams in tblinventory
    const { data: items } = await supabaseAdmin
        .from('tblinventory')
        .select('weight_grams, purchase_price')
        .eq('wallet_id', matchedGoal.wallet_id)
        .eq('user_id', userId);

    const totalGrams = (items || []).reduce((sum, item) => sum + (parseFloat(item.weight_grams) || 0), 0);
    const totalCost = (items || []).reduce((sum, item) => sum + (parseFloat(item.purchase_price) || 0), 0);

    const targetGrams = parseFloat(matchedGoal.goal_amount) || 0;
    const remainingGrams = Math.max(0, targetGrams - totalGrams);
    const progressPercent = targetGrams > 0 ? (totalGrams / targetGrams) * 100 : 0;

    // 3. Get latest gold price (Antam 1 gr)
    let latestPrice = 1500000;
    const { data: priceRow } = await supabaseAdmin
        .from('market_price_history')
        .select('price')
        .ilike('brand_name', '%Antam%')
        .eq('weight_grams', 1)
        .order('recorded_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (priceRow && priceRow.price) {
        latestPrice = parseFloat(priceRow.price);
    }

    const currentMarketValue = totalGrams * latestPrice;
    const remainingCostEstimate = remainingGrams * latestPrice;
    const profitLoss = currentMarketValue - totalCost;

    const reply = `📊 *Status Target: ${matchedGoal.wallet_name} (NTGold)*
━━━━━━━━━━━━━━━━━━━━━━
🎯 *Target Emas*   : ${targetGrams.toFixed(2)} gr
✨ *Terkumpul*     : ${totalGrams.toFixed(2)} gr (${progressPercent.toFixed(1)}%)
⏳ *Sisa Target*   : *${remainingGrams.toFixed(2)} gr*

💰 *Modal Beli*    : ${formatCurrency(totalCost)}
📈 *Nilai Pasar*   : ${formatCurrency(currentMarketValue)}
🚀 *Floating P/L*  : ${profitLoss >= 0 ? '+' : ''}${formatCurrency(profitLoss)}
💵 *Estimasi Sisa* : Butuh ± ${formatCurrency(remainingCostEstimate)} lagi
━━━━━━━━━━━━━━━━━━━━━━
_(Dihitung berdasarkan harga Antam 1gr: ${formatCurrency(latestPrice)})_`;

    await sendTelegramMessage(chatId, reply, { parse_mode: 'Markdown' });
}

// ==========================================
// NTGOLD PRICE & NET WORTH QUERY
// ==========================================
async function handleNTGoldPriceQuery(chatId) {
    const { data: prices } = await supabaseAdmin
        .from('market_price_history')
        .select('*')
        .eq('weight_grams', 1)
        .order('recorded_date', { ascending: false })
        .limit(4);

    if (!prices || prices.length === 0) {
        await sendTelegramMessage(chatId, `🪙 Harga emas Antam hari ini sekitar *Rp 1.500.000 / gram*.`);
        return;
    }

    const rows = prices.map(p => `• *${p.brand_name} (1 gr)*: ${formatCurrency(p.price)} (${p.recorded_date})`).join('\n');
    await sendTelegramMessage(chatId, `🪙 *Update Harga Emas Hari Ini (per 1 Gram):*\n\n${rows}`, { parse_mode: 'Markdown' });
}

async function handleNetWorthQuery(chatId, userId) {
    const { data, error } = await supabaseAdmin.rpc('get_user_net_worth', { p_user_id: userId });
    if (error || !data) {
        await sendTelegramMessage(chatId, `⚠️ Gagal menghitung kekayaan total.`);
        return;
    }

    const reply = `👑 *Rekap Kekayaan Bersih (Net Worth)*
━━━━━━━━━━━━━━━━━━━━━━
💵 *Saldo Uang Tunai / Bank* : ${formatCurrency(data.total_cash)}
🪙 *Total Emas Dimiliki*     : ${Number(data.total_gold_grams).toFixed(2)} gr
📈 *Nilai Pasar Emas*        : ${formatCurrency(data.gold_market_value)}
━━━━━━━━━━━━━━━━━━━━━━
💎 *TOTAL KEKAYAAN* : *${formatCurrency(data.net_worth)}*
━━━━━━━━━━━━━━━━━━━━━━`;

    await sendTelegramMessage(chatId, reply, { parse_mode: 'Markdown' });
}

// ==========================================
// TELEGRAM CALLBACK HANDLER
// ==========================================
async function handleTelegramCallback(callbackQuery) {
    const data = callbackQuery.data || '';
    const chatId = callbackQuery.message.chat.id;

    if (data.startsWith('tx_cancel:')) {
        const txId = data.replace('tx_cancel:', '');
        const { data: tx } = await supabaseAdmin.from('transactions').select('*').eq('id', txId).single();

        if (tx) {
            // Revert balance
            const { data: wallet } = await supabaseAdmin.from('wallets').select('*').eq('id', tx.wallet_id).single();
            if (wallet) {
                const restored = tx.type === 'expense' ? Number(wallet.balance) + Number(tx.amount) : Number(wallet.balance) - Number(tx.amount);
                await supabaseAdmin.from('wallets').update({ balance: restored }).eq('id', wallet.id);
            }
            await supabaseAdmin.from('transactions').delete().eq('id', txId);
            await sendTelegramMessage(chatId, `🗑️ Transaksi *${tx.description} (${formatCurrency(tx.amount)})* berhasil dibatalkan & saldo dikembalikan.`, { parse_mode: 'Markdown' });
        }
    }
}

// ==========================================
// DIRECT LOGIN & PAIRING HELPERS
// ==========================================
async function handleDirectLogin(chatId, email, password, username) {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
        await sendTelegramMessage(chatId, `❌ Login gagal: ${error?.message || 'Email atau password salah'}`);
        return;
    }

    await supabaseAdmin.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        telegram_chat_id: chatId,
        telegram_username: username || null
    });

    await sendTelegramMessage(chatId, `🎉 *Login Berhasil!*\n\nSelamat datang, *${data.user.email}*! Akun Dompetku & NTGold Anda kini terhubung.\n\nAnda sekarang bisa langsung mencatat pengeluaran atau bertanya target tabungan emas di sini.`, { parse_mode: 'Markdown' });
}

async function handleLinkAccount(chatId, code, username) {
    const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('telegram_link_code', code.toUpperCase())
        .maybeSingle();

    if (error || !profile) {
        await sendTelegramMessage(chatId, `❌ Kode pairing *${code}* tidak ditemukan atau sudah kedaluwarsa. Silakan cek menu Pengaturan di Dompetku Web.`, { parse_mode: 'Markdown' });
        return;
    }

    await supabaseAdmin
        .from('profiles')
        .update({
            telegram_chat_id: chatId,
            telegram_username: username || null
        })
        .eq('id', profile.id);

    await sendTelegramMessage(chatId, `🎉 *Akun Berhasil Dihubungkan!*\n\nHalo *${profile.full_name || profile.email}*, bot siap mencatat pengeluaran Anda dan menginfokan progres tabungan emas NTGold.`, { parse_mode: 'Markdown' });
}

// ==========================================
// INDONESIAN NLP PARSER
// ==========================================
function parseExpenseTextNLP(text, categories, wallets) {
    let cleaned = text.trim();
    let type = 'expense';

    // Detect income keywords
    if (/^(gaji|terima|dapat|masuk|bonus|penjualan|pemasukan)/i.test(cleaned)) {
        type = 'income';
    }

    // Extract amount: e.g., "15rb", "15k", "1.200.000", "50000", "1.2jt", "2,5 juta"
    let amount = 0;
    const numMatch = cleaned.match(/(\d+[\d\.,]*)\s*(rb|k|ribu|jt|juta)?/i);

    if (numMatch) {
        let numStr = numMatch[1].replace(/\./g, '').replace(/,/g, '.');
        let rawNum = parseFloat(numStr);
        let unit = (numMatch[2] || '').toLowerCase();

        if (unit === 'rb' || unit === 'k' || unit === 'ribu') {
            amount = rawNum * 1000;
        } else if (unit === 'jt' || unit === 'juta') {
            amount = rawNum * 1000000;
        } else {
            amount = rawNum;
        }
    }

    // Clean description: remove amount portion and common prefixes
    let desc = cleaned
        .replace(/^(beli|bayar|catat|pengeluaran|pemasukan|gaji)\s+/i, '')
        .replace(/(\d+[\d\.,]*)\s*(rb|k|ribu|jt|juta)?/gi, '')
        .replace(/\s+(pake|dari|ke|via)\s+\w+/gi, '')
        .trim();

    if (!desc) desc = type === 'expense' ? 'Pengeluaran' : 'Pemasukan';
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);

    // Match category
    let matchedCategory = null;
    const lowerDesc = desc.toLowerCase();

    for (const cat of categories) {
        const catName = cat.name.toLowerCase();
        if (lowerDesc.includes(catName) || (catName.includes('makan') && /(kopi|nasi|makan|bakso|ayam|mie|roti|snack|minum|kafe)/i.test(lowerDesc))) {
            matchedCategory = cat;
            break;
        } else if (catName.includes('trans') && /(bensin|pertamax|pertalite|ojol|gojek|grab|parkir|tol)/i.test(lowerDesc)) {
            matchedCategory = cat;
            break;
        } else if (catName.includes('belanja') && /(shopee|tokped|baju|celana|pasar|supermarket|indomaret|alfamart)/i.test(lowerDesc)) {
            matchedCategory = cat;
            break;
        } else if (catName.includes('tagihan') && /(listrik|pln|wifi|indihome|pulsa|air|pdam|bpjs)/i.test(lowerDesc)) {
            matchedCategory = cat;
            break;
        }
    }

    // Match wallet
    let matchedWallet = null;
    for (const w of wallets) {
        if (cleaned.toLowerCase().includes(w.name.toLowerCase())) {
            matchedWallet = w;
            break;
        }
    }

    return { type, amount, description: desc, category: matchedCategory, wallet: matchedWallet };
}

function formatCurrency(num) {
    return 'Rp ' + new Intl.NumberFormat('id-ID').format(num || 0);
}

// ==========================================
// TELEGRAM API CLIENT HELPERS
// ==========================================
async function sendTelegramMessage(chatId, text, options = {}) {
    if (!TELEGRAM_BOT_TOKEN) return;
    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: text, ...options })
        });
    } catch (e) {
        console.error('Telegram send error:', e);
    }
}

async function deleteTelegramMessage(chatId, messageId) {
    if (!TELEGRAM_BOT_TOKEN) return;
    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, message_id: messageId })
        });
    } catch (e) {
        console.error('Telegram delete error:', e);
    }
}

