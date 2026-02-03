
import { BaseWeapon, Effect, DamageBreakdown } from "./HBgen/types.js";
import { SRDItem } from "./SRD/types.js";

// Re-export for compatibility
export * from "./HBgen/types.js";
export * from "./SRD/types.js";

export type RarityKey = 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary';

export interface ShopItem {
    id: string;
    mode: 'generator' | 'srd';
    name: string;
    rarity: RarityKey;
    priceGp: number;
    imageUrl?: string | null;
    
    // Procedural fields
    base?: BaseWeapon;
    effects?: Effect[];
    damage?: DamageBreakdown;
    namingInfo?: any;

    // SRD fields
    srd?: SRDItem;
    srdTags?: string[];
    
    // Shop Context Data
    shopLog?: string[]; // Explanation of price/availability
    
    internals: any;
}

export type GeneratedItem = ShopItem;