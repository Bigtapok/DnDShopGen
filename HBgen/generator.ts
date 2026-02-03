import { state } from "../state.js";
import { ShopItem, RarityKey } from "../types.js";
import { BaseWeapon, Effect } from "./types.js";
import { getRNG, parseNum, parseBool } from "../utils.js";
import { computeDamage } from "./damage.js";
import { computePrice } from "./pricing.js";

export function generateProceduralItems(rows: { id: string, qty: number, baseId: string, rarityKey: string }[]): ShopItem[] {
    const items: ShopItem[] = [];
    const db = state.db;
    const rng = getRNG();

    const bases = (db.CORE_BASES || []) as BaseWeapon[];
    const allEffects = (db.CORE_EFFECTS || []) as Effect[];

    if (!bases.length) return [];

    rows.forEach(row => {
        if (!row.qty) return;

        for (let i = 0; i < row.qty; i++) {
            // 1. Pick Base
            let validBases = bases;
            if (row.baseId) {
                const exact = bases.filter(b => b.BaseID === row.baseId);
                if (exact.length > 0) validBases = exact;
                else {
                    const fam = bases.filter(b => b.FamilyKey === row.baseId);
                    if (fam.length > 0) validBases = fam;
                }
            }
            
            if (validBases.length === 0) continue;
            const base = validBases[Math.floor(rng.random() * validBases.length)];

            // 2. Pick Rarity if not set
            const targetRarity = (row.rarityKey || 'common') as RarityKey;

            // 3. Pick Effects
            // Simplified Logic: Pick 1 random effect appropriate for rarity if not common
            const selectedEffects: Effect[] = [];
            if (targetRarity !== 'common' && allEffects.length > 0) {
                const validEffects = allEffects.filter(e => e.MinRarityKey === targetRarity);
                if (validEffects.length > 0) {
                    const eff = validEffects[Math.floor(rng.random() * validEffects.length)];
                    // Resolve name templates if needed
                    eff.resolvedName = eff.DisplayName_EN; 
                    eff.resolvedRules = eff.RulesText_EN;
                    selectedEffects.push(eff);
                }
            }

            // 4. Compute Stats
            const damage = computeDamage(base, selectedEffects);

            // 5. Generate Name
            let name = base.DisplayName_EN;
            if (selectedEffects.length > 0) {
                name = `${selectedEffects[0].resolvedName || selectedEffects[0].DisplayName_EN} ${name}`;
            }

            // 6. Compute Price
            const dummyItem = { rarity: targetRarity, base, effects: selectedEffects };
            const priceData = computePrice(dummyItem, rng);

            items.push({
                id: crypto.randomUUID(),
                mode: 'generator',
                name: name,
                rarity: targetRarity,
                priceGp: priceData.priceGp,
                base: base,
                effects: selectedEffects,
                damage: damage,
                internals: {
                    pricing: priceData.pricingBreakdown
                }
            });
        }
    });

    return items;
}