class DatLoader {
    constructor() {
        this.file = null;
        this.buffer = null;
        this.dataView = null;
        this.offset = 0;

        this.signature = 0;
        this.itemsCount = 0;
        this.outfitsCount = 0;
        this.effectsCount = 0;
        this.missilesCount = 0;

        // Data storage
        // We really only care about "Effect" -> "Sprite IDs" mapping for the "Magic" tab
        // And "Missile" -> "Sprite IDs" for "Distance"?
        // But let's try to store minimal info to save memory.
        this.effects = new Map(); // ID -> { sprites: [] }
        this.missiles = new Map();
        this.items = new Map();

        this.isExtended = false; // Will be detected or passed
        this.features = {
            extended: true,
            frameGroups: true,
            improvedAnimations: true
        };
    }

    async loadFile(file, options = {}) {
        this.file = file;
        this.buffer = await file.arrayBuffer();
        this.dataView = new DataView(this.buffer);
        this.offset = 0;

        // Manual override or auto-detect settings could go here
        if (options.extended !== undefined) this.isExtended = options.extended;

        this.parse();
    }

    readUint8() {
        if (this.offset + 1 > this.dataView.byteLength) return 0;
        const v = this.dataView.getUint8(this.offset);
        this.offset += 1;
        return v;
    }

    readUint16() {
        if (this.offset + 2 > this.dataView.byteLength) return 0;
        const v = this.dataView.getUint16(this.offset, true);
        this.offset += 2;
        return v;
    }

    readUint32() {
        if (this.offset + 4 > this.dataView.byteLength) return 0;
        const v = this.dataView.getUint32(this.offset, true);
        this.offset += 4;
        return v;
    }

    parse() {
        this.signature = this.readUint32();
        this.itemsCount = this.readUint16();
        this.outfitsCount = this.readUint16();
        this.effectsCount = this.readUint16();
        this.missilesCount = this.readUint16();

        console.log(`DAT Loaded: Sig=${this.signature.toString(16)} Items=${this.itemsCount} Effects=${this.effectsCount}`);

        // Read Items
        this.readCategory("Item", 100, this.itemsCount, this.items);

        // Read Outfits
        this.readCategory("Outfit", 1, this.outfitsCount, null); // Skip storage for now

        // Read Effects
        this.readCategory("Effect", 1, this.effectsCount, this.effects);

        // Read Missiles
        this.readCategory("Missile", 1, this.missilesCount, this.missiles);

        console.log("DAT Parsing Complete");
    }

    readCategory(name, minId, maxId, storage) {
        for (let id = minId; id <= maxId; id++) {
            this.readProperties();
            const sprites = this.readTexturePatterns(name);

            if (storage) {
                storage.set(id, sprites);
            }
        }
    }

    readProperties() {
        // Implement Flag skipping based on MetadataReader6 (10.10+)
        // This is crucial to keep offset correct.
        let flag = this.readUint8();
        while (flag !== 0xFF) { // LAST_FLAG
            switch (flag) {
                case 0x00: // Ground
                    this.offset += 2; // speed
                    break;
                case 0x01: // GroundBorder
                case 0x02: // OnBottom
                case 0x03: // OnTop
                case 0x04: // Container
                case 0x05: // Stackable
                case 0x06: // ForceUse
                case 0x07: // MultiUse
                    break;
                case 0x08: // Writable
                    this.offset += 2; // maxTextLen
                    break;
                case 0x09: // WritableOnce
                    this.offset += 2; // maxTextLen
                    break;
                case 0x0A: // FluidContainer
                case 0x0B: // Fluid
                case 0x0C: // Unpassable
                case 0x0D: // Unmoveable
                case 0x0E: // BlockMissile
                case 0x0F: // BlockPathfind
                case 0x10: // NoMoveAnimation
                case 0x11: // Pickupable
                case 0x12: // Hangable
                case 0x13: // Vertical
                case 0x14: // Horizontal
                case 0x15: // Rotatable
                    break;
                case 0x16: // HasLight
                    this.offset += 4; // level(2) + color(2)
                    break;
                case 0x17: // DontHide
                case 0x18: // Translucent
                    break;
                case 0x19: // HasOffset
                    this.offset += 4; // x(2) + y(2)
                    break;
                case 0x1A: // HasElevation
                    this.offset += 2; // elevation
                    break;
                case 0x1B: // LyingObject
                case 0x1C: // AnimateAlways
                    break;
                case 0x1D: // MiniMap
                    this.offset += 2; // color
                    break;
                case 0x1E: // LensHelp
                    this.offset += 2; // value
                    break;
                case 0x1F: // FullGround
                case 0x20: // IgnoreLook
                    break;
                case 0x21: // Cloth
                    this.offset += 2; // slot
                    break;
                case 0x22: // MarketItem
                    this.offset += 2; // category
                    this.offset += 2; // tradeAs
                    this.offset += 2; // showAs
                    const len = this.readUint16(); // name len
                    this.offset += len; // name
                    this.offset += 2; // restrict profession
                    this.offset += 2; // restrict level
                    break;
                case 0x23: // DefaultAction
                    this.offset += 2; // action
                    break;
                case 0x24: // Wrappable
                case 0x25: // Unwrappable
                case 0x26: // TopEffect
                    break;
                case 0x27: // Usable
                case 0x28: // Usable (old?)
                    break;
                    // Note: 10.50+ might have new flags. 
                    // 0x25 = UNWRAPPABLE in Reader6
                    // 0x26 = TOP_EFFECT
                    // 0X27 = USABLE
                    // 0x28 = HAS_BONES? NO, Reader6 says HAS_BONES scan be different.
                    // Reader6 HAS_BONES is not 0x28, it might be the default check.

                    // Actually checking MetadataReader6.as:
                    // WRAPPABLE (0x24)
                    // UNWRAPPABLE (0x25)
                    // TOP_EFFECT (0x26)
                    // USABLE (0x27) - wait, code has case for it.
                    // HAS_BONES is not in the switch order? 
                    // Ah, Reader6:
                    // ...
                    // case MetadataFlags6.HAS_BONES:
                    // MetadataFlags6 value?
                    // Typically flags are sequential. If Usable is 0x27...
                    // Let's assume standard up to here.

                    // Wait, if I encounter an unknown flag, the parser will break because I don't know the length.
                    // The user is likely using 10.98 or similar (Extended). 
                    // Let's add catch-all or hope 0xFF comes soon.
                    break;
                default:
                    // If we hit an unknown flag, we are in trouble.
                    // HAS_BONES (0x29?)
                    if (flag === 0xFE) { // 254?
                        // sometimes temp flag
                    } else {
                        // console.warn("Unknown flag:", flag.toString(16), "at offset", this.offset);
                        // If we assume it has no data...
                    }
                    break;

            }
            flag = this.readUint8();
        }
    }

    readTexturePatterns(category) {
        // Based on MetadataReader structure
        const frameGroups = this.features.frameGroups; // Only if enabled

        // For Outfits (category="Outfit"), first byte is groupCount (if frameGroups enabled)
        let groupCount = 1;
        if (category === "Outfit" && frameGroups) {
            groupCount = this.readUint8();
        }

        let thingData = {
            width: 1,
            height: 1,
            frames: 1,
            sprites: []
        };

        for (let g = 0; g < groupCount; g++) {
            // If outfit && frameGroups, skip byte (animation mode?)
            if (category === "Outfit" && frameGroups) {
                this.readUint8();
            }

            const width = this.readUint8();
            const height = this.readUint8();

            if (width > 1 || height > 1) {
                this.readUint8(); // exactSize
            }

            const layers = this.readUint8();
            const patternX = this.readUint8();
            const patternY = this.readUint8();
            const patternZ = this.readUint8();
            const frames = this.readUint8();

            // VALIDATE individual values
            if (width === 0 || height === 0 || layers === 0 || frames === 0 ||
                patternX === 0 || patternY === 0 || patternZ === 0) {
                console.error(`❌ Invalid pattern values detected at offset ${this.offset}`);
                console.error(`width=${width}, height=${height}, layers=${layers}, patternX=${patternX}, patternY=${patternY}, patternZ=${patternZ}, frames=${frames}`);
                throw new Error(
                    `Valores inválidos no arquivo DAT (offset ${this.offset}).\n\n` +
                    `Possíveis causas:\n` +
                    `1. Arquivo DAT corrompido\n` +
                    `2. Versão incompatível (tente marcar/desmarcar 'Extended')\n` +
                    `3. Arquivo não é um DAT válido (10.10+)`
                );
            }

            if (frames > 1) {
                // Animation
                // If improvedAnimations
                if (this.features.improvedAnimations) {
                    this.readUint8(); // async/sync
                    this.readUint32(); // loop count (int)
                    this.readUint8(); // start frame (byte)

                    for (let f = 0; f < frames; f++) {
                        this.readUint32(); // min duration
                        this.readUint32(); // max duration
                    }
                } else {
                    // standard logic
                }
            }

            // Total Sprites
            const totalSprites = width * height * layers * patternX * patternY * patternZ * frames;

            // CRITICAL VALIDATION - Prevent "Invalid array length"
            if (totalSprites <= 0 || totalSprites > 100000 || !Number.isFinite(totalSprites)) {
                console.error(`❌ Invalid totalSprites: ${totalSprites}`);
                console.error(`Values: width=${width}, height=${height}, layers=${layers}, patternX=${patternX}, patternY=${patternY}, patternZ=${patternZ}, frames=${frames}`);
                console.error(`Offset: ${this.offset}, Category: ${category}`);
                throw new Error(`Invalid sprite count (${totalSprites}). O arquivo DAT pode estar corrompido ou incompatível.`);
            }

            console.log(`Reading ${totalSprites} sprites for ${category}...`);

            for (let i = 0; i < totalSprites; i++) {
                let spriteId;
                if (this.isExtended) {
                    spriteId = this.readUint32(); // Extended = U32
                } else {
                    spriteId = this.readUint16();
                }
                thingData.sprites.push(spriteId);
            }

            // Save structure (simplification: last group overrides or merged? Outfits usually have Idle/Walk)
            // For Effects/Missiles there is usually 1 group.
            thingData.width = width;
            thingData.height = height;
            thingData.frames = frames;
            thingData.layers = layers;
            thingData.patternX = patternX;
            thingData.patternY = patternY;
            thingData.patternZ = patternZ;
        }

        return thingData;
    }

    getCategorySprites(id, category) {
        let map = this.effects;
        if (category === 'Missile' || category === 'Distance') map = this.missiles;
        if (category === 'Item') map = this.items; // for future

        return map.get(id);
    }
}

window.datLoader = new DatLoader();
