# PWA Icons

## Required Icons

To complete the PWA setup, you need to add the following icon files to this directory:

### Required Files:
1. **pwa-192x192.png** - 192x192 pixels
2. **pwa-512x512.png** - 512x512 pixels
3. **favicon.ico** - Standard favicon (32x32)
4. **apple-touch-icon.png** - 180x180 pixels (for iOS)
5. **mask-icon.svg** - SVG icon for Safari pinned tabs

## How to Create Icons

### Option 1: Use a Logo Generator
1. Create your logo with any design tool
2. Use a PWA icon generator like:
   - https://realfavicongenerator.net/
   - https://www.pwabuilder.com/imageGenerator
3. Upload your logo and download the generated icons

### Option 2: Manual Creation
1. Create a 512x512 PNG with your DeutschBoost logo
2. Resize to create smaller versions
3. Use online tools like https://favicon.io/ to create favicon.ico

## Design Suggestions

For DeutschBoost, consider:
- Colors: Blue (#2563eb) and white
- Icons: German flag colors, book, or "DB" initials
- Simple, recognizable design that works at small sizes

## Temporary Placeholder

Until you create proper icons, you can use a simple colored square:
- Background: #2563eb (blue)
- Text: "DB" in white
- Font: Bold, sans-serif

## Testing

After adding icons, test your PWA:
1. Run `npm run build && npm run preview`
2. Open in Chrome/Edge
3. Check DevTools > Application > Manifest
4. Look for "Install" button in address bar
