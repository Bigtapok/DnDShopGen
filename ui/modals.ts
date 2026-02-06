import { state } from "../state.js";
import { ShopItem } from "../types.js";
import { formatLabel } from "../utils.js";
import { resolveSrdTables } from "./srd.js";
import { formatPriceHtml } from "./results.js";

export function closeModals() {
    const overlay = document.getElementById('overlay');
    const modalOverlay = document.getElementById('modalOverlay');
    if (overlay) overlay.style.display = 'none';
    if (modalOverlay) modalOverlay.style.display = 'none';
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}

// Render the modal content based on the active tab
export function renderModal(item: ShopItem, tab: 'details' | 'internals') {
    const body = document.getElementById('modalBody');
    const content = document.getElementById('modalContent');
    // Support both ID conventions from previous iterations
    const targetEl = body || content;
    
    if (!targetEl) return;

    if (tab === 'internals') {
        targetEl.innerHTML = `<pre class="internal-field">${JSON.stringify(item.internals, null, 2)}</pre>`;
        return;
    }

    // Visibility Checks
    const showPrice = !state.batchVisibility.hidePrice;
    const showDesc = !state.batchVisibility.hideDescription;
    const showName = !state.batchVisibility.hideName;
    const showRarity = !state.batchVisibility.hideRarity;
    // Note: Type/Subtitle is mostly part of description content or header in modal

    // Editable Price HTML
    let priceHtml = "";
    if (showPrice) {
        if (!state.locked) {
            priceHtml = `
            <div style="display:flex; flex-direction:column; margin-bottom: 1rem;">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <input type="number" id="modalPriceInput" value="${item.priceGp}" step="0.01"
                        style="font-size:1.5rem; font-weight:600; width:160px; padding:0.25rem 0.5rem; color:var(--warning); background:var(--bg-input); border:1px solid var(--border); border-radius:6px;"
                        onfocus="this.select()"
                    >
                    <span style="font-size:1.25rem; font-weight:600; color:var(--warning);">gp</span>
                    <button id="btnAuctionToggle" style="margin-left:0.5rem; padding:0.4rem 0.8rem; font-size:0.8rem; cursor:pointer; background:var(--bg-card); border:1px solid var(--border); color:var(--text-main); border-radius:4px;">Auctions</button>
                </div>
                <div id="auctionPanel" class="hidden" style="margin-top:0.5rem; padding:0.75rem; background:rgba(0,0,0,0.2); border:1px solid var(--border); border-radius:6px;">
                    <div style="display:flex; gap:1rem; margin-bottom:0.5rem;">
                        <div style="display:flex; flex-direction:column; gap=2px;">
                            <label style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Difficulty</label>
                            <input type="number" id="aucDC" value="18" style="width:80px; padding:4px; background:var(--bg-input); border:1px solid var(--border); color:var(--text-main); border-radius:4px;">
                        </div>
                        <div style="display:flex; flex-direction:column; gap=2px;">
                            <label style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Percentage Price Change</label>
                            <input type="number" id="aucStep" value="2" style="width:80px; padding:4px; background:var(--bg-input); border:1px solid var(--border); color:var(--text-main); border-radius:4px;">
                        </div>
                    </div>
                    <div style="display:flex; gap:1rem; align-items:flex-end;">
                        <div style="display:flex; flex-direction:column; gap=2px;">
                            <label style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Current Roll</label>
                            <input type="number" id="aucRoll" placeholder="-" style="width:80px; padding:4px; border:1px solid var(--primary); background:var(--bg-input); color:var(--text-main); border-radius:4px;">
                        </div>
                        <div id="aucResult" style="font-size:0.9rem; font-weight:600; color:var(--text-muted); padding-bottom:6px;"></div>
                    </div>
                </div>
            </div>`;
        } else {
            priceHtml = `
            <div class="item-price" style="font-size:1.5rem; margin-bottom: 1rem; color:var(--warning);">
                ${item.priceGp.toLocaleString()} gp 
                <span style="font-size:0.75rem; color:var(--text-muted); font-weight:400; vertical-align:middle; margin-left:0.5rem; border:1px solid var(--border); padding:2px 6px; border-radius:4px;">Locked</span>
            </div>`;
        }
    } else {
        priceHtml = `<div class="item-price" style="font-size:1.5rem; margin-bottom: 1rem; opacity:0.5">Hidden Price</div>`;
    }

    const nameDisplay = showName ? item.name : "Unknown Item";

    const rarityLabel = showRarity ? formatLabel(item.rarity) : "???";
    const rarityClass = showRarity ? `rarity-${item.rarity}` : "";
    const rarityStyle = showRarity ? "" : "background:#444; color:#aaa; border-color:#555;";

    let contentHtml = "";

    if (item.mode === 'generator') {
        const d = item.damage;
        let damageSection = "";
        if (showDesc && d) {
            damageSection = `
            <div class="dmg-breakdown">
                <div class="dmg-row"><span>${d.parts[0].label}</span><span>${d.parts[0].addMin}–${d.parts[0].addMax}</span></div>
                ${d.parts.slice(1).map(p => `
                    <div class="dmg-row ${p.includeInRange ? '' : 'excluded'}">
                        <span>${p.label} (${p.diceNotation})</span>
                        <span>+${p.addMin}${p.addMax > p.addMin ? '–' + p.addMax : ''}</span>
                    </div>
                `).join('')}
                <div class="dmg-total dmg-row"><span>Total Hit Range</span><span>${d.totalMin}–${d.totalMax}</span></div>
            </div>`;
        } else if (showDesc && !d) {
            damageSection = `<div class="dmg-breakdown"><div class="dmg-row" style="justify-content:center; opacity:0.6; font-style:italic">No Damage Stats</div></div>`;
        } else {
            damageSection = `<div class="dmg-breakdown"><div class="dmg-row" style="justify-content:center; opacity:0.6; font-style:italic">Damage Stats Hidden</div></div>`;
        }

        let effectsSection = "";
        if (showDesc) {
            effectsSection = `
            <div class="modal-effects-list">
                ${item.effects?.map(e => `
                    <div class="modal-effect-item" style="margin-top:1rem; padding: 0.5rem; border-left: 2px solid var(--primary); background: rgba(0,0,0,0.05);">
                        <div class="effect-header">
                            <strong>${e.resolvedName}</strong>
                            <span class="badge rarity-${e.MinRarityKey}">${formatLabel(e.MinRarityKey)}</span>
                        </div>
                        <p class="effect-summary" style="font-size:0.9rem; margin-top:0.25rem;">${e.Summary_EN}</p>
                        <p class="effect-rules" style="font-size:0.8rem; margin-top:0.25rem; color:var(--text-muted); font-style:italic;">${e.resolvedRules}</p>
                    </div>
                `).join('')}
            </div>`;
        } else {
            effectsSection = `<div style="text-align:center; padding: 2rem; opacity: 0.5; font-style:italic; border: 1px dashed var(--border); border-radius: 12px; margin-top: 1rem;">Effects & Properties Hidden</div>`;
        }

        contentHtml = `
            ${damageSection}
            ${effectsSection}
        `;
    } else {
        const s = item.srd!;
        const typeLabel = (item.srd?.ItemType || item.srd?.BaseTag || 'Item');
        
        let srdContent = "";
        if (showDesc) {
            
            // Legacy content generation (from original ui.ts, adapted)
            let tagsHtml = '';
            if (item.srdTags && item.srdTags.length > 0) {
                tagsHtml = `<div class="tags-container" style="margin-bottom:1rem;">${item.srdTags.map(t => `<span class="tag-badge" style="display:inline-block; padding:2px 8px; background:rgba(255,255,255,0.1); border-radius:10px; font-size:0.75rem; margin-right:4px;">${t}</span>`).join('')}</div>`;
            }

            srdContent = `
            <div class="modal-body-content">
                ${tagsHtml}
                <div class="dmg-breakdown">
                    <div class="dmg-row"><strong>Base Tag</strong><span>${s.BaseTag}</span></div>
                    <div class="dmg-row"><strong>Attunement</strong><span>${s.RequiresAttunement || 'No'}</span></div>
                    <div class="dmg-row"><strong>Requirement</strong><span>${s.RequiredBaseItem || 'None'}</span></div>
                    ${s.Availability ? `<div class="dmg-row"><strong>Availability</strong><span>${s.Availability}</span></div>` : ''}
                    ${s.Legality ? `<div class="dmg-row"><strong>Legality</strong><span>${s.Legality}</span></div>` : ''}
                </div>
                ${state.settings.debug && item.shopLog && item.shopLog.length > 0 ? `
                <div class="modal-description" style="border: 1px solid var(--primary); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <h4 style="margin: 0 0 0.5rem 0; font-size: 0.8rem; text-transform: uppercase; color: var(--primary);">Shop Notes & Modifiers</h4>
                    <ul style="padding-left: 1.2rem; font-size: 0.9rem;">
                        ${item.shopLog.map(l => `<li>${l}</li>`).join('')}
                    </ul>
                </div>` : ''}
                <div class="modal-description">
                    <h4 style="margin: 1.5rem 0 0.5rem 0; font-size: 0.9rem; text-transform: uppercase; color: var(--text-muted);">Properties</h4>
                    <div style="white-space:pre-wrap; line-height: 1.6;">${resolveSrdTables(s.PropertyDescription)}</div>
                </div>
            </div>`;
        } else {
            srdContent = `<div style="text-align:center; padding: 2rem; opacity: 0.5; font-style:italic; border: 1px dashed var(--border); border-radius: 12px; margin-top: 1rem;">SRD Stats & Properties Hidden</div>`;
        }

        contentHtml = srdContent;
    }
    
    // Header Content helper (if modalHeaderContent exists)
    const headerContent = document.getElementById('modalHeaderContent');
    if (headerContent) {
         // This is mostly for the legacy 'details' tab in some versions, but if the full modalBody is used, we can stick to that.
         // If we are replacing the *entire* modalBody innerHTML, we include the header stuff there.
    }

    targetEl.innerHTML = `
        <div class="modal-header-content" style="margin-bottom:1rem;">
            <div class="badge ${rarityClass}" style="${rarityStyle}">${rarityLabel}</div>
            <h2 style="margin: 0.5rem 0;">${nameDisplay}</h2>
            ${priceHtml}
        </div>
        ${contentHtml}
    `;

    // Attach Change Listener for Price
    if (showPrice && !state.locked) {
        const input = document.getElementById('modalPriceInput');
        if (input) {
            input.addEventListener('input', (e: any) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) {
                    item.priceGp = val;

                    // Mark as modified so Batch Code can save it
                    if (!item.internals) item.internals = {};
                    item.internals.modifiedPrice = true;

                    // Live update card in background
                    const card = document.querySelector(`.item-card[data-id="${item.id}"]`);
                    if (card) {
                        const priceEl = card.querySelector('.item-price');
                        if (priceEl) {
                             // Use standard format logic instead of just toLocaleString to keep silver/copper styling
                             priceEl.innerHTML = formatPriceHtml(val);
                        }
                    }
                }
            });
        }

        // Auction Logic
        const btnAuction = document.getElementById('btnAuctionToggle');
        const auctionPanel = document.getElementById('auctionPanel');
        const aucDC = document.getElementById('aucDC') as HTMLInputElement;
        const aucStep = document.getElementById('aucStep') as HTMLInputElement;
        const aucRoll = document.getElementById('aucRoll') as HTMLInputElement;
        const aucResult = document.getElementById('aucResult');

        let auctionBasePrice = item.priceGp;

        if (btnAuction && auctionPanel && input) {
            btnAuction.addEventListener('click', () => {
                auctionPanel.classList.toggle('hidden');
                // Capture base price when opening to allow reset
                if (!auctionPanel.classList.contains('hidden')) {
                    auctionBasePrice = parseFloat((input as HTMLInputElement).value) || 0;
                    if (aucRoll) {
                        aucRoll.value = "";
                        aucRoll.focus();
                    }
                    if (aucResult) aucResult.textContent = "";
                }
            });

            const updateAuction = () => {
                const dc = parseFloat(aucDC.value) || 0;
                const step = parseFloat(aucStep.value) || 0;
                const rollVal = aucRoll.value;

                if (rollVal === "") {
                    // Restore base if roll cleared? Or just do nothing?
                    // Let's do nothing to avoid jumping, user can manually fix or re-roll
                    return;
                }
                const roll = parseFloat(rollVal);

                // Logic: (Difficulty - Roll) * Percentage
                // e.g. DC 18, Roll 16 => 2 * 2% = 4% (Increase)
                const diff = dc - roll;
                const pctChange = diff * step;
                
                const factor = 1 + (pctChange / 100);
                const newPrice = Math.round(auctionBasePrice * factor * 100) / 100; // Keep decimals for auction too

                // Update Input
                (input as HTMLInputElement).value = String(newPrice);
                
                // Trigger state update
                input.dispatchEvent(new Event('input'));

                // Feedback
                if (aucResult) {
                    const sign = pctChange > 0 ? "+" : "";
                    const color = pctChange > 0 ? "var(--danger)" : "var(--success)";
                    const label = pctChange > 0 ? "Markup" : "Discount";
                    aucResult.innerHTML = `<span style="color:${color}">${sign}${pctChange.toFixed(1)}% ${label}</span>`;
                }
            };

            if (aucDC) aucDC.addEventListener('input', updateAuction);
            if (aucStep) aucStep.addEventListener('input', updateAuction);
            if (aucRoll) aucRoll.addEventListener('input', updateAuction);
        }
    }
}

export function updateModalInternalsVisibility() {
    const tab = document.getElementById('tabInternals');
    if (tab) {
         if (state.settings.internals) tab.classList.remove('hidden');
         else tab.classList.add('hidden');
    }
}