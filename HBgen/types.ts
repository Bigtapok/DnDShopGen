import { RarityKey } from "../types.js";

export interface BaseWeapon {
    BaseID: string;
    InternalKey?: string;
    DisplayName_EN: string;
    ItemTypeKey: string;
    FamilyKey: string;
    DamageDiceKey: string;
    DamageTypeKey: string;
    WeightLb: number;
    BaseWeight: number;
    Tags: string;
    Properties: string;
    WeaponClassKey: string;
    exportEnabled?: any;
    isDeprecated?: any;
}

export interface Effect {
    EffectID: string;
    DisplayName_EN: string;
    DisplayNameTemplate_EN?: string;
    RulesText_EN: string;
    RulesTextTemplate_EN?: string;
    Summary_EN: string;
    EffectWeight: number;
    MinRarityKey: RarityKey;
    MaxRarityKey: RarityKey;
    LexiconEntityTypeKey?: string;
    AllowedWeaponClasses?: string;
    AllowedFamilies?: string;
    RequiresTags?: string;
    ForbidsTags?: string;
    exportEnabled?: any;
    isDeprecated?: any;
    StackGroupKey?: string;
    MaxPerItem?: number;
    OnHitDamageAddMin?: number;
    OnHitDamageAddMax?: number;
    OnHitDamageIncludeInRange?: any;
    TypeKey?: string;
    resolvedName?: string;
    resolvedSummary?: string;
    resolvedRules?: string;
    resolvedDamageType?: string;
}

export interface DamagePart {
    source: "base" | "effect";
    effectId?: string;
    label: string;
    addMin: number;
    addMax: number;
    includeInRange: boolean;
    damageType?: string;
    diceNotation?: string;
}

export interface DamageBreakdown {
    baseMin: number;
    baseMax: number;
    totalMin: number;
    totalMax: number;
    parts: DamagePart[];
}