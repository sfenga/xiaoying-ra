/**
 * Generate demo images (template covers, simulated result images, sample uploads)
 * as valid PNG files using only Node built-ins (zlib).
 *
 * Run: node scripts/generate-images.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outCovers = join(root, "backend/src/main/resources/demo/covers");
const outResults = join(root, "backend/src/main/resources/demo/results");
const outSamples = join(root, "docs/sample-uploads");
mkdirSync(outCovers, { recursive: true });
mkdirSync(outResults, { recursive: true });
mkdirSync(outSamples, { recursive: true });

// ---------- minimal PNG encoder ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function encodePng(width, height, pixels /* RGBA Buffer */) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- tiny canvas ----------
class Canvas {
  constructor(w, h, bg) {
    this.w = w;
    this.h = h;
    this.px = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      this.px[i * 4] = bg[0];
      this.px[i * 4 + 1] = bg[1];
      this.px[i * 4 + 2] = bg[2];
      this.px[i * 4 + 3] = 255;
    }
  }
  set(x, y, [r, g, b], a = 255) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const af = a / 255;
    this.px[i] = Math.round(r * af + this.px[i] * (1 - af));
    this.px[i + 1] = Math.round(g * af + this.px[i + 1] * (1 - af));
    this.px[i + 2] = Math.round(b * af + this.px[i + 2] * (1 - af));
    this.px[i + 3] = 255;
  }
  vGradient(stops) {
    // stops: [[pos, [r,g,b]], ...]
    for (let y = 0; y < this.h; y++) {
      const t = y / (this.h - 1);
      let a = stops[0], b = stops[stops.length - 1];
      for (let s = 0; s < stops.length - 1; s++) {
        if (t >= stops[s][0] && t <= stops[s + 1][0]) {
          a = stops[s]; b = stops[s + 1]; break;
        }
      }
      const f = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
      const c = a[1].map((v, i) => Math.round(v + (b[1][i] - v) * f));
      for (let x = 0; x < this.w; x++) this.set(x, y, c);
    }
  }
  rect(x0, y0, w, h, color, alpha = 255) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, color, alpha);
  }
  circle(cx, cy, r, color, alpha = 255) {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (d2 <= r * r) this.set(x, y, color, alpha);
      }
  }
  ring(cx, cy, r, w, color, alpha = 255) {
    for (let y = cy - r - w; y <= cy + r + w; y++)
      for (let x = cx - r - w; x <= cx + r + w; x++) {
        const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (d <= r + w && d >= r - w) this.set(x, y, color, alpha);
      }
  }
  triangle(p1, p2, p3, color, alpha = 255) {
    const minX = Math.min(p1[0], p2[0], p3[0]), maxX = Math.max(p1[0], p2[0], p3[0]);
    const minY = Math.min(p1[1], p2[1], p3[1]), maxY = Math.max(p1[1], p2[1], p3[1]);
    const sign = (a, b, c) => (a[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (a[1] - c[1]);
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const p = [x, y];
        const d1 = sign(p, p1, p2), d2 = sign(p, p2, p3), d3 = sign(p, p3, p1);
        const neg = d1 < 0 || d2 < 0 || d3 < 0;
        const pos = d1 > 0 || d2 > 0 || d3 > 0;
        if (!(neg && pos)) this.set(x, y, color, alpha);
      }
  }
  save(file) {
    writeFileSync(file, encodePng(this.w, this.h, this.px));
    console.log("wrote", file);
  }
}

const C = {
  dusk: [26, 27, 46], night: [15, 18, 32], cream: [247, 240, 227],
  coral: [255, 111, 97], gold: [250, 190, 88], teal: [64, 174, 170],
  navy: [40, 60, 100], sky: [125, 185, 222], white: [250, 250, 250],
  pink: [244, 143, 177], red: [214, 69, 65], green: [88, 178, 118],
  deepBlue: [30, 50, 90], sand: [232, 205, 163], leaf: [56, 118, 84],
  purple: [126, 87, 194], ice: [180, 215, 235],
};

// ---------- scenes ----------
function sceneSunset(cnv) {
  cnv.vGradient([[0, C.dusk], [0.55, [200, 100, 90]], [0.75, C.gold], [1, [255, 220, 150]]]);
  cnv.circle(cnv.w * 0.5, cnv.h * 0.72, cnv.w * 0.13, C.cream, 235);
  cnv.triangle([0, cnv.h], [cnv.w * 0.28, cnv.h * 0.58], [cnv.w * 0.55, cnv.h], [C.navy], 255);
  cnv.triangle([cnv.w * 0.35, cnv.h], [cnv.w * 0.68, cnv.h * 0.5], [cnv.w, cnv.h], [C.deepBlue], 255);
}
function sceneOcean(cnv) {
  cnv.vGradient([[0, C.sky], [0.6, C.ice], [0.6, [70, 140, 170]], [1, C.deepBlue]]);
  cnv.circle(cnv.w * 0.78, cnv.h * 0.3, cnv.w * 0.09, C.cream, 220);
  for (let i = 0; i < 5; i++)
    cnv.rect(0, cnv.h * (0.66 + i * 0.06), cnv.w, 2 + i * 2, C.white, 40 + i * 8);
  cnv.triangle([cnv.w * 0.05, cnv.h * 0.6], [cnv.w * 0.22, cnv.h * 0.34], [cnv.w * 0.4, cnv.h * 0.6], C.leaf, 230);
}
function sceneBloom(cnv) {
  cnv.vGradient([[0, [250, 235, 240]], [1, [230, 180, 200]]]);
  const petals = [[0.3, 0.35, C.coral], [0.62, 0.5, C.pink], [0.45, 0.68, C.purple], [0.75, 0.28, C.gold]];
  for (const [fx, fy, col] of petals) {
    cnv.circle(cnv.w * fx, cnv.h * fy, cnv.w * 0.14, col, 200);
    cnv.circle(cnv.w * fx, cnv.h * fy, cnv.w * 0.05, C.cream, 220);
  }
}
function sceneFestival(cnv) {
  cnv.vGradient([[0, C.red], [1, [120, 20, 30]]]);
  for (let i = 0; i < 6; i++) {
    const cx = cnv.w * (0.12 + 0.15 * i), cy = cnv.h * (0.2 + 0.1 * ((i * 7) % 3));
    cnv.circle(cx, cy, cnv.w * 0.055, C.gold);
    cnv.rect(cx - cnv.w * 0.02, cy + cnv.w * 0.05, cnv.w * 0.04, cnv.h * 0.05, C.gold);
  }
  cnv.rect(0, cnv.h * 0.82, cnv.w, cnv.h * 0.18, [90, 15, 25]);
}
function sceneWinter(cnv) {
  cnv.vGradient([[0, [170, 200, 230]], [1, [235, 244, 252]]]);
  cnv.triangle([0, cnv.h], [cnv.w * 0.5, cnv.h * 0.22], [cnv.w, cnv.h], [C.ice], 255);
  cnv.triangle([cnv.w * 0.3, cnv.h], [cnv.w * 0.62, cnv.h * 0.38], [cnv.w, cnv.h], [220, 232, 245], 255);
  cnv.triangle([cnv.w * 0.5, cnv.h * 0.22], [cnv.w * 0.42, cnv.h * 0.35], [cnv.w * 0.58, cnv.h * 0.35], C.white, 255);
  for (let i = 0; i < 40; i++) {
    const x = (i * 137) % cnv.w, y = (i * 89) % Math.floor(cnv.h * 0.5);
    cnv.circle(x, y, 2, C.white, 230);
  }
}
function scenePlayful(cnv) {
  cnv.vGradient([[0, [255, 244, 214]], [1, [255, 205, 148]]]);
  cnv.circle(cnv.w * 0.5, cnv.h * 0.45, cnv.w * 0.2, C.teal, 235);
  cnv.circle(cnv.w * 0.5, cnv.h * 0.38, cnv.w * 0.06, C.cream, 255);
  cnv.triangle([cnv.w * 0.5 - cnv.w * 0.07, cnv.h * 0.42], [cnv.w * 0.5 + cnv.w * 0.07, cnv.h * 0.42], [cnv.w * 0.5, cnv.h * 0.56], C.cream, 255);
  cnv.ring(cnv.w * 0.5, cnv.h * 0.45, cnv.w * 0.24, 4, C.coral, 220);
}
function sceneGrow(cnv) {
  cnv.vGradient([[0, [214, 236, 222]], [1, [150, 200, 170]]]);
  for (let i = 0; i < 3; i++) {
    const cx = cnv.w * (0.25 + 0.25 * i), r = cnv.w * (0.1 + i * 0.035);
    cnv.circle(cx, cnv.h * 0.5, r, C.white, 210);
    cnv.ring(cx, cnv.h * 0.5, r * 1.25, 3, C.green, 180);
  }
}

const SCENES = { sceneSunset, sceneOcean, sceneBloom, sceneFestival, sceneWinter, scenePlayful, sceneGrow };

// 1) template covers (portrait cards, like reference UI)
const covers = [
  ["demo-postcard", sceneSunset], ["demo-magazine", sceneOcean], ["demo-polaroid", sceneBloom],
  ["demo-birthday", sceneFestival], ["demo-lunar", sceneWinter], ["demo-growth", sceneGrow],
  ["demo-sky", scenePlayful],
];
for (const [name, scene] of covers) {
  const c = new Canvas(480, 600, C.dusk);
  scene(c);
  c.save(join(outCovers, `${name}.png`));
}

// 2) simulated results (landscape "final outputs")
const results = [
  ["postcard", sceneSunset], ["postcard-b", sceneOcean],
  ["magazine", sceneOcean], ["magazine-b", sceneBloom],
  ["polaroid", sceneBloom], ["polaroid-b", scenePlayful],
  ["birthday", sceneFestival], ["birthday-b", sceneSunset],
  ["lunar", sceneWinter], ["lunar-b", sceneFestival],
  ["growth", sceneGrow], ["growth-b", sceneBloom],
  ["sky", scenePlayful], ["sky-b", sceneOcean],
];
for (const [name, scene] of results) {
  const c = new Canvas(960, 640, C.night);
  scene(c);
  // white polaroid-style frame + bottom band to look like a finished artifact
  c.rect(24, 24, c.w - 48, c.h - 48, C.white, 40);
  c.ring(c.w / 2, c.h / 2, 0, 0, C.white, 0);
  c.save(join(outResults, `result-${name}.png`));
}

// 3) sample upload images (for manual testing)
const samples = [["trip-photo-a", sceneSunset], ["trip-photo-b", sceneOcean], ["family-photo", sceneGrow], ["pet-photo", scenePlayful]];
for (const [name, scene] of samples) {
  const c = new Canvas(640, 480, C.cream);
  scene(c);
  c.save(join(outSamples, `${name}.png`));
}
console.log("done");
