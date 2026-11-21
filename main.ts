// The World in One Day — 21 November 2026
// A deterministic program (Node standard library only, no network) that
// draws a 1024x1024 PNG newspaper front page summing up the world news of
// Saturday 21 November 2026: seven real stories, researched that morning.
// Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The program writes entry.png into MAKEFUN_OUTPUT_DIR (default "out").
// Two runs produce byte-identical output.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// 5x7 bitmap font, uppercase only. Each glyph is 7 rows of 5 cells:
// "#" is ink, "." is empty. Newspaper copy is set in capitals throughout.
// ---------------------------------------------------------------------------
const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "..##.", ".#...", "#....", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", "..#..", ".#..."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", "..#..", ".#..."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "/": ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."],
  "%": ["##..#", "##.#.", "....#", "...#.", "..#..", ".#...", "#..##"],
  $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": ["#....", "..#..", "...#.", "...#.", "...#.", "..#..", "#...."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
};

// ---------------------------------------------------------------------------
// Canvas: a plain RGB pixel buffer, 1024 by 1024.
// ---------------------------------------------------------------------------
const W = 1024;
const H = 1024;
const PAPER: [number, number, number] = [247, 242, 231];
const INK: [number, number, number] = [20, 20, 20];
const RED: [number, number, number] = [163, 18, 18];
const BLUE: [number, number, number] = [28, 61, 110];
const PANEL: [number, number, number] = [24, 42, 74];
const PANEL_LINE: [number, number, number] = [120, 150, 195];
const PANEL_TEXT: [number, number, number] = [235, 238, 244];
const GREY: [number, number, number] = [96, 92, 84];

type RGB = [number, number, number];
const px = new Uint8Array(W * H * 3);

function fillAll(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0];
    px[i * 3 + 1] = c[1];
    px[i * 3 + 2] = c[2];
  }
}

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPixel(xx, yy, c);
  }
}

function hRule(x: number, y: number, w: number, thick: number, c: RGB): void {
  fillRect(x, y, w, thick, c);
}

function vRule(x: number, y: number, h: number, thick: number, c: RGB): void {
  fillRect(x, y, thick, h, c);
}

// Bresenham line, for the starburst and map ticks.
function drawLine(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPixel(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function drawCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -half; x <= half; x++) setPixel(cx + x, cy + y, c);
  }
}

function drawRing(cx: number, cy: number, r: number, thick: number, c: RGB): void {
  for (let y = -r - thick; y <= r + thick; y++) {
    for (let x = -r - thick; x <= r + thick; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d <= r + thick && d >= r - thick) setPixel(cx + x, cy + y, c);
    }
  }
}

// Four-pointed star, drawn with straight spokes.
function drawStar(cx: number, cy: number, r: number, c: RGB): void {
  drawLine(cx - r, cy, cx + r, cy, c);
  drawLine(cx, cy - r, cx, cy + r, c);
  drawLine(cx - r, cy - r, cx + r, cy + r, c);
  drawLine(cx - r, cy + r, cx + r, cy - r, c);
  drawCircle(cx, cy, Math.max(2, Math.floor(r / 4)), c);
}

// ---------------------------------------------------------------------------
// Text: draw one glyph, measure a string, draw a string, wrap a paragraph.
// A glyph is 5 cells wide plus 1 cell of spacing; scale s makes each cell
// an s-by-s block. Unknown characters render as a blank.
// ---------------------------------------------------------------------------
function glyphOf(ch: string): string[] {
  return FONT[ch] ?? FONT[" "];
}

function textWidth(s: string, scale: number): number {
  if (s.length === 0) return 0;
  return s.length * 6 * scale - scale;
}

function drawText(s: string, x: number, y: number, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s) {
    const g = glyphOf(ch);
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row][col] === "#") {
          fillRect(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}

function drawTextCentred(s: string, cx: number, y: number, scale: number, c: RGB): void {
  drawText(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c);
}

function wrapText(s: string, scale: number, maxW: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const trial = cur === "" ? word : cur + " " + word;
    if (textWidth(trial, scale) <= maxW) {
      cur = trial;
    } else {
      if (cur !== "") lines.push(cur);
      // A single over-long word is split by characters.
      if (textWidth(word, scale) > maxW) {
        let part = "";
        for (const ch of word) {
          if (textWidth(part + ch, scale) <= maxW) part += ch;
          else {
            lines.push(part);
            part = ch;
          }
        }
        cur = part;
      } else {
        cur = word;
      }
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

function drawPara(lines: string[], x: number, y: number, scale: number, c: RGB, lh: number): void {
  for (let i = 0; i < lines.length; i++) {
    drawText(lines[i], x, y + i * lh, scale, c);
  }
}

// ---------------------------------------------------------------------------
// Layout: a newspaper front page, 1024 by 1024.
// ---------------------------------------------------------------------------
function drawStory(
  x: number,
  y: number,
  w: number,
  kicker: string,
  head1: string,
  head2: string,
  deck: string,
): void {
  drawText(kicker, x, y, 2, RED);
  drawText(head1, x, y + 24, 3, INK);
  drawText(head2, x, y + 50, 3, INK);
  const lines = wrapText(deck, 2, w);
  drawPara(lines, x, y + 80, 2, INK, 18);
}

function drawPage(): void {
  fillAll(PAPER);

  // Double border frame.
  fillRect(14, 14, W - 28, 3, INK);
  fillRect(14, H - 17, W - 28, 3, INK);
  fillRect(14, 14, 3, H - 28, INK);
  fillRect(W - 17, 14, 3, H - 28, INK);
  fillRect(24, 24, W - 48, 1, INK);
  fillRect(24, H - 25, W - 48, 1, INK);
  fillRect(24, 24, 1, H - 48, INK);
  fillRect(W - 25, 24, 1, H - 48, INK);

  // Masthead.
  drawTextCentred("THE WORLD IN ONE DAY", 512, 48, 7, INK);
  hRule(36, 112, 952, 1, INK);
  drawTextCentred("SATURDAY, 21 NOVEMBER 2026", 512, 124, 3, INK);
  drawTextCentred("SEVEN STORIES FROM TODAY IN THE WORLD", 512, 152, 2, GREY);
  hRule(36, 178, 952, 5, INK);
  hRule(36, 188, 952, 1, INK);

  // Lead story: Russian missile lands in Poland.
  drawText("WAR IN EUROPE - POLAND", 36, 204, 2, RED);
  drawText("RUSSIAN MISSILE", 36, 232, 6, INK);
  drawText("LANDS IN POLAND", 36, 282, 6, INK);
  const leadDeck = wrapText(
    "TUSK CALLS THE KH-101 STRIKE AN 'INTENTIONAL PROVOCATION' AS MOSCOW " +
      "FIRES 400 DRONES AND 110 MISSILES AT UKRAINE - ONE OF THE WAR'S " +
      "BIGGEST BARRAGES. AT LEAST EIGHT PEOPLE WERE KILLED.",
    2,
    570,
  );
  drawPara(leadDeck, 36, 340, 2, INK, 18);
  const leadNote = wrapText(
    "NATO CHIEF RUTTE CALLS IT A GRAVE VIOLATION AND HEADS TO WARSAW ON SATURDAY.",
    2,
    570,
  );
  drawPara(leadNote, 36, 340 + leadDeck.length * 18 + 10, 2, GREY, 18);

  // Lead graphic: night panel with the blast rings over the impact point.
  fillRect(630, 204, 358, 232, PANEL);
  drawRing(790, 295, 78, 2, PANEL_LINE);
  drawRing(790, 295, 52, 2, PANEL_LINE);
  drawRing(790, 295, 26, 2, PANEL_LINE);
  drawStar(790, 295, 12, RED);
  drawCircle(705, 368, 4, PANEL_TEXT);
  drawText("KYIV", 688, 380, 1, PANEL_TEXT);
  drawCircle(672, 340, 4, PANEL_TEXT);
  drawText("LVIV", 656, 352, 1, PANEL_TEXT);
  drawCircle(905, 245, 4, PANEL_TEXT);
  drawText("WARSAW", 905, 232, 1, PANEL_TEXT);
  drawTextCentred("NOWY LIPOWIEC, POLAND", 809, 404, 2, PANEL_TEXT);
  drawTextCentred("50 KM FROM UKRAINE", 809, 422, 2, PANEL_TEXT);

  // Divider above the grid.
  hRule(36, 496, 952, 3, INK);
  hRule(36, 503, 952, 1, INK);

  // Six more stories, two columns by three rows.
  drawStory(
    36, 522, 458,
    "MARKETS",
    "WALL STREET PLUNGES",
    "AS AI RALLY UNRAVELS",
    "NASDAQ FALLS 5.28% AND NVIDIA DROPS ABOUT 14% IN THE WEEK'S ROUT. THE DOW SHEDS NEARLY 950 POINTS.",
  );
  drawStory(
    530, 522, 458,
    "WEATHER",
    "CYCLONE AKVAN SLAMS",
    "INTO ODISHA COAST",
    "THE STORM CROSSES NEAR GOPALPUR WITH GUSTS TO 145 KM/H AS HEAVY RAIN LASHES ODISHA AND ANDHRA PRADESH.",
  );
  drawStory(
    36, 654, 458,
    "BRAZIL",
    "BOLSONARO RUSHED",
    "TO HOSPITAL",
    "THE JAILED EX-PRESIDENT, 71, IS TREATED FOR SEVERE ABDOMINAL PAIN LINKED TO HIS 2018 STABBING.",
  );
  drawStory(
    530, 654, 458,
    "GAMES",
    "GTA VI SMASHES RECORD",
    "WITH $3.79BN DAY ONE",
    "ROCKSTAR SAYS THE SEQUEL TOOK $3.79 BILLION IN FIRST-DAY RETAIL SALES, A RECORD FOR THE SERIES.",
  );
  drawStory(
    36, 786, 458,
    "CLIMATE",
    "COP31 TALKS ENTER",
    "FINAL STRETCH",
    "NEGOTIATORS IN ANTALYA RACE TO CLOSE A DEAL ON FOSSIL FUELS AND CLIMATE FINANCE AS THE SUMMIT NEARS ITS END.",
  );
  drawStory(
    530, 786, 458,
    "PAKISTAN",
    "SUICIDE BLAST KILLS",
    "FIVE AT CHECKPOINT",
    "A CAR BOMB AT A SECURITY POST KILLS FIVE AND WOUNDS 13, THE LATEST ATTACK ON PAKISTAN'S SECURITY FORCES.",
  );

  // Footer.
  hRule(36, 928, 952, 1, INK);
  drawTextCentred("COMPILED ON 21 NOVEMBER 2026 - SEVEN STORIES - MAKE.FUN", 512, 946, 2, GREY);
}

// ---------------------------------------------------------------------------
// PNG encoding: truecolour, no filtering, zlib level 9. Fully deterministic.
// ---------------------------------------------------------------------------
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crc = crc32(out.subarray(4, 8 + data.length));
  view.setUint32(8 + data.length, crc);
  return out;
}

function encodePng(): Uint8Array {
  const raw = new Uint8Array(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = new Uint8Array(13);
  const iv = new DataView(ihdr.buffer);
  iv.setUint32(0, W);
  iv.setUint32(4, H);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const parts: Uint8Array[] = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main: draw the page, write entry.png into the output directory.
// ---------------------------------------------------------------------------
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "out";
drawPage();
const png = encodePng();
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "entry.png"), png);
console.log(`wrote ${join(outDir, "entry.png")} (${png.length} bytes, ${W}x${H})`);
