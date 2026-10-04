// Растеризует public/icon.svg в PNG-иконки для PWA и iOS.
import sharp from 'sharp';

const src = 'public/icon.svg';
const out = [
  ['public/pwa-192.png', 192],
  ['public/pwa-512.png', 512],
  ['public/apple-touch-icon.png', 180],
];
for (const [file, size] of out) {
  await sharp(src).resize(size, size).png().toFile(file);
  console.log('ok', file);
}
