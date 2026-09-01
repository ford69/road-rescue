/**
 * Rasterizes the Road Rescue brand mark SVGs into PWA icon sizes.
 * Source artwork mirrors the in-app LifeBuoy mark (no alternate logo invented).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(root, '../public/icons');

const targets = [
  { name: 'icon-192.png', size: 192, source: 'icon.svg' },
  { name: 'icon-512.png', size: 512, source: 'icon.svg' },
  { name: 'apple-touch-icon.png', size: 180, source: 'icon.svg' },
  { name: 'maskable-192.png', size: 192, source: 'icon-maskable.svg' },
  { name: 'maskable-512.png', size: 512, source: 'icon-maskable.svg' },
  { name: 'favicon-32.png', size: 32, source: 'icon.svg' },
];

async function main() {
  for (const target of targets) {
    const input = path.join(iconsDir, target.source);
    const output = path.join(iconsDir, target.name);
    await sharp(input).resize(target.size, target.size).png().toFile(output);
    console.log(`wrote ${target.name}`);
  }

  // Root favicon for browsers that look at /favicon.ico path via PNG fallback in HTML
  const favicon = path.join(root, '../public/favicon.ico');
  await sharp(path.join(iconsDir, 'icon.svg')).resize(32, 32).png().toFile(favicon.replace(/\.ico$/, '-32.png'));
  fs.copyFileSync(path.join(iconsDir, 'favicon-32.png'), path.join(root, '../public/favicon-32.png'));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
