import { state, RARITY_ORDER } from "../state.js";
import { formatLabel } from "../utils.js";
import { refreshGrid } from "./results.js";

// Renders the rarity toggle chips
export function renderRarityToggles() {
    const container = document.getElementById('rarityFilters');
    if (!container) return;

    container.innerHTML = '<span style="font-size:0.8rem; text-transform:uppercase; color:var(--text-muted); font-weight:600; margin-right:0.5rem;">Filter Rarity:</span>';

    RARITY_ORDER.forEach(r => {
        const isActive = state.filters.rarities.has(r);
        const btn = document.createElement('button');
        btn.className = `filter-chip rarity-${r} ${isActive ? 'active' : ''}`;
        btn.style.opacity = isActive ? '1' : '0.4';
        btn.textContent = formatLabel(r);
        btn.onclick = () => {
            if (state.filters.rarities.has(r)) state.filters.rarities.delete(r);
            else state.filters.rarities.add(r);
            renderRarityToggles(); // Re-render to update visual state
            refreshGrid();
        };
        container.appendChild(btn);
    });
    
    // Explicit legacy support logic if needed for simple inputs
    const simpleContainer = document.getElementById('rarityFiltersSimple');
    if (simpleContainer) {
        simpleContainer.innerHTML = RARITY_ORDER.map(r => `
            <label class="rarity-check">
                <input type="checkbox" value="${r}" checked>
                <span class="checkmark rarity-${r}"></span>
                ${formatLabel(r)}
            </label>
        `).join('');
        
        simpleContainer.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', (e: any) => {
                if (e.target.checked) state.filters.rarities.add(e.target.value);
                else state.filters.rarities.delete(e.target.value);
                refreshGrid();
            });
        });
    }
}

// Updates the tag dropdown with tags from current items
export function updateTagFilterDropdown() {
    const dropdown = document.getElementById('tagDropdown') as HTMLSelectElement;
    if (!dropdown) return;

    // Collect counts
    const counts = new Map<string, number>();

    state.generatedItems.forEach(item => {
        const tags = new Set<string>();

        // SRD Tags
        if (item.srdTags) {
            item.srdTags.forEach(t => tags.add(t));
        }

        // Generator Tags (Use ItemTypeKey as a proxy for category/tag)
        if (item.mode === 'generator' && item.base) {
            tags.add(item.base.ItemTypeKey);
        }

        tags.forEach(tag => {
            const cleanTag = tag.trim();
            if (cleanTag) {
                counts.set(cleanTag, (counts.get(cleanTag) || 0) + 1);
            }
        });
    });

    // Sort by count desc, then alpha
    const sorted = Array.from(counts.entries()).sort((a, b) => {
        if (b[1] === a[1]) return a[0].localeCompare(b[0]);
        return b[1] - a[1];
    });

    // Save current selection if valid
    const currentSelection = state.filters.activeTag;

    dropdown.innerHTML = `<option value="">All Tags (${state.generatedItems.length})</option>`;

    sorted.forEach(([tag, count]) => {
        const opt = document.createElement('option');
        opt.value = tag;
        opt.textContent = `${tag} (${count})`;
        dropdown.appendChild(opt);
    });

    // Restore selection if it still exists, else reset
    if (currentSelection && counts.has(currentSelection)) {
        dropdown.value = currentSelection;
    } else {
        dropdown.value = "";
        state.filters.activeTag = "";
    }
}