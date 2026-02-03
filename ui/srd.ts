import { state } from "../state.js";

export function updateSrdUi() {
    const isSrd = state.currentMode === 'srd';
    const genControls = document.getElementById('generatorControls');
    const srdControls = document.getElementById('srdGenControls');
    if (genControls) genControls.classList.toggle('hidden', isSrd);
    if (srdControls) srdControls.classList.toggle('hidden', !isSrd);

    // Also toggle input hints if needed
    const modeLabel = document.getElementById('modeLabel');
    if (modeLabel) modeLabel.textContent = isSrd ? "SRD Browse Mode" : "Procedural Generator";
}

export function resolveSrdTables(text: string): string {
    if (!text) return "";
    return text.replace(/\[\[TABLE:([^\]]+)\]\]/g, (match, tableId) => {
        const db = state.srdDb;
        if (!db || !db.ITEM_TABLES || !db.ITEM_TABLE_ROWS) return "";

        const tableDef = db.ITEM_TABLES.find((t: any) => t.TableId === tableId);
        if (!tableDef) return "";

        const rows = db.ITEM_TABLE_ROWS.filter((r: any) => r.TableId === tableId);
        rows.sort((a: any, b: any) => (a.RowOrder || 0) - (b.RowOrder || 0));

        if (rows.length === 0) return "";

        // Determine columns
        const cols: {key: string, label: string}[] = [];
        if (tableDef.Col1Header) cols.push({ key: 'C1', label: tableDef.Col1Header });
        if (tableDef.Col2Header) cols.push({ key: 'C2', label: tableDef.Col2Header });
        if (tableDef.Col3Header) cols.push({ key: 'C3', label: tableDef.Col3Header });
        if (tableDef.Col4Header) cols.push({ key: 'C4', label: tableDef.Col4Header });

        const isRollTable = tableDef.TableType === 'roll_table';

        let html = `<div class="srd-table-container">`;
        if (tableDef.Title) html += `<h5>${tableDef.Title}</h5>`;
        html += `<table><thead><tr>`;

        if (isRollTable) {
            html += `<th style="width:80px">${tableDef.Dice || 'd100'}</th>`;
        }

        cols.forEach(c => html += `<th>${c.label}</th>`);
        html += `</tr></thead><tbody>`;

        rows.forEach((row: any) => {
            html += `<tr>`;
            if (isRollTable) {
                const range = (row.RollMin === row.RollMax) ? row.RollMin : `${row.RollMin}–${row.RollMax}`;
                html += `<td>${range}</td>`;
            }
            cols.forEach(c => {
                html += `<td>${row[c.key] || ''}</td>`;
            });
            html += `</tr>`;
        });

        html += `</tbody></table></div>`;
        return html;
    });
}