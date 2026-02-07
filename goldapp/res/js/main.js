const SUPABASE_URL = "https://iwsacljessokrqhfmdbv.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3c2FjbGplc3Nva3JxaGZtZGJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxODcyNTMsImV4cCI6MjA4Mzc2MzI1M30.jQ_8KR76Xbbn1Heest75p3I78J6oiSt9V-H31cWWLOo"; 
const { createClient } = supabase;
const sbClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let latestPricesMap = new Map();

window.onload = async () => {
	document.getElementById('lang_select').value = currentLang;

	await fetchMarketData(); 
	const { data: { session } } = await sbClient.auth.getSession();
	
	updateUI(session);
	
	if(session) {
		loadProfile(session.user);
		fetchPortfolio(session.user);
	}
	
	sbClient.auth.onAuthStateChange((event, session) => { 
		updateUI(session);
		if(session) {
			loadProfile(session.user);
			fetchPortfolio(session.user);

			if(event === 'SIGNED_IN') nav('market');
		}
	});

	applyLang();
};

// Pull to refresh
let touchStartY = 0;
let isRefreshing = false;
const ptrSpinner = document.getElementById('ptr-spinner');

document.addEventListener('touchstart', e => { 
    if (document.documentElement.scrollTop === 0) {
        touchStartY = e.touches[0].pageY; 
    }
}, {passive: true});

document.addEventListener('touchmove', e => {
    if (isRefreshing || document.documentElement.scrollTop > 0) return;

    const y = e.touches[0].pageY;
    const pullDistance = y - touchStartY;

    if (pullDistance > 0 && pullDistance < 150) {
        ptrSpinner.style.display = 'flex';
        ptrSpinner.style.top = `${Math.min(pullDistance - 50, 70)}px`;
        ptrSpinner.style.transform = `translateX(-50%) rotate(${pullDistance * 2}deg)`;
    }
}, {passive: true});

document.addEventListener('touchend', async () => {
    const currentTop = parseInt(ptrSpinner.style.top);
    
    if (currentTop >= 60 && !isRefreshing) {
        isRefreshing = true;
        ptrSpinner.style.top = '70px';
        
        await Promise.all([
            fetchMarketData(),
            fetchPortfolio(currentSessionUser)
        ]);

        showToast(currentLang === 'en' ? "Data Updated" : "Data Diperbarui");
        
        setTimeout(() => {
            ptrSpinner.style.top = '-50px';
            isRefreshing = false;
        }, 500);
    } else {
        ptrSpinner.style.top = '-50px';
    }
});

function updateUI(session) {
	const desktop = document.getElementById('desktop-links');
	const mobileNav = document.getElementById('mobile-nav');
	const avatarContainer = document.getElementById('mobile-avatar-container');
	const avatarImg = document.getElementById('mobile-avatar-img');
	const profilePageImg = document.getElementById('profile-page-img');
	const profilePageName = document.getElementById('profile-page-name');

	const iconHome = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>`;
	const iconPort = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v11a2 2 0 002 2h14a2 2 0 002-2v-1M21 12a2 2 0 00-2-2h-1a2 2 0 00-2 2v0a2 2 0 002 2h1a2 2 0 002-2z" /></svg>`;
	const iconUser = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>`;

	if (session) {
		avatarContainer.style.display = 'block';
		const seed = session.user.email.split('@')[0];
		const avatarUrl = `https://ui-avatars.com/api/?name=${seed}&background=F5C518&color=000&rounded=true&bold=true`;
		avatarImg.src = avatarUrl; profilePageImg.src = avatarUrl; profilePageName.innerText = seed;

		desktop.innerHTML = `
			<a onclick="nav('market')" class="nav-item" data-page="market" data-i18n="market">${t('market')}</a>
			<a onclick="nav('portfolio')" class="nav-item" data-page="portfolio" data-i18n="portfolio">${t('portfolio')}</a>
			<a onclick="nav('profile')" class="nav-item" data-page="profile" data-i18n="profile">${t('profile')}</a>`;
		mobileNav.innerHTML = `
			<a onclick="nav('market', this)" data-page="market" class="nav-item">${iconHome}<div data-i18n="market">${t('market')}</div></a>
			<a onclick="nav('portfolio', this)" data-page="portfolio" class="nav-item">${iconPort}<div data-i18n="portfolio">${t('portfolio')}</div></a>
			<a onclick="nav('profile', this)" data-page="profile" class="nav-item">${iconUser}<div data-i18n="profile">${t('profile')}</div></a>`;

		const savedPage = localStorage.getItem('last_page') || 'market';
        nav(savedPage);
	} else {
		avatarContainer.style.display = 'none';
		desktop.innerHTML = `<a onclick="nav('market')">Market</a><button class="btn-primary" style="width:auto; padding:8px 20px" onclick="nav('auth')" data-i18n="login">Login</button>`;
		mobileNav.innerHTML = `<a onclick="nav('market', this)" data-page="market" class="nav-item">${iconHome}<div data-i18n="market">Market</div></a><a onclick="nav('auth', this)" data-page="auth" class="nav-item">${iconUser}<div data-i18n="login">Login</div></a>`;

		nav('market');

		// By Default is blank when no session
		const badges = [document.getElementById('desktop-sub-badge'), document.getElementById('mobile-sub-badge')];

		badges.forEach(badge => {
			badge.innerText = '';
		});
	}
}

function nav(page, el) {
	// Save current page state
	localStorage.setItem('last_page', page);

	// Toggle Section Visibility
	document.querySelectorAll('.section').forEach(e => e.classList.remove('active-section'));
	const target = document.getElementById(`page-${page}`);
	if(target) target.classList.add('active-section');

	// Toggle Navigation Active State
	document.querySelectorAll('[data-page]').forEach(e => e.classList.remove('active'));
	
	if (el) {
		el.classList.add('active');
	} else {
		// Find the mobile nav item that matches the page ID
		const targetButtons = document.querySelectorAll(`[data-page="${page}"]`);
        targetButtons.forEach(btn => btn.classList.add('active'));
	}
}

function setSubBadge(type) {
	const badges = [document.getElementById('desktop-sub-badge'), document.getElementById('mobile-sub-badge')];
	const isPro = type?.toLowerCase() === 'pro';

	badges.forEach(badge => {
		if (!badge) return;
		badge.innerText = isPro ? 'Pro' : 'Free';
		badge.className = isPro ? 'sub-badge sub-badge-pro' : 'sub-badge sub-badge-free';
	});
}

// Brand Logo
function getBrandLogo(brandName) {
	const lower = brandName.toLowerCase();
	if(lower.includes('antam')) return './logos/antam.jpg';
	if(lower.includes('emas kita')) return './logos/emaskita.jpg';
	if(lower.includes('galeri24')) return './logos/galeri24.jpg';
	if(lower.includes('king halim')) return './logos/kinghalim.jpg';
	if(lower.includes('lotus archi')) return './logos/lotusarchi.jpg';
	if(lower.includes('sampoerna')) return './logos/sampoerna.jpg';
	if(lower.includes('ubs')) return './logos/ubs.jpg';
	return 'https://cdn-icons-png.flaticon.com/512/217/217853.png';
}

function getBrandUrl(brandName) {
	const l = brandName.toLowerCase();
	if (l.includes('antam')) return 'https://www.logammulia.com/id/harga-emas-hari-ini';
	if (l.includes('ubs')) return 'https://ubslifestyle.com/fine-gold/';
	if (l.includes('galeri24')) return 'https://galeri24.co.id/harga-emas';
	if (l.includes('lotus archi')) return 'https://lotusarchi.com/pricing';
	if (l.includes('emas kita')) return 'https://emaskita.id/Harga_emas';
	if (l.includes('sampoerna')) return 'https://sampoernagold.com';
	if (l.includes('king halim')) return 'https://www.kinghalim.com/goldbarwithamala';
	return '#';
}

// Market Data
let brandWeightMap = {};

async function fetchMarketData() {
	const dateLimit = new Date(); dateLimit.setDate(dateLimit.getDate() - 7);
	const { data } = await sbClient.from('tblpricelog')
		.select(`*, tblbrand(brand_name,brand_id)`)
		.gt('log_date', dateLimit.toISOString().split('T')[0])
		.order('log_date', { ascending: false })
		.order('created_date', { ascending: false });

	if (!data) return;

	// Populate Modal Select
	const map = new Map();
	const brands = new Set();
	const uniqueMap = new Map();   // Stores the latest price
	const historyMap = new Map();  // Stores the second latest price
	const distinctWeights = new Set();

	brandWeightMap = {};
	
	data.forEach(item => {
		const brandId = item.tblbrand.brand_id;
        const brandName = item.tblbrand.brand_name;
        const weight = item.weight_grams;
        const key = `${brandName}_${weight}`;
		
		if (!uniqueMap.has(key)) {
			// First time seeing this brand/weight = Latest Data
			uniqueMap.set(key, item);
			brands.add(brandId + "|" + brandName);
			distinctWeights.add(item.weight_grams);

			// Build the Brand -> Weight mapping
			if (!brandWeightMap[brandId]) {
                brandWeightMap[brandId] = new Set();
            }
            brandWeightMap[brandId].add(weight);
		} else if (!historyMap.has(key)) {
			// Second time seeing this brand/weight = Previous Data
			historyMap.set(key, item);
		}
	});

	latestPricesMap = uniqueMap;

	// Populate Modal Select
	brandList = Array.from(brands).map(s => {
        const [brand_id, name] = s.split("|"); 
        return { brand_id, name };
    }).sort((a, b) => a.name.localeCompare(b.name));
	const brandSelect = document.getElementById('add-brand');
	brandSelect.innerHTML = brandList.map(b => `<option value="${b.brand_id}">${b.name}</option>`).join('');

	// Trigger initial weight population for the first brand in the list
    if (brandList.length > 0) {
        updateWeightOptions(brandList[0].brand_id);
    }

	// const weightSelect = document.getElementById('add-weight');
	// const sortedWeights = Array.from(distinctWeights).sort((a, b) => a - b);
	// weightSelect.innerHTML = sortedWeights.map(w => `<option value="${w}">${w} Gram</option>`).join('');

	const excludedMain = ['antam retro', 'ubs old'];
	const items = Array.from(uniqueMap.values())
		.filter(item => {
			const name = item.tblbrand?.brand_name?.toLowerCase() || "";
			// This removes the brand from Desktop, Mobile, and Summary lists
			return !excludedMain.includes(name); 
		})
		.sort((a, b) => {
			const brandA = a.tblbrand?.brand_name || ""; 
			const brandB = b.tblbrand?.brand_name || "";
			return brandA.localeCompare(brandB) || a.weight_grams - b.weight_grams;
		});

	// Render Summary Lowest Price
	const summaryContainer = document.getElementById('market-summary-container');
	const summaryList = document.getElementById('summary-cards-list');
	const excludedBrands = ['antam series', 'antam retro', 'ubs old'];

	const summaryItems = items
		.filter(item => {
			const name = item.tblbrand?.brand_name?.toLowerCase() || "";
			return item.weight_grams === 1 && !excludedBrands.includes(name);
		})
		.sort((a, b) => a.price - b.price);

	if (summaryItems.length > 0) {
		summaryContainer.style.display = 'block';
		summaryList.innerHTML = summaryItems.map((item, index) => {
			const brandName = item.tblbrand?.brand_name || "Unknown";
			const isCheapest = index === 0;

			const key = `${brandName}_${item.weight_grams}`;
			const prevData = historyMap.get(key);
			const prevPrice = prevData ? prevData.price : item.price;
			const diff = item.price - prevPrice;
			const diffPer = prevPrice > 0 ? ((diff / prevPrice) * 100).toFixed(2) : 0;

			const colorTrend = diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--text-sub)';
			const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '•';
			const { time, color } = formatTime(item);
			
			return `
			<div style="flex: 0 0 160px; scroll-snap-align: start; background: var(--card-bg); border: 1px solid ${isCheapest ? 'var(--accent)' : 'var(--border)'}; padding: 16px; border-radius: 16px; position: relative;">
				${isCheapest ? `<div style="position:absolute; top:0; right:0; background:var(--accent); color:#000; font-size:8px; font-weight:900; padding:2px 6px; border-bottom-left-radius:8px;">BEST VALUE</div>` : ''}
				<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
					<a href="${getBrandUrl(brandName)}" target="_blank" style="text-decoration:none; display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
						<img src="${getBrandLogo(brandName)}" style="width:20px; height:20px; border-radius:50%; background:#fff;">
						<span style="font-size:12px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
						${brandName}<br>
						<text style="font-size:8px; opacity:0.5">Last Update : ${time}</text>
					</a>
					</span>
				</div>
				<div class="price-font" style="font-size:14px; font-weight:800; color:${isCheapest ? 'var(--accent)' : 'var(--text-main)'}">
					Rp ${item.price.toLocaleString('id-ID')}
				</div>
				<div style="font-size:10px; font-weight:700; color:${colorTrend}; margin-top:4px;">
					${arrow} Rp ${Math.abs(diff).toLocaleString('id-ID')} (${diffPer}%)
				</div>
			</div>`;
		}).join('');
	}

	// Render Market Desktop
	document.getElementById('desktop-tbody').innerHTML = items.map(item => {
		const { time, color } = formatTime(item);
		return `<tr>
			<td><span style="color:var(--accent); font-weight:700">${item.tblbrand?.brand_name}</span></td>
			<td>${item.weight_grams}g</td>
			<td style="text-align:right" class="price-font">Rp ${item.price.toLocaleString('id-ID')}</td>
			<td style="text-align:right; opacity:0.6">Rp ${item.buyback_price.toLocaleString('id-ID')}</td>
			<td style="text-align:right; font-size:12px; color:${color}">${time}</td>
		</tr>`;
	}).join('');

	// Render Market Mobile
	document.getElementById('mobile-list').innerHTML = items.map(item => {
		const { time, isToday } = formatTime(item);
		const updateBadge = isToday ? `<span class="pill-update">Today</span>` : "";
		const logoUrl = getBrandLogo(item.tblbrand?.brand_name || "");
		
		return `
		<div class="crypto-row" onclick="window.open('${getBrandUrl(item.tblbrand?.brand_name)}', '_blank')" style="cursor:pointer;">
			<div class="row-left">
				<img src="${logoUrl}" class="brand-logo-img" alt="logo" onerror="this.onerror=null; this.src='https://cdn-icons-png.flaticon.com/512/217/217853.png';">
				<div>
					<div class="coin-name">${item.tblbrand?.brand_name} <span style="font-size:12px; opacity:0.5">· ${item.weight_grams}g</span></div>
					<div class="coin-weight">${time} ${updateBadge}</div>
				</div>
			</div>
			<div class="row-right">
				<div class="coin-price price-font">Rp ${item.price.toLocaleString('id-ID')}</div>
				<div class="coin-sub">Buyback: Rp ${item.buyback_price.toLocaleString('id-ID')}</div>
			</div>
		</div>`;
	}).join('');
}

function updateWeightOptions(brandId) {
    const weightSelect = document.getElementById('add-weight');
    
    // Get weights for this brand from our map and sort them
    const weights = Array.from(brandWeightMap[brandId] || []).sort((a, b) => a - b);
    
    if (weights.length > 0) {
        weightSelect.innerHTML = weights.map(w => 
            `<option value="${w}">${w} Gram</option>`
        ).join('');
    } else {
        weightSelect.innerHTML = `<option value="">No weights available</option>`;
    }
}

// Portfolio Data
let currentSessionUser = null;
async function fetchPortfolio(user) {
	if (!user) return;
	currentSessionUser = user;
	
	const isBuybackMode = document.getElementById('buyback-toggle').checked;
	const sortVal = document.getElementById('portfolio-sort').value;
	const listEl = document.getElementById('portfolio-list');
	const tableEl = document.getElementById('portfolio-desktop-tbody');
	const totalEl = document.getElementById('pf-total');
	const plEl = document.getElementById('pf-pl');

	let sortCol = 'purchase_date';
	let sortAsc = false;

	if (sortVal.startsWith('weight')) sortCol = 'weight_grams';
	if (sortVal.startsWith('brand')) sortCol = 'tblbrand(brand_name)';
	if (sortVal.endsWith('asc')) sortAsc = true;

	const { data: assets, error } = await sbClient
		.from('tblinventory')
		.select(`inventory_id, weight_grams, purchase_price, purchase_date, tblbrand(brand_name)`)
		.eq('user_id', user.id)
		.order(sortCol, { ascending: sortAsc });

	if(error || !assets || assets.length === 0) {
		listEl.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-sub);">Vault is empty.</div>`;
		return;
	}

	let totalCurrentValue = 0;
	let totalPurchaseCost = 0;
	let totalGrams = 0;

	let desktopHTML = "";
	let mobileHTML = "";

	const trashIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>`;

	assets.forEach((asset) => {
		const brand = asset.tblbrand?.brand_name || "Unknown";
		const weight = asset.weight_grams || 0;
		const cost = asset.purchase_price || 0;
		const pDate = asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : 'No Date';

		const marketData = latestPricesMap.get(`${brand}_${weight}`);
		const activePrice = isBuybackMode ? (marketData?.buyback_price || 0) : (marketData?.price || 0);
		
		totalCurrentValue += activePrice;
		totalPurchaseCost += cost;
		totalGrams += weight;

		const diff = activePrice - cost;
		const color = diff >= 0 ? 'var(--success)' : 'var(--danger)';

		// Render Detail Wallet Desktop
		desktopHTML += `
			<tr>
				<td><img src="${getBrandLogo(brand)}" style="width:24px; vertical-align:middle; margin-right:10px;"> <b>${brand}</b></td>
				<td style="color:var(--text-sub)">${pDate}</td>
				<td style="text-align:right">${weight}g</td>
				<td style="text-align:right">Rp ${cost.toLocaleString('id-ID')}</td>
				<td style="text-align:right" class="price-font">Rp ${activePrice.toLocaleString('id-ID')}</td>
				<td style="text-align:right; color:${color}; font-weight:700">${diff >= 0 ? '+' : ''}Rp ${diff.toLocaleString('id-ID')}</td>
				<td style="text-align:right"><button onclick="deleteInventory('${asset.inventory_id}')" style="background:none; border:none; color:var(--text-sub); cursor:pointer; padding:5px;">${trashIcon}</button></td>
			</tr>`;

		mobileHTML += `
			<div class="swipe-container">
				<div class="swipe-action-bg" onclick="deleteInventory('${asset.inventory_id}')">
					${trashIcon}
				</div>
				<div class="crypto-row crypto-row-swipeable" 
					ontouchstart="handleTouchStart(event)" 
					ontouchmove="handleTouchMove(event)" 
					ontouchend="handleTouchEnd(event)">
					<div class="row-left">
						<img src="${getBrandLogo(brand)}" class="brand-logo-img">
						<div>
							<div class="coin-name">${brand} <span style="font-size:12px; opacity:.5">${weight}g</span></div>
							<div class="coin-weight"><span data-i18n="buy">Buy</span>: Rp ${cost.toLocaleString('id-ID')}</div>
							<div class="coin-weight">${pDate}</div>
						</div>
					</div>
					<div class="row-right">
						<div class="coin-price price-font">Rp ${activePrice.toLocaleString('id-ID')}</div>
						<div class="coin-sub" style="color:${color};font-weight:700">Rp ${diff.toLocaleString('id-ID')}</div>
					</div>
				</div>
			</div>`;
	});

	tableEl.innerHTML = desktopHTML;
	listEl.innerHTML = mobileHTML;

	// Total Net Worth
	totalEl.innerText = `Rp ${totalCurrentValue.toLocaleString('id-ID')}`;
	const totalDiff = totalCurrentValue - totalPurchaseCost;
	const totalPercent = totalPurchaseCost > 0 ? ((totalDiff / totalPurchaseCost) * 100).toFixed(2) : 0;
	
	plEl.style.color = totalDiff >= 0 ? '#268851' : 'var(--danger)';
	plEl.style.background = totalDiff >= 0 ? 'rgba(39, 201, 110, 0.1)' : 'rgba(255, 77, 77, 0.1)';
	plEl.innerText = `${totalDiff >= 0 ? '+' : ''}Rp ${totalDiff.toLocaleString('id-ID')} (${totalPercent}%)`;
	document.getElementById('pf-grams').innerText = `${totalGrams.toFixed(2)} Grams`;
}

function toggleAddModal() {
	const m = document.getElementById('add-modal');
	m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
	if(m.style.display === 'flex') document.getElementById('add-date').valueAsDate = new Date();
}

async function saveInventory() {
	if(!currentSessionUser) return showToast(currentLang === 'en' ? "Please login first" : "Mohon login terlebih dahulu", "failed");
	const b = document.getElementById('add-brand').value;
	const w = parseFloat(document.getElementById('add-weight').value);
	const p = parseFloat(document.getElementById('add-price').value);
	const d = document.getElementById('add-date').value;

	if(!b || !w || !p) return showToast(currentLang === 'en' ? "Please fill all fields" : "Mohon isi semua kolom", "failed");

	const { error } = await sbClient.from('tblinventory').insert({
		user_id: currentSessionUser.id,
		brand_id: b,
		weight_grams: w,
		purchase_price: p,
		purchase_date: d
	});

	if(error) showToast("Error: " + error.message, "failed");
	else {
		showToast(currentLang === 'en' ? "Added successfully" : "Berhasil menambahkan");
		toggleAddModal();
		fetchPortfolio(currentSessionUser);
	}
}

let deleteTargetId = null;
async function deleteInventory(id) {
	// const confirmMsg = currentLang === 'en' ? "Are you sure want to delete this?" : "Apakah kamu yakin akan menghapus ini?";
	deleteTargetId = id;
	const modal = document.getElementById('confirm-modal');
	document.getElementById('confirm-msg').innerText = currentLang === 'en' ? "Are you sure want to delete this ?" : "Apakah kamu yakin akan menghapus ini ?";
	
	modal.style.display = 'flex';

	document.getElementById('confirm-exec-btn').onclick = async () => {
		const { error } = await sbClient.from('tblinventory').delete().eq('inventory_id', deleteTargetId);
		if (error) {
			showToast("Error :" + error.message, "failed");
		} else {
			showToast(currentLang === 'en' ? "Item deleted" : "Aset dihapus");
			closeConfirm();
			fetchPortfolio(currentSessionUser);
		}
	};
}

function closeConfirm() {
	document.getElementById('confirm-modal').style.display = 'none';
	deleteTargetId = null;
}

let startX = 0;
let currentTarget = null;

function handleTouchStart(e) {
	document.querySelectorAll('.crypto-row-swipeable').forEach(el => {
		if (el !== e.currentTarget) el.classList.remove('swiped');
	});
	startX = e.touches[0].clientX;
	currentTarget = e.currentTarget;
}

function handleTouchMove(e) {
	let moveX = e.touches[0].clientX;
	let diff = startX - moveX;

	if (diff > 30) {
		currentTarget.classList.add('swiped');
	} 
	else if (diff < -30) {
		currentTarget.classList.remove('swiped');
	}
}

function handleTouchEnd(e) {
	// Logic is handled by classes, but we reset the target
	currentTarget = null;
}

function toggleAuth(){
	const l = document.getElementById('login-box'), r = document.getElementById('register-box');
	
	if (l.style.display === 'none') {
		l.style.display = 'block';
		r.style.display = 'none'
	} else {
		l.style.display = 'none';
		r.style.display = 'block'
	}
}

async function handleLogin() {
	const e = document.getElementById('l-email').value, p = document.getElementById('l-password').value;
	const {error} = await sbClient.auth.signInWithPassword({email:e,password:p});
	
	if (error) showToast("Error: " + error.message, "failed");
	else nav('market');
}

async function handleRegister() {
	const n = document.getElementById('r-name').value, e = document.getElementById('r-email').value, p = document.getElementById('r-password').value;
	const {error} = await sbClient.auth.signUp({
		email : e,
		password : p,
		options : {
			data: {
				full_name : n
			}
		}
	});
	
	if (error) showToast("Error: " + error.message, "failed");
	else {
		showToast(currentLang === 'en' ? "Registration Successful. Your account has been created" : "Registrasi berhasil. Akunmu telah terbuat");
		toggleAuth();
	}
}

async function handleLogout() {
	await sbClient.auth.signOut();
	nav('market');
}

async function loadProfile(user) {
	document.getElementById('prof-email').value = user.email;
	
	const{data} = await sbClient
		.from('tbluser')
		.select('full_name, user_type, tbllang(lang_code,lang_id)')
		.eq('id',user.id)
		.single();
	
	if (data) {
		document.getElementById('prof-name').value = data.full_name || '';
		document.getElementById('profile-page-name').innerText = data.full_name || user.email.split('@')[0];
		document.getElementById('lang_select').value = data.tbllang.lang_code.toLowerCase();
		
		setSubBadge(data.user_type);
		toggleLang(data.tbllang.lang_code.toLowerCase());
		applyLang();
	}
}

async function updateName() {
	const n = document.getElementById('prof-name').value;
	const l = document.getElementById('lang_select').value;
	const {data:{user}} = await sbClient.auth.getUser();

	const{data: lang} = await sbClient
		.from('tbllang')
		.select('lang_id')
		.eq('lang_code',l.toUpperCase());

	let langid = "";

	lang.forEach((asset) => {
		const lang = asset.lang_id;
		langid += `${lang}`;
	});

	await sbClient
		.from('tbluser')
		.update({full_name : n, lang_id : langid})
		.eq('id',user.id);
	
	showToast(currentLang === 'en' ? "Your profile has been updated" : "Profil berhasil diperbarui");

	loadProfile(user);
	location.reload();
}

async function updatePassword() {
	const p = document.getElementById('prof-pass').value;
	if (p) {
		await sbClient.auth.updateUser({password : p});
		
		showToast(currentLang === 'en' ? "Your password has been changed" : "Password berhasil diganti");
	}
}

function formatTime(item) {
	const d = new Date(item.created_date || item.log_date);
	const isToday = d.toDateString() === new Date().toDateString();
	const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
	const t = `${d.getDate()} ${m} ${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`;
	return { time: isToday ? `${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}` : t, color: isToday ? 'var(--success)' : 'var(--danger)', isToday };
}

function showToast(msg, type = 'success') {
	const container = document.getElementById('toast-container');
	const toast = document.createElement('div');
	toast.className = `toast toast-${type}`;
	
	// Simple icon logic
	// const icon = type === 'success' ? '✅' : '❌';
	// toast.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
	toast.innerHTML = `<span>${msg}</span>`;
	
	container.appendChild(toast);
	setTimeout(() => toast.remove(), 3000);
}

// Multi-language
let currentLang = localStorage.getItem('lang') || 'en';

function toggleLang(flag) {
	currentLang = flag;
	localStorage.setItem('lang', currentLang);
}

function t(key) {
	return i18n[currentLang][key] || key;
}

function applyLang() {
	document.querySelectorAll('[data-i18n]').forEach(el => {
		const key = el.getAttribute('data-i18n');
		el.innerText = t(key);
	});
}

const i18n = {
	en: {
		market: "Market",
		portfolio: "Portfolio",
		wallet: "Wallet",
		profile: "Profile",
		today_market: "Today's Market",
		best_value: "BEST VALUE",
		net_worth: "Total Net Worth",
		buyback: "Buyback",
		sign_out: "Sign Out",
		save_changes: "Save Changes",
		brand: "Brand",
		weight: "Weight",
		price: "Price",
		updated: "Updated",
		cost: "Buy Price",
		market_value: "Market Value",
		pl: "Profit/Loss",
		purchase_date: "Purchase Date",
		date_newest: "Date (Newest)",
		date_oldest: "Date (Oldest)",
		weight_high: "Weight (High)",
		weight_low: "Weight (Low)",
		lang_pref: "Language Preference",
		change_pass: "Change Password",
		change_pass_btn: "Update Password",
		email_address: "Email Address",
		full_name: "Full Name",
		update_profile_btn: "Save Changes",
		english: "English",
		indonesian: "Indonesian",
		logout: "Logout",
		add_item: "Add New Item",
		save: "Save",
		cancel: "Cancel",
		delete: "Delete",
		areyousure: "Are you sure ?",
		buy: "Buy"
	},
	id: {
		market: "Pasar",
		portfolio: "Portofolio",
		wallet: "Aset",
		profile: "Profil",
		today_market: "Harga Hari Ini",
		best_value: "Harga Terbaik",
		net_worth: "Total Aset Anda",
		buyback: "Harga Jual Kembali",
		sign_out: "Keluar",
		save_changes: "Simpan Perubahan",
		brand: "Merk",
		weight: "Berat",
		price: "Harga",
		updated: "Data Update",
		cost: "Harga Pembelian",
		market_value: "Harga Pasar",
		pl: "Untung/Rugi",
		purchase_date: "Tanggal Pembelian",
		date_newest: "Tanggal (Terbaru)",
		date_oldest: "Tanggal (Terlama)",
		weight_high: "Berat (Tertinggi)",
		weight_low: "Berat (Terendah)",
		lang_pref: "Preferensi Bahasa",
		change_pass: "Ubah Kata Sandi",
		change_pass_btn: "Atur Kata Sandi",
		email_address: "Alamat Email",
		full_name: "Nama Lengkap",
		update_profile_btn: "Simpan Perubahan",
		english: "Bahasa Inggris",
		indonesian: "Bahasa Indonesia",
		logout: "Keluar",
		add_item: "Tambah Aset",
		save: "Simpan",
		cancel: "Batal",
		delete: "Hapus",
		areyousure: "Apakah kamu yakin ?",
		buy: "Beli"
	}
};