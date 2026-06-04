// mcp/examples/draw-husky-dawn.mjs
// Drives the live Piskel via the piskel-mcp bridge to paint a husky at dawn,
// then saves a .piskel and exports a PNG. Run: node mcp/examples/draw-husky-dawn.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as bridge from "../dist/piskel-bridge.js";
import { shutdown } from "../dist/browser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "..", "examples");
const W = 32;
const H = 32;

// ---- palette ----
const C = {
  D: "#3A3F47", // dark fur (mask/cap/ears)
  G: "#6B7178", // mid gray fur
  W: "#F4F7FA", // white fur
  I: "#262A30", // inner ear
  E: "#74D2EE", // ice-blue eye
  P: "#15323F", // pupil
  N: "#141414", // nose
  m: "#2A2D33" // mouth
};

// ---- husky head, designed as a 16-wide LEFT half then mirrored for symmetry ----
const HALF = [
  "................", // 0
  "................", // 1
  ".......D........", // 2  ear tip
  "......DDD.......", // 3
  "......DID.......", // 4
  ".....DDIDD......", // 5
  ".....DDIDD......", // 6
  "....DDDIIDD.....", // 7
  "....DDDIIDD.....", // 8
  "....DDDDDD..DDDD", // 9  ear base + forehead
  "..DDDDDDDDDDDDDD", // 10 dark cap
  ".......DDDDDDDWW", // 11 blaze starts (WW at centre)
  "......DDDDDDDDWW", // 12
  ".....DDDDDDDDDWW", // 13
  "....DDDDWWDDDDWW", // 14 white brow spots
  "....DDDDDEPEDDWW", // 15 eye
  "....DDDDDEPEDDWW", // 16 eye
  "....DDDGWWWWWGWW", // 17 muzzle opens
  ".....DDGWWWWWWWW", // 18
  ".....GGWWWWWWWWW", // 19
  "......GGWWWWWWWW", // 20
  ".......GWWWWWWWW", // 21
  "........WWWWWWNN", // 22 nose top
  ".........WWWWWWN", // 23 nose tip
  ".........WWWWWWm", // 24 philtrum
  ".........WWWmWWW", // 25 subtle mouth corner
  "..........WWWWWW", // 26
  "...........WWWWW", // 27
  "............GGGG", // 28 chin shadow
  "................", // 29
  "................", // 30
  "................" // 31
];

function buildHuskyPixels() {
  const px = [];
  for (let y = 0; y < H; y++) {
    const left = HALF[y];
    const full = left + left.split("").reverse().join(""); // mirror -> 32 wide
    for (let x = 0; x < W; x++) {
      const ch = full[x];
      if (ch === "." || ch === undefined) {
        continue;
      }
      const color = C[ch];
      if (color) {
        px.push({ x, y, color });
      }
    }
  }
  return px;
}

// ---- dawn sky + sun + snow background (full 32x32, opaque, behind the husky) ----
function skyBand(y) {
  if (y <= 2) {
    return "#1E2348"; // deep pre-dawn blue
  }
  if (y <= 5) {
    return "#33285A"; // indigo
  }
  if (y <= 8) {
    return "#5E3A6E"; // violet
  }
  if (y <= 11) {
    return "#934C79"; // mauve
  }
  if (y <= 14) {
    return "#CB5E6E"; // rose
  }
  if (y <= 17) {
    return "#EE7459"; // coral
  }
  if (y <= 20) {
    return "#F6A65C"; // amber
  }
  if (y <= 23) {
    return "#FAC77A"; // gold
  }
  return "#FBD89A"; // 24-26 pale warm horizon
}

const STARS = [
  [3, 3],
  [7, 1],
  [11, 4],
  [24, 2],
  [28, 5],
  [18, 2]
];

function buildBackgroundPixels() {
  const px = [];
  const starSet = new Set(STARS.map(([x, y]) => `${x},${y}`));
  const sun = { cx: 3, cy: 22, r: 5.8 }; // rising sun cresting behind the husky on the left
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let color;
      if (y >= 27) {
        color = y === 27 ? "#F6FAFE" : "#E9F0F8"; // snow, lighter top edge
        if ((x + y) % 7 === 0 && y > 28) {
          color = "#D7E2EF"; // faint snow texture
        }
      } else {
        color = skyBand(y);
        // sun disc near the horizon (rises behind the husky)
        const d = Math.hypot(x - sun.cx, y - sun.cy);
        if (d < 2.6) {
          color = "#FFF4CE";
        } else if (d < 4.0) {
          color = "#FFE391";
        } else if (d < sun.r) {
          color = "#FFC96E";
        }
        // a couple of stars in the deep sky
        if (y <= 6 && starSet.has(`${x},${y}`)) {
          color = "#CBD2F2";
        }
      }
      px.push({ x, y, color });
    }
  }
  return px;
}

async function main() {
  console.log("Opening Piskel (a browser window will appear)...");
  await bridge.newCanvas(W, H, "husky-dawn", 12);

  console.log("Painting the dawn sky + sun + snow on the base layer...");
  await bridge.applyPixels(buildBackgroundPixels());

  console.log("Adding a 'Husky' layer on top...");
  await bridge.callController("createLayer", ["Husky"]);
  const mid = await bridge.getCanvasInfo();
  await bridge.callController("setCurrentLayerIndex", [mid.layerCount - 1]);

  console.log("Drawing the husky...");
  await bridge.applyPixels(buildHuskyPixels());

  const info = await bridge.getCanvasInfo();
  console.log(
    `Canvas: ${info.width}x${info.height}, layers=${info.layerCount} (${info.layers
      .map((l) => l.name)
      .join(", ")})`
  );

  mkdirSync(OUT, { recursive: true });

  const piskel = await bridge.serializePiskel();
  writeFileSync(resolve(OUT, "husky-dawn.piskel"), piskel, "utf-8");
  console.log("Saved examples/husky-dawn.piskel");

  const pngB64 = await bridge.renderPng(12); // 32 * 12 = 384px
  writeFileSync(resolve(OUT, "husky-dawn.png"), Buffer.from(pngB64, "base64"));
  console.log("Exported examples/husky-dawn.png (384x384)");

  console.log("Leaving the window open for 25s so you can watch / inspect...");
  await new Promise((r) => setTimeout(r, 25000));
}

main()
  .catch((err) => {
    console.error("Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await shutdown();
    console.log("Done. Browser closed.");
  });
