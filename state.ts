import { ShopItem, RarityKey, ShopDetails } from "./types.js";

export const state = {
    db: {} as Record<string, any[]>,
    srdDb: {} as Record<string, any[]>, // Separated SRD Data Source
    currentMode: 'generator' as 'generator' | 'srd',
    inputMode: 'builder' as 'builder' | 'text',
    generatedItems: [] as ShopItem[],
    currentItem: null as ShopItem | null,
    
    locked: false, // Prevents editing when loaded from batch

    // User Session
    user: {
        token: null as string | null,
        username: null as string | null,
        balance: 0
    },

    // UI Builder State
    builderRows: [{ id: '1', qty: 1, baseId: '', tag: '', rarityKey: '' }] as { id: string, qty: number, baseId: string, tag: string, rarityKey: string }[],

    settings: {
        debug: true,
        internals: false,
        theme: 'dark' as 'light' | 'dark',
        images: false,
        seed: ''
    },
    
    // Shop Identity
    shopDetails: {
        namePrefix: '',
        nameNoun: '',
        nameSuffix: '',
        shopType: '',
        merchantFirst: '',
        merchantLast: '',
        merchantRace: '',
        merchantPersonality: ''
    } as ShopDetails,
    
    batchVisibility: {
        hidePrice: false,
        hideDescription: false,
        hideName: false,
        hideRarity: false,
        hideType: false
    },
    
    filters: {
        search: '',
        rarities: new Set<RarityKey>(['common', 'uncommon', 'rare', 'very_rare', 'legendary']),
        sort: 'none',
        activeTag: '',
        srdTags: new Set<string>(),
        srdTagMatchMode: 'all' as 'all' | 'any'
    },
    
    // Shop Generation Context
    shopContext: {
        wealth: 'average',
        settlement: 'town',
        biome: 'general',
        law: 'normal'
    },
    
    srdGenMode: 'random' as 'random' | 'unique',
    srdUniquePool: [] as any[],
    srdUniquePoolKey: '',
    
    srdTagsIndex: [] as { tag: string, count: number }[],

    counters: {
        names: new Map<string, number>(),
        patterns: new Map<string, number>(),
        total: 0
    },
    
    lastFilename: 'None'
};

export const RARITY_ORDER: RarityKey[] = ['common', 'uncommon', 'rare', 'very_rare', 'legendary'];