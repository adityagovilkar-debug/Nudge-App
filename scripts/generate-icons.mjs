// Rasterizes public/icons/icon.svg into the PNG sizes the PWA + favicons
// need. Re-run after editing the SVG:  npm run icons
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "public/icons/icon.svg"));

const targets = [
  { size: 192, out: "public/icons/icon-192.png" },
  { size: 512, out: "public/icons/icon-512.png" },
  { size: 512, out: "public/icons/icon-maskable.png" },
  { size: 256, out: "app/icon.png" }, // favicon (Next file convention)
  { size: 180, out: "app/apple-icon.png" }, // apple touch icon
];

for (const t of targets) {
  await sharp(svg, { density: 384 })
    .resize(t.size, t.size)
    .png()
    .toFile(join(root, t.out));
  console.log("wrote", t.out, `${t.size}x${t.size}`);
}
console.log("done");
