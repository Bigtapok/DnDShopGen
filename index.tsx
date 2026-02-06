import { state } from "./state.js";
import { loadDefaultData, downloadJson, copyMarkdown, downloadLogs } from "./xlsx.js";
import { formatLabel } from "./utils.js";
import { log, renderCard, renderSavedShops, refreshGrid, renderModal, renderRarityToggles, updateTagFilterDropdown, renderShopHeader, updateShopDropdowns, initShopDropdowns, initContextDropdowns, updateContextDropdowns, initAuth } from "./ui.js";
import { generateShopInventory, generateUniquePoolBatch, generateShopDetails, getFilteredSrdItems } from "./SRD/srdShop.js";
import { generateProceduralItems } from "./HBgen/generator.js";
import { apiGetUsers, apiSaveGeneration } from "./auth.js";
import { GoogleGenAI, Type } from "@google/genai";
import './style.css';


const overlay = document.getElementById('overlay');
// Make downloads global
(window as any).downloadJson = downloadJson;
(window as any).copyMarkdown = copyMarkdown;
(window as any).downloadLogs = downloadLogs;

// Helper to update Saved Tab visibility
function updateSavedTabVisibility() {
    const btn = document.getElementById('modeSavedBtn');
    if (btn) {
        if (state.user.token) btn.classList.remove('hidden');
        else btn.classList.add('hidden');
    }
    // Update save button in header
    renderShopHeader();
}

// Helper to update SRD specific UI visibility
function updateSrdUi() {
    const isSrd = state.currentMode === 'srd';
    const isUnique = state.srdGenMode === 'unique';

    // Toggle SRD controls container
    const controls = document.getElementById('srdGenControls');
    if (controls) controls.style.display = isSrd ? 'flex' : 'none';

    // Toggle buttons state
    document.getElementById('genModeRandom')?.classList.toggle('active', !isUnique);
    document.getElementById('genModeUnique')?.classList.toggle('active', isUnique);

    // Toggle panels
    const tagSelector = document.getElementById('srdTagSelector');
    const builderPanel = document.getElementById('builderModePanel');
    const toggleLogsBtn = document.getElementById('toggleLogsBtn');
    const logsPanel = document.getElementById('logsPanel');
    // Toggle Context Controls: Show in Generator mode OR (SRD mode AND Random)
    const contextControls = document.getElementById('contextControls');
    if (contextControls) {
        if (state.currentMode === 'srd' && isUnique) {
            contextControls.classList.add('hidden');
        } else {
            contextControls.classList.remove('hidden');
        }
    }

    if (tagSelector) tagSelector.style.display = (isSrd && isUnique) ? 'block' : 'none';

    // If we are in Unique mode, we hide the standard builder rows
    if (builderPanel) {
        if (isSrd && isUnique) {
            builderPanel.classList.add('hidden');
        } else {
            // Only show builder panel if input mode is builder (it might be hidden by text mode)
            if (state.inputMode === 'builder') {
                builderPanel.classList.remove('hidden');
            }
        }
    }

    renderBuilder();
}

function updateModalInternalsVisibility() {
    const tab = document.getElementById('tabInternals');
    if (tab) {
        if (state.settings.internals) {
            tab.classList.remove('hidden');
        } else {
            tab.classList.add('hidden');
        }
    } else {
        document.body.classList.remove('show-internals');
    }
}

export function renderBuilder() {
    const builderContainer = document.getElementById('builderRows');
    if (!builderContainer) return;
    builderContainer.innerHTML = '';

    const isSrdMode = state.currentMode === 'srd';
    // If unique pool mode, we don't render builder rows
    if (isSrdMode && state.srdGenMode === 'unique') return;

    // Determine available tags and rarities for the current context
    let validTags = state.srdTagsIndex;
    let availableRarities = ['common', 'uncommon', 'rare', 'very_rare', 'legendary'];

    if (isSrdMode && state.srdGenMode === 'random') {
        const candidates = getFilteredSrdItems(state.shopContext);

        // Filter Tags
        const tagCounts = new Map<string, number>();
        candidates.forEach(c => {
            const tags = (c.Tags || "").split(/[;,]/).map(t => t.trim()).filter(t => t);
            tags.forEach(t => tagCounts.set(t, (tagCounts.get(t) || 0) + 1));
        });
        validTags = Array.from(tagCounts.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => a.tag.localeCompare(b.tag));

        // Filter Rarities
        const distinctRarities = new Set(candidates.map(c => (c.RarityKey || 'common').toLowerCase().trim().replace(/\s+/g, '_')));
        availableRarities = availableRarities.filter(r => distinctRarities.has(r));
    }

    const builderRows = state.builderRows;

    builderRows.forEach(row => {
        const div = document.createElement('div');
        div.className = 'builder-row';
        div.dataset.id = row.id;

        const qtyHtml = `<input type="number" class="qty-in" value="${row.qty}" min="1">`;

        let queryHtml = '';
        if (isSrdMode) {
            const options = validTags.map(t =>
                `<option value="${t.tag}" ${row.tag === t.tag ? 'selected' : ''}>${t.tag} — ${t.count}</option>`
            ).join('');
            // Keep selected value even if filtered out, to avoid confusion
            const extraOption = (row.tag && !validTags.find(t => t.tag === row.tag)) ? `<option value="${row.tag}" selected>${row.tag} (Unavailable)</option>` : '';
            queryHtml = `<select class="query-in tag-sel-row"><option value="">Select Tag</option>${extraOption}${options}</select>`;
        } else {
            const bases = state.db.CORE_BASES || [];
            const families = Array.from(new Set(bases.map((b: any) => b.FamilyKey).filter((k: any) => k))).sort();
            const options = families.map((f: unknown) =>
                `<option value="${f as string}" ${row.baseId === f ? 'selected' : ''}>${formatLabel(f as string)}</option>`
            ).join('');

            // Check if row.baseId matches any family, if not (and it's not empty), show it as selected but perhaps without label formatting logic
            // This handles internal keys that are not family keys
            let extraOption = '';
            const exists = families.includes(row.baseId);
            if (row.baseId && !exists) {
                extraOption = `<option value="${row.baseId}" selected>${row.baseId} (ID)</option>`;
            }

            queryHtml = `<select class="query-in">
                <option value="">Any Family</option>
                ${extraOption}
                ${options}
            </select>`;
        }

        // Rarity Dropdown (Filtered)
        // If current selection is not in available, show it but mark it
        const currentRarityValid = !row.rarityKey || availableRarities.includes(row.rarityKey);
        const rarityOptions = availableRarities.map(r =>
            `<option value="${r}" ${row.rarityKey === r ? 'selected' : ''}>${formatLabel(r)}</option>`
        ).join('');

        const extraRarity = (!currentRarityValid && row.rarityKey) ? `<option value="${row.rarityKey}" selected>${formatLabel(row.rarityKey)} (Unavailable)</option>` : '';

        const rarityHtml = `<select class="rarity-sel">
            <option value="">Any Rarity</option>
            ${extraRarity}
            ${rarityOptions}
        </select>`;

        div.innerHTML = `
            ${qtyHtml}
            ${queryHtml}
            ${rarityHtml}
            <button class="btn-icon remove-row" title="Remove Row">×</button>
        `;

        // Event listeners for inputs
        const qtyInput = div.querySelector('.qty-in');
        if (qtyInput) {
            qtyInput.addEventListener('change', (e: any) => {
                row.qty = parseInt(e.target.value) || 1;
            });
        }

        const queryInput = div.querySelector('.query-in');
        if (queryInput) {
            queryInput.addEventListener('change', (e: any) => {
                if (isSrdMode) row.tag = e.target.value;
                else row.baseId = e.target.value;
            });
        }

        const rarityInput = div.querySelector('.rarity-sel');
        if (rarityInput) {
            rarityInput.addEventListener('change', (e: any) => {
                row.rarityKey = e.target.value;
            });
        }

        const removeBtn = div.querySelector('.remove-row');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                state.builderRows = state.builderRows.filter(r => r.id !== row.id);
                renderBuilder();
            });
        }

        builderContainer.appendChild(div);
    });
}

// Reusable generation function
function runGeneration(preserveDetails = false, selectedUniqueTags: Set<string>) {
    // Reset Lock on new generation
    if (!preserveDetails) {
        state.locked = false;
    }

    let items = [];

    // 1. Generate Items
    if (state.currentMode === 'srd') {
        if (state.srdGenMode === 'unique') {
            // Unique Pool Generation
            items = generateUniquePoolBatch(Array.from(selectedUniqueTags));
        } else {
            // Standard Random Shop Generation
            items = generateShopInventory(state.builderRows);
        }
    } else {
        items = generateProceduralItems(state.builderRows);
    }
    state.generatedItems = items;

    // 2. Handle Shop Details (Name, Merchant, etc)
    if (!preserveDetails) {
        generateShopDetails();
    }

    // 3. UI Updates
    state.filters.activeTag = ''; // Reset filter to show all
    renderShopHeader();
    updateTagFilterDropdown();
    refreshGrid();
    log(`Generated ${items.length} items.`);
}

// Updated interpretPrompt to use browser-compatible API key
export async function interpretPrompt(promptText: string) {
    // Try to get API key from state or localStorage
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.warn("API Key not found in environment. Text Mode requires a configured API Key.");
        return null;
    }

    // Extract valid options from DB
    const extract = (table: any[], key: string) => table ? table.map(r => r[key]).filter(x => x).join(', ') : '';
    const settlements = extract(state.srdDb.SETTLEMENT_TIERS, 'SettlementTier');
    const wealths = extract(state.srdDb.ECONOMY_MODIFIERS, 'WealthLevel');
    const biomes = extract(state.srdDb.BIOME_MODIFIERS, 'Biome');
    const laws = extract(state.srdDb.LAW_HEAT, 'LawLevel');

    const systemPrompt = `You are a D&D Shop Generator assistant.
    Your task is to interpret a user's description of a shop and configure the generator parameters to match it.
    
    Available Parameters (pick the closest match from the list):
    - Settlement: ${settlements}
    - Wealth: ${wealths}
    - Biome: ${biomes}
    - Law: ${laws}
    
    Shop Identity:
    - Generate a Name (Prefix, Noun, Suffix)
    - Generate Merchant Details (First Name, Last Name, Race, Personality)
    
    Inventory Request:
    - Create a list of item categories (tags) and quantities to stock the shop.
    - Valid Tags Examples: Weapon, Armor, Potion, Scroll, Wondrous Item, Ring, Rod, Staff, Wand, or specific types like Sword, Bow.
    - Rarities: common, uncommon, rare, very_rare, legendary.
    
     Output JSON only. Ensure parameter values match the casing of the available options where possible.
    `;

    try {
        const ai = new GoogleGenAI({ apiKey });
        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Description: ${promptText}`,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        settlement: { type: Type.STRING },
                        wealth: { type: Type.STRING },
                        biome: { type: Type.STRING },
                        law: { type: Type.STRING },
                        shopDetails: {
                            type: Type.OBJECT,
                            properties: {
                                namePrefix: { type: Type.STRING },
                                nameNoun: { type: Type.STRING },
                                nameSuffix: { type: Type.STRING },
                                shopType: { type: Type.STRING },
                                merchantFirst: { type: Type.STRING },
                                merchantLast: { type: Type.STRING },
                                merchantRace: { type: Type.STRING },
                                merchantPersonality: { type: Type.STRING },
                            }
                        },
                        inventory: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    tag: { type: Type.STRING },
                                    qty: { type: Type.INTEGER },
                                    rarity: { type: Type.STRING, enum: ["common", "uncommon", "rare", "very_rare", "legendary"] }
                                }
                            }
                        }
                    }
                }
            }
        });

        const text = result.text;
        if (!text) return null;
        return JSON.parse(text);
    } catch (e) {
        console.error("AI Interpretation Error", e);
        return null;
    }
}

// Global initialization
window.addEventListener('DOMContentLoaded', async () => {
    // State for selected unique pool tags
    const selectedUniqueTags = new Set<string>();

    // Init Auth
    await initAuth();

    // Moved up to be accessible by Load Code logic
    const activeChips = document.getElementById('activeTagChips');
    const tagBtn = document.getElementById('tagSelectorBtn');
    const tagList = document.getElementById('tagOptionsList');
    const tagSearch = document.getElementById('tagSearch') as HTMLInputElement;

    function renderTagOptions(filter: string = "") {
        if (!tagList) return;
        const allTags = state.srdTagsIndex || [];
        const filtered = allTags.filter(t => t.tag.toLowerCase().includes(filter.toLowerCase()));

        tagList.innerHTML = filtered.map(t => {
            const isSelected = selectedUniqueTags.has(t.tag);
            return `<div class="tag-option" style="padding:4px; cursor:pointer; background:${isSelected ? 'rgba(255,255,255,0.1)' : 'transparent'}" data-tag="${t.tag}">
                ${t.tag} (${t.count}) ${isSelected ? '✓' : ''}
            </div>`;
        }).join('');
    }

    function renderActiveTags() {
        if (!activeChips) return;
        activeChips.innerHTML = Array.from(selectedUniqueTags).map(t =>
            `<span class="tag-chip">${t} <span class="tag-chip-remove" data-tag="${t}">×</span></span>`
        ).join('');
        if (tagBtn) tagBtn.textContent = `Tags (${selectedUniqueTags.size})`;
    }

    // Helper to sync Modal Internals visibility
    const updateModalInternalsVisibility = () => {
        const tabBtn = document.getElementById('internalsTabBtn');
        if (tabBtn) {
            tabBtn.style.display = state.settings.internals ? 'block' : 'none';
            // If hidden while active, switch to Details
            if (!state.settings.internals && tabBtn.classList.contains('active')) {
                document.getElementById('tabDetailsBtn')?.click();
            }
        }
    };

    // 1. Try to load default data immediately
    await loadDefaultData().then(success => {
        if (success) {
            renderBuilder();
            refreshGrid();
            initShopDropdowns();
            initContextDropdowns();
            // Attach listeners to context dropdowns to refresh builder options
            ['ctxSettlement', 'ctxWealth', 'ctxBiome', 'ctxLaw'].forEach(id => {
                document.getElementById(id)?.addEventListener('change', () => {
                    // Wait briefly for state update in ui.ts
                    setTimeout(() => renderBuilder(), 0);
                });
            });
        }
    });

    // 3. Generation Logic (Button Click)
    const genBtn = document.getElementById('generateBtn') as HTMLButtonElement;
    if (genBtn) {
        genBtn.addEventListener('click', async () => {
            if (state.inputMode === 'text') {
                const promptEl = document.getElementById('promptArea') as HTMLTextAreaElement;
                const prompt = promptEl.value.trim();

                if (prompt) {
                    const originalText = genBtn.textContent;
                    genBtn.textContent = "AI Interpreting...";
                    genBtn.disabled = true;

                    try {
                        const aiConfig = await interpretPrompt(prompt);
                        if (aiConfig) {
                            // Apply Config
                            if (aiConfig.settlement) state.shopContext.settlement = aiConfig.settlement;
                            if (aiConfig.wealth) state.shopContext.wealth = aiConfig.wealth;
                            if (aiConfig.biome) state.shopContext.biome = aiConfig.biome;
                            if (aiConfig.law) state.shopContext.law = aiConfig.law;

                            if (aiConfig.shopDetails) {
                                state.shopDetails = { ...state.shopDetails, ...aiConfig.shopDetails };
                            }

                            if (aiConfig.inventory && Array.isArray(aiConfig.inventory)) {
                                state.builderRows = aiConfig.inventory.map((i: any) => ({
                                    id: crypto.randomUUID(),
                                    qty: i.qty || 1,
                                    baseId: '', // Text mode mainly for SRD/Tags
                                    tag: i.tag || '',
                                    rarityKey: i.rarity || ''
                                }));
                            }

                            // Update UI
                            updateContextDropdowns();
                            renderShopHeader(); // Update header manually to preview name
                            updateShopDropdowns(); // Sync dropdowns
                            renderBuilder(); // Show the generated rows

                            log("AI configuration applied.", "success");

                            // Generate with preserved details
                            runGeneration(true, selectedUniqueTags);
                        } else {
                            log("AI returned no config, running default.", "warn");
                            runGeneration(false, selectedUniqueTags);
                        }
                    } catch (err) {
                        console.error(err);
                        log("AI generation failed: " + err, "error");
                        runGeneration(false, selectedUniqueTags);
                    } finally {
                        genBtn.textContent = originalText;
                        genBtn.disabled = false;
                    }
                } else {
                    runGeneration(false, selectedUniqueTags);
                }
            } else {
                // Standard generation = New Details
                runGeneration(false, selectedUniqueTags);
            }
        });
    }

    const addRowBtn = document.getElementById('addRowBtn');
    if (addRowBtn) {
        addRowBtn.addEventListener('click', () => {
            state.builderRows.push({ id: crypto.randomUUID(), qty: 1, baseId: '', tag: '', rarityKey: '' });
            renderBuilder();
        });
    }

    // 4. Modal Interaction Logic
    const overlay = document.getElementById('modalOverlay');

    function closeModals() {
        if (overlay) overlay.style.display = 'none';
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    }

    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModals();
        });
    }

    ['modalClose', 'batchClose', 'aboutClose', 'authClose'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', closeModals);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModals();
    });

    // Admin Users Logic
    const adminBtn = document.getElementById('adminUsersBtn');
    if (adminBtn) {
        adminBtn.addEventListener('click', async () => {
            if (!state.user.token || state.user.role !== 'admin') return;

            const modal = document.getElementById('adminUsersModal');
            const listEl = document.getElementById('adminUsersList');
            const overlay = document.getElementById('modalOverlay');

            if (modal && overlay && listEl) {
                modal.classList.remove('hidden');
                overlay.style.display = 'flex';
                listEl.innerHTML = '<div style="padding:1rem; text-align:center;">Fetching users...</div>';

                try {
                    const users = await apiGetUsers(state.user.token);
                    // Sort by ID
                    users.sort((a: any, b: any) => (a.id || 0) - (b.id || 0));

                    if (users.length === 0) {
                        listEl.innerHTML = '<div style="padding:1rem; text-align:center;">No users found.</div>';
                        return;
                    }

                    let html = `
                        <table style="width:100%; border-collapse: collapse; font-size:0.9rem;">
                            <thead>
                                <tr style="border-bottom: 1px solid var(--border); text-align:left;">
                                    <th style="padding:8px; color:var(--text-muted);">ID</th>
                                    <th style="padding:8px; color:var(--text-muted);">Login</th>
                                    <th style="padding:8px; color:var(--text-muted);">Email</th>
                                    <th style="padding:8px; color:var(--text-muted);">Role</th>
                                    <th style="padding:8px; color:var(--text-muted);">Joined</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;

                    users.forEach((u: any) => {
                        html += `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <td style="padding:8px;">${u.id}</td>
                                <td style="padding:8px; font-weight:600;">${u.login}</td>
                                <td style="padding:8px;">${u.email || '-'}</td>
                                <td style="padding:8px;">${u.role || 'user'}</td>
                                <td style="padding:8px; color:var(--text-muted); font-size:0.8rem;">
                                    ${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                                </td>
                            </tr>
                        `;
                    });

                    html += `</tbody></table>`;
                    listEl.innerHTML = html;

                } catch (e) {
                    listEl.innerHTML = `<div style="padding:1rem; text-align:center; color:var(--danger);">Error fetching users.</div>`;
                }
            }
        });
    }

    // 5. Results Interaction (Open Details)
    const resultsGrid = document.getElementById('resultsGrid');
    if (resultsGrid) {
        resultsGrid.addEventListener('click', (e: any) => {
            const card = e.target.closest('.item-card');
            if (card && card.dataset.id) {
                const item = state.generatedItems.find(i => i.id === card.dataset.id);
                if (item) {
                    state.currentItem = item;
                    // Reset Tabs
                    const tabDetails = document.getElementById('tabDetailsBtn');
                    const tabInternals = document.getElementById('internalsTabBtn');
                    if (tabDetails) tabDetails.classList.add('active');
                    if (tabInternals) tabInternals.classList.remove('active');

                    renderModal(item, 'details');
                    const modal = document.getElementById('itemModal');
                    if (modal && overlay) {
                        modal.classList.remove('hidden');
                        overlay.style.display = 'flex';
                    }
                }
            }
        });
    }

    // 6. Item Modal Tabs
    const tabDetails = document.getElementById('tabDetailsBtn');
    const tabInternals = document.getElementById('internalsTabBtn');
    if (tabDetails && tabInternals) {
        tabDetails.addEventListener('click', () => {
            if (!state.currentItem) return;
            tabDetails.classList.add('active');
            tabInternals.classList.remove('active');
            renderModal(state.currentItem, 'details');
        });
        tabInternals.addEventListener('click', () => {
            if (!state.currentItem) return;
            tabInternals.classList.add('active');
            tabDetails.classList.remove('active');
            renderModal(state.currentItem, 'internals');
        });
    }

    // 7. Header Toggles & Controls

    const themeToggle = document.getElementById('themeToggle') as HTMLInputElement;
    if (themeToggle) {
        state.settings.theme = themeToggle.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', state.settings.theme);

        themeToggle.addEventListener('change', (e: any) => {
            state.settings.theme = e.target.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', state.settings.theme);
        });
    }

    const logsPanel = document.getElementById('pipelineLogsPanel');
    const toggleLogsBtn = document.getElementById('toggleLogsBtn');

    // Initialize Logs visibility
    if (logsPanel) {
        if (!state.settings.debug) logsPanel.classList.add('hidden');
    }

    // Collapse Button Logic
    if (toggleLogsBtn && logsPanel) {
        toggleLogsBtn.addEventListener('click', () => {
            logsPanel.classList.toggle('collapsed');
            const isCollapsed = logsPanel.classList.contains('collapsed');
            toggleLogsBtn.textContent = isCollapsed ? '▲' : '▼';
        });
    }

    document.getElementById('debugToggle')?.addEventListener('change', (e: any) => {
        state.settings.debug = e.target.checked;
        log(`Debug mode ${state.settings.debug ? 'enabled' : 'disabled'}.`);

        // Toggle logs visibility based on debug state
        if (logsPanel) {
            if (state.settings.debug) logsPanel.classList.remove('hidden');
            else logsPanel.classList.add('hidden');
        }

        refreshGrid();
    });

    document.getElementById('internalsToggle')?.addEventListener('change', (e: any) => {
        state.settings.internals = e.target.checked;
        log(`Internals ${state.settings.internals ? 'shown' : 'hidden'}.`);
        updateModalInternalsVisibility();
    });

    document.getElementById('seedInput')?.addEventListener('change', (e: any) => {
        state.settings.seed = e.target.value;
    });

    document.getElementById('clearBtn')?.addEventListener('click', () => {
        state.generatedItems = [];
        state.filters.activeTag = '';
        state.shopDetails = { namePrefix: '', nameNoun: '', nameSuffix: '', shopType: '', merchantFirst: '', merchantLast: '', merchantRace: '', merchantPersonality: '' };

        // Reset visibility controls and locks
        ['toggleHidePrice', 'toggleHideDesc', 'toggleHideName', 'toggleHideRarity', 'toggleHideType'].forEach(id => {
            const el = document.getElementById(id) as HTMLInputElement;
            if (el) { el.checked = false; el.disabled = false; }
        });
        state.batchVisibility = {
            hidePrice: false,
            hideDescription: false,
            hideName: false,
            hideRarity: false,
            hideType: false
        };
        state.locked = false; // Reset lock on clear

        renderShopHeader();
        updateTagFilterDropdown();
        refreshGrid();
        log('Cleared results.');
    });

    // Export Buttons
    document.getElementById('exportJsonBtn')?.addEventListener('click', () => {
        downloadJson(state.generatedItems, '3.6', false);
    });

    document.getElementById('exportFullBtn')?.addEventListener('click', () => {
        downloadJson(state.generatedItems, '3.6', true);
    });

    document.getElementById('copyMdBtn')?.addEventListener('click', () => {
        copyMarkdown(state.generatedItems, '3.6');
    });

    // About Button
    document.getElementById('aboutBtn')?.addEventListener('click', () => {
        const modal = document.getElementById('aboutModal');
        const overlay = document.getElementById('modalOverlay');
        if (modal && overlay) {
            modal.classList.remove('hidden');
            overlay.style.display = 'flex';
        }
    });

    // Download Logs Button
    document.getElementById('downloadLogsBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        downloadLogs('3.6', state.lastFilename);
    });

    // 8. Mode Tabs (Generator vs SRD)
    const modeGenBtn = document.getElementById('modeGeneratorBtn');
    const modeSrdBtn = document.getElementById('modeSRDBtn');
    const modeSavedBtn = document.getElementById('modeSavedBtn');
    const savedPanel = document.getElementById('savedShopsPanel');
    const genControls = document.getElementById('builderModePanel'); // and others
    // We need to manage visibility of "Generator Controls" vs "Saved List"
    // The existing structure has `promptPanel` containing builder/text inputs.
    // `savedShopsPanel` is inside `promptPanel` (based on my edit to index.html).

    function switchMode(mode: 'generator' | 'srd' | 'saved') {
        if (modeGenBtn) modeGenBtn.addEventListener('click', () => switchMode('generator'));
        if (modeSrdBtn) modeSrdBtn.addEventListener('click', () => switchMode('srd'));
        if (modeSavedBtn) modeSavedBtn.addEventListener('click', () => switchMode('saved'));

        // Periodically check auth to toggle Saved Tab (simple poll to avoid complex event bus changes)
        setInterval(updateSavedTabVisibility, 1000);

        // Toggle Saved Panel
        if (savedPanel) savedPanel.classList.toggle('hidden', mode !== 'saved');

        // Toggle Generator Specifics
        const showGen = mode !== 'saved';
        // Note: updateSrdUi handles hiding builderModePanel vs SRD panels
        // We just need to ensure savedPanel hides both.

        // Hide standard panels if saved
        const builder = document.getElementById('builderModePanel');
        const text = document.getElementById('textModePanel');
        const srdControls = document.getElementById('srdGenControls');
        const ctxControls = document.getElementById('contextControls');
        const genBar = document.querySelector('.generate-bar') as HTMLElement;

        if (mode === 'saved') {
            if (builder) builder.classList.add('hidden');
            if (text) text.classList.add('hidden');
            if (srdControls) srdControls.style.display = 'none'; // direct style override
            if (ctxControls) ctxControls.classList.add('hidden');
            if (genBar) genBar.classList.add('hidden');

            // Fetch list
            renderSavedShops();
        } else {
            if (genBar) genBar.classList.remove('hidden');
            // Re-run standard UI update to show correct generator panels
            state.currentMode = mode === 'srd' ? 'srd' : 'generator';
            updateSrdUi();
        }
    }
    if (modeGenBtn && modeSrdBtn) {
        modeGenBtn.addEventListener('click', () => {
            state.currentMode = 'generator';
            modeGenBtn.classList.add('active');
            modeSrdBtn.classList.remove('active');
            updateSrdUi();
        });
        modeSrdBtn.addEventListener('click', () => {
            state.currentMode = 'srd';
            modeSrdBtn.classList.add('active');
            modeGenBtn.classList.remove('active');
            updateSrdUi();
        });
    }

    // 9. Input Mode Tabs (Builder vs Text)
    const modeBuilderBtn = document.getElementById('modeBuilderBtn');
    const modeTextBtn = document.getElementById('modeTextBtn');
    const builderPanel = document.getElementById('builderModePanel');
    const textPanel = document.getElementById('textModePanel');

    if (modeBuilderBtn && modeTextBtn && builderPanel && textPanel) {
        modeBuilderBtn.addEventListener('click', () => {
            state.inputMode = 'builder';
            modeBuilderBtn.classList.add('active');
            modeTextBtn.classList.remove('active');
            builderPanel.classList.remove('hidden');
            textPanel.classList.add('hidden');
            updateSrdUi(); // Ensure SRD unique mode logic respects this if needed
        });
        modeTextBtn.addEventListener('click', () => {
            state.inputMode = 'text';
            modeTextBtn.classList.add('active');
            modeBuilderBtn.classList.remove('active');
            builderPanel.classList.add('hidden');
            textPanel.classList.remove('hidden');
        });
    }

    // 10. Panel Toggle
    const togglePanelBtn = document.getElementById('togglePanelBtn');
    const promptPanel = document.getElementById('promptPanel');
    if (togglePanelBtn && promptPanel) {
        togglePanelBtn.addEventListener('click', () => {
            promptPanel.classList.toggle('hidden');
            togglePanelBtn.textContent = promptPanel.classList.contains('hidden') ? '▲' : '▼';
        });
    }

    // 11. Batch Code Button & Modal Logic
    const batchCodeBtn = document.getElementById('batchCodeBtn');
    if (batchCodeBtn) {
        batchCodeBtn.addEventListener('click', () => {
            const modal = document.getElementById('batchModal');
            if (modal && overlay) {
                modal.classList.remove('hidden');
                overlay.style.display = 'flex';
                // When opening batch modal, update dropdowns to match current state
                updateShopDropdowns();

                // Lock Send Tab if state is locked (loaded from code)
                const tabSend = document.getElementById('tabSendBatch');
                if (tabSend) {
                    if (state.locked) {
                        tabSend.style.opacity = '0.5';
                        tabSend.style.cursor = 'not-allowed';
                        tabSend.title = "Cannot generate code for a locked shop. Generate a new shop to share.";

                        // Force switch to Load tab if Send is active (though normally modal opens fresh)
                        const tabLoad = document.getElementById('tabLoadBatch');
                        if (tabLoad && tabSend.classList.contains('active')) {
                            tabLoad.click();
                        }
                    } else {
                        tabSend.style.opacity = '1';
                        tabSend.style.cursor = 'pointer';
                        tabSend.title = "";
                    }
                }
            }
        });
    }

    const tabLoadBatch = document.getElementById('tabLoadBatch');
    const tabSendBatch = document.getElementById('tabSendBatch');
    const batchLoadView = document.getElementById('batchLoadView');
    const batchSendView = document.getElementById('batchSendView');

    if (tabLoadBatch && tabSendBatch && batchLoadView && batchSendView) {
        // Use onclick to replace listeners to prevent stacking if hot-reloaded
        tabLoadBatch.onclick = () => {
            tabLoadBatch.classList.add('active');
            tabSendBatch!.classList.remove('active');
            batchLoadView!.classList.remove('hidden');
            batchSendView!.classList.add('hidden');
        };
        tabSendBatch.onclick = () => {
            if (state.locked) return; // Prevent access if locked

            tabSendBatch!.classList.add('active');
            tabLoadBatch.classList.remove('active');
            batchSendView!.classList.remove('hidden');
            batchLoadView!.classList.add('hidden');

            // Auto generate code when switching to Send
            document.getElementById('executeGenCodeBtn')?.click();
        };
    }

    // Batch Visibility Toggles
    const toggleHidePrice = document.getElementById('toggleHidePrice');
    if (toggleHidePrice) {
        toggleHidePrice.addEventListener('change', (e: any) => {
            state.batchVisibility.hidePrice = e.target.checked;
            refreshGrid();
        });
    }
    const toggleHideDesc = document.getElementById('toggleHideDesc');
    if (toggleHideDesc) {
        toggleHideDesc.addEventListener('change', (e: any) => {
            state.batchVisibility.hideDescription = e.target.checked;
            refreshGrid();
        });
    }
    const toggleHideName = document.getElementById('toggleHideName');
    if (toggleHideName) {
        toggleHideName.addEventListener('change', (e: any) => {
            state.batchVisibility.hideName = e.target.checked;
            refreshGrid();
        });
    }
    const toggleHideRarity = document.getElementById('toggleHideRarity');
    if (toggleHideRarity) {
        toggleHideRarity.addEventListener('change', (e: any) => {
            state.batchVisibility.hideRarity = e.target.checked;
            refreshGrid();
        });
    }
    const toggleHideType = document.getElementById('toggleHideType');
    if (toggleHideType) {
        toggleHideType.addEventListener('change', (e: any) => {
            state.batchVisibility.hideType = e.target.checked;
            refreshGrid();
        });
    }

    // Batch Logic Execution
    const executeGenCodeBtn = document.getElementById('executeGenCodeBtn');
    if (executeGenCodeBtn) {
        executeGenCodeBtn.addEventListener('click', () => {
            // Harvest overrides (modified prices)
            const overrides = state.generatedItems.reduce((acc: any, item, idx) => {
                if (item.internals && item.internals.modifiedPrice) {
                    acc[idx] = item.priceGp;
                }
                return acc;
            }, {});

            const payload = {
                version: '3.6',
                rows: state.builderRows,
                vis: state.batchVisibility,
                context: state.shopContext,
                mode: state.currentMode,
                srdMode: state.srdGenMode,
                shopDetails: state.shopDetails,
                seed: state.settings.seed, // Add seed so items can be restored exactly
                tags: Array.from(selectedUniqueTags), // Save unique pool tags
                overrides: overrides // Save modified prices
            };
            const area = document.getElementById('batchSendArea') as HTMLTextAreaElement;
            if (area) area.value = btoa(JSON.stringify(payload));
        });
    }

    const executeLoadBatchBtn = document.getElementById('executeLoadBatchBtn');
    if (executeLoadBatchBtn) {
        executeLoadBatchBtn.addEventListener('click', () => {
            const area = document.getElementById('batchLoadArea') as HTMLTextAreaElement;
            if (!area) return;
            try {
                const raw = atob(area.value.trim());
                const data = JSON.parse(raw);

                if (data.rows) state.builderRows = data.rows;

                // Restore Seed if present (Allows item restoration)
                if (data.seed) {
                    state.settings.seed = data.seed;
                    const seedInput = document.getElementById('seedInput') as HTMLInputElement;
                    if (seedInput) seedInput.value = data.seed;
                }

                // Restore Tags if present
                if (data.tags && Array.isArray(data.tags)) {
                    selectedUniqueTags.clear();
                    data.tags.forEach((t: string) => selectedUniqueTags.add(t));
                    renderActiveTags();
                }

                if (data.vis) {
                    state.batchVisibility = data.vis;

                    const updateToggle = (id: string, val: boolean) => {
                        const el = document.getElementById(id) as HTMLInputElement;
                        if (el) {
                            el.checked = !!val;
                            el.disabled = !!val; // Lock if hidden
                        }
                    };

                    updateToggle('toggleHidePrice', data.vis.hidePrice);
                    updateToggle('toggleHideDesc', data.vis.hideDescription);
                    updateToggle('toggleHideName', data.vis.hideName);
                    updateToggle('toggleHideRarity', data.vis.hideRarity);
                    updateToggle('toggleHideType', data.vis.hideType);
                }
                if (data.context) state.shopContext = { ...state.shopContext, ...data.context };
                if (data.mode) state.currentMode = data.mode;
                if (data.srdMode) state.srdGenMode = data.srdMode;
                if (data.shopDetails) state.shopDetails = data.shopDetails;

                // Ensure state propagation before generation
                setTimeout(() => {
                    renderBuilder();
                    updateSrdUi();

                    // Render the restored shop details immediately
                    renderShopHeader();

                    // Update context dropdowns if they exist
                    updateContextDropdowns();

                    refreshGrid();
                    closeModals();

                    // Execute generation, but PRESERVE the details we just loaded
                    runGeneration(true, selectedUniqueTags);

                    // Restore overrides
                    if (data.overrides) {
                        Object.keys(data.overrides).forEach(k => {
                            const idx = parseInt(k);
                            const price = data.overrides[k];
                            if (state.generatedItems[idx]) {
                                state.generatedItems[idx].priceGp = price;
                                // We don't mark modifiedPrice here because it's now locked
                            }
                        });
                        refreshGrid(); // Refresh to show overridden prices
                    }

                    // Lock the shop to prevent edits
                    state.locked = true;

                    log("Batch code loaded and executed.", "info");
                }, 50);

            } catch (err) {
                alert("Invalid or corrupt batch code string.");
                console.error(err);
            }
        });
    }
    // 12. SRD Unique/Random Modes
    document.getElementById('genModeRandom')?.addEventListener('click', () => {
        state.srdGenMode = 'random';
        updateSrdUi();
    });
    document.getElementById('genModeUnique')?.addEventListener('click', () => {
        state.srdGenMode = 'unique';
        updateSrdUi();
    });

    if (tagSearch) {
        tagSearch.addEventListener('input', (e: any) => {
            renderTagOptions(e.target.value);
            if (tagList) tagList.style.display = 'block';
        });
        tagSearch.addEventListener('focus', () => {
            renderTagOptions(tagSearch.value);
            if (tagList) tagList.style.display = 'block';
        });
    }

    if (tagBtn) {
        tagBtn.addEventListener('click', () => {
            if (tagList) tagList.style.display = tagList.style.display === 'none' ? 'block' : 'none';
            renderTagOptions(tagSearch?.value || "");
        });
    }

    // Delegate clicks for tag options
    document.addEventListener('click', (e: any) => {
        if (e.target.classList.contains('tag-option')) {
            const tag = e.target.dataset.tag;
            if (selectedUniqueTags.has(tag)) selectedUniqueTags.delete(tag);
            else selectedUniqueTags.add(tag);
            renderActiveTags();
            renderTagOptions(tagSearch?.value || "");
        }
        if (e.target.classList.contains('tag-chip-remove')) {
            const tag = e.target.dataset.tag;
            selectedUniqueTags.delete(tag);
            renderActiveTags();
            renderTagOptions(tagSearch?.value || "");
        }
        // Close list if clicking outside
        if (tagList && tagList.style.display === 'block' &&
            !e.target.closest('#srdTagSelector') && e.target !== tagBtn) {
            tagList.style.display = 'none';
        }
    });

    // 14. Quick Controls Logic (Search/Sort)
    const searchInput = document.getElementById('searchFilter');
    if (searchInput) {
        searchInput.addEventListener('input', (e: any) => {
            state.filters.search = e.target.value;
            refreshGrid();
        });
    }

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e: any) => {
            state.filters.sort = e.target.value;
            refreshGrid();
        });
    }

    // Tag Dropdown
    const tagDropdown = document.getElementById('tagDropdown');
    if (tagDropdown) {
        tagDropdown.addEventListener('change', (e: any) => {
            state.filters.activeTag = e.target.value;
            refreshGrid();
        });
    }

    // Initialize UI parts
    renderRarityToggles();
    updateSrdUi();
    updateModalInternalsVisibility();
    initShopDropdowns();
    initContextDropdowns();
});