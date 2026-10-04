// Исходники иконки для APK (@capacitor/assets): полная иконка, передний план и фон адаптивной иконки.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('assets', { recursive: true });
const BG = '#0E1015';
const shield = (scale) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <path d="M256 92 L380 164 V308 L256 420 L132 308 V164 Z" fill="none" stroke="#F2B544" stroke-width="28" stroke-linejoin="round"/>
    <path d="M256 170 V330 M196 270 L256 330 L316 270" fill="none" stroke="#F2B544" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" transform="rotate(180 256 250)"/>
  </g>
</svg>`;

// Передний план адаптивной иконки: Android обрезает края, поэтому щит меньше.
await sharp(Buffer.from(shield(0.62))).resize(1024, 1024).png().toFile('assets/icon-foreground.png');
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BG } }).png().toFile('assets/icon-background.png');
await sharp('public/icon.svg').resize(1024, 1024).png().toFile('assets/icon-only.png');
console.log('assets ok');
