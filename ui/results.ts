import { state, RARITY_ORDER } from "../state.js";
import { ShopItem } from "../types.js";
import { formatLabel } from "../utils.js";

export function formatPriceHtml(val: number): string {
    const fixed = val.toFixed(2);
    const [intStr, decStr = "00"] = fixed.split('.');
    const intFmt = parseInt(intStr).toLocaleString();
    const silverDigit = decStr[0] || '0';
    const copperDigit = decStr[1] || '0';
    return `<span>${intFmt}</span><span style="opacity:0.5">.</span><span style="color:var(--text-muted)" title="Silver">${silverDigit}</span><span style="color:#d97706" title="Copper">${copperDigit}</span> <span style="font-size:0.8em; opacity:0.8">gp</span>`;
}

// Render Shop Header in results area
export function renderShopHeader() {
    const header = document.getElementById('shopHeader');
    const nameEl = document.getElementById('shopName'); // Helper check for robust existing dom
    
    if (!header) return;

    if (!state.shopDetails || !state.shopDetails.nameNoun) {
        header.classList.add('hidden');
        return;
    }

    header.classList.remove('hidden');
    const { namePrefix, nameNoun, nameSuffix, shopType, merchantFirst, merchantLast, merchantRace, merchantPersonality } = state.shopDetails;

    header.innerHTML = `
        <h2 class="shop-title">${namePrefix} ${nameNoun} ${nameSuffix}</h2>
        <div class="shop-subtitle">${shopType}</div>
        <div class="merchant-info">
            <strong>${merchantFirst} ${merchantLast}</strong> 
            <span>(${merchantRace})</span>
            <span class="merchant-trait">— ${merchantPersonality}</span>
        </div>
    `;
    
    // Legacy support if elements exist separately
    if (nameEl) {
         nameEl.textContent = `${namePrefix} ${nameNoun} ${nameSuffix}`.trim() || "Unnamed Shop";
    }
    const merchantEl = document.getElementById('merchantInfo');
    if (merchantEl) {
        merchantEl.textContent = `${merchantFirst} ${merchantLast} (${merchantRace}) - ${shopType}`;
    }
}

// Render a single card and append it to the container
export function renderCard(item: ShopItem): string {
    let subtitle = "";
    let desc = "";
    
    // Visibility checks
    const showPrice = !state.batchVisibility.hidePrice;
    const showDesc = !state.batchVisibility.hideDescription;
    const showName = !state.batchVisibility.hideName;
    const showRarity = !state.batchVisibility.hideRarity;
    const showType = !state.batchVisibility.hideType;

    const hPrice = !showPrice ? 'hidden-value' : '';
    const hDesc = !showDesc ? 'hidden-value' : '';
    const hName = !showName ? 'hidden-value' : '';
    const hRarity = !showRarity ? 'hidden-value' : '';
    const hType = !showType ? 'hidden-value' : '';

    if (item.mode === 'generator') {
        subtitle = showType ? (showDesc ? `${item.damage?.totalMin}–${item.damage?.totalMax} damage` : "??? damage") : "???";
        desc = showDesc ? (item.effects?.map(e => e.resolvedName).join(', ') || "") : "Unknown properties";
    } else {
        subtitle = showType ? (item.srd?.BaseTag || "item") : "???";
        desc = showDesc ? (item.srd?.PropertyDescription || "") : "Unknown properties";
    }

    const nameText = showName ? (item.name || "Unnamed Item") : "Unknown Item";
    const rarityLabel = showRarity ? formatLabel(item.rarity) : "???";
    const rarityClass = showRarity ? `rarity-${item.rarity}` : "";
    const rarityStyle = showRarity ? "" : "background:#444; color:#aaa; border-color:#555;";

    let priceHtml = "";
    if (showPrice) {
        priceHtml = formatPriceHtml(item.priceGp || 0);
    } else {
        priceHtml = '<span style="opacity:0.5; font-style:italic">Hidden</span>';
    }

    const descText = showDesc ? (desc || "") : '<span style="opacity:0.5; font-style:italic">Hidden Information</span>';

    // Show Shop Logs (Reasons/Modifiers) if available and desc is shown
    let notesHtml = "";
    if (state.settings.debug && showDesc && item.shopLog && item.shopLog.length > 0) {
        notesHtml = `<div style="margin-top:auto; font-size:0.75rem; color:var(--primary); font-style:italic; border-top:1px solid var(--border); padding-top:0.4rem;">
            ${item.shopLog.map(l => `<div>• ${l}</div>`).join('')}
        </div>`;
    }

    // Clean up description for card view (strip tables)
    let cardDesc = descText;
    if (item.mode === 'srd' && descText.includes('[[TABLE:')) {
        cardDesc = descText.replace(/\[\[TABLE:[^\]]+\]\]/g, ' [Table] ');
    }

    // Use a slightly different class structure based on recent edits request to use "hidden-value" classes too, keeping compatible with logic
    return `
        <div class="item-card ${rarityClass}" data-id="${item.id}">
            <div class="card-header">
                 <div class="item-name ${hName}">${nameText}</div>
                 <div class="item-price ${hPrice}" title="${item.priceGp?.toLocaleString() || 0} gp">${priceHtml}</div>
            </div>
            <div class="card-meta">
                <div class="badge ${rarityClass} ${hRarity}" style="${rarityStyle}">${rarityLabel}</div>
                <div class="item-damage ${hType}">${subtitle}</div>
            </div>
            <div class="item-desc ${hDesc}">${cardDesc}</div>
            ${notesHtml}
        </div>
    `;
}

// Refreshes the results grid based on state filters and sorting criteria
export function refreshGrid() {
    const grid = document.getElementById('resultsGrid');
    const emptyState = document.getElementById('emptyState');
    const quickControls = document.getElementById('quickControls');
    const statsBar = document.getElementById('statsBar');
    const countEl = document.getElementById('resultCount');
    
    if (!grid) return;
    
    grid.innerHTML = '';
    
    // Filter Items
    const activeTag = state.filters.activeTag;
    const search = state.filters.search.toLowerCase();
    const raritySet = state.filters.rarities;
    const sortMode = state.filters.sort;
    
    let displayItems = state.generatedItems.filter(i => {
        // Tag Filter
        if (activeTag) {
            const tags = (i.srdTags || []).map(t => t.toLowerCase());
            if (!tags.includes(activeTag.toLowerCase())) return false;
        }
        
        // Rarity Filter (show all if none selected)
        if (raritySet.size > 0 && !raritySet.has(i.rarity)) return false;
        
        // Search
        if (search) {
            const text = (i.name + " " + (i.srd?.BaseTag||"") + " " + (i.srd?.PropertyDescription||"")).toLowerCase();
            if (!text.includes(search)) return false;
        }
        
        return true;
    });

    if (sortMode === 'price_asc') displayItems.sort((a, b) => a.priceGp - b.priceGp);
    else if (sortMode === 'price_desc') displayItems.sort((a, b) => b.priceGp - a.priceGp);
    else if (sortMode === 'rarity') displayItems.sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity));
    else if (sortMode === 'name') displayItems.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortMode === 'type') {
        displayItems.sort((a, b) => {
            const ta = a.mode === 'srd' ? a.srd?.BaseTag || '' : a.base?.ItemTypeKey || '';
            const tb = b.mode === 'srd' ? b.srd?.BaseTag || '' : b.base?.ItemTypeKey || '';
            return ta.localeCompare(tb);
        });
    }

    // Toggle Visibility
    const hasItems = state.generatedItems.length > 0;
    if (hasItems) {
        grid.classList.remove('hidden');
        if (emptyState) emptyState.classList.add('hidden');
        if (quickControls) quickControls.classList.remove('hidden');
        if (statsBar) statsBar.classList.remove('hidden');
    } else {
        grid.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        if (quickControls) quickControls.classList.add('hidden');
        if (statsBar) statsBar.classList.add('hidden');
    }

    grid.innerHTML = displayItems.map(item => renderCard(item)).join('');

    // Update count display
    if (countEl) {
        countEl.textContent = `${displayItems.length} item${displayItems.length !== 1 ? 's' : ''} found`;
    }
    
    // Update stats counters
    updateStats(displayItems);

    // Refresh tag counts based on context
    if (state.currentMode === 'srd' && (window as any).updateTagFilterUI) {
        (window as any).updateTagFilterUI();
    }
}

function updateStats(items: ShopItem[]) {
    const statsBar = document.getElementById('statsBar');
    const totalEl = document.getElementById('statTotal');
    const breakEl = document.getElementById('statBreakdown');
    if (!statsBar) return;
    
    if (items.length === 0) {
        statsBar.innerHTML = '';
        return;
    }

    const totalVal = items.reduce((sum, i) => sum + i.priceGp, 0);
    const avg = Math.round(totalVal / items.length);

    if (totalEl) totalEl.textContent = String(items.length);
    
    const counts: Record<string, number> = {};
    items.forEach(i => counts[i.rarity] = (counts[i.rarity] || 0) + 1);

    if (breakEl) {
        breakEl.innerHTML = RARITY_ORDER.map(r => {
            if (!counts[r]) return "";
            return `<span class="rarity-${r}" style="font-weight:600; font-size:0.8rem;">${formatLabel(r)}: ${counts[r]}</span>`;
        }).join(' <span style="opacity:0.3; margin:0 4px">|</span> ');
    }
    
    // Also update value if structure differs slightly
    if (!totalEl && !breakEl) {
         statsBar.innerHTML = `
            <div class="stat-item"><strong>Total Value:</strong> ${totalVal.toLocaleString()} gp</div>
            <div class="stat-item"><strong>Avg Price:</strong> ${avg.toLocaleString()} gp</div>
        `;
    }
}