#!/usr/bin/env node

/**
 * Upload ROM files to Cloudflare R2
 *
 * Reads data/metadata.json, filters to target systems, and uploads each ROM
 * from the local games directory to the R2 bucket. Skips files that already
 * exist in R2 (idempotent — safe to re-run).
 *
 * Usage:
 *   node scripts/upload-to-r2.js                  # Upload all target systems
 *   node scripts/upload-to-r2.js --dry-run        # Preview without uploading
 *   node scripts/upload-to-r2.js --systems gba,gb # Override target systems
 */

const fs = require("fs");
const path = require("path");
const {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");

// ── Load .env manually (no dotenv dependency) ─────────────────────────────
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

// ── Config ──────────────────────────────────────────────────────────────────

const GAMES_DIR = process.env.GAMES_DIR || "H:\\Games";
const DATA_DIR = path.join(__dirname, "..", "data");
const METADATA_PATH = path.join(DATA_DIR, "metadata.json");

const R2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME || "deejpotter";
const R2_PREFIX = "roms/"; // All ROMs stored under this prefix

// Systems to upload (small, browser-relevant)
const DEFAULT_SYSTEMS = ["nes", "snes", "gb", "gba", "n64"];

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, systems: DEFAULT_SYSTEMS };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") opts.dryRun = true;
    if (args[i] === "--systems" && args[i + 1]) {
      opts.systems = args[i + 1].split(",").map((s) => s.trim());
      i++;
    }
  }
  return opts;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024)
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

async function existsInR2(key) {
  try {
    await R2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (err) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404)
      return false;
    throw err;
  }
}

async function uploadFile(localPath, key) {
  const fileBuffer = fs.readFileSync(localPath);
  await R2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: fileBuffer,
      "Content-Length": fileBuffer.length,
    })
  );
  return fileBuffer.length;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  // Load metadata
  if (!fs.existsSync(METADATA_PATH)) {
    console.error(`Metadata not found: ${METADATA_PATH}`);
    process.exit(1);
  }
  const metadata = JSON.parse(fs.readFileSync(METADATA_PATH, "utf8"));
  const allGames = metadata.games || [];

  // Filter to target systems
  const games = allGames.filter((g) => opts.systems.includes(g.system));
  console.log(`\n📦 R2 Upload — ${opts.dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(
    `   Bucket: ${BUCKET} | Systems: ${opts.systems.join(", ")}`
  );
  console.log(
    `   Games: ${games.length} of ${allGames.length} total\n`
  );

  let uploaded = 0;
  let skipped = 0;
  let missing = 0;
  let errors = 0;
  let totalBytes = 0;

  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    const romPath = game.romPath.replace(/\\/g, "/");
    const r2Key = `${R2_PREFIX}${romPath}`;
    const localPath = path.join(GAMES_DIR, romPath);

    // Progress indicator
    const pct = (((i + 1) / games.length) * 100).toFixed(0);
    const prefix = `[${String(i + 1).padStart(String(games.length).length)}/${games.length}] ${pct}%`;

    // Check local file exists
    if (!fs.existsSync(localPath)) {
      console.log(`${prefix} ⏭  MISSING  ${romPath}`);
      missing++;
      continue;
    }

    // Check R2
    try {
      const alreadyExists = await existsInR2(r2Key);
      if (alreadyExists) {
        skipped++;
        // Only log every 100th skip to reduce noise
        if (skipped % 100 === 1) {
          console.log(`${prefix} ⏭  EXISTS   (skipping ${skipped} so far...)`);
        }
        continue;
      }
    } catch (err) {
      console.error(`${prefix} ❌ HEAD ERR ${romPath}: ${err.message}`);
      errors++;
      continue;
    }

    // Upload
    if (opts.dryRun) {
      const size = fs.statSync(localPath).size;
      console.log(`${prefix} 📤 WOULD UPLOAD  ${romPath} (${formatBytes(size)})`);
      totalBytes += size;
      uploaded++;
      continue;
    }

    try {
      const size = await uploadFile(localPath, r2Key);
      totalBytes += size;
      uploaded++;
      console.log(
        `${prefix} ✅ UPLOAD   ${romPath} (${formatBytes(size)})`
      );
    } catch (err) {
      console.error(`${prefix} ❌ UPLOAD   ${romPath}: ${err.message}`);
      errors++;
    }
  }

  // Summary
  console.log(`\n${"─".repeat(60)}`);
  console.log(`📊 Summary`);
  console.log(`   Uploaded: ${uploaded} files (${formatBytes(totalBytes)})`);
  console.log(`   Skipped (already in R2): ${skipped}`);
  console.log(`   Missing locally: ${missing}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total in R2: ${uploaded + skipped} files\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
