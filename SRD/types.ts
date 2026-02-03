
export interface ShopDetails {
    namePrefix: string;
    nameNoun: string;
    nameSuffix: string;
    shopType: string;
    merchantFirst: string;
    merchantLast: string;
    merchantRace: string;
    merchantPersonality: string;
}

export interface SRDItem {
    Name: string;
    PropertyDescription: string;
    RarityKey: string;
    BaseTag: string;
    TypicalPriceGp?: number;
    Tags: string; // 10 semantic tags
    RequiresAttunement?: string;
    RequiredBaseItem?: string;
    
    // New Fields
    ItemType?: string; // weapon, armor, potion...
    Slot?: string; // head, neck...
    PowerTier?: string; // t1..t4
    ShopWeightBase?: number;
    MinSettlementTier?: string; // hamlet < town...
    Availability?: string; // common_stock, limited, special_order
    Legality?: string; // legal, restricted
    SupplyTags?: string; // crafted, imported...
    ThemeTags?: string; // general, desert...
    ShopTags?: string; // Key:Value structured
    NotesShop?: string;
}

export interface ShopProfile {
    ShopProfileId: string;
    Name: string;
    DefaultWealth: string;
    DefaultSettlementTier: string;
    DefaultVenue: string;
    DefaultLawLevel: string;
    DefaultThemes: string;
    StockSizeMin: number;
    StockSizeMax: number;
}

export interface SettlementTier {
    SettlementTier: string;
    MaxRarityOpen: string;
    SpecialOrderAllowed: string;
}

export interface EconomyModifier {
    WealthLevel: string;
    PriceMultTypical: number;
    StockSizeMult: number;
}

export interface BiomeModifier {
    Biome: string;
    BoostThemeTags: string;
    BanThemeTags: string;
    ImportBias: number;
}

export interface LawHeat {
    LawLevel: string;
    RestrictedMarkup: number;
    IllegalMarkup: number;
}