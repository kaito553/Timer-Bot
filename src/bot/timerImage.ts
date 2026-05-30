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

export type TimerStyle = "random" | "hellokitty" | "chromie";

export interface ColorPair {
  accent: string;
  accentSoft: string;
}

// Palette for the "random" style — each repost rotates through these.
export const RANDOM_PALETTE: ColorPair[] = [
  { accent: "#ff2bd6", accentSoft: "#a21caf" }, // neon pink (default)
  { accent: "#22d3ee", accentSoft: "#06b6d4" }, // cyan
  { accent: "#a3ff12", accentSoft: "#65a30d" }, // neon green
  { accent: "#ffeb3b", accentSoft: "#ca8a04" }, // yellow
  { accent: "#ff6b35", accentSoft: "#c2410c" }, // orange
  { accent: "#b14eff", accentSoft: "#7e22ce" }, // purple
  { accent: "#ff3366", accentSoft: "#be123c" }, // crimson
  { accent: "#4ad9ff", accentSoft: "#0284c7" }, // sky blue
];

export interface TimerImageOptions {
  remainingSeconds: number;
  phase: "study" | "break";
  style: TimerStyle;
  /** Index into RANDOM_PALETTE; ignored unless style === "random". */
  paletteIndex?: number;
}

export function renderTimerImage(opts: TimerImageOptions): Buffer {
  ensureFontRegistered();

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  if (opts.style === "hellokitty") {
    renderHelloKitty(ctx, opts);
  } else if (opts.style === "chromie") {
    renderChromie(ctx, opts);
  } else {
    renderNeon(ctx, opts);
  }

  return canvas.toBuffer("image/png");
}

// ---------------- NEON / RANDOM STYLE ----------------

function renderNeon(ctx: SKRSContext2D, opts: TimerImageOptions): void {
  const isBreak = opts.phase === "break";
  // In break phase always force a calm cyan look so user can tell the phase apart.
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

  // background gradient
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, "#08020c");
  bg.addColorStop(1, "#1a0a1f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;

  // decorative spirograph-like ellipses
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = accentSoft;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 14; i++) {
    ctx.save();
    ctx.rotate((Math.PI / 14) * i);
    ctx.beginPath();
    ctx.ellipse(0, 0, 320, 110, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // soft outer glow
  ctx.save();
  ctx.globalAlpha = 0.18;
  const glow = ctx.createRadialGradient(cx, cy, 40, cx, cy, 420);
  glow.addColorStop(0, accent);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.restore();

  // small "TIMER" label
  ctx.save();
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 18;
  ctx.font = `bold 30px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TIMER", cx, 60);
  ctx.restore();

  // main time text
  const timeText = formatTime(opts.remainingSeconds);
  ctx.save();
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 35;
  ctx.font = `bold 140px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(timeText, cx, cy + 10);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.18;
  ctx.fillText(timeText, cx, cy + 10);
  ctx.restore();

  // phase label
  ctx.save();
  ctx.fillStyle = "#f5d0fe";
  ctx.globalAlpha = 0.85;
  ctx.font = `bold 22px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(isBreak ? "BREAK TIME" : "FOCUS TIME", cx, HEIGHT - 36);
  ctx.restore();
}

// ---------------- HELLO KITTY STYLE ----------------

function renderHelloKitty(ctx: SKRSContext2D, opts: TimerImageOptions): void {
  const isBreak = opts.phase === "break";

  // background: soft pink → white
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, "#ffd6ec");
  bg.addColorStop(1, "#fff5fa");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Scattered hearts
  drawHearts(ctx);

  // Bows in the corners
  drawBow(ctx, 70, 70, 50);
  drawBow(ctx, WIDTH - 70, 70, 50);

  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;

  // Cute kitty face on the side
  drawKittyFace(ctx, 110, cy + 30, 70);
  drawKittyFace(ctx, WIDTH - 110, cy + 30, 70);

  // Header
  ctx.save();
  ctx.fillStyle = "#d6336c";
  ctx.font = `bold 28px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("♡ HELLO KITTY TIMER ♡", cx, 50);
  ctx.restore();

  // Time text
  const timeText = formatTime(opts.remainingSeconds);
  ctx.save();
  // soft shadow
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 130px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(timeText, cx + 3, cy + 13);
  ctx.fillStyle = "#e91e63";
  ctx.fillText(timeText, cx, cy + 10);
  ctx.restore();

  // Phase label
  ctx.save();
  ctx.fillStyle = "#a61e4d";
  ctx.font = `bold 22px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    isBreak ? "♡ BREAK TIME ♡" : "♡ FOCUS TIME ♡",
    cx,
    HEIGHT - 32,
  );
  ctx.restore();
}

function drawHearts(ctx: SKRSContext2D): void {
  const hearts = [
    { x: 60, y: 200, s: 16, a: 0.55 },
    { x: 160, y: 270, s: 20, a: 0.45 },
    { x: 240, y: 130, s: 14, a: 0.5 },
    { x: 380, y: 90, s: 18, a: 0.4 },
    { x: 560, y: 270, s: 22, a: 0.4 },
    { x: 640, y: 150, s: 16, a: 0.55 },
    { x: 720, y: 240, s: 14, a: 0.5 },
    { x: 480, y: 305, s: 18, a: 0.4 },
  ];
  for (const h of hearts) {
    ctx.save();
    ctx.globalAlpha = h.a;
    ctx.fillStyle = "#ff85b3";
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
  // left loop
  ctx.fillStyle = "#ff5da8";
  ctx.beginPath();
  ctx.ellipse(-size * 0.45, 0, size * 0.45, size * 0.32, -0.25, 0, Math.PI * 2);
  ctx.fill();
  // right loop
  ctx.beginPath();
  ctx.ellipse(size * 0.45, 0, size * 0.45, size * 0.32, 0.25, 0, Math.PI * 2);
  ctx.fill();
  // center knot
  ctx.fillStyle = "#e83e8c";
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.16, size * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawKittyFace(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  size: number,
): void {
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

  // head
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#e0a3c0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.95, size * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // bow on left ear area
  drawBow(ctx, -size * 0.55, -size * 0.55, size * 0.55);

  // eyes
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.ellipse(-size * 0.32, size * 0.05, size * 0.07, size * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(size * 0.32, size * 0.05, size * 0.07, size * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();

  // nose
  ctx.fillStyle = "#f5b942";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.25, size * 0.08, size * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  // whiskers
  ctx.strokeStyle = "#888";
  ctx.lineWidth = 1.5;
  for (const dir of [-1, 1]) {
    for (const yo of [-0.05, 0.1, 0.25]) {
      ctx.beginPath();
      ctx.moveTo(dir * size * 0.45, size * (0.1 + yo));
      ctx.lineTo(dir * size * 0.95, size * (0.05 + yo));
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ---------------- CHROMIE (CHROME / METALLIC) STYLE ----------------

function renderChromie(ctx: SKRSContext2D, opts: TimerImageOptions): void {
  const isBreak = opts.phase === "break";

  // base background: dark steel
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, "#0b1220");
  bg.addColorStop(0.5, "#1f2937");
  bg.addColorStop(1, "#0b1220");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // diagonal metallic shine bars
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = -2; i < 8; i++) {
    const grad = ctx.createLinearGradient(i * 120, 0, i * 120 + 90, HEIGHT);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.5, "rgba(180,200,220,0.18)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(i * 120, 0, 90, HEIGHT);
  }
  ctx.restore();

  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;

  // chrome plate behind text
  ctx.save();
  const plate = ctx.createLinearGradient(0, cy - 90, 0, cy + 90);
  plate.addColorStop(0, "#e6ecf2");
  plate.addColorStop(0.5, "#7a8696");
  plate.addColorStop(1, "#cfd6df");
  ctx.fillStyle = plate;
  roundRect(ctx, 70, cy - 95, WIDTH - 140, 170, 24);
  ctx.fill();
  ctx.strokeStyle = "#1a1f2a";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // header
  ctx.save();
  ctx.fillStyle = "#cfd6df";
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 6;
  ctx.font = `bold 28px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("⚙ CHROMIE TIMER ⚙", cx, 50);
  ctx.restore();

  // time text — silver chrome gradient
  const timeText = formatTime(opts.remainingSeconds);
  ctx.save();
  const textGrad = ctx.createLinearGradient(0, cy - 70, 0, cy + 70);
  textGrad.addColorStop(0, "#ffffff");
  textGrad.addColorStop(0.45, "#9aa4b2");
  textGrad.addColorStop(0.55, "#3b4452");
  textGrad.addColorStop(1, "#dde3ea");
  ctx.fillStyle = textGrad;
  ctx.font = `bold 130px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(timeText, cx, cy + 5);

  // outline
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#0f1422";
  ctx.strokeText(timeText, cx, cy + 5);
  ctx.restore();

  // phase label
  ctx.save();
  ctx.fillStyle = "#cfd6df";
  ctx.font = `bold 22px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(isBreak ? "■ BREAK TIME ■" : "■ FOCUS TIME ■", cx, HEIGHT - 32);
  ctx.restore();
}

function roundRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
