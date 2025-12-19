/* === OT SPELL MAKER AI - SMART CORE === */

// Global State
let currentGridSize = 11;
let currentZoom = 100;

// Multi-Combat State
let combatAreas = [
    { id: 11, type: 'magic', grid: {} } // Combat 1 (default)
];
let currentCombatIndex = 0;

let isSprLoaded = false;
let isDatLoaded = false;
let currentCodeType = 'revscript'; // revscript, common, xml

// Animation State
let animationInterval = null;
let previewAnimationInterval = null;

// Constants
const MAX_MANA = 10000;
const MAX_LEVEL = 2000;
const PRESET_COMBOS = {
    'COMBAT_ENERGYDAMAGE': { effect: 11, name: 'Energy' }, // CONST_ME_ENERGYAREA
    'COMBAT_FIREDAMAGE': { effect: 6, name: 'Fire' },      // CONST_ME_FIREAREA
    'COMBAT_ICEDAMAGE': { effect: 42, name: 'Ice' },       // CONST_ME_ICEAREA
    'COMBAT_EARTHDAMAGE': { effect: 46, name: 'Earth' },   // CONST_ME_POISONAREA
    'COMBAT_DEATHDAMAGE': { effect: 18, name: 'Death' },   // CONST_ME_MORTAREA
    'COMBAT_HOLYDAMAGE': { effect: 49, name: 'Holy' },     // CONST_ME_HOLYAREA
    'COMBAT_PHYSICALDAMAGE': { effect: 1, name: 'Blood' },  // CONST_ME_DRAWBLOOD
    'COMBAT_HEALING': { effect: 12, name: 'Healing' },      // CONST_ME_MAGIC_BLUE
};

// Initialize
function init() {
    setGridSize(11); // Initial set
    loadAssets('magic');
    updateCombatTabs();
    fitToScreen();

    // Smart Defaults
    document.getElementById('spellType').addEventListener('change', updateSmartDefaults);
}

// On Load
window.addEventListener('DOMContentLoaded', init);


/* --- GRID & EDITOR LOGIC --- */
function setGridSize(size) {
    currentGridSize = size;
    // We don't clear grid here on resize anymore, we keep data but might clip.
    // Ideally we should warn or remap. For this MVP we just re-render.

    // Update active toolbar btns
    document.querySelectorAll('.tool-btn').forEach(btn => {
        if (btn.innerText == size) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    renderGrid();
    fitToScreen();
}

function renderGrid() {
    const gridEl = document.getElementById('spell-grid');
    gridEl.innerHTML = '';

    // Set CSS grid sizing
    gridEl.style.gridTemplateColumns = `repeat(${currentGridSize}, var(--grid-cell-size, 32px))`;
    gridEl.style.gridTemplateRows = `repeat(${currentGridSize}, var(--grid-cell-size, 32px))`;

    const center = Math.floor(currentGridSize / 2);

    for (let y = 0; y < currentGridSize; y++) {
        for (let x = 0; x < currentGridSize; x++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            const key = `${x},${y}`;
            const isCenter = (x === center && y === center);

            if (isCenter) {
                cell.classList.add('center-cell');
                const pImg = document.createElement('img');
                pImg.src = 'src/resc/player.gif';
                pImg.className = 'center-player-img';
                cell.appendChild(pImg);
            }

            // Click Handlers
            cell.onmousedown = (e) => {
                e.preventDefault();
                if (e.buttons === 1) toggleCell(x, y, cell);
            };
            cell.onmouseenter = (e) => {
                if (e.buttons === 1) paintCell(x, y, cell);
            };
            cell.oncontextmenu = (e) => {
                e.preventDefault();
                eraseCell(x, y, cell);
            };

            // Render Content from ALL combats
            // We iterate all combats. Current combat shown normally. Others semi-transparent.
            combatAreas.forEach((combat, idx) => {
                if (combat.grid[key]) {
                    const img = document.createElement('img');
                    img.src = combat.grid[key].url;

                    if (idx !== currentCombatIndex) {
                        img.style.opacity = '0.3'; // Ghost other combats
                        img.style.filter = 'grayscale(100%)';
                        img.style.zIndex = '0';
                    } else {
                        img.style.zIndex = '1';
                    }
                    cell.appendChild(img);
                }
            });

            gridEl.appendChild(cell);
        }
    }
}

function toggleCell(x, y, cell) {
    const key = `${x},${y}`;
    const currentGrid = combatAreas[currentCombatIndex].grid;

    if (currentGrid[key]) {
        delete currentGrid[key];
    } else {
        paintCell(x, y, cell);
    }
    renderGrid(); // Full re-render needed to manage layers
}

function paintCell(x, y, cell) {
    const key = `${x},${y}`;
    const currentCombat = combatAreas[currentCombatIndex];

    // Use the combat's selected effect or global selection
    // Ideally each combat has its own "selected tool". 
    // For now, we use the global selection and apply it to the current combat.

    let url = currentAssetImageUrl || `src/images/effects/effect_${currentCombat.id}_.png`;

    currentCombat.grid[key] = {
        id: selectedEffectId, // From global selection
        type: selectedEffectType,
        url: url
    };
    renderGrid();
}

function eraseCell(x, y, cell) {
    const key = `${x},${y}`;
    const currentGrid = combatAreas[currentCombatIndex].grid;
    if (currentGrid[key]) {
        delete currentGrid[key];
        renderGrid();
    }
}

function clearGrid() {
    combatAreas[currentCombatIndex].grid = {};
    renderGrid();
    showToast(`Combat ${currentCombatIndex + 1} cleared`, 'info');
}


/* --- MULTI-COMBAT TABS --- */
function updateCombatTabs() {
    const container = document.getElementById('combatTabs');
    if (!container) return; // Guard if HTML not updated yet

    container.innerHTML = '';

    combatAreas.forEach((_, idx) => {
        const btn = document.createElement('button');
        btn.className = `c-tab ${idx === currentCombatIndex ? 'active' : ''}`;
        btn.innerText = `Combat ${idx + 1}`;
        btn.onclick = () => switchCombat(idx);
        container.appendChild(btn);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'c-tab-add';
    addBtn.innerText = '+';
    addBtn.onclick = addCombat;
    container.appendChild(addBtn);
}

function switchCombat(index) {
    currentCombatIndex = index;
    updateCombatTabs();
    // Refresh properties UI if we were tracking per-combat properties (e.g. damage)
    // For now assuming global properties shared.

    // Load saved delay for this combat
    const delay = combatAreas[index].delay || 0;
    document.getElementById('combatDelayInput').value = delay;

    renderGrid();
}

function updateCombatDelay(val) {
    // Ensure the current combat area exists and has a delay property
    if (!combatAreas[currentCombatIndex]) {
        combatAreas[currentCombatIndex] = { id: 11, type: 'magic', grid: {}, delay: 0 };
    }
    combatAreas[currentCombatIndex].delay = parseInt(val) || 0;
}

function addCombat() {
    combatAreas.push({ id: 11, type: 'magic', grid: {} });
    switchCombat(combatAreas.length - 1);
    showToast(`Added Combat ${combatAreas.length}`, 'success');
}


/* --- ZOOM & VIEW --- */
function zoomGrid(dir) {
    const root = document.documentElement;
    currentZoom += (dir * 10);
    if (currentZoom < 20) currentZoom = 20;
    if (currentZoom > 300) currentZoom = 300;
    document.getElementById('zoomLevel').innerText = currentZoom + '%';
    const newSize = 32 * (currentZoom / 100);
    root.style.setProperty('--grid-cell-size', `${newSize}px`);
}

function fitToScreen() {
    const container = document.querySelector('.canvas-scroll-area');
    if (!container) return;
    const w = container.clientWidth - 40;
    const h = container.clientHeight - 40;
    const sizeX = w / currentGridSize;
    const sizeY = h / currentGridSize;
    let optimalPx = Math.min(sizeX, sizeY);
    if (optimalPx > 128) optimalPx = 128;
    currentZoom = Math.floor((optimalPx / 32) * 100);
    zoomGrid(0);
}


/* --- ASSET BROWSER & ANIMATION --- */
let currentAssetImageUrl = '';
let selectedEffectId = 11;
let selectedEffectType = 'magic';

function switchTab(type) {
    document.querySelectorAll('.b-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    loadAssets(type);
}

async function loadAssets(type) {
    const container = document.getElementById('assetsGrid');
    container.innerHTML = '';

    if (!isSprLoaded && !isDatLoaded) { // Only show empty if NONE loaded
        if (window.location.protocol !== 'file:') { // Allow demo mode in non-local
            // Demo mode continue
        } else {
            container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>Files not loaded (Demo fallback).</p></div>`;
        }
    }

    selectedEffectType = type;
    let count = 50;
    if (window.datLoader) {
        if (type === 'magic') count = window.datLoader.effectsCount;
        else if (type === 'distance') count = window.datLoader.missilesCount;
    }

    // Creating Items

    let limit = 70; // Default for projectiles
    if (type === 'magic') limit = 200; // Default for effects

    // Try to get dynamic limit from Data Loader
    if (window.datLoader && window.datLoader.subTypeCounts) {
        if (type === 'magic' && window.datLoader.subTypeCounts.effect) {
            limit = window.datLoader.subTypeCounts.effect;
        } else if (type === 'distance' && window.datLoader.subTypeCounts.missile) {
            limit = window.datLoader.subTypeCounts.missile;
        }
    }

    for (let i = 1; i <= limit; i++) {
        const item = document.createElement('div');
        item.className = 'asset-item';
        // Show ID on hover
        item.title = `ID: ${i}`;

        const img = document.createElement('img');

        if (window.sprLoader && isSprLoaded) {
            // Async loading
            let thingData = null;
            try {
                thingData = await window.datLoader.getThing(type, i);
            } catch (e) { console.error(e); }

            if (!thingData) {
                // If invalid, maybe skip or show error
                // prevent clutter
            } else {
                if (thingData.sprites && thingData.sprites.length > 0) {
                    try {
                        const url = await window.sprLoader.getSpriteImage(thingData.sprites[0]);
                        if (url) img.src = url;
                        else img.src = 'src/images/unknown.png';
                    } catch (e) { img.src = 'src/images/unknown.png'; }
                }
            }
        } else {
            // Fallback (Offline Mode)
            // We only have limited local images, so maybe cap the loop?
            if (i > 69) {
                // If strictly offline, we don't have 200 images. 
                // But let's keep logic simple.
            }
            if (type === 'magic') img.src = `src/images/effects/effect_${i}_.png`;
            else img.src = `src/images/missiles/missile_${i}_.png`;
        }

        // Error fallback
        img.onerror = function () { this.style.display = 'none'; };

        item.appendChild(img);

        // Add ID label overlay for clarity
        const idLabel = document.createElement('span');
        idLabel.style.position = 'absolute';
        idLabel.style.bottom = '0';
        idLabel.style.right = '0';
        idLabel.style.fontSize = '10px';
        idLabel.style.color = '#fff';
        idLabel.style.background = 'rgba(0,0,0,0.7)';
        idLabel.style.padding = '1px 3px';
        idLabel.innerText = i;
        item.appendChild(idLabel);

        item.onclick = function () {
            // Select logic
            document.querySelectorAll('.asset-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            selectAsset(i, type, img.src, item);
            showToast(`Selected ${type}: ${i}`, 'info');
        };

        container.appendChild(item);
    }
}

function selectAsset(id, type, url, el) {
    selectedEffectId = id;
    selectedEffectType = type;
    currentAssetImageUrl = url;

    // UI Updates
    document.getElementById('effectPreviewImg').src = url;
    document.getElementById('effectPreviewName').innerText = `ID: ${id} (${type})`;
    document.querySelectorAll('.asset-item').forEach(i => i.classList.remove('selected'));
    if (el) el.classList.add('selected');

    // Start Animation Preview
    if (el && el.dataset.frames) {
        startPreviewAnimation(JSON.parse(el.dataset.frames));
    }
}

function startPreviewAnimation(sprites) {
    if (previewAnimationInterval) clearInterval(previewAnimationInterval);
    if (!sprites || sprites.length <= 1) return;

    let idx = 0;
    const img = document.getElementById('effectPreviewImg');

    previewAnimationInterval = setInterval(async () => {
        idx = (idx + 1) % sprites.length;
        if (window.sprLoader) {
            const url = await window.sprLoader.getSpriteImage(sprites[idx]);
            img.src = url;
        }
    }, 150); // ~6.6fps
}

/* --- CANVAS ANIMATION --- */
function playAnimation() {
    if (animationInterval) clearInterval(animationInterval);

    showToast("Playing animation...", "info");
    let step = 0;
    const maxSteps = combatAreas.length;

    // Hide all layers first? No, we want to flash them.
    // Logic: Show Combat 1 -> delay -> Show Combat 2 -> ...

    // This requires renderGrid to support a "visibleCombatIndex" override
    // For MVP, we'll just toggle the DOM elements opacity manually or use a specific class

    animationInterval = setInterval(() => {
        currentCombatIndex = step;
        updateCombatTabs(); // visually sync tab
        renderGrid(); // This makes the current combat standard and others ghosted

        step++;
        if (step >= maxSteps) step = 0;
    }, 500); // 500ms delay between combats
}

function stopAnimation() {
    if (animationInterval) clearInterval(animationInterval);
    showToast("Stopped.", "info");
    currentCombatIndex = 0;
    updateCombatTabs();
    renderGrid();
}


/* --- SMART LOGIC & VALIDATION --- */

function smartSuggestEffect(combatType) {
    const preset = PRESET_COMBOS[combatType];
    if (preset) {
        showToast(`Smart Suggestion: Switched effect to ${preset.name}`, 'success');
        selectedEffectId = preset.effect;
        // Ideally trigger a reload of asset selection
    }
}

function updateFormulaInputs() {
    const type = document.getElementById('formulaType').value;
    const minInput = document.getElementById('minDamage');
    const maxInput = document.getElementById('maxDamage');

    if (type === 'fixed') {
        minInput.placeholder = "Fixed Min";
        maxInput.placeholder = "Fixed Max";
    } else {
        minInput.placeholder = "Base / Factor";
        maxInput.placeholder = "Base / Factor";
    }
}

function validateSpell() {
    const name = document.getElementById('spellName').value;
    const words = document.getElementById('spellWords').value;
    const mana = parseInt(document.getElementById('manaCost').value);

    if (!name || name.length < 3) return { valid: false, err: "Spell name is too short." };
    if (!words) return { valid: false, err: "Words (incantation) are required." };

    // Check if ANY combat has grid data
    const hasData = combatAreas.some(c => Object.keys(c.grid).length > 0);
    if (!hasData) {
        return { valid: false, err: "The spell areas are empty! Draw something." };
    }

    return { valid: true };
}


/* --- CODE GENERATION ENGINE --- */

/* --- DATA STRUCTURES --- */
class SpellData {
    constructor() {
        this.name = "";
        this.words = "";
        this.group = "attack";
        this.level = 0;
        this.mana = 0;
        this.soul = 0;
        this.premium = false;
        this.selftarget = false;
        this.cooldown = 0;
        this.groupcooldown = 0;
        this.needlearn = false;
        this.aggressive = true;
        this.blockwalls = true;
        this.range = 0;
        this.vocations = [];
        this.scriptPath = "";
        this.id = 0;
        this.isRune = false;
        this.isConjuringSpell = false;
        this.runeItemId = 0;
        this.needWeapon = false;
        this.needCasterTargetOrDirection = false;
        this.castSound = "";
        this.impactSound = "";
        this.allowfaruse = false;
        this.direction = false;
        this.playernameparam = false;
        this.params = false;
        this.magiclevel = 0;
        this.charges = 0;
        this.blocktype = "solid";
        this.secondarygroup = "";
        this.secondaryneedlearn = false;
        this.showInDescription = true;

        // Custom Generator Props
        this.combatType = "";
        this.targetType = "";
        this.formulaType = "";
        this.min = 0;
        this.max = 0;
    }
}

/* --- CODE GENERATION ENGINE --- */

function generateAndNotify() {
    const check = validateSpell();
    if (!check.valid) {
        showToast(check.err, 'error');
        return;
    }
    openCodeModal();
}

function generateCode(format) {
    // Instantiate SpellData
    const d = new SpellData();

    // Populate from UI
    d.name = document.getElementById('spellName').value;
    d.words = document.getElementById('spellWords').value;
    d.type = document.getElementById('spellType').value;

    // Numeric
    d.mana = parseInt(document.getElementById('manaCost').value) || 0;
    d.soul = parseInt(document.getElementById('soulCost').value) || 0;
    d.level = parseInt(document.getElementById('levelReq').value) || 0;
    d.magiclevel = parseInt(document.getElementById('magLevelReq').value) || 0;
    d.cooldown = parseInt(document.getElementById('cooldown').value) || 0;
    d.groupcooldown = parseInt(document.getElementById('groupCooldown').value) || 0;
    d.range = parseInt(document.getElementById('spellRange').value) || 0;

    // Booleans
    d.aggressive = document.getElementById('optAggressive').checked;
    d.premium = document.getElementById('optPremium').checked;
    d.blockwalls = document.getElementById('optBlockWalls').checked;
    d.needlearn = document.getElementById('optNeedLearn').checked;
    d.needWeapon = document.getElementById('optNeedWeapon').checked;
    d.allowfaruse = document.getElementById('optAllowFarUse').checked;
    d.playernameparam = document.getElementById('optPlayerNameParam').checked;
    d.showInDescription = document.getElementById('optShowInDesc').checked;
    d.secondaryneedlearn = document.getElementById('optSecNeedLearn').checked;

    // Selects / Strings
    d.group = document.getElementById('spellGroup') ? document.getElementById('spellGroup').value : 'attack';
    d.secondarygroup = document.getElementById('spellSecGroup').value;
    d.castSound = document.getElementById('castSound').value;
    d.impactSound = document.getElementById('impactSound').value;

    // Core Logic
    d.combatType = document.getElementById('combatType').value;
    d.targetType = document.querySelector('input[name="targetType"]:checked').value;
    d.formulaType = document.getElementById('formulaType').value;
    d.min = document.getElementById('minDamage').value;
    d.max = document.getElementById('maxDamage').value;
    d.vocations = Array.from(document.querySelectorAll('.voc-check:checked')).map(cb => cb.value);

    // Derived
    if (d.targetType === 'self') d.selftarget = true;
    if (d.targetType === 'direction') d.direction = true;
    if (document.getElementById('optNeedTarget').checked) d.needCasterTargetOrDirection = true;

    // Generate Areas for ALL COMBATS
    const activeCombats = combatAreas.filter(c => Object.keys(c.grid).length > 0);

    if (format === 'revscript') return generateRevScript(d, activeCombats);
    if (format === 'common') return generateCommonScript(d, activeCombats);
    if (format === 'xml') return generateXML(d);

    return "-- Error: Unknown format";
}

function generateAreaMatrix(grid) {
    // Generate simple {1, 0, 1} matrix for a single grid
    let minX = currentGridSize, maxX = 0, minY = currentGridSize, maxY = 0;
    const keys = Object.keys(grid);
    if (keys.length === 0) return "{}";

    keys.forEach(k => {
        const [x, y] = k.split(',').map(Number);
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
    });

    const center = Math.floor(currentGridSize / 2);
    // Expand to include center
    minX = Math.min(minX, center); maxX = Math.max(maxX, center);
    minY = Math.min(minY, center); maxY = Math.max(maxY, center);

    let lua = "{\n";
    for (let y = minY; y <= maxY; y++) {
        let row = "    {";
        for (let x = minX; x <= maxX; x++) {
            const key = `${x},${y}`;
            const isCenter = (x === center && y === center);
            const hasEffect = grid[key] !== undefined;
            let proto = 0;
            if (isCenter) proto = 3; // Center always 3 locally
            else if (hasEffect) proto = 1;
            row += proto + (x === maxX ? "" : ", ");
        }
        row += "}" + (y === maxY ? "" : ",\n");
        lua += row;
    }
    lua += "\n}";
    return lua;
}

function generateRevScript(d, combats) {
    let s = `-- Spell: ${d.name}\n-- Generated by OT Spell Maker AI\n\n`;
    s += `local spell = Spell("${d.type}")\n\n`;

    // 1. Define Combats
    combats.forEach((c, i) => {
        const idx = i + 1;
        s += `local combat${idx} = Combat()\n`;
        s += `combat${idx}:setParameter(COMBAT_PARAM_TYPE, ${d.combatType})\n`;

        // Dynamic Effect Logic
        // Find the first cell that has an effect to decide the combat effect
        let effectId = 'CONST_ME_ENERGYAREA'; // Fallback
        const gridKeys = Object.keys(c.grid);
        if (gridKeys.length > 0) {
            const firstCell = c.grid[gridKeys[0]];
            // If the cell has an ID, use it. Try to map to CONST if possible, else use raw ID.
            if (firstCell && firstCell.id !== undefined) {
                effectId = firstCell.id;
                // If you have a stored constant name, use it. Otherwise, valid number is fine.
            }
        }
        s += `combat${idx}:setParameter(COMBAT_PARAM_EFFECT, ${effectId})\n`;

        const areaTable = generateAreaMatrix(c.grid);
        s += `combat${idx}:setArea(createCombatArea(${areaTable}))\n\n`;

        s += `function onGetFormulaValues(player, level, magicLevel)\n`;
        if (d.formulaType === 'fixed') {
            s += `    local min = ${d.min}\n    local max = ${d.max}\n`;
        } else {
            s += `    local min = (level / 5) + (magicLevel * ${d.min / 100}) + 10\n`;
            s += `    local max = (level / 5) + (magicLevel * ${d.max / 100}) + 20\n`;
        }
        s += `    return -min, -max\nend\n`;
        s += `combat${idx}:setCallback(CALLBACK_PARAM_LEVELMAGICVALUE, "onGetFormulaValues")\n\n`;
    });

    // 2. Helper for Delayed Execution (if needed)
    const hasDelays = combats.some(c => (c.delay || 0) > 0);
    if (hasDelays) {
        s += `local function executeCombatDelayed(combat, creatureId, variant)\n`;
        s += `    local creature = Creature(creatureId)\n`;
        s += `    if creature then combat:execute(creature, variant) end\n`;
        s += `end\n\n`;
    }

    // 3. onCastSpell (Single Definition)
    s += `function spell.onCastSpell(creature, variant)\n`;
    combats.forEach((c, i) => {
        const idx = i + 1;
        const delay = c.delay || 0;
        if (delay > 0) {
            // Safe execution via helper
            s += `    addEvent(executeCombatDelayed, ${delay}, combat${idx}, creature:getId(), variant)\n`;
        } else {
            s += `    combat${idx}:execute(creature, variant)\n`;
        }
    });
    s += `    return true\n`;
    s += `end\n\n`;

    // 4. Registration
    s += `spell:name("${d.name}")\n`;
    s += `spell:words("${d.words}")\n`;
    s += `spell:group("${d.group}")\n`;
    if (d.secondarygroup) s += `spell:secondaryGroup("${d.secondarygroup}")\n`;
    if (d.vocations.length > 0) s += `spell:vocation("${d.vocations.join(';true", "')};true")\n`;
    s += `spell:id(${d.id || 100})\n`;
    s += `spell:cooldown(${d.cooldown})\n`;
    s += `spell:groupCooldown(${d.groupcooldown})\n`;
    s += `spell:level(${d.level})\n`;
    s += `spell:magicLevel(${d.magiclevel})\n`;
    s += `spell:mana(${d.mana})\n`;
    s += `spell:soul(${d.soul})\n`;
    s += `spell:range(${d.range})\n`;

    // Boolean properties - Only generate if true (or checked) to reduce clutter & follow user request
    if (d.aggressive) s += `spell:isAggressive(true)\n`;
    if (d.premium) s += `spell:isPremium(true)\n`;
    if (d.blockwalls) s += `spell:blockWalls(true)\n`;
    if (d.needlearn) s += `spell:needLearn(true)\n`;
    if (d.needWeapon) s += `spell:needWeapon(true)\n`;
    if (d.allowfaruse) s += `spell:allowFarUse(true)\n`;

    // Target Type Logic
    // If self target is explicitly checked/true
    if (d.selftarget) s += `spell:isSelfTarget(true)\n`;

    // Direction logic
    if (d.direction) s += `spell:needDirection(true)\n`;

    if (d.needCasterTargetOrDirection) s += `spell:needCasterTargetOrDirection(true)\n`;

    if (d.castSound) s += `spell:castSound("${d.castSound}")\n`;
    if (d.impactSound) s += `spell:impactSound("${d.impactSound}")\n`;

    s += `spell:register()\n`;

    return s;
}

function generateCommonScript(d, combats) {
    let s = `-- Spell: ${d.name}\n-- Generated by OT Spell Maker AI\n-- Modernized for TFS 1.5+\n\n`;

    // 1. Combat Configuration Table
    s += `local combatConfig = {\n`;
    combats.forEach((c, i) => {
        const areaTable = generateAreaMatrix(c.grid);
        const delay = c.delay || 0;

        // Find effect for this layer
        let effectId = 'CONST_ME_ENERGYAREA';
        const gridKeys = Object.keys(c.grid);
        if (gridKeys.length > 0) {
            const firstCell = c.grid[gridKeys[0]];
            if (firstCell && firstCell.id !== undefined) {
                effectId = firstCell.id;
            }
        }

        s += `    -- Combat ${i + 1} (Delay: ${delay}ms)\n`;
        s += `    {\n`;
        s += `        delay = ${delay},\n`;
        s += `        effect = ${effectId},\n`;
        s += `        type = ${d.combatType},\n`;
        s += `        area = ${areaTable}\n`;
        s += `    }${i < combats.length - 1 ? ',' : ''}\n`;
    });
    s += `}\n\n`;

    // 2. Create Combat Objects
    s += `local combats = {}\n\n`;
    s += `for i, config in ipairs(combatConfig) do\n`;
    s += `    combats[i] = Combat()\n`;
    s += `    combats[i]:setParameter(COMBAT_PARAM_TYPE, config.type)\n`;
    s += `    combats[i]:setParameter(COMBAT_PARAM_EFFECT, config.effect)\n`;
    s += `    combats[i]:setArea(createCombatArea(config.area))\n\n`;

    // Formula Callback (Inline)
    s += `    combats[i]:setCallback(CALLBACK_PARAM_LEVELMAGICVALUE, function(player, level, magicLevel)\n`;
    if (d.formulaType === 'fixed') {
        s += `        local min = ${d.min}\n        local max = ${d.max}\n`;
    } else {
        // Simple scaling example
        s += `        local min = (level / 5) + (magicLevel * ${d.min / 100}) + 10\n`;
        s += `        local max = (level / 5) + (magicLevel * ${d.max / 100}) + 20\n`;
    }
    s += `        return -min, -max\n`;
    s += `    end)\n`;
    s += `end\n\n`;

    // 3. Helper for Delayed Execution
    s += `local function executeCombatDelayed(combatId, creatureId, variant)\n`;
    s += `    local creature = Creature(creatureId)\n`;
    s += `    if not creature then return end\n`;
    s += `    combats[combatId]:execute(creature, variant)\n`;
    s += `end\n\n`;

    // 4. Main onCastSpell
    s += `function onCastSpell(creature, variant)\n`;
    s += `    -- Group combats by delay for optimization\n`;
    s += `    local delayGroups = {}\n\n`;

    s += `    for i, config in ipairs(combatConfig) do\n`;
    s += `        local delay = config.delay\n`;
    s += `        if not delayGroups[delay] then delayGroups[delay] = {} end\n`;
    s += `        table.insert(delayGroups[delay], i)\n`;
    s += `    end\n\n`;

    s += `    -- Execute combats\n`;
    s += `    for delay, combatIds in pairs(delayGroups) do\n`;
    s += `        if delay == 0 then\n`;
    s += `            for _, combatId in ipairs(combatIds) do\n`;
    s += `                combats[combatId]:execute(creature, variant)\n`;
    s += `            end\n`;
    s += `        else\n`;
    s += `            for _, combatId in ipairs(combatIds) do\n`;
    s += `                addEvent(executeCombatDelayed, delay, combatId, creature:getId(), variant)\n`;
    s += `            end\n`;
    s += `        end\n`;
    s += `    end\n\n`;
    s += `    return true\n`;
    s += `end\n`;
    return s;
}

function generateXML(d) {
    let v = d.vocations.map(voc => `    <vocation name="${voc}"/>`).join("\n");
    return `<instant group="attack" name="${d.name}" words="${d.words}" level="${d.level}" mana="${d.mana}" premium="${d.premium ? 1 : 0}" aggressive="${d.aggressive ? 1 : 0}" cooldown="${d.cooldown}" groupcooldown="${d.groupCd}" needlearn="${d.needLearn ? 1 : 0}" script="attack/${d.name.toLowerCase().replace(/ /g, '_')}.lua">\n${v}\n</instant>`;
}

function getEffectName(id) {
    return "MAGIC_EFFECT_HIT";
}

/* --- MODAL HANDLING --- */
function openCodeModal() {
    document.getElementById('codeModal').classList.add('show');
    switchCodeType('revscript');
}
function closeCodeModal() {
    document.getElementById('codeModal').classList.remove('show');
}
function switchCodeType(type) {
    currentCodeType = type;
    document.querySelectorAll('.m-tab').forEach(t => {
        if (t.innerText.toLowerCase().includes(type === 'common' ? 'common' : (type === 'xml' ? 'xml' : 'rev'))) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });

    const code = generateCode(type);
    document.getElementById('generatedCode').textContent = code;
}
function copyCode() {
    const code = document.getElementById('generatedCode').textContent;
    navigator.clipboard.writeText(code).then(() => {
        showToast('Code copied to clipboard!', 'success');
        document.getElementById('copyStatus').classList.add('show');
        setTimeout(() => document.getElementById('copyStatus').classList.remove('show'), 2000);
    });
}
function downloadCode() {
    const code = document.getElementById('generatedCode').textContent;
    const blob = new Blob([code], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spell_script.lua`;
    a.click();
    window.URL.revokeObjectURL(url);
}

/* --- UTILS --- */
function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.background = type === 'error' ? 'var(--danger)' : (type === 'warning' ? 'var(--warning)' : 'var(--success)');
    toast.style.color = '#000';
    toast.style.padding = '10px 20px';
    toast.style.marginTop = '10px';
    toast.style.borderRadius = '4px';
    toast.style.fontWeight = 'bold';
    toast.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; }, 10);
    setTimeout(() => { toast.remove(); }, 3000);
}

/* --- FILE LOADER INTEGRATION --- */
function updateSettings() {
    const isExtended = document.getElementById('extendedCheck').checked;
    const isTransp = document.getElementById('transparencyCheck').checked;
    if (window.sprLoader) {
        window.sprLoader.isExtended = isExtended;
        window.sprLoader.hasTransparency = isTransp;
    }
    if (window.datLoader) {
        window.datLoader.isExtended = isExtended;
    }
    if (isSprLoaded) loadAssets(selectedEffectType);
}

async function loadFiles(input) {
    if (input.files && input.files.length > 0) {
        const files = Array.from(input.files);
        const sprFile = files.find(f => f.name.toLowerCase().endsWith('.spr'));
        const datFile = files.find(f => f.name.toLowerCase().endsWith('.dat'));

        if (!sprFile && !datFile) {
            showToast('❌ No .spr or .dat files found.', 'error');
            return;
        }

        try {
            const isExtended = document.getElementById('extendedCheck').checked;
            const isTransp = document.getElementById('transparencyCheck').checked;
            showToast('Loading files...', 'info');

            if (sprFile) {
                await window.sprLoader.loadFile(sprFile, { extended: isExtended, transparency: isTransp });
                isSprLoaded = true;
            }
            if (datFile) {
                await window.datLoader.loadFile(datFile, { extended: isExtended });
                isDatLoaded = true;
            }

            if (sprFile && datFile) showToast(`✓ Loaded ${sprFile.name}, ${datFile.name}`, 'success');
            else if (sprFile) showToast(`✓ Loaded SPR. Warning: DAT not found.`, 'warning');
            else showToast(`✓ Loaded DAT. Warning: SPR not found.`, 'warning');

            loadAssets(selectedEffectType);
        } catch (e) {
            console.error('❌ Error:', e);
            showToast(`Error: ${e.message}`, 'error');
        }
    }
}
window.sprLoader = window.sprLoader || { loadFile: async () => { }, getSpriteImage: async () => { } };
window.datLoader = window.datLoader || { loadFile: async () => { } };