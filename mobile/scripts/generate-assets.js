#!/usr/bin/env node
// Generate app icon and splash screen assets for Keptt
// Run: node scripts/generate-assets.js

const sharp = require('sharp')
const path  = require('path')
const fs    = require('fs')

const ASSETS = path.join(__dirname, '..', 'assets')

// ── Icon SVG (1024×1024) ──────────────────────────────────────────────────────
// Indigo background (#4F46E5), white house silhouette
const iconSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="1024" height="1024" rx="224" fill="#4F46E5"/>

  <!-- House body -->
  <rect x="300" y="530" width="424" height="310" rx="12" fill="white"/>

  <!-- Roof -->
  <polygon points="240,540 512,270 784,540" fill="white"/>

  <!-- Chimney -->
  <rect x="610" y="285" width="68" height="120" rx="8" fill="white"/>

  <!-- Door -->
  <rect x="436" y="660" width="152" height="180" rx="10" fill="#4F46E5"/>

  <!-- Left window -->
  <rect x="326" y="610" width="90" height="80" rx="8" fill="#4F46E5"/>
  <!-- Left window cross -->
  <rect x="369" y="610" width="5" height="80" fill="white" opacity="0.5"/>
  <rect x="326" y="648" width="90" height="5" fill="white" opacity="0.5"/>

  <!-- Right window -->
  <rect x="608" y="610" width="90" height="80" rx="8" fill="#4F46E5"/>
  <!-- Right window cross -->
  <rect x="651" y="610" width="5" height="80" fill="white" opacity="0.5"/>
  <rect x="608" y="648" width="90" height="5" fill="white" opacity="0.5"/>

  <!-- Door knob -->
  <circle cx="570" cy="755" r="10" fill="white" opacity="0.8"/>
</svg>
`.trim()

// ── Splash SVG ────────────────────────────────────────────────────────────────
// Light background (#F0F4FF), centered mini house + "Keptt" wordmark
const splashSvg = `
<svg width="1284" height="2778" viewBox="0 0 1284 2778" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="1284" height="2778" fill="#F0F4FF"/>

  <!-- House icon (centered, scaled to ~260px) -->
  <g transform="translate(512, 1189) scale(0.254)">
    <rect x="0" y="0" width="1024" height="1024" rx="224" fill="#4F46E5"/>
    <rect x="300" y="530" width="424" height="310" rx="12" fill="white"/>
    <polygon points="240,540 512,270 784,540" fill="white"/>
    <rect x="610" y="285" width="68" height="120" rx="8" fill="white"/>
    <rect x="436" y="660" width="152" height="180" rx="10" fill="#4F46E5"/>
    <rect x="326" y="610" width="90" height="80" rx="8" fill="#4F46E5"/>
    <rect x="369" y="610" width="5" height="80" fill="white" opacity="0.5"/>
    <rect x="326" y="648" width="90" height="5" fill="white" opacity="0.5"/>
    <rect x="608" y="610" width="90" height="80" rx="8" fill="#4F46E5"/>
    <rect x="651" y="610" width="5" height="80" fill="white" opacity="0.5"/>
    <rect x="608" y="648" width="90" height="5" fill="white" opacity="0.5"/>
    <circle cx="570" cy="755" r="10" fill="white" opacity="0.8"/>
  </g>

  <!-- Wordmark: "Keptt" -->
  <text
    x="642"
    y="1560"
    font-family="Georgia, serif"
    font-size="108"
    font-weight="700"
    fill="#1E1B4B"
    text-anchor="middle"
    letter-spacing="-2"
  >Keptt</text>

  <!-- Tagline -->
  <text
    x="642"
    y="1640"
    font-family="Arial, sans-serif"
    font-size="46"
    fill="#6B7280"
    text-anchor="middle"
    letter-spacing="1"
  >Household chores, made fun</text>
</svg>
`.trim()

async function generate() {
  console.log('Generating app icon...')
  await sharp(Buffer.from(iconSvg))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(ASSETS, 'icon.png'))
  console.log('  ✓ assets/icon.png (1024×1024)')

  console.log('Generating splash screen...')
  await sharp(Buffer.from(splashSvg))
    .resize(1284, 2778)
    .png()
    .toFile(path.join(ASSETS, 'splash-icon.png'))
  console.log('  ✓ assets/splash-icon.png (1284×2778)')

  console.log('Generating favicon...')
  await sharp(Buffer.from(iconSvg))
    .resize(48, 48)
    .png()
    .toFile(path.join(ASSETS, 'favicon.png'))
  console.log('  ✓ assets/favicon.png (48×48)')

  console.log('\nAll assets generated successfully.')
}

generate().catch((e) => {
  console.error('Asset generation failed:', e.message)
  process.exit(1)
})
