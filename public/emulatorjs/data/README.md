# EmulatorJS Data Files

This folder should contain the EmulatorJS data files.

## Setup Instructions

1. Download EmulatorJS from the CDN or GitHub:
   - CDN: <https://cdn.emulatorjs.org/stable/data/>
   - GitHub: <https://github.com/EmulatorJS/EmulatorJS>

2. Copy the contents of the `data/` folder to this directory.

3. The structure should look like:

   ```
   public/emulatorjs/data/
   ├── loader.js
   ├── emulator.js
   ├── emulator.css
   └── cores/
       ├── nes-*.wasm
       ├── snes-*.wasm
       └── ...
   ```

## Quick Download

You can use this command to download the required files:

```bash
# Download from CDN (run in public/emulatorjs/data/)
curl -O https://cdn.emulatorjs.org/stable/data/loader.js
curl -O https://cdn.emulatorjs.org/stable/data/emulator.js
curl -O https://cdn.emulatorjs.org/stable/data/emulator.css
```

Or clone the entire repository:

```bash
git clone https://github.com/EmulatorJS/EmulatorJS.git temp-emu
cp -r temp-emu/data/* public/emulatorjs/data/
rm -rf temp-emu
```

## Alternative: Use CDN

If you prefer to use the CDN instead of self-hosting, edit `src/app/play/page.tsx`
and change `EJS_pathtodata` to:

```typescript
window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
```

Note: Self-hosting is recommended for production to avoid CORS issues and ensure availability.
