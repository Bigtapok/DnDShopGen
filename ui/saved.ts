
import { state } from "../state.js";
import { apiGetGenerations, apiDeleteGeneration, apiGetGenerationById } from "../auth.js";
import { log } from "./logging.js";
import { renderShopHeader, refreshGrid } from "./results.js";
import { updateShopDropdowns, updateContextDropdowns } from "./inputs.js";
import { renderBuilder } from "./builder.js";
import { updateSrdUi } from "./srd.js";

export async function renderSavedShops() {
    const listEl = document.getElementById('savedShopsList');
    if (!listEl) return;

    listEl.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-muted);">Loading saved shops...</div>';

    const gens = await apiGetGenerations();

    if (!gens || gens.length === 0) {
        listEl.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-muted);">No saved shops found.</div>';
        return;
    }

    listEl.innerHTML = '';
    
    // Sort by ID desc (newest first)
    gens.sort((a: any, b: any) => (b.id || 0) - (a.id || 0));

    gens.forEach((g: any) => {
        const row = document.createElement('div');
        row.className = 'saved-shop-row';
        row.style.cssText = `
            display: flex; 
            align-items: center; 
            justify-content: space-between; 
            background: var(--bg-card); 
            padding: 0.75rem; 
            border-radius: var(--radius-md); 
            border: 1px solid var(--border);
        `;

        const dateStr = g.createdAt ? new Date(g.createdAt).toLocaleDateString() : 'Unknown Date';
        const itemCount = g.items ? g.items.length : '?';

        row.innerHTML = `
            <div style="flex:1; min-width:0; margin-right:1rem;">
                <div style="font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${g.name || 'Unnamed Shop'}</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">ID: ${g.id} • ${dateStr} • ${itemCount} items</div>
            </div>
            <div style="display:flex; gap:0.5rem;">
                <button class="load-btn primary" style="padding:4px 12px; font-size:0.8rem;">Load</button>
                <button class="del-btn" style="padding:4px 8px; font-size:0.8rem; background:rgba(239,68,68,0.2); border-color:var(--danger); color:var(--danger);">×</button>
            </div>
        `;

        // Load Handler
        row.querySelector('.load-btn')?.addEventListener('click', async () => {
            log(`Loading shop ${g.id}...`);
            // Try to get full details if available, else use what we have
            // The list usually doesn't have the full deeply nested 'shopDetails' if it was stripped.
            // We assume backend returns everything OR we fetch by ID.
            let fullData = g;
            
            // Heuristic: if items is missing or we suspect incomplete data, fetch by ID
            const fetched = await apiGetGenerationById(g.id);
            if (fetched) fullData = fetched;

            loadShopState(fullData);
        });

        // Delete Handler
        row.querySelector('.del-btn')?.addEventListener('click', async () => {
            if (confirm(`Delete "${g.name}"?`)) {
                const res = await apiDeleteGeneration(g.id);
                if (res.success) {
                    log("Shop deleted.", "success");
                    renderSavedShops();
                } else {
                    log("Failed to delete shop.", "error");
                }
            }
        });

        listEl.appendChild(row);
    });
}

function loadShopState(data: any) {
    if (!data) return;

    // restore items
    if (data.items) {
        state.generatedItems = data.items;
    }

    // restore details
    // The backend stores payload in 'items' and 'name'. 
    // We sent shopDetails inside the body. If the backend preserved it, great.
    if (data.shopDetails) {
        state.shopDetails = data.shopDetails;
    } else if (data.name) {
        // Fallback: Try to parse name if we had to pack info there (not doing that yet, but safe to check)
    }

    if (data.context) {
        state.shopContext = data.context;
    }
    
    // Legacy support: check if 'rows' were saved (builder state)
    if (data.rows) {
        state.builderRows = data.rows;
    }

    state.locked = true; // Lock loaded shops
    
    // UI Updates
    renderShopHeader();
    updateShopDropdowns();
    updateContextDropdowns();
    renderBuilder();
    refreshGrid();
    
    // Switch to Generator tab to show results
    document.getElementById('modeGeneratorBtn')?.click();
    log(`Loaded shop: ${data.name}`, "success");
}
