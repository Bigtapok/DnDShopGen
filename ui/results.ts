import { state, RARITY_ORDER } from "../state.js";
import { ShopItem } from "../types.js";
import { formatLabel } from "../utils.js";
import { renderModal } from "./modals.js";

export function formatPriceHtml(price: number): string {
    if (price < 1) {
        return `<span class="price-cp">${Math.round(price * 100)} cp</span>`;
    }
    if (price < 10 && price % 1 !== 0) {
        return `<span class="price-gp">${Math.floor(price)}</span> <span class="price-sp">${Math.round((price % 1) * 10)} sp</span>`;
    }
    return `<span class="price-gp">${price.toLocaleString()} gp</span>`;
}

export function formatPriceHtmlFromCp(priceCp: number): string {
    const gp = Math.floor(priceCp / 100);
    const sp = Math.floor((priceCp % 100) / 10);
    const cp = priceCp % 10;
    let html = '';
    if (gp > 0) html += `<span class="price-gp">${gp} gp</span> `;
    if (sp > 0) html += `<span class="price-sp">${sp} sp</span> `;
    if (cp > 0 || (!gp && !sp)) html += `<span class="price-cp">${cp} cp</span>`;
    return html.trim();
}

export function renderShopHeader() {
    const header = document.getElementById('shopHeader');
    const nameEl = document.getElementById('shopNameDisplay') || document.getElementById('shopNameHeader');

    if (!header) return;

    if (!state.shopDetails || !state.shopDetails.nameNoun) {
        header.classList.add('hidden');
        return;
    }

    header.classList.remove('hidden');
    const { namePrefix, nameNoun, nameSuffix, shopType, merchantFirst, merchantLast, merchantRace, merchantPersonality } = state.shopDetails;

    // Save Button Logic
    let saveBtnHtml = '';
    if (state.user.token) {
        saveBtnHtml = `
            <button id="btnSaveShop" class="btn-icon" style="position:absolute; top:1rem; right:1rem; background:rgba(0,0,0,0.3); color:var(--primary); border:1px solid var(--primary);" title="Save Shop to Cloud">
                💾
            </button>
        `;
    }

    header.innerHTML = `
        ${saveBtnHtml}
        <h2 class="shop-title" style="color:var(--accent-green);">${namePrefix} ${nameNoun} ${nameSuffix}</h2>
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

    // Attach listener to new save button
    const btnSave = document.getElementById('btnSaveShop');
    if (btnSave) {
        btnSave.addEventListener('click', () => {
            // Dispatch a custom event so index.tsx can handle the API call with all dependencies
            window.dispatchEvent(new CustomEvent('req-save-shop'));
        });

    }

    function updateStats(items: ShopItem[]) {
        const statsBar = document.getElementById('statsBar');
        if (!statsBar) return;

        const totalValue = items.reduce((acc, i) => acc + i.priceGp, 0);
        const avgValue = items.length > 0 ? totalValue / items.length : 0;

        const breakdown = RARITY_ORDER.map(r => {
            const c = items.filter(i => i.rarity === r).length;
            return c > 0 ? `<span class="stat-badge rarity-${r}">${c}</span>` : '';
        }).join('');

        statsBar.innerHTML = `
        <div class="stat-group">
            <span class="stat-label">Total Value</span>
            <span class="stat-val">${Math.round(totalValue).toLocaleString()} gp</span>
        </div>
        <div class="stat-group">
            <span class="stat-label">Avg Price</span>
            <span class="stat-val">${Math.round(avgValue).toLocaleString()} gp</span>
        </div>
        <div class="stat-group">
            ${breakdown}
        </div>
    `;
    }
}

export function renderCard(item: ShopItem, count: number = 1): string {
    // Видимость
    const showPrice = !state.batchVisibility.hidePrice;
    const showDesc = !state.batchVisibility.hideDescription;
    const showName = !state.batchVisibility.hideName;
    const showRarity = !state.batchVisibility.hideRarity;
    const showType = !state.batchVisibility.hideType;

    // Классы для скрытия
    const hPrice = !showPrice ? 'hidden-value' : '';
    const hDesc = !showDesc ? 'hidden-value' : '';
    const hName = !showName ? 'hidden-value' : '';
    const hRarity = !showRarity ? 'hidden-value' : '';
    const hType = !showType ? 'hidden-value' : '';

    // Заголовок, описание
    let subtitle = "";
    let desc = "";

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

    // ShopLog
    let notesHtml = "";
    if (state.settings?.debug && showDesc && item.shopLog && item.shopLog.length > 0) {
        notesHtml = `<div style="margin-top:auto; font-size:0.75rem; color:var(--primary); font-style:italic; border-top:1px solid var(--border); padding-top:0.4rem;">
            ${item.shopLog.map(l => `<div>• ${l}</div>`).join('')}
        </div>`;
    }

    // Очищаем описание от таблиц
    let cardDesc = descText;
    if (item.mode === 'srd' && descText.includes('[[TABLE:')) {
        cardDesc = descText.replace(/\[\[TABLE:[^\]]+\]\]/g, ' [Table] ');
    }

    // Бейдж количества
    const countBadge = count > 1
        ? `<div class="item-qty" style="position:absolute; top:12px; right:12px; background:var(--accent); color:white; font-weight:800; padding:2px 10px; border-radius:12px; font-size:0.85rem; box-shadow:0 2px 4px rgba(0,0,0,0.5); z-index:2; border:1px solid rgba(255,255,255,0.2);">x${count}</div>`
        : '';

    return `
        <div class="item-card ${rarityClass}" data-id="${item.id}">
            ${countBadge}
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

    let filteredItems = state.generatedItems.filter(i => {
        // Tag Filter
        if (activeTag) {
            const tags = (i.srdTags || []).map(t => t.toLowerCase());
            if (!tags.includes(activeTag.toLowerCase())) return false;
        }

        // Rarity Filter (show all if none selected)
        if (raritySet.size > 0 && !raritySet.has(i.rarity)) return false;

        // Search
        if (search) {
            const text = (i.name + " " + (i.srd?.BaseTag || "") + " " + (i.srd?.PropertyDescription || "")).toLowerCase();
            if (!text.includes(search)) return false;
        }

        return true;
    });

    // Group Items for Display
    // Key = Name + Rarity. We merge prices and show the highest.
    const groupedItemsMap = new Map<string, { item: ShopItem, count: number }>();

    filteredItems.forEach(item => {
        const sig = `${item.name}|${item.rarity}`;
        if (groupedItemsMap.has(sig)) {
            const entry = groupedItemsMap.get(sig)!;
            entry.count++;
            // Keep the item with the highest price as the representative
            if (item.priceGp > entry.item.priceGp) {
                entry.item = item;
            }
        } else {
            groupedItemsMap.set(sig, { item, count: 1 });
        }
    });

    // Convert to Array for sorting
    let displayGroups = Array.from(groupedItemsMap.values());

    // Sort Groups
    if (sortMode === 'price_asc') displayGroups.sort((a, b) => a.item.priceGp - b.item.priceGp);
    else if (sortMode === 'price_desc') displayGroups.sort((a, b) => b.item.priceGp - a.item.priceGp);
    else if (sortMode === 'rarity') displayGroups.sort((a, b) => RARITY_ORDER.indexOf(b.item.rarity) - RARITY_ORDER.indexOf(a.item.rarity));
    else if (sortMode === 'name') displayGroups.sort((a, b) => a.item.name.localeCompare(b.item.name));
    else if (sortMode === 'type') {
        displayGroups.sort((a, b) => {
            const ta = a.item.mode === 'srd' ? a.item.srd?.BaseTag || '' : a.item.base?.ItemTypeKey || '';
            const tb = b.item.mode === 'srd' ? b.item.srd?.BaseTag || '' : b.item.base?.ItemTypeKey || '';
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

    // Render grouped items
    grid.innerHTML = displayGroups
        .map(entry => renderCard(entry.item, entry.count))
        .join('');

    // Update count display
    if (countEl) {
        countEl.textContent = `${filteredItems.length} item${filteredItems.length !== 1 ? 's' : ''} found`;
    }

    // Refresh tag counts based on context
    if (state.currentMode === 'srd' && (window as any).updateTagFilterUI) {
        (window as any).updateTagFilterUI();
    }
}