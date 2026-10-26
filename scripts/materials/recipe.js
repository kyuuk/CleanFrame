// Development-time material recipe shared by build-materials.mjs and own-photos.mjs.
// Takes the registered 1920 x 1080 photo canvas; returns base64 JPEGs and the Soft tint.
window.cleanFrameMaterials = function (photo, fixedTint) {
  const W = 1920, H = 1080, P = 96;
  const canvas = (w = W, h = H) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  const padded = canvas(W + 2 * P, H + 2 * P), pad = padded.getContext('2d');
  for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
    pad.save(); pad.translate(P + (x === 1 ? 2 * W : 0), P + (y === 1 ? 2 * H : 0));
    pad.scale(x === 0 ? 1 : -1, y === 0 ? 1 : -1); pad.drawImage(photo, 0, 0); pad.restore();
  }
  const linear = Array.from({ length: 256 }, (_, v) => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
  const encode = v => 255 * (v <= .0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - .055);
  const files = {};
  let frost;
  for (const [suffix, blur, saturation, quality] of [['field-blur', 28, .92, .82], ['field-frost', 42, .92, .82], ['field-clear', 2, 1.06, .86]]) {
    const filtered = canvas(W + 2 * P, H + 2 * P), fc = filtered.getContext('2d');
    fc.filter = 'blur(' + blur + 'px) saturate(' + saturation + ')'; fc.drawImage(padded, 0, 0);
    const output = canvas(), out = output.getContext('2d'); out.drawImage(filtered, P, P, W, H, 0, 0, W, H);
    if (suffix !== 'field-clear') {
      const pixels = out.getImageData(0, 0, W, H), data = pixels.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = linear[data[i]], g = linear[data[i + 1]], b = linear[data[i + 2]], l = .2126 * r + .7152 * g + .0722 * b;
        if (l > .82) { const ratio = (.82 + .4 * (l - .82)) / l; data[i] = encode(r * ratio); data[i + 1] = encode(g * ratio); data[i + 2] = encode(b * ratio); }
        data[i + 3] = 255;
      }
      out.putImageData(pixels, 0, 0);
    }
    files[suffix] = output.toDataURL('image/jpeg', quality).split(',')[1];
    if (suffix === 'field-frost') frost = output;
  }
  const panel = canvas(320, 180); panel.getContext('2d').drawImage(frost, 0, 0, 320, 180);
  files.panel = panel.toDataURL('image/jpeg', .85).split(',')[1];

  // Soft keeps the reviewed low-detail, darker dock material. New images use
  // the same recipe with a bounded density selected from the dock band.
  const base = canvas(), bc = base.getContext('2d'); bc.drawImage(photo, 0, 0);
  const scrim = bc.createLinearGradient(0, 560, 0, H);
  scrim.addColorStop(0, 'rgba(4,10,12,0)'); scrim.addColorStop(.7, 'rgba(4,10,12,.42)'); scrim.addColorStop(1, 'rgba(4,10,12,.52)');
  bc.fillStyle = scrim; bc.fillRect(0, 560, W, 520);
  const soft = canvas(), sc = soft.getContext('2d'); sc.filter = 'blur(14px) saturate(1.12)'; sc.drawImage(base, 0, 0); sc.filter = 'none';
  const pixels = sc.getImageData(0, 0, W, H), d = pixels.data, mean = [0, 0, 0]; let count = 0;
  for (let y = 676; y < 908; y++) for (let x = 96; x < 1824; x++) { const i = (y * W + x) * 4; for (let k = 0; k < 3; k++) mean[k] += d[i + k]; count++; }
  for (let k = 0; k < 3; k++) mean[k] /= count;
  const lumas = [];
  for (let i = 0; i < d.length; i += 4) {
    for (let k = 0; k < 3; k++) d[i + k] = d[i + k] * .65 + mean[k] * .35;
    d[i + 3] = 255;
  }
  for (let y = 720; y < 908; y += 4) for (let x = 112; x < 1808; x += 4) { const i = (y * W + x) * 4; lumas.push(.2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2]); }
  lumas.sort((a, b) => a - b);
  const high = lumas[Math.floor(lumas.length * .95)];
  const tint = fixedTint == null ? Math.max(.28, Math.min(.6, (high - 94) / (high - 8.87))) : fixedTint;
  sc.putImageData(pixels, 0, 0); sc.fillStyle = 'rgba(4,10,12,' + tint + ')'; sc.fillRect(0, 0, W, H);
  files['study-soft'] = soft.toDataURL('image/jpeg', .94).split(',')[1];
  return { files, tint };
};
