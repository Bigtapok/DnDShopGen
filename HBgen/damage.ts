import { BaseWeapon, Effect, DamageBreakdown, DamagePart } from "./types.js";
import { parseBool, parseNum } from "../utils.js";

export function parseDice(diceStr: string): { min: number, max: number } {
    if (!diceStr) return { min: 0, max: 0 };
    const match = diceStr.toLowerCase().match(/(\d+)d(\d+)/);
    if (match) {
        const count = parseInt(match[1]);
        const sides = parseInt(match[2]);
        return { min: count, max: count * sides };
    }
    const flat = parseInt(diceStr);
    if (!isNaN(flat)) return { min: flat, max: flat };
    return { min: 0, max: 0 };
}

export function computeDamage(base: BaseWeapon, effects: Effect[]): DamageBreakdown {
    const baseRange = parseDice(base.DamageDiceKey);
    const parts: DamagePart[] = [];
    
    parts.push({
        source: "base",
        label: `Base (${base.DamageDiceKey})`,
        addMin: baseRange.min,
        addMax: baseRange.max,
        includeInRange: true,
        damageType: base.DamageTypeKey
    });

    let totalMin = baseRange.min;
    let totalMax = baseRange.max;

    effects.forEach(eff => {
        const addMin = parseNum(eff.OnHitDamageAddMin, 0);
        let addMax = parseNum(eff.OnHitDamageAddMax, 0);
        if (addMax === 0 && addMin > 0) addMax = addMin;

        if (addMin > 0 || addMax > 0) {
            const include = parseBool(eff.OnHitDamageIncludeInRange);
            let dType = eff.resolvedDamageType || eff.TypeKey || "";
            if (dType === "{TERM}") dType = base.DamageTypeKey;

            let diceNotation = "";
            if (addMax > addMin && addMin > 0 && addMax % addMin === 0) {
                const sides = addMax / addMin;
                if ([4,6,8,10,12,20].includes(sides)) {
                    diceNotation = `${addMin}d${sides}`;
                }
            }
            if (!diceNotation) diceNotation = addMin === addMax ? `${addMin}` : `${addMin}–${addMax}`;

            parts.push({
                source: "effect",
                effectId: eff.EffectID,
                label: eff.resolvedName || eff.DisplayName_EN,
                addMin,
                addMax,
                includeInRange: include,
                damageType: dType,
                diceNotation
            });

            if (include) {
                totalMin += addMin;
                totalMax += addMax;
            }
        }
    });

    return {
        baseMin: baseRange.min,
        baseMax: baseRange.max,
        totalMin,
        totalMax,
        parts
    };
}