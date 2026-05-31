import { createCanvas, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import path from "node:path";
import fs from "node:fs";

const WIDTH = 800;
const HEIGHT = 360;

const FONT_FAMILY = "TimerSans";
let fontRegistered = false;

function ensureFontRegistered(): void {
  if (fontRegistered) return;
  const candidates = [
    path.join(process.cwd(), "fonts", "DejaVuSans-Bold.ttf"),
    path.join(process.cwd(), "dist", "fonts", "DejaVuSans-Bold.ttf"),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        GlobalFonts.registerFromPath(p, FONT_FAMILY);
        fontRegistered = true;
        return;
      }
    } catch {
      /* try next */
    }
  }
  fontRegistered = true;
}

function formatTime(totalSeconds: number): string {
  const raw = Math.max(0, Math.floor(totalSeconds));
  const safe = Math.floor(raw / 30) * 30;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mm = minutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export type TimerStyle = "random" | "hellokitty" | "kuromie";

export interface ColorPair {
  accent: string;
  accentSoft: string;
}

export const RANDOM_PALETTE: ColorPair[] = [
  { accent: "#ff2bd6", accentSoft: "#a21caf" },
  { accent: "#22d3ee", accentSoft: "#06b6d4" },
  { accent: "#a3ff12", accentSoft: "#65a30d" },
  { accent: "#ffeb3b", accentSoft: "#ca8a04" },
  { accent: "#ff6b35", accentSoft: "#c2410c" },
  { accent: "#b14eff", accentSoft: "#7e22ce" },
  { accent: "#ff3366", accentSoft: "#be123c" },
  { accent: "#4ad9ff", accentSoft: "#0284c7" },
];

export interface TimerImageOptions {
  remainingSeconds: number;
  phase: "study" | "break";
  style: TimerStyle;
  paletteIndex?: number;
  rotate?: boolean;
  cycleIndex?: number;
}

export function renderTimerImage(opts: TimerImageOptions): Buffer {
  ensureFontRegistered();

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  let effectiveStyle: TimerStyle = opts.style;
  if (opts.rotate) {
    const idx = (opts.paletteIndex ?? 0) % 3;
    effectiveStyle = idx === 0 ? "random" : idx === 1 ? "hellokitty" : "kuromie";
  }

  if (effectiveStyle === "hellokitty") {
    renderHelloKitty(ctx, opts);
  } else if (effectiveStyle === "kuromie") {
    renderKuromie(ctx, opts);
  } else {
    renderNeon(ctx, opts);
  }

  return canvas.toBuffer("image/png");
}

// ---------------- NEON / RANDOM STYLE ----------------

function renderNeon(ctx: SKRSContext2D, opts: TimerImageOptions): void {
  const isBreak = opts.phase === "break";
  let accent: string;
  let accentSoft: string;
  if (isBreak) {
    accent = "#22d3ee";
    accentSoft = "#06b6d4";
  } else {
    const idx = (opts.paletteIndex ?? 0) % RANDOM_PALETTE.length;
    accent = RANDOM_PALETTE[idx]!.accent;
    accentSoft = RANDOM_PALETTE[idx]!.accentSoft;
  }

  // Dark background
  ctx.fillStyle = "#0d0d0d";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;

  // Grid lines
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.07;
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x <= WIDTH; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= HEIGHT; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  ctx.restore();

  // Horizontal glow bar across the middle
  ctx.save();
  const bar = ctx.createLinearGradient(0, cy, WIDTH, cy);
  bar.addColorStop(0, "transparent");
  bar.addColorStop(0.2, accentSoft);
  bar.addColorStop(0.5, accent);
  bar.addColorStop(0.8, accentSoft);
  bar.addColorStop(1, "transparent");
  ctx.fillStyle = bar;
  ctx.globalAlpha = 0.18;
  ctx.fillRect(0, cy - 2, WIDTH, 4);
  ctx.globalAlpha = 0.08;
  ctx.fillRect(0, cy - 18, WIDTH, 36);
  ctx.restore();

  // Top & bottom accent lines
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.7;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(WIDTH, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, HEIGHT); ctx.lineTo(WIDTH, HEIGHT); ctx.stroke();
  ctx.restore();

  // Header — "STUDY MODE" / "BREAK MODE"
  ctx.save();
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 14;
  ctx.globalAlpha = 0.9;
  ctx.font = `bold 28px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(isBreak ? "✦ BREAK MODE ✦" : "✦ STUDY MODE ✦", cx, 48);
  ctx.restore();

  // Time text
  const timeText = formatTime(opts.remainingSeconds);
  ctx.save();
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 40;
  ctx.font = `bold 140px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(timeText, cx, cy + 8);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.12;
  ctx.fillText(timeText, cx, cy + 8);
  ctx.restore();

  // Bottom — "CYCLE X"
  const cycle = opts.cycleIndex ?? 1;
  ctx.save();
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.75;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 8;
  ctx.font = `bold 22px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`CYCLE ${cycle}`, cx, HEIGHT - 36);
  ctx.restore();
}

// ---------------- HELLO KITTY STYLE ----------------

function renderHelloKitty(ctx: SKRSContext2D, opts: TimerImageOptions): void {
  const isBreak = opts.phase === "break";

  // background: soft pink stripes
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, "#ffe0f0");
  bg.addColorStop(0.5, "#fff0f8");
  bg.addColorStop(1, "#ffd6ec");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // subtle polka dots
  drawPolkaDots(ctx);

  // Scattered hearts
  drawHearts(ctx);

  // Bows in the corners
  drawBow(ctx, 60, 60, 52);
  drawBow(ctx, WIDTH - 60, 60, 52);
  drawBow(ctx, 60, HEIGHT - 60, 38);
  drawBow(ctx, WIDTH - 60, HEIGHT - 60, 38);

  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;

  // Kitty faces on sides
  drawKittyFace(ctx, 108, cy + 20, 72);
  drawKittyFace(ctx, WIDTH - 108, cy + 20, 72);

  // Decorative top border
  ctx.save();
  ctx.fillStyle = "#ff5da8";
  ctx.fillRect(0, 0, WIDTH, 8);
  ctx.fillRect(0, HEIGHT - 8, WIDTH, 8);
  ctx.restore();

  // Header
  ctx.save();
  ctx.fillStyle = "#c2185b";
  ctx.shadowColor = "#ff85b3";
  ctx.shadowBlur = 8;
  ctx.font = `bold 26px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("♡ HELLO KITTY TIMER ♡", cx, 42);
  ctx.restore();

  // Star sparkles near header
  drawSparkles(ctx, cx, 42);

  // Time text with soft drop shadow
  const timeText = formatTime(opts.remainingSeconds);
  ctx.save();
  // shadow
  ctx.fillStyle = "#ffb3d1";
  ctx.font = `bold 128px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(timeText, cx + 4, cy + 14);
  // main color
  ctx.fillStyle = "#e91e63";
  ctx.fillText(timeText, cx, cy + 10);
  // highlight
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.3;
  ctx.fillText(timeText, cx - 2, cy + 6);
  ctx.restore();

  // Phase label
  ctx.save();
  ctx.fillStyle = "#880e4f";
  ctx.font = `bold 20px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    isBreak ? "♡ BREAK TIME ♡" : "♡ FOCUS TIME ♡",
    cx - 50,
    HEIGHT - 30,
  );
  ctx.restore();

  // Cycle label
  ctx.save();
  ctx.fillStyle = "#880e4f";
  ctx.globalAlpha = 0.7;
  ctx.font = `bold 18px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`CYCLE ${opts.cycleIndex ?? 1}`, cx + 120, HEIGHT - 30);
  ctx.restore();
}

function drawPolkaDots(ctx: SKRSContext2D): void {
  const dots = [
    { x: 30, y: 30, r: 6 }, { x: 200, y: 15, r: 5 }, { x: 400, y: 20, r: 7 },
    { x: 600, y: 10, r: 5 }, { x: 760, y: 35, r: 6 }, { x: 25, y: 180, r: 5 },
    { x: 775, y: 200, r: 6 }, { x: 20, y: 330, r: 7 }, { x: 790, y: 320, r: 5 },
    { x: 350, y: 340, r: 5 }, { x: 500, y: 345, r: 6 }, { x: 150, y: 350, r: 5 },
  ];
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#ff5da8";
  for (const d of dots) {
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSparkles(ctx: SKRSContext2D, cx: number, cy: number): void {
  const positions = [cx - 230, cx + 230];
  ctx.save();
  ctx.fillStyle = "#ff5da8";
  ctx.font = "16px sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  for (const x of positions) {
    ctx.fillText("✦", x, cy);
  }
  ctx.restore();
}

function drawHearts(ctx: SKRSContext2D): void {
  const hearts = [
    { x: 50, y: 190, s: 14, a: 0.4 },
    { x: 155, y: 265, s: 18, a: 0.35 },
    { x: 230, y: 120, s: 12, a: 0.4 },
    { x: 370, y: 85, s: 16, a: 0.3 },
    { x: 555, y: 265, s: 20, a: 0.35 },
    { x: 645, y: 145, s: 14, a: 0.4 },
    { x: 725, y: 235, s: 12, a: 0.4 },
    { x: 475, y: 300, s: 16, a: 0.3 },
    { x: 310, y: 310, s: 10, a: 0.35 },
  ];
  for (const h of hearts) {
    ctx.save();
    ctx.globalAlpha = h.a;
    ctx.fillStyle = "#ff5da8";
    drawHeart(ctx, h.x, h.y, h.s);
    ctx.restore();
  }
}

function drawHeart(ctx: SKRSContext2D, x: number, y: number, size: number): void {
  ctx.beginPath();
  const k = size;
  ctx.moveTo(x, y + k * 0.3);
  ctx.bezierCurveTo(x, y, x - k, y, x - k, y + k * 0.5);
  ctx.bezierCurveTo(x - k, y + k * 0.9, x, y + k * 1.1, x, y + k * 1.4);
  ctx.bezierCurveTo(x, y + k * 1.1, x + k, y + k * 0.9, x + k, y + k * 0.5);
  ctx.bezierCurveTo(x + k, y, x, y, x, y + k * 0.3);
  ctx.fill();
}

function drawBow(ctx: SKRSContext2D, x: number, y: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#ff5da8";
  ctx.beginPath();
  ctx.ellipse(-size * 0.45, 0, size * 0.45, size * 0.32, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(size * 0.45, 0, size * 0.45, size * 0.32, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e83e8c";
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.16, size * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawKittyFace(ctx: SKRSContext2D, x: number, y: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);

  // ears
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(-size * 0.6, -size * 0.3);
  ctx.lineTo(-size * 0.85, -size * 0.95);
  ctx.lineTo(-size * 0.25, -size * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(size * 0.6, -size * 0.3);
  ctx.lineTo(size * 0.85, -size * 0.95);
  ctx.lineTo(size * 0.25, -size * 0.55);
  ctx.closePath();
  ctx.fill();

  // inner ear pink
  ctx.fillStyle = "#ffb3d1";
  ctx.beginPath();
  ctx.moveTo(-size * 0.55, -size * 0.38);
  ctx.lineTo(-size * 0.75, -size * 0.82);
  ctx.lineTo(-size * 0.32, -size * 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(size * 0.55, -size * 0.38);
  ctx.lineTo(size * 0.75, -size * 0.82);
  ctx.lineTo(size * 0.32, -size * 0.58);
  ctx.closePath();
  ctx.fill();

  // head
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffb3d1";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.95, size * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // bow on left ear area
  drawBow(ctx, -size * 0.55, -size * 0.58, size * 0.52);

  // eyes (oval)
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.ellipse(-size * 0.3, size * 0.04, size * 0.08, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(size * 0.3, size * 0.04, size * 0.08, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  // eye shine
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(-size * 0.27, size * 0.0, size * 0.025, size * 0.035, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(size * 0.33, size * 0.0, size * 0.025, size * 0.035, 0, 0, Math.PI * 2);
  ctx.fill();

  // nose
  ctx.fillStyle = "#f5a623";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.26, size * 0.09, size * 0.065, 0, 0, Math.PI * 2);
  ctx.fill();

  // whiskers
  ctx.strokeStyle = "#aaa";
  ctx.lineWidth = 1.2;
  for (const dir of [-1, 1]) {
    for (const yo of [-0.03, 0.12, 0.27]) {
      ctx.beginPath();
      ctx.moveTo(dir * size * 0.42, size * (0.1 + yo));
      ctx.lineTo(dir * size * 0.95, size * (0.05 + yo));
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ---------------- KUROMIE STYLE (Sakura / Kimono) ----------------

function renderKuromie(ctx: SKRSContext2D, opts: TimerImageOptions): void {
  const isBreak = opts.phase === "break";
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;

  // Soft pink background — like the Kuromi sakura image
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, "#ffc8de");
  bg.addColorStop(0.5, "#ffdaea");
  bg.addColorStop(1, "#ffb8d4");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Large blurry sakura blossoms in background
  drawSakuraBg(ctx);

  // Small butterflies / hummingbirds scattered
  drawButterflies(ctx);

  // Decorative border — thin pink
  ctx.save();
  ctx.strokeStyle = "#e91e8c";
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.35;
  ctx.strokeRect(8, 8, WIDTH - 16, HEIGHT - 16);
  ctx.restore();

  // Decorative top/bottom bar
  ctx.save();
  ctx.fillStyle = "#e91e8c";
  ctx.globalAlpha = 0.3;
  ctx.fillRect(0, 0, WIDTH, 6);
  ctx.fillRect(0, HEIGHT - 6, WIDTH, 6);
  ctx.restore();

  // Header
  ctx.save();
  ctx.fillStyle = "#7b003c";
  ctx.font = `bold 26px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("✿ Girl Style Timer ✿", cx, 42);
  ctx.restore();

  // Time text — dark on pink
  const timeText = formatTime(opts.remainingSeconds);
  ctx.save();
  // soft drop shadow
  ctx.fillStyle = "#f090b8";
  ctx.font = `bold 128px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(timeText, cx + 4, cy + 14);
  // main color: deep dark pink / almost black
  ctx.fillStyle = "#1a0010";
  ctx.fillText(timeText, cx, cy + 10);
  // hot pink highlight
  ctx.fillStyle = "#e91e8c";
  ctx.globalAlpha = 0.2;
  ctx.fillText(timeText, cx - 2, cy + 7);
  ctx.restore();

  // Phase label
  ctx.save();
  ctx.fillStyle = "#7b003c";
  ctx.font = `bold 20px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    isBreak ? "✿ BREAK TIME ✿" : "✿ FOCUS TIME ✿",
    cx - 50,
    HEIGHT - 30,
  );
  ctx.restore();

  // Cycle label
  ctx.save();
  ctx.fillStyle = "#7b003c";
  ctx.globalAlpha = 0.7;
  ctx.font = `bold 18px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`CYCLE ${opts.cycleIndex ?? 1}`, cx + 120, HEIGHT - 30);
  ctx.restore();
}

function drawSakuraBg(ctx: SKRSContext2D): void {
  const blossoms = [
    { x: 55,  y: 55,  r: 32, a: 0.22 },
    { x: 740, y: 45,  r: 28, a: 0.18 },
    { x: 30,  y: 295, r: 26, a: 0.2  },
    { x: 760, y: 300, r: 30, a: 0.18 },
    { x: 390, y: 330, r: 22, a: 0.15 },
    { x: 200, y: 30,  r: 20, a: 0.16 },
    { x: 600, y: 320, r: 24, a: 0.16 },
  ];
  for (const b of blossoms) {
    drawSakuraFlower(ctx, b.x, b.y, b.r, b.a);
  }
  // small scattered petals
  const petals = [
    { x: 140, y: 280, r: 10, a: 0.3 },
    { x: 320, y: 50,  r: 12, a: 0.28 },
    { x: 480, y: 30,  r: 9,  a: 0.25 },
    { x: 660, y: 140, r: 11, a: 0.28 },
    { x: 180, y: 140, r: 8,  a: 0.25 },
    { x: 580, y: 200, r: 10, a: 0.22 },
    { x: 430, y: 300, r: 9,  a: 0.25 },
  ];
  for (const p of petals) {
    drawSakuraFlower(ctx, p.x, p.y, p.r, p.a);
  }
}

function drawSakuraFlower(ctx: SKRSContext2D, x: number, y: number, r: number, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ff85b3";
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
    const px = x + Math.cos(angle) * r * 0.55;
    const py = y + Math.sin(angle) * r * 0.55;
    ctx.beginPath();
    ctx.ellipse(px, py, r * 0.52, r * 0.35, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  // center
  ctx.fillStyle = "#ffcce0";
  ctx.globalAlpha = alpha * 1.2;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawButterflies(ctx: SKRSContext2D): void {
  const items = [
    { x: 230, y: 70,  s: 14, c: "#b39ddb", a: 0.75 },
    { x: 555, y: 60,  s: 12, c: "#90caf9", a: 0.7  },
    { x: 160, y: 220, s: 11, c: "#f48fb1", a: 0.65 },
    { x: 640, y: 230, s: 13, c: "#ce93d8", a: 0.7  },
    { x: 340, y: 310, s: 10, c: "#80deea", a: 0.6  },
    { x: 510, y: 290, s: 11, c: "#b39ddb", a: 0.65 },
  ];
  for (const b of items) {
    drawButterfly(ctx, b.x, b.y, b.s, b.c, b.a);
  }
}

function drawButterfly(ctx: SKRSContext2D, x: number, y: number, size: number, color: string, alpha: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  // upper wings
  ctx.beginPath();
  ctx.ellipse(-size * 0.55, -size * 0.35, size * 0.5, size * 0.32, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(size * 0.55, -size * 0.35, size * 0.5, size * 0.32, 0.5, 0, Math.PI * 2);
  ctx.fill();
  // lower wings (smaller)
  ctx.globalAlpha = alpha * 0.75;
  ctx.beginPath();
  ctx.ellipse(-size * 0.4, size * 0.2, size * 0.32, size * 0.2, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(size * 0.4, size * 0.2, size * 0.32, size * 0.2, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // body
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#111111";
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.08, size * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawKuromiKimono(ctx: SKRSContext2D, x: number, y: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);

  // Kimono body — black with pink flower pattern
  // skirt/kimono lower part
  ctx.fillStyle = "#111111";
  ctx.beginPath();
  ctx.moveTo(-size * 0.55, size * 0.38);
  ctx.lineTo(-size * 0.68, size * 1.28);
  ctx.lineTo(size * 0.68, size * 1.28);
  ctx.lineTo(size * 0.55, size * 0.38);
  ctx.closePath();
  ctx.fill();

  // Pink flower dots on kimono (like in the image)
  const flowerPositions = [
    { fx: -size * 0.3, fy: size * 0.65, fr: size * 0.09 },
    { fx: size * 0.28, fy: size * 0.7,  fr: size * 0.08 },
    { fx: -size * 0.1, fy: size * 0.95, fr: size * 0.09 },
    { fx: size * 0.38, fy: size * 1.0,  fr: size * 0.08 },
    { fx: -size * 0.42, fy: size * 1.05, fr: size * 0.07 },
    { fx: size * 0.08, fy: size * 1.18, fr: size * 0.08 },
    { fx: -size * 0.22, fy: size * 1.18, fr: size * 0.07 },
  ];
  for (const f of flowerPositions) {
    drawTinyFlower(ctx, f.fx, f.fy, f.fr);
  }

  // kimono obi (belt) — thin white/pink band
  ctx.fillStyle = "#ffc0d8";
  ctx.beginPath();
  ctx.rect(-size * 0.52, size * 0.4, size * 1.04, size * 0.14);
  ctx.fill();

  // torso
  ctx.fillStyle = "#111111";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.28, size * 0.44, size * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  // arms
  ctx.fillStyle = "#111111";
  ctx.beginPath();
  ctx.ellipse(-size * 0.52, size * 0.38, size * 0.14, size * 0.28, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(size * 0.52, size * 0.38, size * 0.14, size * 0.28, 0.25, 0, Math.PI * 2);
  ctx.fill();

  // BLACK HOOD (Kuromi's signature)
  ctx.fillStyle = "#0d0010";
  ctx.strokeStyle = "#3b003c";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-size * 0.85, size * 0.06);
  ctx.bezierCurveTo(-size * 0.92, -size * 0.52, -size * 0.26, -size * 1.28, 0, -size * 1.35);
  ctx.bezierCurveTo(size * 0.26, -size * 1.28, size * 0.92, -size * 0.52, size * 0.85, size * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // pink skull on hood
  drawPinkSkullSmall(ctx, 0, -size * 0.7, size * 0.28);

  // WHITE FACE
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffb3cc";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.ellipse(0, size * 0.06, size * 0.6, size * 0.54, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // eye patch (left eye - Kuromi has an eye patch!)
  ctx.fillStyle = "#111111";
  ctx.beginPath();
  ctx.ellipse(-size * 0.22, size * 0.04, size * 0.14, size * 0.1, -0.15, 0, Math.PI * 2);
  ctx.fill();
  // patch string
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-size * 0.08, size * 0.04);
  ctx.lineTo(size * 0.06, size * 0.04);
  ctx.stroke();

  // right eye — winking / cute oval
  ctx.fillStyle = "#1a0028";
  ctx.beginPath();
  ctx.ellipse(size * 0.24, size * 0.05, size * 0.1, size * 0.145, 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(size * 0.28, size * 0.01, size * 0.028, size * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();

  // rosy cheeks
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "#ff69b4";
  ctx.beginPath();
  ctx.ellipse(-size * 0.36, size * 0.2, size * 0.13, size * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(size * 0.38, size * 0.2, size * 0.13, size * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // small smirk
  ctx.strokeStyle = "#1a0028";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(size * 0.06, size * 0.26, size * 0.1, 0.3, Math.PI - 0.3);
  ctx.stroke();

  // purple bow on left side of hood
  drawKuromieBow(ctx, -size * 0.56, -size * 0.08, size * 0.42);

  ctx.restore();
}

function drawTinyFlower(ctx: SKRSContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.fillStyle = "#ff85b3";
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 / 5) * i;
    const px = x + Math.cos(angle) * r * 0.65;
    const py = y + Math.sin(angle) * r * 0.65;
    ctx.beginPath();
    ctx.ellipse(px, py, r * 0.42, r * 0.3, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPinkSkullSmall(ctx: SKRSContext2D, x: number, y: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#ff5da8";
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.08, size * 0.5, size * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, size * 0.26, size * 0.32, size * 0.19, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(-size * 0.17, -size * 0.1, size * 0.11, size * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(size * 0.17, -size * 0.1, size * 0.11, size * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e0408a";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.1, size * 0.055, size * 0.065, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(-size * 0.07, size * 0.19, size * 0.14, size * 0.13);
  ctx.fill();
  ctx.restore();
}

function drawKuromieBow(ctx: SKRSContext2D, x: number, y: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#7c3aed";
  ctx.strokeStyle = "#9333ea";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(-size * 0.42, 0, size * 0.42, size * 0.27, -0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(size * 0.42, 0, size * 0.42, size * 0.27, 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#9333ea";
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.13, size * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

