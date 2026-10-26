// Development-time materials. Navigation on the TV only displays these JPEGs.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { openPreview, root } from './browser.mjs';

const catalogue = JSON.parse(readFileSync(root + 'app/assets/wallpapers/SOURCES.json', 'utf8'));
const requested = process.argv[2] ? process.argv[2].split(',') : catalogue.map(w => w.id);
if (requested.some(id => !catalogue.some(w => w.id === id))) throw Error('Unknown wallpaper');
const destination = root + '.local/materials/builder/';
mkdirSync(destination, { recursive: true });
// Preserve the reviewed density of the original nine Soft surfaces.
const softTint = { misty: .43303399, cove: .389543, forest: .43034609, valley: .51301798,
  night: .46650529, peaks: .36319971, bridge: .30784841, ridge: .6, golden: .32207446 };
const report = { recipe: 1, size: [1920, 1080], assets: [], errors: [] };
const preview = await openPreview();
try {
  const page = await preview.browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(preview.baseURL + '/build/dock.html');
  await page.addScriptTag({ url: preview.baseURL + '/build/recipe.js' });
  for (const id of requested) {
    const result = await page.evaluate(async ({ id, fixedTint }) => {
      const W = 1920, H = 1080;
      const image = new Image(); image.src = '/home/assets/wallpapers/' + id + '.jpg'; await image.decode();
      const photo = Object.assign(document.createElement('canvas'), { width: W, height: H }), pc = photo.getContext('2d'), scale = Math.max(W / image.width, H / image.height);
      pc.drawImage(image, (W - image.width * scale) / 2, (H - image.height * scale) / 2, image.width * scale, image.height * scale);
      return window.cleanFrameMaterials(photo, fixedTint);
    }, { id, fixedTint: softTint[id] ?? null });
    for (const [suffix, base64] of Object.entries(result.files)) {
      const bytes = Buffer.from(base64, 'base64');
      writeFileSync(destination + id + '-' + suffix + '.jpg', bytes);
      report.assets.push({ id, suffix, bytes: bytes.length, softTint: result.tint });
    }
    console.log(id + ': five registered materials prepared');
  }
  writeFileSync(destination + 'report.json', JSON.stringify(report, null, 2) + '\n');
  if (report.errors.length) throw Error(report.errors.join('\n'));
} finally { await preview.close(); }
