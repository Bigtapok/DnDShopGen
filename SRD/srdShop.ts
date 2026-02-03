import { state, RARITY_ORDER } from "../state.js";
import { ShopItem, RarityKey } from "../types.js";
import { SRDItem, SettlementTier, EconomyModifier, BiomeModifier, LawHeat, ShopDetails } from "./types.js";
import { computePrice } from "../HBgen/pricing.js";
import { getRNG, parseNum, parseBool } from "../utils.js";

// Helper to normalize keys from CSV/Excel
const norm = (s: string) => s?.toLowerCase().trim() || "";

/**
 * Calculates the price for an SRD item.
 * Prioritizes item's own TypicalPriceGp, fallbacks to procedural pricing if missing.
 */
function calculateSrdPrice(item: SRDItem, rng: any): { price: number, logs: string[], internalData: any } {
    const logs: string[] = [];
    let basePrice = parseNum(item.TypicalPriceGp, 0);
    const wealth = state.shopContext.wealth;
    const law = state.shopContext.law;
    let internalData: any = {};

    // Check if we are in 'unique' (List of All Items) mode
    const isUniqueMode = state.srdGenMode === 'unique';

    // 1. Get Economy Multiplier
    const econRow = (state.srdDb.ECONOMY_MODIFIERS || []).find((r: any) => norm(r.WealthLevel) === norm(wealth));
    const econMult = parseNum(econRow?.PriceMultTypical, 1.0);

    // 2. Get Law Markup
    const lawRow = (state.srdDb.LAW_HEAT || []).find((r: any) => norm(r.LawLevel) === norm(law));
    let lawMarkup = 0;
    if (norm(item.Legality) === 'restricted') lawMarkup = parseNum(lawRow?.RestrictedMarkup, 0) - 1;
    if (norm(item.Legality) === 'illegal') lawMarkup = parseNum(lawRow?.IllegalMarkup, 0) - 1;
    
    // Safety for old data formats where markup might be absolute multiplier (e.g. 1.2) vs additive (0.2)
    if (lawMarkup < 0) lawMarkup = 0; 

    let finalPrice = 0;

    if (basePrice > 0) {
        // USE FIXED SRD PRICE
        logs.push(`Base: ${basePrice} gp (SRD)`);

        if (isUniqueMode) {
             // In Unique mode, skip all modifiers (economy, law, variance)
             finalPrice = basePrice;
             logs.push(`List Mode: Exact DB price used.`);
             internalData = {
                calcMethod: "srd_fixed_exact",
                basePrice,
                finalPrice
             };
        } else {
            if (econMult !== 1) logs.push(`Economy (${wealth}): x${econMult}`);
            if (lawMarkup > 0) logs.push(`Law Markup (${item.Legality}): +${Math.round(lawMarkup * 100)}%`);

            const variance = rng.uniform(0.9, 1.1); // +/- 10%
            finalPrice = basePrice * econMult * (1 + lawMarkup) * variance;
            
            internalData = {
                calcMethod: "srd_fixed",
                basePrice,
                economy: { wealth, mult: econMult },
                law: { level: law, markup: lawMarkup },
                variance,
                rawTotal: finalPrice
            };
        }
    } else {
        // FALLBACK TO PROCEDURAL PRICING (Rarity based)
        const dummyItem = { 
            rarity: (item.RarityKey?.toLowerCase() || 'common') as RarityKey, 
            base: { BaseWeight: item.ShopWeightBase || 1 } as any 
        };
        const pData = computePrice(dummyItem, rng);
        const procPrice = pData.priceGp;
        logs.push(`Price derived from rarity (${item.RarityKey})`);
        
        if (isUniqueMode) {
            // In unique mode, we take the raw procedural price (no economy/law)
            finalPrice = procPrice;
            internalData = {
                calcMethod: "procedural_fallback_unique",
                pricingBreakdown: pData.pricingBreakdown,
                baseProcedural: procPrice
            };
        } else {
            // In random mode, we SHOULD apply Economy and Law to the procedural price
            // to respect the shop context
            if (econMult !== 1) logs.push(`Economy (${wealth}): x${econMult}`);
            if (lawMarkup > 0) logs.push(`Law Markup (${item.Legality}): +${Math.round(lawMarkup * 100)}%`);
            
            finalPrice = procPrice * econMult * (1 + lawMarkup);

            internalData = {
                calcMethod: "procedural_fallback_modified",
                pricingBreakdown: pData.pricingBreakdown,
                baseProcedural: procPrice,
                economy: { wealth, mult: econMult },
                law: { level: law, markup: lawMarkup },
                rawTotal: finalPrice
            };
        }
    }

    // Rounding logic: preserve copper/silver for cheap items, round to GP for expensive ones
    // Skip rounding for exact fixed price mode
    if (!(isUniqueMode && basePrice > 0)) {
        if (finalPrice < 10) {
            finalPrice = Math.round(finalPrice * 100) / 100;
        } else {
            finalPrice = Math.round(finalPrice);
        }
    }
    
    internalData.finalPrice = finalPrice;

    return { price: Math.max(0.01, finalPrice), logs, internalData };
}

export function getFilteredSrdItems(context: any): SRDItem[] {
    return (state.srdDb.SRD_ITEMS || []) as SRDItem[];
}

export function generateShopDetails() {
    const rng = getRNG();
    const genData = state.srdDb.SHOP_GENERATOR || [];
    
    const pickRandom = (field: string) => {
        const options = genData.map((r: any) => r[field]).filter((x: any) => x);
        if (options.length === 0) return "";
        return options[Math.floor(rng.random() * options.length)];
    };

    const d = state.shopDetails;
    if (!d.namePrefix) d.namePrefix = pickRandom('ShopNamePrefix');
    if (!d.nameNoun) d.nameNoun = pickRandom('ShopNameNoun');
    if (!d.nameSuffix) d.nameSuffix = pickRandom('ShopNameSuffix');
    if (!d.shopType) d.shopType = pickRandom('ShopType');
    if (!d.merchantFirst) d.merchantFirst = pickRandom('MerchantFirstName');
    if (!d.merchantLast) d.merchantLast = pickRandom('MerchantLastName');
    if (!d.merchantRace) d.merchantRace = pickRandom('MerchantRace');
    if (!d.merchantPersonality) d.merchantPersonality = pickRandom('MerchantPersonality');
}

export function generateShopInventory(rows: { id: string, qty: number, tag: string, rarityKey: string }[]): ShopItem[] {
    const items: ShopItem[] = [];
    const candidates = getFilteredSrdItems(state.shopContext);
    const rng = getRNG();

    rows.forEach(row => {
        if (!row.qty) return;
        
        let pool = candidates;
        if (row.tag) {
            const tagFilter = row.tag.toLowerCase();
            pool = pool.filter(item => (item.Tags || "").toLowerCase().includes(tagFilter));
        }
        if (row.rarityKey) {
            const rarityFilter = norm(row.rarityKey);
            pool = pool.filter(item => norm(item.RarityKey) === rarityFilter);
        }

        if (pool.length === 0) return;

        for (let i = 0; i < row.qty; i++) {
            const selected = pool[Math.floor(rng.random() * pool.length)];
            const { price, logs, internalData } = calculateSrdPrice(selected, rng);

            items.push({
                id: crypto.randomUUID(),
                mode: 'srd',
                name: selected.Name,
                rarity: (selected.RarityKey?.toLowerCase() || 'common') as RarityKey,
                priceGp: price,
                srd: selected,
                srdTags: (selected.Tags || "").split(/[;,]/).map(t => t.trim()).filter(t => t),
                shopLog: logs,
                internals: internalData
            });
        }
    });

    return items;
}

export function generateUniquePoolBatch(tags: string[]): ShopItem[] {
    const candidates = getFilteredSrdItems(state.shopContext);
    const rng = getRNG();
    
    let pool = candidates;
    if (tags && tags.length > 0) {
        pool = pool.filter(item => {
             const itemTags = (item.Tags || "").toLowerCase();
             return tags.some(t => itemTags.includes(t.toLowerCase()));
        });
    }

    return pool.map(selected => {
        const { price, logs, internalData } = calculateSrdPrice(selected, rng);

        return {
            id: crypto.randomUUID(),
            mode: 'srd',
            name: selected.Name,
            rarity: (selected.RarityKey?.toLowerCase() || 'common') as RarityKey,
            priceGp: price,
            srd: selected,
            srdTags: (selected.Tags || "").split(/[;,]/).map(t => t.trim()).filter(t => t),
            shopLog: logs,
            internals: internalData
        };
    });
}