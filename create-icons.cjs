// Simple script to create placeholder PWA icons
// Run with: node create-icons.js

const fs = require('fs');
const path = require('path');

// Create SVG icon
const createSVGIcon = (size) => {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#2563eb"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="${size * 0.4}" font-family="Arial, sans-serif" font-weight="bold">DB</text>
</svg>`;
};

// Create SVG files
const publicDir = path.join(__dirname, 'public');

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Create 192x192 SVG (will be converted to PNG manually or by build tool)
fs.writeFileSync(path.join(publicDir, 'icon-192.svg'), createSVGIcon(192));
fs.writeFileSync(path.join(publicDir, 'icon-512.svg'), createSVGIcon(512));
fs.writeFileSync(path.join(publicDir, 'mask-icon.svg'), createSVGIcon(512));

// Create a simple HTML file to help convert SVG to PNG
const converterHTML = `<!DOCTYPE html>
<html>
<head>
  <title>Icon Converter</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    canvas { border: 1px solid #ccc; margin: 10px; }
  </style>
</head>
<body>
  <h1>DeutschBoost Icon Generator</h1>
  <p>Open browser DevTools Console to save the icons as PNG</p>

  <h2>192x192 Icon</h2>
  <canvas id="canvas192" width="192" height="192"></canvas>

  <h2>512x512 Icon</h2>
  <canvas id="canvas512" width="512" height="512"></canvas>

  <script>
    function drawIcon(canvas, size) {
      const ctx = canvas.getContext('2d');

      // Background
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(0, 0, size, size);

      // Text
      ctx.fillStyle = 'white';
      ctx.font = 'bold ' + (size * 0.4) + 'px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DB', size / 2, size / 2);

      // Download link
      canvas.style.cursor = 'pointer';
      canvas.onclick = function() {
        const link = document.createElement('a');
        link.download = 'pwa-' + size + 'x' + size + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      };
    }

    drawIcon(document.getElementById('canvas192'), 192);
    drawIcon(document.getElementById('canvas512'), 512);

    console.log('Click on each canvas to download the PNG file');
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(publicDir, 'icon-generator.html'), converterHTML);

console.log('✓ SVG icons created in public/');
console.log('✓ Open public/icon-generator.html in a browser to create PNG files');
console.log('  Click on each canvas to download the PNG files');
console.log('  Save them as pwa-192x192.png and pwa-512x512.png in the public/ directory');
