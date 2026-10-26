# Asset generation

The app includes all runtime JPEGs, thumbnails, registered material fields, public fonts and icons. A clone can preview the current app without the original Downloads folder or any generation step. Keep photo and icon credits and third-party licences with the assets. The private Pangram overlay is described in [development](development.md).

## Current List and Dock materials

The 0.6 runtime uses fifteen photographs. Each has a background, a thumbnail, a small panel backdrop and four full-stage material JPEGs. The runtime never generates blur or reads photo pixels. Generate selected materials with:

```sh
node scripts/build-materials.mjs summit,goldcoast,sydney,amber,mint,alpine
```

Omit the argument to regenerate every catalogue entry. Output goes to ignored `.local/materials/builder/`. Review it, then copy `*-panel.jpg` to `app/assets/wallpapers/` and the other four JPEGs to `app/assets/materials/`.

- `field-blur`: 28px blur, saturation .92, mirrored edge padding and highlight soft clipping.
- `field-frost`: the same registered crop with 42px blur.
- `field-clear`: 2px blur and saturation 1.06, with no baked veil.
- `study-soft`: the retained name for the reviewed Dock Soft recipe, including the lower scrim, 14px blur and compressed local variation. The original nine preserve their calibrated tint. New photos use a bounded tint selected from the dock band.

All fields use the centred 1920 x 1080 crop. The small panel backdrop comes from that same Frost field. The six new backgrounds use baseline sRGB JPEG at quality 90 with full chroma; thumbnails use quality 85. Their originals remain unchanged.

`app/assets/wallpapers/catalog.js` stores names and surface parameters; `app/assets/adaptive-ink.js` stores offline colour choices. New photographs need a rendered review of their List, Dock, clock, controls and all three materials before their metadata is accepted. An average image colour alone does not establish readable text.

## Icon metrics

`node scripts/build-icon-metrics.mjs` measures the SVGs in an aspect-preserved 240px viewport, matching the CSS mask renderer. Output is ignored `.local/materials/metrics.js`; review before copying it into `app/assets/icons/metrics.js`. The TV reads these bounds and does not scan icon pixels.

## New or replacement photographs

Full-size original photographs are local inputs and are not required for glass regeneration: the bundled 1920px JPEGs are the rendering inputs. To recreate JPEGs/thumbnails from the original supplied filenames on a Mac:

```sh
python3 scripts/prepare-wallpapers.py /path/to/originals --ids summit,goldcoast,sydney,amber,mint,alpine
```

The retained generator covers all fifteen filenames and writes `.local/materials/wallpapers/`. The original nine keep their macOS `sips` recipe. The new six require Pillow and use the reviewed centred crop and JPEG settings; Pillow is a development dependency only. Supply Golden Hour as `big-sur-golden-hour.jpg` in the originals folder. Install Pillow in a local Python environment when using the six newer photos.

For another photo, add its source/credit to `SOURCES.json`, prepare its background and thumbnail, add the gallery entry in `catalog.js`, generate the four registered materials and panel backdrop, then measure and review its foreground metadata. Keep the crop identical across all assets. Run source and browser checks before packaging.

## Your own photos

A personal build can add the owner's photos after the bundled gallery. They stay in ignored `.local/photos/` and are never committed or included in `npm run export:public`.

1. Put JPEG or PNG files in `.local/photos/`. The name shown in Settings comes from the filename: `lake-annecy.jpg` becomes Lake Annecy.
2. Optionally add a file with the same base name and `.json`, such as `lake-annecy.json`:
   ```json
   {"name": "Lake Annecy", "focus": [0.5, 0.3], "look": {"tone": "dark"}}
   ```
   `focus` moves the 16:9 crop (0 to 1 across and down; the default is the centre). `look` overrides any derived field: `tone`, `ut`, `frostVeil`, `listColumn`, `dockQuiet` or `clockMist`.
3. To show only your photos, create `.local/photos/cleanframe.json` with `{"hideBundled": true}`.
4. Run `npm run photos`. It crops each photo to 1920 x 1080, renders the thumbnail, panel backdrop and four registered materials with the same recipe as the bundled gallery (`scripts/materials/recipe.js`), and derives foreground metadata from zone brightness, calibrated against the reviewed gallery. Output goes to `.local/photos/build/`. It warns above 30 photos.
5. Review `.local/photos/build/preview-sheet.jpg`, which shows each photo in List and Dock, and adjust `focus` or `look` if text is hard to read.

`npm run dev` and `npm run package` then include the build. Packaging stops if `.local/photos` changed since the last `npm run photos`, or if `hideBundled` is set without photos. Browser checks, `npm run dev:public` and the public export always use only the bundled gallery. Own photos have no adaptive-ink palette; they use the derived `ut` foreground choices.

Source pages and licence observations are recorded in [asset sources](asset-sources.md).
