#!/usr/bin/env node
// Uploads data/metadata.json to R2 as library/manifest.json

const fs = require("fs");
const path = require("path");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

// Load .env manually (no dotenv dependency)
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const BUCKET = process.env.R2_BUCKET_NAME || "deejpotter";

const metaPath = path.join(__dirname, "..", "data", "metadata.json");
if (!fs.existsSync(metaPath)) {
  console.error("metadata.json not found — run a scan/prune first");
  process.exit(1);
}

(async () => {
  const body = fs.readFileSync(metaPath);
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: "library/manifest.json",
      Body: body,
      "Content-Type": "application/json",
    })
  );
  const games = JSON.parse(body.toString()).games.length;
  console.log(
    `✅ Uploaded library manifest (${games} games) to ${BUCKET}/library/manifest.json`
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
