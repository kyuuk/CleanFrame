// Build the owner's own wallpapers from .local/photos into .local/photos/build.
// Development only: the TV displays these JPEGs and never blurs or samples pixels.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { openPreview, root } from './browser.mjs';

const folder = root + '.local/photos/', build = folder + 'build/';
const IMAGES = /\.(jpe?g|png)$/i, WARN_AT = 30;
const LOOK_KEYS = ['tone', 'ut', 'frostVeil', 'listColumn', 'dockQuiet', 'clockMist'];
const settings = existsSync(folder + 'cleanframe.json') ? JSON.parse(readFileSync(folder + 'cleanframe.json', 'utf8')) : {};
const hideBundled = !!settings.hideBundled;
const sources = existsSync(folder) ? readdirSync(folder).filter(name => IMAGES.test(name) && statSync(folder + name).isFile()).sort() : [];
if (hideBundled && !sources.length) throw Error('hideBundled is set in .local/photos/cleanframe.json, but .local/photos has no JPEG or PNG photos.');
if (sources.length > WARN_AT) console.warn('Warning: ' + sources.length + ' photos. Large galleries make the widget slower to install.');

const slug = name => name.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'photo';
const title = name => name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase()) || 'My photo';
const used = new Set();
const photos = sources.map(source => {
  const sidecar = folder + source.replace(/\.[^.]+$/, '') + '.json';
  const options = existsSync(sidecar) ? JSON.parse(readFileSync(sidecar, 'utf8')) : {};
  const focus = Array.isArray(options.focus) ? options.focus.map(v => Math.max(0, Math.min(1, Number(v) || 0))) : [.5, .5];
  let id = 'own-' + slug(source), n = 2;
  while (used.has(id)) id = 'own-' + slug(source) + '-' + n++;
  used.add(id);
  const stat = statSync(folder + source);
  return { id, source, name: String(options.name || title(source)).slice(0, 80), focus, look: options.look || {}, sourceBytes: stat.size, sourceMtime: Math.floor(stat.mtimeMs / 1000) };
});

// Generated files only: remove what the previous build listed, then write afresh.
const previous = existsSync(build + 'manifest.json') ? JSON.parse(readFileSync(build + 'manifest.json', 'utf8')) : null;
if (previous) for (const name of previous.files.concat(['manifest.json', 'preview-sheet.jpg'])) rmSync(build + name, { force: true });
mkdirSync(build + 'assets/wallpapers', { recursive: true });
mkdirSync(build + 'assets/materials', { recursive: true });

const files = [], entries = [];
let preview = await openPreview();
try {
  const page = await preview.browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/own-source/*', route => route.fulfill({ path: folder + decodeURIComponent(route.request().url().split('/own-source/')[1]) }));
  await page.goto(preview.baseURL + '/build/dock.html');
  await page.addScriptTag({ url: preview.baseURL + '/build/recipe.js' });
  for (const photo of photos) {
    const result = await page.evaluate(async ({ source, focus }) => {
      const W = 1920, H = 1080;
      const canvas = (w = W, h = H) => Object.assign(document.createElement('canvas'), { width: w, height: h });
      const image = new Image(); image.src = '/own-source/' + encodeURIComponent(source); await image.decode();
      // Cover crop around the focus point; Chromium applies EXIF orientation.
      const photo = canvas(), pc = photo.getContext('2d'), scale = Math.max(W / image.naturalWidth, H / image.naturalHeight);
      const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
      pc.imageSmoothingQuality = 'high'; pc.drawImage(image, (W - w) * focus[0], (H - h) * focus[1], w, h);
      const thumb = canvas(512, 288), tc = thumb.getContext('2d'); tc.imageSmoothingQuality = 'high'; tc.drawImage(photo, 0, 0, 512, 288);
      const files = window.cleanFrameMaterials(photo, null).files;
      files[''] = photo.toDataURL('image/jpeg', .9).split(',')[1];
      files.thumb = thumb.toDataURL('image/jpeg', .85).split(',')[1];

      // Offline foreground metadata, calibrated against the reviewed gallery.
      const d = pc.getImageData(0, 0, W, H).data;
      const linear = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
      const zone = (x0, y0, x1, y1) => {
        const values = [];
        for (let y = y0; y < y1; y += 4) for (let x = x0; x < x1; x += 4) { const i = (y * W + x) * 4; values.push(.2126 * linear(d[i]) + .7152 * linear(d[i + 1]) + .0722 * linear(d[i + 2])); }
        values.sort((a, b) => a - b);
        return { mean: values.reduce((a, b) => a + b, 0) / values.length, p90: values[Math.floor(values.length * .9)] };
      };
      const all = zone(0, 0, W, H), tl = zone(100, 50, 760, 220), tr = zone(1150, 50, 1820, 270), br = zone(1480, 760, 1820, 980), col = zone(112, 160, 1040, 980);
      const ink = z => z.mean < .1 ? 'light' : 'mist';
      const look = {
        tone: all.mean > .25 ? 'light' : 'dark', ut: { tr: ink(tr), br: ink(br) },
        frostVeil: all.p90 >= .8 ? .44 : all.p90 >= .76 ? .36 : all.mean >= .2 ? .2 : .12,
        listColumn: col.mean >= .3 ? 3 : col.mean >= .25 ? 2 : 0, dockQuiet: false, clockMist: tl.mean > .35
      };
      return { files, look };
    }, photo);
    const names = { '': 'assets/wallpapers/' + photo.id + '.jpg', thumb: 'assets/wallpapers/' + photo.id + '-thumb.jpg', panel: 'assets/wallpapers/' + photo.id + '-panel.jpg' };
    for (const [suffix, base64] of Object.entries(result.files)) {
      const name = names[suffix] || 'assets/materials/' + photo.id + '-' + suffix + '.jpg';
      writeFileSync(build + name, Buffer.from(base64, 'base64')); files.push(name);
    }
    const look = { ...result.look };
    for (const key of LOOK_KEYS) if (photo.look[key] !== undefined) look[key] = photo.look[key];
    entries.push(photo.entry = { id: photo.id, name: photo.name, src: names[''], thumb: names.thumb, ...look });
    console.log(photo.source + ' -> ' + photo.id + ' (' + photo.name + ')');
  }
  if (errors.length) throw Error(errors.join('\n'));
} finally { await preview.close(); }

writeFileSync(build + 'manifest.json', JSON.stringify({
  built: new Date().toISOString(), hideBundled, files,
  photos: photos.map(({ id, source, sourceBytes, sourceMtime, entry }) => ({ id, source, sourceBytes, sourceMtime, entry }))
}, null, 2) + '\n');
const bytes = files.reduce((sum, name) => sum + statSync(build + name).size, 0);
console.log(photos.length + ' photo(s), ' + (bytes / 1048576).toFixed(1) + ' MB in .local/photos/build');
if (!photos.length) process.exit(0);

// Preview sheet: each photo in List and Dock, rendered by the real app with this build.
preview = await openPreview({ ownPhotos: true });
try {
  const shots = [];
  for (const photo of photos) for (const layout of ['list', 'dock']) {
    const page = await preview.browser.newPage({ viewport: { width: 960, height: 540 } });
    await page.addInitScript(([wall, layout]) => {
      if (!sessionStorage.getItem('seeded')) { localStorage.setItem('cleanframe.home.v1', JSON.stringify({ look: { bg: 'photo', wall, layout }, wallpaper: wall })); sessionStorage.setItem('seeded', '1'); }
    }, [photo.id, layout]);
    await page.goto(preview.baseURL + '/home/');
    await page.waitForFunction(() => window.ShoreQA && ShoreQA.ready && ShoreQA.ready(), null, { timeout: 15000 });
    await page.waitForTimeout(400);
    shots.push({ label: photo.name + ' · ' + layout, png: (await page.screenshot()).toString('base64') });
    await page.close();
  }
  const page = await preview.browser.newPage();
  const sheet = await page.evaluate(async shots => {
    const cw = 960, ch = 540, gap = 24, label = 40, rows = shots.length / 2;
    const canvas = Object.assign(document.createElement('canvas'), { width: 2 * cw + 3 * gap, height: rows * (ch + label + gap) + gap }), c = canvas.getContext('2d');
    c.fillStyle = '#111'; c.fillRect(0, 0, canvas.width, canvas.height); c.font = '500 24px sans-serif'; c.fillStyle = '#eee';
    for (let i = 0; i < shots.length; i++) {
      const image = new Image(); image.src = 'data:image/png;base64,' + shots[i].png; await image.decode();
      const x = gap + (i % 2) * (cw + gap), y = gap + Math.floor(i / 2) * (ch + label + gap);
      c.fillText(shots[i].label, x, y + 28); c.drawImage(image, x, y + label);
    }
    return canvas.toDataURL('image/jpeg', .85).split(',')[1];
  }, shots);
  writeFileSync(build + 'preview-sheet.jpg', Buffer.from(sheet, 'base64'));
  console.log('Review .local/photos/build/preview-sheet.jpg before packaging.');
} finally { await preview.close(); }
