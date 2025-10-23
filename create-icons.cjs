const fs = require('fs');
const path = require('path');

// Create a simple SVG that can be saved as PNG placeholder
const createSVG = (size) => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2563eb;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#4f46e5;stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="url(#grad)"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size/2.5}" fill="white"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size/3}" font-weight="bold" fill="#2563eb" text-anchor="middle" dominant-baseline="central">DB</text>
</svg>`;

const publicDir = path.join(__dirname, 'public');

// Create 192x192 SVG (browsers will use this as PNG)
fs.writeFileSync(
  path.join(publicDir, 'pwa-192x192.svg'),
  createSVG(192)
);

// Create 512x512 SVG
fs.writeFileSync(
  path.join(publicDir, 'pwa-512x512.svg'),
  createSVG(512)
);

console.log('✓ Created pwa-192x192.svg and pwa-512x512.svg');
console.log('Note: These SVG files will work as icons. For true PNG, use an online converter.');
