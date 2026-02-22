#!/usr/bin/env node

/**
 * EmulatorJS Setup Script
 *
 * Downloads and sets up EmulatorJS data files for self-hosting.
 * This script is run automatically via `npm run setup` or `postinstall`.
 *
 * EmulatorJS provides browser-based emulation using WebAssembly cores
 * from the RetroArch/libretro project.
 *
 * IMPORTANT: Each core requires MULTIPLE files:
 * - {core}-wasm.data - Main WebAssembly binary
 * - {core}.json - Core metadata (optional, but helps)
 * - {core}-legacy-wasm.data - Fallback for older browsers
 * - {core}-thread-wasm.data - Thread-based variant (optional)
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

// Configuration
const EMULATORJS_VERSION = "stable";
const CDN_BASE = `https://cdn.emulatorjs.org/${EMULATORJS_VERSION}/data`;
const DATA_DIR = path.join(__dirname, "..", "public", "emulatorjs", "data");

// Core files needed for EmulatorJS to function
const CORE_FILES = [
  "loader.js",
  "emulator.min.js",
  "emulator.min.css",
  "nipplejs.min.js",
  "version.json", // Version metadata
];

/**
 * Compression library files needed to extract ROM archives.
 * EmulatorJS needs these to decompress .zip, .7z, .rar files.
 * Without these, ROMs in archive format fail with "Network Error".
 */
const COMPRESSION_FILES = [
  "compression/extract7z.js",    // For .7z archives
  "compression/extractzip.js",   // For .zip archives
  "compression/libunrar.js",     // For .rar archives
  "compression/libunrar.wasm",   // WASM binary for rar extraction
];

/**
 * Core metadata file with information about all available cores.
 */
const METADATA_FILES = [
  "cores/cores.json",  // Core metadata
];

/**
 * Core configurations with their internal names.
 * Format: { system, coreName, displayName }
 *
 * The coreName is what EmulatorJS uses in filenames.
 */
const CORES = [
  { system: "nes", core: "fceumm", name: "NES - FCEUmm" },
  { system: "snes", core: "snes9x", name: "SNES - Snes9x" },
  { system: "gb", core: "gambatte", name: "Game Boy - Gambatte" },
  { system: "gba", core: "mgba", name: "GBA - mGBA" },
  { system: "n64", core: "mupen64plus_next", name: "N64 - Mupen64Plus" },
  { system: "segaMD", core: "genesis_plus_gx", name: "Genesis - Genesis Plus GX" },
  { system: "psx", core: "pcsx_rearmed", name: "PlayStation - PCSX ReARMed" },
  { system: "nds", core: "desmume2015", name: "Nintendo DS - DeSmuME" },
  { system: "psp", core: "ppsspp", name: "PSP - PPSSPP" },
  { system: "atari2600", core: "stella2014", name: "Atari 2600 - Stella" },
];

/**
 * File variants to download for each core.
 * Each core may have multiple file types.
 */
const CORE_FILE_SUFFIXES = [
  "-wasm.data", // Main WebAssembly data (required)
  "-legacy-wasm.data", // Legacy browser fallback
  "-thread-wasm.data", // Multi-threaded variant
];

/**
 * Download a file from URL to local path
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const protocol = url.startsWith("https") ? https : http;

    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        downloadFile(response.headers.location, destPath)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        try {
          fs.unlinkSync(destPath);
        } catch { }
        reject(
          new Error(`HTTP ${response.statusCode} for ${path.basename(destPath)}`)
        );
        return;
      }

      response.pipe(file);

      file.on("finish", () => {
        file.close();
        resolve();
      });
    });

    request.on("error", (err) => {
      file.close();
      fs.unlink(destPath, () => { }); // Delete partial file
      reject(err);
    });

    request.setTimeout(60000, () => {
      // 60 second timeout for large files
      request.destroy();
      reject(new Error(`Timeout downloading ${path.basename(destPath)}`));
    });
  });
}

/**
 * Ensure directory exists
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Check if a file already exists
 */
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * Download a single file, with logging
 */
async function downloadWithLog(url, destPath, quiet = false) {
  const filename = path.basename(destPath);

  if (fileExists(destPath)) {
    if (!quiet) console.log(`  ✓ ${filename} (exists)`);
    return true;
  }

  try {
    if (!quiet) process.stdout.write(`  ↓ ${filename}...`);
    await downloadFile(url, destPath);
    if (!quiet) console.log(" ✓");
    return true;
  } catch (err) {
    if (!quiet) console.log(` ✗ (${err.message})`);
    return false;
  }
}

/**
 * Main setup function
 */
async function setup() {
  console.log("");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("   🎮 EmulatorJS Setup");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("");
  console.log(`Version: ${EMULATORJS_VERSION}`);
  console.log(`CDN: ${CDN_BASE}`);
  console.log(`Destination: ${DATA_DIR}`);
  console.log("");

  // Create directories
  ensureDir(DATA_DIR);
  ensureDir(path.join(DATA_DIR, "cores"));
  ensureDir(path.join(DATA_DIR, "compression"));

  // Download core UI files
  console.log("📦 Downloading EmulatorJS core files...");
  for (const file of CORE_FILES) {
    const url = `${CDN_BASE}/${file}`;
    const destPath = path.join(DATA_DIR, file);
    await downloadWithLog(url, destPath);
  }

  // Download compression libraries (needed for ROM archives)
  console.log("");
  console.log("📦 Downloading compression libraries...");
  console.log("   (Required for .zip, .7z, .rar ROM files)");
  for (const file of COMPRESSION_FILES) {
    const url = `${CDN_BASE}/${file}`;
    const destPath = path.join(DATA_DIR, file);
    await downloadWithLog(url, destPath);
  }

  // Download metadata files
  console.log("");
  console.log("📦 Downloading core metadata...");
  for (const file of METADATA_FILES) {
  }

  // Download emulator cores
  console.log("");
  console.log("🕹️  Downloading emulator cores...");
  console.log("   (This may take several minutes)");
  console.log("");

  let successCount = 0;
  let failCount = 0;

  for (const { core, name } of CORES) {
    console.log(`\n📀 ${name} (${core}):`);

    // Download each file variant for this core
    for (const suffix of CORE_FILE_SUFFIXES) {
      const filename = `${core}${suffix}`;
      const url = `${CDN_BASE}/cores/${filename}`;
      const destPath = path.join(DATA_DIR, "cores", filename);

      const success = await downloadWithLog(url, destPath);
      if (success) {
        successCount++;
      } else {
        // Only count as failure if it's the main -wasm.data file
        if (suffix === "-wasm.data") {
          failCount++;
        }
      }
    }
  }

  // Summary
  console.log("");
  console.log("═══════════════════════════════════════════════════════════");

  if (failCount === 0) {
    console.log("   ✅ EmulatorJS Setup Complete!");
  } else {
    console.log(`   ⚠️  Setup completed with ${failCount} missing cores`);
  }

  console.log("═══════════════════════════════════════════════════════════");
  console.log("");
  console.log("   You can now run: npm run dev");
  console.log("");
  console.log("   Add ROMs to your games folder:");
  console.log("   Supported: NES, SNES, GB, GBA, N64, Genesis, PS1, DS, PSP");
  console.log("");

  // Note about additional cores
  console.log("💡 Need more systems? Download cores from:");
  console.log("   https://cdn.emulatorjs.org/stable/data/cores/");
  console.log("");

  // Verify critical files exist
  console.log("🔍 Verifying installation...");
  const criticalFiles = [
    path.join(DATA_DIR, "loader.js"),
    path.join(DATA_DIR, "emulator.min.js"),
    path.join(DATA_DIR, "cores", "fceumm-wasm.data"),
  ];

  let verified = true;
  for (const file of criticalFiles) {
    if (!fileExists(file)) {
      console.log(`   ✗ Missing: ${path.basename(file)}`);
      verified = false;
    }
  }

  if (verified) {
    console.log("   ✓ All critical files present");
  } else {
    console.log("   ⚠️  Some files missing - emulation may not work");
  }
  console.log("");
}

// Run setup
setup().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
