class SprLoader {
    constructor() {
        this.file = null;
        this.buffer = null;
        this.dataView = null;
        this.version = 0;
        this.spriteCount = 0;
        this.extended = false;

        // Settings
        this.isExtended = false; // User override or auto-detect
        this.hasTransparency = false; // User override

        // Cache to store loaded sprites (canvas elements or ImageBitmap)
        this.cache = new Map();
    }

    async loadFile(file, options = {}) {
        this.file = file;
        this.buffer = await file.arrayBuffer();
        this.dataView = new DataView(this.buffer);

        // Apply options
        this.isExtended = options.extended || false;
        if (options.transparency !== undefined) this.hasTransparency = options.transparency;

        this.parseHeader();
    }

    parseHeader() {
        // Tibia SPR Format:
        // Signature (4 bytes)
        // Count (2 bytes or 4 bytes depending on version/extended)

        let offset = 0;
        const signature = this.dataView.getUint32(offset, true); // Little Endian
        offset += 4;

        // Count sprites
        // Usually signature determines version. 
        // 960+ uses extended? 
        // For simplicity, let's try to detect or user specifies. 
        // Standard (old) is Uint16 for count. Extended is Uint32.

        // Heuristic: If Uint16 count is essentially the file size / factor, it fits.
        // Actually, let's assume standard first? 
        // ObjectBuilder uses "features.extended". 
        // Let's assume U16 first, if it looks wrong (too small/large), try U32?
        // Actually, simpler: Just read Uint16. If signature implies > 9.60, use Uint32.

        // Map Signature to Version (approximate)
        // 4F525453 ("STRO"?) - No, usually it's a version number like 0x4E5F (format identifier)
        // Wait, standard SPR signature is usually the version.
        // e.g. 8.60 = 0x4C35 (just valid signature)

        this.version = signature;

        // Auto-detect Extended based on known signatures or simple heuristic
        // User's signature: 0x59E48E02 (1508199938) -> Definitely new/extended.
        // Standard signatures differ.
        // Heuristic: Check if the user forced it OR if the signature implies it.
        // For now, if the user didn't explicitly set it via UI (handled in script.js), 
        // we can try to smart-detect:
        // If U16 count seems too small or header fits U32 better.

        if (this.isExtended) {
            this.spriteCount = this.dataView.getUint32(offset, true);
            // Header size = 4 (Sig) + 4 (Count) = 8
        } else {
            this.spriteCount = this.dataView.getUint16(offset, true);
            // Header size = 4 (Sig) + 2 (Count) = 6
        }

        // If spriteCount is 0 or very small for a large file, maybe it's extended (U32)?
        // Or check file size vs ((count * 4) + 6). 
        // Header size: 6 bytes (Signature 4 + Count 2).
        // Extended: 8 bytes (Signature 4 + Count 4).

        // For now, let's stick to U16 (Old Client) as default, but provide a toggle if needed.
        // The user's project seems to be "Food Theme" -> "TFS", usually 8.60 or 10.x. 10.x+ is extended.

        console.log(`SPR Loaded: Sig=${signature.toString(16)}, Count=${this.spriteCount}, Extended=${this.isExtended}`);
    }

    getSpriteAddress(id) {
        // ID is 1-based index
        if (id < 1 || id > this.spriteCount) return 0;

        // Offset Calculation
        // Standard: Header(6) + ((id-1) * 4)
        // Pointer is 4 bytes (Standard)
        const headerSize = this.isExtended ? 8 : 6;
        const addressOffset = headerSize + ((id - 1) * 4);

        // Safety check
        if (addressOffset + 4 > this.dataView.byteLength) return 0;

        return this.dataView.getUint32(addressOffset, true);
    }

    async getSpriteImage(id) {
        if (this.cache.has(id)) return this.cache.get(id);

        const address = this.getSpriteAddress(id);
        if (address === 0) return null; // Empty sprite

        // Jump to address
        let pos = address;

        // Safety
        if (pos + 3 > this.dataView.byteLength) return null;

        // Skip Color Key (Pink) - 3 bytes (R, G, B)
        // Even if validation failed, these bytes exist in format.
        // We skip them.
        pos += 3;

        if (pos + 2 > this.dataView.byteLength) return null;
        const dataSize = this.dataView.getUint16(pos, true);
        pos += 2;

        if (dataSize === 0) return null;
        if (pos + dataSize > this.dataView.byteLength) return null;

        // Pixel Data
        // Creates a 32x32 canvas
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(32, 32);
        const pixels = imageData.data; // RGBA array

        // Parsing Loop (RLE-like)
        let writePos = 0; // Number of pixels written (0 to 1024)
        let readOffset = pos;
        const endOffset = pos + dataSize;

        // Fill background if transparency is disabled
        if (!this.hasTransparency) {
            // Fill with Magenta (255, 0, 255)
            for (let i = 0; i < 1024 * 4; i += 4) {
                pixels[i] = 255;     // R
                pixels[i + 1] = 0;     // G
                pixels[i + 2] = 255;   // B
                pixels[i + 3] = 255;   // A
            }
        }

        while (readOffset < endOffset && writePos < 1024) {
            // Safety check for loop
            if (readOffset + 4 > this.dataView.byteLength) break;

            // Read transparent count (2 bytes)
            const transparentBytes = this.dataView.getUint16(readOffset, true);
            readOffset += 2;

            // Advance write position
            // If transparency is ON, we just skip (pixels are already 0,0,0,0 default).
            // If transparency is OFF, we already filled with Magenta, so we just skip.
            writePos += transparentBytes;

            if (readOffset >= endOffset) break;

            // Read colored count (2 bytes)
            const coloredBytes = this.dataView.getUint16(readOffset, true);
            readOffset += 2;

            for (let i = 0; i < coloredBytes; i++) {
                if (writePos >= 1024) break;
                if (readOffset + 3 > this.dataView.byteLength) break;

                const r = this.dataView.getUint8(readOffset++);
                const g = this.dataView.getUint8(readOffset++);
                const b = this.dataView.getUint8(readOffset++);

                // Set Pixel
                const pixelIndex = writePos * 4;
                pixels[pixelIndex] = r;
                pixels[pixelIndex + 1] = g;
                pixels[pixelIndex + 2] = b;
                pixels[pixelIndex + 3] = 255; // Alpha 100%

                writePos++;
            }
        }

        ctx.putImageData(imageData, 0, 0);

        // Store as DataURL for easy IMG tag usage
        const dataUrl = canvas.toDataURL();
        this.cache.set(id, dataUrl);
        return dataUrl;
    }
}

// Global Instance
window.sprLoader = new SprLoader();
