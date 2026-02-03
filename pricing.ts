
import { state } from "./state.js";
import { parseBool, parseNum } from "./utils.js";
import { GeneratedItem } from "./types.js";

export function computePrice(item: Partial<GeneratedItem>, rng: any) {
    const db = state.db;
    const pr = (db.PARAM_PRICING_RULES || []).find((r: any) => r.PricingRuleKey === 'default');
    const pRarityUsed = (parseBool(pr?.UseDerivedRarityKey) ? item.rarity : (item as any).targetRarity || item.rarity) || 'common';
    const prd = (db.PARAM_PRICING_RARITY || []).find((r: any) => r.RarityKey === pRarityUsed);
    const finalCapRow = (db.PARAM_RARITY_CAPS || []).find((r: any) => r.RarityKey === pRarityUsed && parseBool(r.BudgetEnabled));
    const pCapVal = parseNum(finalCapRow?.RarityWeightBudget, 1.0);
    
    const baseWeight = parseNum(item.base?.BaseWeight);
    const capUsed = item.internals?.capUsed || 0;
    const wRaw = (pCapVal - baseWeight) > 0 ? (capUsed - baseWeight) / (pCapVal - baseWeight) : 0;
    const wClamped = Math.max(0, Math.min(1, wRaw));
    
    const lMin = Math.log(parseNum(prd?.MinGp, 1));
    const lTyp = Math.log(parseNum(prd?.TypicalGp, 2));
    const lMax = Math.log(parseNum(prd?.MaxGp, 3));
    
    let lp = wClamped <= 0.5 
        ? lMin + (wClamped / 0.5) * (lTyp - lMin) 
        : lTyp + ((wClamped - 0.5) / 0.5) * (lMax - lTyp);
    
    let finalGpBeforeRounding = 0;
    let noiseMultiplier = 1.0;
    let upperCap = parseNum(prd?.MaxGp) * 1.15;
    let attempts = 0;

    do {
        noiseMultiplier = Math.exp(rng.uniform(-Math.log(parseNum(prd?.Vol, 1) || 1), Math.log(parseNum(prd?.Vol, 1) || 1)));
        finalGpBeforeRounding = Math.exp(lp) * noiseMultiplier;
        attempts++;
    } while (finalGpBeforeRounding > upperCap && attempts < 8);

    finalGpBeforeRounding = Math.max(parseNum(prd?.MinGp), finalGpBeforeRounding);
    const finalGp = Math.round(finalGpBeforeRounding);

    return {
        priceGp: finalGp,
        pricingBreakdown: {
            rarityKeyUsed: pRarityUsed, capTotal: pCapVal, capUsed, wClamped,
            finalGpBeforeRounding, finalGp, attempts
        }
    };
}
