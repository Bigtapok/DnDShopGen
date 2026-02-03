import { state, RARITY_ORDER } from "../state.js";
import { formatLabel } from "../utils.js";

export function renderBuilder() {
    const container = document.getElementById('builderRows');
    if (!container) return;

    container.innerHTML = '';

    state.builderRows.forEach((row, index) => {
        const div = document.createElement('div');
        div.className = 'builder-row';
        div.dataset.id = row.id;

        // Helper to get formatted rarity options
        const rarityOptions = RARITY_ORDER.map(r =>
            `<option value="${r}" ${row.rarityKey === r ? 'selected' : ''}>${formatLabel(r)}</option>`
        ).join('');

        div.innerHTML = `
            <input type="number" class="qty-input" value="${row.qty}" min="1" aria-label="Quantity">
            <input type="text" class="base-input" placeholder="Base Item / Query" value="${row.baseId || ''}" aria-label="Base Item">
            <input type="text" class="tag-input" placeholder="Tag (Optional)" value="${row.tag || ''}" aria-label="Tag">
            <select class="rarity-select" aria-label="Rarity">
                <option value="">Any Rarity</option>
                ${rarityOptions}
            </select>
            <button class="btn-icon remove-row-btn" aria-label="Remove Row">×</button>
        `;

        // Bind events
        const inputs = div.querySelectorAll('input, select');
        // Qty
        inputs[0].addEventListener('change', (e: any) => { row.qty = parseInt(e.target.value) || 1; });
        // Base
        inputs[1].addEventListener('change', (e: any) => { row.baseId = e.target.value; });
        // Tag
        inputs[2].addEventListener('change', (e: any) => { row.tag = e.target.value; });
        // Rarity
        inputs[3].addEventListener('change', (e: any) => { row.rarityKey = e.target.value; });

        const btn = div.querySelector('.remove-row-btn');
        if (btn) btn.addEventListener('click', () => {
            state.builderRows = state.builderRows.filter(r => r.id !== row.id);
            renderBuilder();
        });

        container.appendChild(div);
    });
}