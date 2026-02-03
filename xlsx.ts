
import { state } from "./state.js";
import { log } from "./ui.js";
import { parseNum, formatLabel } from "./utils.js";

export function setDb(data: Record<string, any[]>) {
    state.db = data;
}

function processTagsIndex() {
    // Config tags usually live in the main DB (Table.json)
    const configDb = state.db;
    // Items live in SRD DB (SRDTable.json)
    const itemDb = state.srdDb;

    if (configDb.TAGS_FOR_SRD && configDb.TAGS_FOR_SRD.length > 0) {
        state.srdTagsIndex = configDb.TAGS_FOR_SRD
            .map((row: any) => ({
                tag: String(row.ListTags || ""),
                count: parseNum(row.Count, 0)
            }))
            .filter(t => t.tag)
            .sort((a, b) => a.tag.localeCompare(b.tag));
    } else {
        const allTags = new Map<string, number>();
        const srdItems = itemDb.SRD_ITEMS || [];
        srdItems.forEach((item: any) => {
            const tags = String(item.Tags || "").split(/[,;]/).map(t => t.trim()).filter(t => t);
            tags.forEach(t => {
                allTags.set(t, (allTags.get(t) || 0) + 1);
            });
        });
        state.srdTagsIndex = Array.from(allTags.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => a.tag.localeCompare(b.tag));
    }
}

export async function processXLSX(file: File) {
    return new Promise<void>((resolve, reject) => {
        const isJson = file.name.toLowerCase().endsWith('.json');
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                let data: Record<string, any[]> = {};
                if (isJson) {
                    const text = e.target?.result as string;
                    data = JSON.parse(text);
                } else {
                    const workbook = (window as any).XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'array' });
                    workbook.SheetNames.forEach((n: string) => {
                        data[n] = (window as any).XLSX.utils.sheet_to_json(workbook.Sheets[n]);
                    });
                }
                
                // If the user uploads a file, we treat it as the primary DB.
                // If it contains SRD items, we also update the SRD DB to allow the upload to override it.
                setDb(data);
                if (data.SRD_ITEMS && data.SRD_ITEMS.length > 0) {
                    state.srdDb = data;
                }

                state.lastFilename = file.name;
                processTagsIndex();
                
                const status = document.getElementById('fileStatus');
                if (status) {
                    status.textContent = `Loaded: ${file.name}`;
                    status.className = "status-badge status-loaded";
                }
                const genBtn = document.getElementById('generateBtn') as HTMLButtonElement;
                if (genBtn) genBtn.disabled = false;

                log(`Data Loaded: ${file.name}`, 'info');
                resolve();
            } catch (err) {
                log(`Failed to load data: ${err}`, 'error');
                reject(err);
            }
        };

        if (isJson) {
            reader.readAsText(file);
        } else {
            reader.readAsArrayBuffer(file);
        }
    });
}

export async function loadDefaultData() {
    try {
        const p1 = fetch('./HBgen/Table.Json').then(r => r.json());
        const p2 = fetch('./SRD/SRDTable.Json').then(r => r.json());

        const [tableData, srdData] = await Promise.all([p1, p2]);

        if (!tableData || !srdData) throw new Error("Missing default data files");

        // Table.json -> Procedural Generator & Rules
        setDb(tableData);
        // SRDTable.json -> SRD Items
        state.srdDb = srdData;

        state.lastFilename = 'Table.Json + SRD';
        processTagsIndex();
        
        const status = document.getElementById('fileStatus');
        if (status) {
            status.textContent = "Loaded: Defaults";
            status.className = "status-badge status-loaded";
        }
        const genBtn = document.getElementById('generateBtn') as HTMLButtonElement;
        if (genBtn) genBtn.disabled = false;
        
        log("Default data loaded (Table.Json & SRDTable.Json).", 'info');
        return true;
    } catch (err) {
        console.warn("Could not load default data:", err);
        log("Failed to load default data files.", 'error');
        return false;
    }
}

export function downloadJson(items: any[], version: string, full: boolean) {
    if (items.length === 0) return;
    const data = full ? items : items.map(i => ({
        name: i.name,
        rarity: i.rarity,
        price: i.priceGp
    }));
    const payload = {
        app: "ShopGen",
        version: version,
        exportDate: new Date().toISOString(),
        items: data
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shop_export_${full ? 'full_' : ''}${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    log(`JSON Exported (${full ? 'Full' : 'Summary'}).`);
}

export async function copyMarkdown(items: any[], version: string) {
    if (items.length === 0) return;
    let md = `# Shop Inventory - ${new Date().toLocaleDateString()}\n`;
    md += `*Generated by ShopGen v${version}*\n\n`;
    
    items.forEach(i => {
        md += `## ${i.name} (${formatLabel(i.rarity)})\n`;
        md += `- **Price:** ${i.priceGp.toLocaleString()} gp\n`;
        if (i.mode === 'generator' && i.damage) {
            md += `- **Damage:** ${i.damage.totalMin}–${i.damage.totalMax} hit\n`;
        } else if (i.mode === 'srd') {
            md += `- **Base Tag:** ${i.srd?.BaseTag}\n`;
            md += `- **Properties:** ${i.srd?.PropertyDescription}\n`;
        }
        md += `\n`;
    });

    try {
        await navigator.clipboard.writeText(md);
        log("Inventory copied to clipboard as Markdown.", 'info');
        alert("Markdown inventory copied to clipboard!");
    } catch (err) {
        log("Failed to copy Markdown: " + err, 'error');
    }
}

export function downloadLogs(version: string, filename: string) {
    const el = document.getElementById('logContent');
    if (!el) return;
    const logs = el.innerText;
    const header = `SHOPGEN PIPELINE LOGS\nVersion: ${version}\nSource: ${filename}\nTimestamp: ${new Date().toLocaleString()}\n${'='.repeat(30)}\n\n`;
    const blob = new Blob([header + logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shopgen_logs_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    log("Logs downloaded.");
}
