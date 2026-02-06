

import { ShopItem, RarityKey } from "./types.js";

export const RARITY_ORDER: RarityKey[] = ['common', 'uncommon', 'rare', 'very_rare', 'legendary'];

export interface State {
    db: any;
    srdDb: any;
    srdTagsIndex: { tag: string; count: number }[];
    lastFilename: string;
    
    user: {
        token: string | null;
        username: string | null;
        role: string | null;
        balance: number;
    };
    
    currentMode: 'generator' | 'srd';
    inputMode: 'builder' | 'text';
    srdGenMode: 'random' | 'unique';
    locked: boolean;
    
    builderRows: { id: string; qty: number; baseId: string; tag: string; rarityKey: string }[];
    
    shopDetails: {
        namePrefix: string;
        nameNoun: string;
        nameSuffix: string;
        shopType: string;
        merchantFirst: string;
        merchantLast: string;
        merchantRace: string;
        merchantPersonality: string;
    };
    
    shopContext: {
        settlement: string;
        wealth: string;
        biome: string;
        law: string;
    };
    
    generatedItems: ShopItem[];
    currentItem?: ShopItem | null;
    
    batchVisibility: {
        hidePrice: boolean;
        hideDescription: boolean;
        hideName: boolean;
        hideRarity: boolean;
        hideType: boolean;
    };
    
    filters: {
        activeTag: string;
        search: string;
        rarities: Set<string>;
        sort: string;
    };
    
    settings: {
        seed: string;
        debug: boolean;
        internals: boolean;
        theme: string;
    };
}

export const state: State = {
    db: {},
    srdDb: {},
    srdTagsIndex: [],
    lastFilename: '',

    user: {
        token: null,
        username: null,
        role: null,
        balance: 0
    },

    currentMode: 'generator',
    inputMode: 'builder',
    srdGenMode: 'random',
    locked: false,

    builderRows: [],

    shopDetails: {
        namePrefix: "",
        nameNoun: "",
        nameSuffix: "",
        shopType: "",
        merchantFirst: "",
        merchantLast: "",
        merchantRace: "",
        merchantPersonality: ""
    },

    shopContext: {
        settlement: "village",
        wealth: "standard",
        biome: "plains",
        law: "law_abiding"
    },

    generatedItems: [],
    currentItem: null,

    batchVisibility: {
        hidePrice: false,
        hideDescription: false,
        hideName: false,
        hideRarity: false,
        hideType: false
    },

    filters: {
        activeTag: "",
        search: "",
        rarities: new Set(),
        sort: "default"
    },

    settings: {
        seed: "",
        debug: false,
        internals: false,
        theme: 'dark'
    }
};
