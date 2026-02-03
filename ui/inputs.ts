import { state } from "../state.js";
import { renderShopHeader } from "./results.js";

// Helper to populate shop dropdowns from SRD data (using datalists)
export function initShopDropdowns() {
    const genData = state.srdDb.SHOP_GENERATOR || [];
    if (genData.length === 0) return;

    // Helper to populate a datalist and bind the input
    const fillDatalist = (inputId: string, listId: string, field: string, stateProp: keyof typeof state.shopDetails) => {
        const input = document.getElementById(inputId) as HTMLInputElement;
        const list = document.getElementById(listId) as HTMLDataListElement;

        if (!input || !list) return;

        const values = Array.from(new Set(genData.map((r: any) => r[field]).filter((v: any) => v))).sort();

        list.innerHTML = values.map(v => `<option value="${v}">`).join('');

        // Initial value from state
        input.value = state.shopDetails[stateProp] || "";

        // Bind input event to update state instantly
        input.oninput = (e: any) => {
            (state.shopDetails as any)[stateProp] = e.target.value;
            renderShopHeader();
        };
        
        // Also bind change for good measure
        input.onchange = (e: any) => {
            if (state.locked) {
                 input.value = state.shopDetails[stateProp] || "";
                 return;
            }
            (state.shopDetails as any)[stateProp] = e.target.value;
            renderShopHeader();
        };
    };

    fillDatalist('cfgShopPrefix', 'listShopPrefix', 'ShopNamePrefix', 'namePrefix');
    fillDatalist('cfgShopNoun', 'listShopNoun', 'ShopNameNoun', 'nameNoun');
    fillDatalist('cfgShopSuffix', 'listShopSuffix', 'ShopNameSuffix', 'nameSuffix');
    fillDatalist('cfgShopType', 'listShopType', 'ShopType', 'shopType');
    fillDatalist('cfgMerchFirst', 'listMerchFirst', 'MerchantFirstName', 'merchantFirst');
    fillDatalist('cfgMerchLast', 'listMerchLast', 'MerchantLastName', 'merchantLast');
    fillDatalist('cfgMerchRace', 'listMerchRace', 'MerchantRace', 'merchantRace');
    fillDatalist('cfgMerchPers', 'listMerchPers', 'MerchantPersonality', 'merchantPersonality');
    
    // Explicit legacy listener logic if elements exist directly
    const mapping: Record<string, keyof typeof state.shopDetails> = {
        'shopPrefix': 'namePrefix',
        'shopNoun': 'nameNoun',
        'shopSuffix': 'nameSuffix',
        'shopType': 'shopType',
        'merchFirst': 'merchantFirst',
        'merchLast': 'merchantLast',
        'merchRace': 'merchantRace',
        'merchPers': 'merchantPersonality'
    };
    
    Object.entries(mapping).forEach(([id, key]) => {
        const el = document.getElementById(id) as HTMLSelectElement | HTMLInputElement;
        if (el) {
            el.addEventListener('change', (e: any) => {
                if (state.locked) {
                     el.value = state.shopDetails[key] || "";
                     return;
                }
                state.shopDetails[key] = e.target.value;
                renderShopHeader();
            });
        }
    });
}

export function updateShopDropdowns() {
    const setVal = (id: string, val: string) => {
        const el = document.getElementById(id) as HTMLInputElement;
        if (el) el.value = val || "";
    };

    setVal('cfgShopPrefix', state.shopDetails.namePrefix);
    setVal('cfgShopNoun', state.shopDetails.nameNoun);
    setVal('cfgShopSuffix', state.shopDetails.nameSuffix);
    setVal('cfgShopType', state.shopDetails.shopType);
    setVal('cfgMerchFirst', state.shopDetails.merchantFirst);
    setVal('cfgMerchLast', state.shopDetails.merchantLast);
    setVal('cfgMerchRace', state.shopDetails.merchantRace);
    setVal('cfgMerchPers', state.shopDetails.merchantPersonality);
    
    // Legacy mapping
    const mapping: Record<string, keyof typeof state.shopDetails> = {
        'shopPrefix': 'namePrefix',
        'shopNoun': 'nameNoun',
        'shopSuffix': 'nameSuffix',
        'shopType': 'shopType',
        'merchFirst': 'merchantFirst',
        'merchLast': 'merchantLast',
        'merchRace': 'merchantRace',
        'merchPers': 'merchantPersonality'
    };
    Object.entries(mapping).forEach(([id, key]) => {
        const el = document.getElementById(id) as HTMLSelectElement | HTMLInputElement;
        if (el) {
            el.value = state.shopDetails[key] || "";
        }
    });
}

export function initContextDropdowns() {
    const db = state.srdDb;
    // We expect these tables to be present in SRD DB
    // Simple setup helper
    const setup = (id: string, list: any[], keyField: string, stateField: keyof typeof state.shopContext) => {
        const sel = document.getElementById(id) as HTMLSelectElement;
        if (!sel) return;

        sel.innerHTML = list.map(item => {
            const val = item[keyField];
            // Format label: "market_town" -> "Market Town"
            const label = val.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            return `<option value="${val}">${label}</option>`;
        }).join('');

        // Set initial value from state (defaults in state.ts)
        if (state.shopContext[stateField]) {
            sel.value = state.shopContext[stateField] as string;
        }

        // Bind change event
        sel.onchange = (e: any) => {
            (state.shopContext as any)[stateField] = e.target.value;
        };
    };

    if (db.SETTLEMENT_TIERS) setup('ctxSettlement', db.SETTLEMENT_TIERS || [], 'SettlementTier', 'settlement');
    if (db.ECONOMY_MODIFIERS) setup('ctxWealth', db.ECONOMY_MODIFIERS || [], 'WealthLevel', 'wealth');
    if (db.BIOME_MODIFIERS) setup('ctxBiome', db.BIOME_MODIFIERS || [], 'Biome', 'biome');
    if (db.LAW_HEAT) setup('ctxLaw', db.LAW_HEAT || [], 'LawLevel', 'law');
}

export function updateContextDropdowns() {
    const set = (id: string, val: string) => {
        const el = document.getElementById(id) as HTMLSelectElement;
        if (el) el.value = val;
    };
    set('ctxSettlement', state.shopContext.settlement);
    set('ctxWealth', state.shopContext.wealth);
    set('ctxBiome', state.shopContext.biome);
    set('ctxLaw', state.shopContext.law);
}