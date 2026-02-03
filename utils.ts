
import { state } from "./state.js";

export function getRNG() {
    if (!state.settings.seed) {
        return {
            random: () => Math.random(),
            uniform: (min: number, max: number) => min + (Math.random() * (max - min))
        };
    }
    // Simple deterministic xorshift
    let s = 0;
    for (let i = 0; i < state.settings.seed.length; i++) {
        s = (s << 5) - s + state.settings.seed.charCodeAt(i);
        s |= 0;
    }
    return {
        random: () => {
            s ^= s << 13;
            s ^= s >> 17;
            s ^= s << 5;
            return ((s >>> 0) / 4294967296);
        },
        uniform: (min: number, max: number) => {
            s ^= s << 13;
            s ^= s >> 17;
            s ^= s << 5;
            const r = (s >>> 0) / 4294967296;
            return min + (r * (max - min));
        }
    };
}

export function parseBool(v: any): boolean {
    if (v === undefined || v === null) return false;
    if (typeof v === 'boolean') return v;
    const s = String(v).toLowerCase().trim();
    return s === 'true' || s === '1' || s === 'yes' || s === 'true';
}

export function parseNum(v: any, fallback = 0): number {
    const n = Number(v);
    return isNaN(n) ? fallback : n;
}

export function resolveTpl(tpl: string, tokens: Record<string, any>): string {
    return tpl.replace(/\{(\w+)\}/g, (_, k) => tokens[k] !== undefined ? String(tokens[k]) : `{${k}}`);
}

/**
 * Human-friendly tag labels.
 */
export function formatLabel(key: string): string {
    if (!key) return "";
    const dict = state.db.TAG_DICTIONARY || [];
    const entry = dict.find((d: any) => d.TagKey === key || d.InternalKey === key);
    if (entry && entry.DisplayName_EN) return entry.DisplayName_EN;

    return key.replace(/^prop:/, '')
              .split('_')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join('-');
}
