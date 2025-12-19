// Global State
let currentGridSize = 11;
let selectedEffectId = 11; // Default to energy
let selectedEffectType = 'magic'; // magic, distance, item
let currentZoom = 100; // Zoom percentage (50-150)

// Multi-Combat System with Shared Grid
let sharedGridData = {}; // key: "x,y", value: array of {combatIndex, effectId, imageUrl}
let combatAreas = [
    { name: 'Combat 1', delay: 0, effectId: 11, effectType: 'magic' }
];
let currentCombatIndex = 0;

// Helper to get active combat data
function getActiveCombat() {
    return combatAreas[currentCombatIndex];
}

// Constants for Effects
const MAGIC_EFFECTS = Array.from({ length: 60 }, (_, i) => i + 1);
const DISTANCE_EFFECTS = Array.from({ length: 40 }, (_, i) => i + 1);

function init() {
    setGridSize(11);
    loadAssets('magic');
    updateCombatUI(); // Initialize combat tabs
    updateCombatPropertiesUI(); // Initialize combat properties
    // Auto-fit to screen after short delay
    setTimeout(fitToScreen, 100);
}

/* --- Grid Logic --- */
function setGridSize(size) {
    currentGridSize = size;
    gridData = {};

    // Update active buttons
    document.querySelectorAll('.toolbar .toolbar-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText.includes(size + 'x')) btn.classList.add('active');
    });

    renderGrid();
}

function renderGrid() {
    const gridEl = document.getElementById('spell-grid');
    gridEl.innerHTML = '';
    // Use the variable for sizing
    gridEl.style.gridTemplateColumns = `repeat(${currentGridSize}, var(--grid-cell-size, 32px))`;
    gridEl.style.gridTemplateRows = `repeat(${currentGridSize}, var(--grid-cell-size, 32px))`;

    const center = Math.floor(currentGridSize / 2);

    for (let y = 0; y < currentGridSize; y++) {
        for (let x = 0; x < currentGridSize; x++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            const isCenter = (x === center && y === center);

            if (isCenter) {
                cell.classList.add('center-cell');
                cell.title = "Caster Position";

                // Add Player Image at Center
                const playerImg = document.createElement('img');
                playerImg.src = 'src/resc/player.gif';
                playerImg.className = 'center-player-img';
                cell.appendChild(playerImg);
            }

            // On Click
            cell.onmousedown = (e) => {
                e.preventDefault();
                toggleCell(x, y, cell);
            };

            // Allow simple drag painting
            cell.onmouseenter = (e) => {
                if (e.buttons === 1) {
                    paintCell(x, y, cell);
                }
            };

            // Restore state if exists - show ALL effects from ALL combats
            const key = `${x},${y}`;
            if (sharedGridData[key] && sharedGridData[key].length > 0) {
                // Show all effects in this cell (overlay)
                sharedGridData[key].forEach(effect => {
                    const effectImg = document.createElement('img');
                    effectImg.src = effect.imageUrl;
                    effectImg.style.position = 'absolute';
                    effectImg.setAttribute('data-combat-index', effect.combatIndex);
                    cell.appendChild(effectImg);
                });
            }

            gridEl.appendChild(cell);
        }
    }
}

// Helpers
function getImageUrlInGrid(id) {
    // If we have access to loaded data...
    // For now assuming we just use the selected type's context or fallback
    // This is a bit tricky if we mixed types in grid?
    // Current logic assumes ALL grid items are SAME type/id? 
    // No, paintCell uses 'selectedEffectId'.

    // Ideally we store TYPE in gridData too.
    // But for now let's try to fetch from sprLoader if possible
    // or just return placeholder.
    // Since we can't easily get the blob URL back synchronously without storage,
    // we might need to rely on the fact that the image was set in paintCell innerHTML.
    // BUT renderGrid clears innerHTML.
    // So we need to fetch again.
    return ""; // handled by async re-paint or simplification?
    // Actually, let's keep it simple: renderGrid re-renders EMPTY cells,
    // then we re-apply gridData?
    // The loop above ADDS content.
    // We need an async way or cached URLs.
    // Let's modify paintCell to store the SRC too if possible?
    // Or just let the user re-paint? No that's bad.
    // FIX: gridData[key] = { id: 1, type: 'magic' } ?
    // Current gridData[key] = id.
}

/* --- Visual Features --- */
function setGridBackground(mode) {
    const grid = document.getElementById('spell-grid');
    grid.classList.remove('bg-light', 'bg-dark', 'bg-grid');

    if (mode === 'light') grid.classList.add('bg-light');
    if (mode === 'dark') grid.classList.add('bg-dark');
    if (mode === 'grid') grid.classList.add('bg-grid');
}

let currentGridCellSize = 32;
function zoomGrid(dir) {
    currentGridCellSize += (dir * 4); // Increment by 4px
    // Limits
    if (currentGridCellSize < 16) currentGridCellSize = 16;
    if (currentGridCellSize > 128) currentGridCellSize = 128;

    document.documentElement.style.setProperty('--grid-cell-size', `${currentGridCellSize}px`);
}

function toggleCell(x, y, cell) {
    const key = `${x},${y}`;
    const center = Math.floor(currentGridSize / 2);
    const combat = getActiveCombat();

    // Check if current combat already has effect here
    if (!sharedGridData[key]) {
        sharedGridData[key] = [];
    }

    const existingIndex = sharedGridData[key].findIndex(e => e.combatIndex === currentCombatIndex);

    if (existingIndex >= 0) {
        // Remove current combat's effect
        sharedGridData[key].splice(existingIndex, 1);
        // Clean up empty arrays
        if (sharedGridData[key].length === 0) {
            delete sharedGridData[key];
        }
    } else {
        // Add effect for current combat
        paintCell(x, y, cell);
        return; // paintCell will re-render
    }

    // Re-render grid to show updated effects
    renderGrid();
}

function paintCell(x, y, cell) {
    const key = `${x},${y}`;
    const combat = getActiveCombat();

    // Initialize array if needed
    if (!sharedGridData[key]) {
        sharedGridData[key] = [];
    }

    // Check if combat already has effect here
    const existingIndex = sharedGridData[key].findIndex(e => e.combatIndex === currentCombatIndex);

    if (existingIndex >= 0) {
        // Update existing effect
        sharedGridData[key][existingIndex] = {
            combatIndex: currentCombatIndex,
            effectId: combat.effectId,
            imageUrl: currentAssetImageUrl || ''
        };
    } else {
        // Add new effect for this combat
        sharedGridData[key].push({
            combatIndex: currentCombatIndex,
            effectId: combat.effectId,
            imageUrl: currentAssetImageUrl || ''
        });
    }

    // Re-render to show all effects
    renderGrid();
}

/* --- Multi-Combat Functions --- */
function addCombat() {
    const newIndex = combatAreas.length + 1;
    const combat = getActiveCombat();
    combatAreas.push({
        name: `Combat ${newIndex}`,
        effectId: combat.effectId,
        effectType: combat.effectType,
        delay: 0 // Default 0ms - user controls via properties
    });
    switchCombat(combatAreas.length - 1);
    updateCombatUI();
    updateCombatPropertiesUI();
}

function switchCombat(index) {
    if (index < 0 || index >= combatAreas.length) return;
    currentCombatIndex = index;
    renderGrid();
    updateCombatUI();
    updateCombatPropertiesUI();
    // Removed generateLuaCode() - only generate when clicking "Generate Script" button
}

/* --- Update Combat Properties UI --- */
function updateCombatPropertiesUI() {
    const combat = getActiveCombat();
    const nameInput = document.getElementById('currentCombatName');
    const delayInput = document.getElementById('currentCombatDelay');

    if (nameInput && combat) {
        nameInput.value = combat.name || 'Combat 1';
    }
    if (delayInput && combat) {
        delayInput.value = combat.delay || 0;
    }
}

/* --- Update Current Combat from Properties --- */
function updateCurrentCombat() {
    const combat = getActiveCombat();
    const nameInput = document.getElementById('currentCombatName');
    const delayInput = document.getElementById('currentCombatDelay');

    if (nameInput) {
        combat.name = nameInput.value;
    }
    if (delayInput) {
        const newDelay = parseInt(delayInput.value);
        combat.delay = isNaN(newDelay) ? 0 : newDelay;
        console.log(`Combat ${currentCombatIndex + 1} delay updated to: ${combat.delay}ms`);
    }

    updateCombatUI();
    // Removed generateLuaCode() - only generate when clicking "Generate Script" button
}

function deleteCombat(index) {
    if (combatAreas.length <= 1) {
        alert('Cannot delete the last combat area!');
        return;
    }
    if (confirm(`Delete ${combatAreas[index].name}?`)) {
        combatAreas.splice(index, 1);
        if (currentCombatIndex >= combatAreas.length) {
            currentCombatIndex = combatAreas.length - 1;
        }
        updateCombatUI();
        renderGrid();
        // Removed generateLuaCode() - only generate when clicking "Generate Script" button
    }
}

function updateCombatUI() {
    const container = document.getElementById('combatTabs');
    if (!container) return;

    container.innerHTML = '';

    combatAreas.forEach((combat, index) => {
        const tab = document.createElement('button');
        tab.className = 'combat-tab' + (index === currentCombatIndex ? ' active' : '');

        const label = document.createElement('span');
        label.textContent = `${combat.name} (${combat.delay}ms)`;
        label.style.cursor = 'pointer';
        tab.appendChild(label);

        tab.onclick = () => switchCombat(index);

        // Delete button (only if more than 1 combat)
        if (combatAreas.length > 1) {
            const deleteBtn = document.createElement('span');
            deleteBtn.className = 'combat-delete';
            deleteBtn.innerHTML = '×';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteCombat(index);
            };
            tab.appendChild(deleteBtn);
        }

        container.appendChild(tab);
    });

    // Add + button
    const addBtn = document.createElement('button');
    addBtn.className = 'combat-tab add-combat';
    addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
    addBtn.onclick = addCombat;
    addBtn.title = 'Add Combat Area';
    container.appendChild(addBtn);
}

function clearGrid() {
    // Remove all effects from current combat
    Object.keys(sharedGridData).forEach(key => {
        sharedGridData[key] = sharedGridData[key].filter(e => e.combatIndex !== currentCombatIndex);
        if (sharedGridData[key].length === 0) {
            delete sharedGridData[key];
        }
    });
    renderGrid();
}

// State for SPR
let isDatLoaded = false;
let isSprLoaded = false; // Added this missing global state variable

// Settings Update
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

// Unified File Loader - Now supports folder selection
async function loadFiles(input) {
    if (input.files && input.files.length > 0) {
        const files = Array.from(input.files);
        console.log(`${files.length} arquivos encontrados na pasta`);

        // Search for .spr and .dat files in the selected folder
        const sprFile = files.find(f => f.name.toLowerCase().endsWith('.spr'));
        const datFile = files.find(f => f.name.toLowerCase().endsWith('.dat'));

        if (!sprFile && !datFile) {
            alert('❌ Nenhum arquivo .spr ou .dat encontrado na pasta selecionada.');
            return;
        }

        try {
            const isExtended = document.getElementById('extendedCheck').checked;
            const isTransp = document.getElementById('transparencyCheck').checked;

            // Load SPR first
            if (sprFile) {
                console.log('Loading SPR:', sprFile.name);
                await window.sprLoader.loadFile(sprFile, { extended: isExtended, transparency: isTransp });
                isSprLoaded = true;
                console.log('✓ SPR loaded successfully');
            }

            // Load DAT
            if (datFile) {
                console.log('Loading DAT:', datFile.name);
                await window.datLoader.loadFile(datFile, { extended: isExtended });
                isDatLoaded = true;
                console.log('✓ DAT loaded successfully');
            }

            // Success message
            if (sprFile && datFile) {
                alert(`✓ Arquivos carregados com sucesso!\n\n${sprFile.name}\n${datFile.name}`);
            } else if (sprFile) {
                alert(`✓ SPR carregado: ${sprFile.name}\n⚠ Arquivo DAT não encontrado`);
            } else if (datFile) {
                alert(`✓ DAT carregado: ${datFile.name}\n⚠ Arquivo SPR não encontrado`);
            }

            // Reload assets with loaded data
            loadAssets(selectedEffectType);
        } catch (e) {
            console.error('❌ Erro detalhado:', e);
            console.error('Stack:', e.stack);
            alert(`❌ Erro ao carregar arquivos:\n\n${e.message}\n\nVerifique o console (F12) para mais detalhes.`);
        }
    }
}

// Legacy wrappers if needed, but we will switch to single input
async function loadDatFile(input) { return loadFiles(input); }
async function loadSprFile(input) { return loadFiles(input); }

/* --- Assets Logic --- */
function getImageUrl(id, type) {
    // If SPR/DAT loaded, we handle it in loadAssets via async calls.
    // This function is mainly for local file fallback.
    return `src/images/effects/effect_${id}_.png`;
}

function loadAssets(tab) {
    const grid = document.getElementById('assetsGrid');
    grid.innerHTML = '';
    selectedEffectType = tab;

    // Update active tab
    document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText.toLowerCase() === tab) {
            btn.classList.add('active');
        }
    });

    let list = [];
    let isCategory = false; // logic based on DAT categories

    // Normalize tab name
    const type = tab.toLowerCase();

    // FORCE SPR/DAT ONLY - No local fallback
    if (!isDatLoaded || !isSprLoaded) {
        grid.innerHTML = `<div style="color: var(--text-muted); padding: 40px; text-align: center; font-size: 0.9rem;">
            <i class="fa-solid fa-folder-open" style="font-size: 3rem; margin-bottom: 10px; opacity: 0.5;"></i><br>
            Por favor, carregue os arquivos <strong>.spr</strong> e <strong>.dat</strong> primeiro.
        </div>`;
        return;
    }

    // DAT Mode: Iterate real Effect/Missile IDs
    if (type === 'magic') {
        const count = window.datLoader.effectsCount || 0;
        console.log(`Loading ${count} magic effects from DAT`);
        for (let i = 1; i <= count; i++) list.push(i);
        isCategory = true;
    } else if (type === 'distance') {
        const count = window.datLoader.missilesCount || 0;
        console.log(`Loading ${count} distance missiles from DAT`);
        for (let i = 1; i <= count; i++) list.push(i);
        isCategory = true;
    }

    list.forEach(id => {
        const el = document.createElement('div');
        el.className = 'asset-item';
        if (id === selectedEffectId) el.classList.add('selected');
        el.onclick = () => selectAsset(id, el, type); // Pass type for animation lookup

        const img = document.createElement('img');

        if (isSprLoaded) {
            // Async loader
            if (isDatLoaded && isCategory) {
                // Get Thing Data associated with this ID
                let categoryKey = 'Effect';
                if (type === 'distance') categoryKey = 'Missile';
                if (type === 'items') categoryKey = 'Item';

                const thingData = window.datLoader.getCategorySprites(id, categoryKey);

                if (thingData && thingData.sprites.length > 0) {
                    // Use first sprite for grid view
                    const spriteId = thingData.sprites[0];
                    window.sprLoader.getSpriteImage(spriteId).then(url => {
                        if (url) img.src = url;
                    });
                    el.title = `ID: ${id}`;

                    // Store animation data on element for easy access?
                    el.dataset.frames = thingData.frames;
                } else {
                    el.style.opacity = 0.3;
                    img.alt = "Empty";
                }
            }
        } else {
            // NO SPR - Show placeholder
            el.style.opacity = 0.2;
            img.alt = "No SPR";
        }

        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.innerText = `ID: ${id}`;

        el.appendChild(img);
        el.appendChild(tooltip);
        grid.appendChild(el);
    });
}

function switchTab(t) {
    loadAssets(t);
}

// Animation State
let animationInterval = null;
let currentFrame = 0;

async function selectAsset(id, element, type) {
    // Highlight
    document.querySelectorAll('.asset-item').forEach(item => item.classList.remove('selected'));
    element.classList.add('selected');

    // Update selected ID and type
    selectedEffectId = id;
    selectedEffectType = type;

    // Store the image URL from the clicked element
    const imgElement = element.querySelector('img');
    if (imgElement && imgElement.src) {
        currentAssetImageUrl = imgElement.src;
        console.log(`Selected asset ${id}, image URL: ${currentAssetImageUrl}`);
    }

    // Update selected ID display
    const idDisplay = document.getElementById('selectedIdDisplay');
    if (idDisplay) idDisplay.innerText = id;

    // -- Animation Preview --
    const previewContainer = document.getElementById('previewContainer');
    const previewImage = document.getElementById('previewImage');

    // Reset
    if (animationInterval) clearInterval(animationInterval);
    currentFrame = 0;

    if (isDatLoaded && isSprLoaded) {
        previewContainer.style.display = 'flex';

        // Determine category key
        let categoryKey = 'Effect';
        if (type === 'distance') categoryKey = 'Missile';
        if (type === 'items') categoryKey = 'Item';

        const thingData = window.datLoader.getCategorySprites(id, categoryKey);

        if (thingData && thingData.sprites && thingData.sprites.length > 0) {
            const frames = thingData.frames || 1;
            const patternX = thingData.patternX || 1;
            const sprites = thingData.sprites;

            // Animation Modes:
            // 1. Standard Animation: frames > 1. Cycle frames.
            // 2. Directional Animation (Missiles): frames = 1, patternX > 1. Cycle directions (X).

            const isAnimatedFrame = frames > 1;
            const isAnimatedView = !isAnimatedFrame && patternX > 1;
            const loopMax = isAnimatedFrame ? frames : (isAnimatedView ? patternX : 1);

            // Function to update frame
            const updateFrame = () => {
                let spriteIndex = 0;

                if (isAnimatedFrame) {
                    // Stride = totalSprites / frames
                    // Assuming frames are the top-level block
                    const stride = sprites.length / frames;
                    spriteIndex = Math.floor(currentFrame * stride);
                } else if (isAnimatedView) {
                    // Stride for X?
                    // Order: Z -> Y -> X -> L -> W -> H (from ThingType.as)
                    // If others are 1, then just X indices.
                    // Sprites = [X0, X1, X2]
                    // We just pick currentFrame (which is currentX)
                    // But wait, there are Layers, Width, Height.
                    // Assuming W=1, H=1, Layers=1 for simple missiles.
                    // If W>1, we need to skip W*H*L sprites per X.
                    const layers = thingData.layers || 1;
                    const width = thingData.width || 1;
                    const height = thingData.height || 1;
                    const chunkSize = layers * width * height;

                    // Pattern Y and Z?
                    // Usually PatternY=1, Z=1 for simple missiles.
                    // If PatternY > 1 (e.g. 3x3), we might want to animate Y too?
                    // Let's stick to X (Direction) for now.

                    spriteIndex = currentFrame * chunkSize;
                }

                // Safety
                if (spriteIndex < sprites.length) {
                    const realSpriteId = sprites[spriteIndex];
                    window.sprLoader.getSpriteImage(realSpriteId).then(url => {
                        if (url) previewImage.src = url;
                    });
                }

                currentFrame = (currentFrame + 1) % loopMax;
            };

            // Run immediately
            updateFrame();

            // Start Interval if animated
            if (loopMax > 1) {
                animationInterval = setInterval(updateFrame, 200); // 200ms default speed
            }
        }
    } else {
        // Local preview
        previewContainer.style.display = 'none'; // Or show local image
    }
}
function filterAssets() {
    const term = document.getElementById('detailsSearch').value.toLowerCase();
    const items = document.querySelectorAll('.asset-item');

    items.forEach(item => {
        const id = item.querySelector('.asset-tooltip').innerText.split(' ')[1];
        if (id.includes(term)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

/* --- Lua Generation --- */
function generateLuaCode() {
    const center = Math.floor(currentGridSize / 2);

    // Get all properties
    const name = document.getElementById('spellName').value || 'spell';
    const spellWork = document.getElementById('spellWork').value;
    const reworkType = document.getElementById('reworkType').value;
    const effectType = document.getElementById('effectTypeSelect').value;
    const effectMode = document.getElementById('effectMode').value;
    // const effectDelay = document.getElementById('effectDelay').value; // Unused
    const misfireId = document.getElementById('misfireId').value;
    const sgmX = document.getElementById('sgmX').value;
    const sgmY = document.getElementById('sgmY').value;
    const posX = document.getElementById('posX').value;
    const posY = document.getElementById('posY').value;
    const drawnOnTop = document.getElementById('drawnOnTop').value;
    const combatType = document.getElementById('combatType').value;
    const minDamage = document.getElementById('minDamage').value;
    const maxDamage = document.getElementById('maxDamage').value;
    const areaType = document.getElementById('areaType').value;
    const manaCost = document.getElementById('spellMana').value;
    const minLevel = document.getElementById('spellLevel').value;
    const cooldown = document.getElementById('spellCooldown').value;

    // Header with metadata
    let fullScript = `-- ${name}\n-- Generated by OT SpellMaker\n-- Spell Work: ${spellWork}\n-- Rework: ${reworkType}\n\n`;

    // Generate code for each combat
    combatAreas.forEach((combat, combatIndex) => {
        const combatVar = `combat${combatIndex + 1}`;
        let luaMatrix = [];

        // Build area for THIS combat only
        for (let y = 0; y < currentGridSize; y++) {
            let row = [];
            for (let x = 0; x < currentGridSize; x++) {
                const key = `${x},${y}`;
                let hasMark = false;
                // Check if THIS combat has effect in this cell
                if (sharedGridData[key]) {
                    hasMark = sharedGridData[key].some(e => e.combatIndex === combatIndex);
                }
                if (x === center && y === center) {
                    row.push(hasMark ? 3 : 2);
                } else {
                    row.push(hasMark ? 1 : 0);
                }
            }
            luaMatrix.push("{" + row.join(", ") + "}");
        }
        const areaString = "{\\n    " + luaMatrix.join(",\\n    ") + "\\n}";

        fullScript += `-- ${combat.name} Configuration (Delay: ${combat.delay}ms)\n`;
        fullScript += `local ${combatVar} = Combat()\n`;
        fullScript += `${combatVar}:setParameter(COMBAT_PARAM_TYPE, ${combatType})\n`;
        fullScript += `${combatVar}:setParameter(COMBAT_PARAM_EFFECT, ${effectType})\n`;

        // Add damage configuration
        fullScript += `\n-- Damage Configuration\n`;
        fullScript += `function onGetFormulaValues(player, level, magicLevel)\n`;
        fullScript += `    local min = ${minDamage}\n`;
        fullScript += `    local max = ${maxDamage}\n`;
        fullScript += `    return -min, -max\n`;
        fullScript += `end\n`;
        fullScript += `${combatVar}:setCallback(CALLBACK_PARAM_LEVELMAGICVALUE, "onGetFormulaValues")\n\n`;

        // Area configuration
        fullScript += `-- Combat Area\n`;
        fullScript += `local area${combatIndex + 1} = createCombatArea(${areaString})\n`;
        fullScript += `${combatVar}:setArea(area${combatIndex + 1})\n\n`;
    });

    // onCastSpell function with effect configuration
    fullScript += `-- Spell Cast Function\n`;
    fullScript += `function onCastSpell(creature, variant)\n`;
    fullScript += `    local player = creature:getPlayer()\n`;
    fullScript += `    if not player then\n`;
    fullScript += `        return false\n`;
    fullScript += `    end\n\n`;

    // Effect mode implementation
    if (effectMode === 'send-magic') {
        fullScript += `    -- SendMagic Effect Configuration\n`;
        fullScript += `    local position = player:getPosition()\n`;

        if (posX !== '0' && posX !== 0 && posX !== '') {
            fullScript += `    position.x = position.x + ${posX}\n`;
        }
        if (posY !== '0' && posY !== 0 && posY !== '') {
            fullScript += `    position.y = position.y + ${posY}\n`;
        }

        if (sgmX !== '0' && sgmX !== 0 && sgmX !== '' || sgmY !== '0' && sgmY !== 0 && sgmY !== '') {
            fullScript += `    -- SendMagic Offsets: SGM-X=${sgmX}, SGM-Y=${sgmY}\n`;
        }
        fullScript += `    position:sendMagicEffect(${effectType})\n\n`;
    }

    // Execute combats with delays
    fullScript += `    -- Execute Combats\n`;
    combatAreas.forEach((combat, combatIndex) => {
        const combatVar = `combat${combatIndex + 1}`;
        console.log(`Combat ${combatIndex + 1} delay in generation:`, combat.delay);

        if (combat.delay === 0 || combat.delay === '0') {
            fullScript += `    ${combatVar}:execute(creature, variant)\n`;
        } else {
            fullScript += `    addEvent(function()\n`;
            fullScript += `        if player and player:isPlayer() then\n`;
            fullScript += `            ${combatVar}:execute(creature, variant)\n`;
            fullScript += `        end\n`;
            fullScript += `    end, ${combat.delay})\n`;
        }
    });

    fullScript += `\n    return true\n`;
    fullScript += `end\n`;

    // Add spell registration info as comment
    fullScript += `\n-- Spell Registration Info:\n`;
    fullScript += `-- Mana Cost: ${manaCost}\n`;
    fullScript += `-- Min Level: ${minLevel}\n`;
    fullScript += `-- Cooldown: ${cooldown}ms\n`;
    fullScript += `-- Area Type: ${areaType}\n`;
    if (misfireId) {
        fullScript += `-- Misfire ID: ${misfireId}\n`;
    }
    fullScript += `-- Drawn On Top: ${drawnOnTop}\n`;

    document.getElementById('modalCodeOutput').textContent = fullScript;
}

/* --- Generate with Success Notification --- */
function generateAndNotify() {
    generateLuaCode();
    showSuccessNotification();
}

/* --- Success Notification --- */
function showSuccessNotification() {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'success-notification';
    notification.innerHTML = `
        <i class="fa-solid fa-check-circle"></i>
        <span>Script gerado com sucesso!</span>
    `;

    document.body.appendChild(notification);

    // Trigger animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

/* --- Animation Logic --- */
let animationTimeouts = [];

function playAnimation() {
    const gridCells = document.querySelectorAll('#spell-grid .grid-cell img:not(.center-player-img)');
    if (gridCells.length === 0) {
        alert('No effects to animate! Paint some cells first.');
        return;
    }

    gridCells.forEach((img, index) => {
        setTimeout(() => {
            img.style.animation = 'none';
            img.offsetHeight; /* trigger reflow */
            img.style.animation = 'popIn 0.5s ease-out';
        }, index * 100); // Stagger animation
    });
}

function stopAnimation() {
    animationTimeouts.forEach(timeout => clearTimeout(timeout));
    animationTimeouts = [];
    renderGrid(); // Restore current combat's grid
}

/* --- Zoom Controls --- */
function zoomGrid(direction) {
    const zoomStep = 25; // 25% increments
    const minZoom = 50;
    const maxZoom = 300; // Increased for better visibility

    currentZoom = Math.max(minZoom, Math.min(maxZoom, currentZoom + (direction * zoomStep)));

    // Update CSS variable for grid cell size
    const baseSize = 32; // Base cell size in pixels
    const newSize = Math.round(baseSize * (currentZoom / 100));
    document.documentElement.style.setProperty('--grid-cell-size', `${newSize}px`);

    // Update zoom level display
    document.getElementById('zoomLevel').textContent = `${currentZoom}%`;

    // Re-render grid with new size
    renderGrid();

    // Center scroll if possible
    setTimeout(() => centerCanvas(), 100);
}

function fitToScreen() {
    const container = document.querySelector('.canvas-container');
    const grid = document.getElementById('spell-grid');

    if (!container || !grid) return;

    const containerWidth = container.clientWidth - 40; // Account for padding
    const containerHeight = container.clientHeight - 40;

    const baseSize = 32;
    const gridPixelSize = currentGridSize * baseSize;

    // Calculate zoom to fit
    const widthZoom = (containerWidth / gridPixelSize) * 100;
    const heightZoom = (containerHeight / gridPixelSize) * 100;
    const optimalZoom = Math.floor(Math.min(widthZoom, heightZoom));

    // Clamp to valid range
    // Clamp to valid range
    currentZoom = Math.max(50, Math.min(300, optimalZoom));

    // Apply zoom
    const newSize = Math.round(baseSize * (currentZoom / 100));
    document.documentElement.style.setProperty('--grid-cell-size', `${newSize}px`);
    document.getElementById('zoomLevel').textContent = `${currentZoom}%`;

    renderGrid();
    setTimeout(() => centerCanvas(), 100);
}

function centerCanvas() {
    const container = document.querySelector('.canvas-container');
    if (!container) return;

    // Center scrollbars
    container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
    container.scrollTop = (container.scrollHeight - container.clientHeight) / 2;
}

/* --- Spell Work UI Update --- */
function updateSpellWorkUI() {
    const spellWork = document.getElementById('spellWork').value;
    // Future: Add specific UI changes based on spell work type
    // For now, just log the change
    console.log('Spell work type changed to:', spellWork);
    // Removed generateLuaCode() - only generate when clicking "Generate Script" button
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    init();
});

/* --- Code Modal Functions --- */
function openCodeModal() {
    // Code is already generated, just show modal
    const modal = document.getElementById('codeModal');
    modal.style.display = 'block';

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
}

function closeCodeModal() {
    const modal = document.getElementById('codeModal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('codeModal');
    if (event.target === modal) {
        closeCodeModal();
    }
}

// ESC key to close modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeCodeModal();
    }
});

function copyCode() {
    const codeText = document.getElementById('modalCodeOutput').textContent;

    // Modern clipboard API
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(codeText).then(() => {
            alert('✅ Code copied to clipboard!');
        }).catch(err => {
            console.error('Copy failed:', err);
            fallbackCopy(codeText);
        });
    } else {
        fallbackCopy(codeText);
    }
}

function fallbackCopy(text) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
        document.execCommand('copy');
        alert('✅ Code copied to clipboard!');
    } catch (err) {
        alert('❌ Failed to copy code. Please copy manually.');
        console.error('Fallback copy failed:', err);
    }

    document.body.removeChild(textarea);
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', init);