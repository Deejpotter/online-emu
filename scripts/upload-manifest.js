#!/usr/bin/env node
// Uploads data/metadata.json to R2 as library/manifest.json so a fresh
// Coolify container can bootstrap its game library without local ROMs.

const fs = require("fs");
const path = require("path");
const {
  S3Client,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");

// Load .env manually
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

const R2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const BUCKET = process.env.R2_BUCKET_NAME || "deejpotter";
const LOCAL = path.join(__dirname, "..", "data", "metadata.json");
const KEY = "library/manifest.json";

if (!fs.existsSync(LOCAL)) {
  console.error("metadata.json not found at", LOCAL);
  process.exit(1);
}

(async () => {
  const body = fs.readFileSync(LOCAL);
  await R2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: KEY,
      Body: body,
      "Content-Type": "application/json",
    })
  );
  console.log(`Uploaded ${body.length} bytes -> ${BUCKET}/${KEY}`);
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
