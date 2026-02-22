/**
 * PWA Icon Generator
 * 
 * This script generates PWA icons for the Online Emulator app.
 * Run with: node scripts/generate-icons.js
 * 
 * Requirements: sharp (npm install sharp)
 * 
 * If you don't have sharp, you can also:
 * 1. Use an online tool like https://realfavicongenerator.net/
 * 2. Create icons manually in your image editor
 * 3. Use the placeholder emoji-based icons below
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
    sharp = require('sharp');
} catch (e) {
    console.log('Sharp not installed. Creating placeholder icons...');
    createPlaceholderIcons();
    process.exit(0);
}

const ICON_SIZES = [192, 512];
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

async function generateIcons() {
    // Simple game controller icon as SVG
    const svgIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
            <rect width="512" height="512" fill="#18181b" rx="80"/>
            <text x="256" y="320" font-size="280" text-anchor="middle" fill="white">🎮</text>
        </svg>
    `;

    for (const size of ICON_SIZES) {
        const outputPath = path.join(PUBLIC_DIR, `icon-${size}x${size}.png`);
        
        await sharp(Buffer.from(svgIcon))
            .resize(size, size)
            .png()
            .toFile(outputPath);
        
        console.log(`Created ${outputPath}`);
    }

    console.log('Icons generated successfully!');
}

function createPlaceholderIcons() {
    // Create minimal placeholder files (1x1 transparent PNG)
    // These should be replaced with real icons
    const placeholderPng = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG header
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
        0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, // IDAT chunk
        0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
        0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, // IEND chunk
        0x42, 0x60, 0x82
    ]);

    for (const size of ICON_SIZES) {
        const outputPath = path.join(PUBLIC_DIR, `icon-${size}x${size}.png`);
        if (!fs.existsSync(outputPath)) {
            fs.writeFileSync(outputPath, placeholderPng);
            console.log(`Created placeholder ${outputPath}`);
            console.log(`⚠️  Replace with a real ${size}x${size} icon!`);
        }
    }
}

// Run the appropriate function
if (sharp) {
    generateIcons().catch(console.error);
} else {
    createPlaceholderIcons();
}
