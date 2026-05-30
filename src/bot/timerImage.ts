import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
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
    } catch { /* try next */ }
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

export type TimerStyle = "random" | "hellokitty" | "kuromi" | "kaitokid" | "gojo" | "mylittlepony";

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
}

function assetPath(name: string): string {
  const candidates = [
    path.join(process.cwd(), "assets", name),
    path.join(process.cwd(), "dist", "assets", name),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0]!;
}

export async function renderTimerImage(opts: TimerImageOptions): Promise<Buffer> {
  ensureFontRegistered();
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  switch (opts.style) {
    case "hellokitty": renderHelloKitty(ctx, opts);          break;
    case "kuromi": await renderCharacterImage(ctx, opts, "kuromi.png", {
      overlayColor: "rgba(20, 0, 20, 0.30)",
      textColor: "#1a1a1a",
      textShadow: "#ff69b4",
      accentColor: "#111111",
      label: "🖤 KUROMI TIMER 🖤",
    }); break;
    case "mylittlepony": await renderMLP(ctx, opts); break;
    case "kaitokid":   await renderCharacterImage(ctx, opts, "kaitokid.png", {
      overlayColor: "rgba(10, 20, 60, 0.45)",
      textColor: "#f5e48a",
      textShadow: "#000000",
      accentColor: "#d4af37",
      label: "♠ KAITO KID TIMER ♠",
    }); break;
    case "gojo": await renderCharacterImage(ctx, opts, "gojo.png", {
      overlayColor: "rgba(15, 5, 40, 0.50)",
      textColor: "#ffffff",
      textShadow: "#7c3aed",
      accentColor: "#a78bfa",
      label: "∞ SATORU GOJO TIMER ∞",
    }); break;
    default: renderNeon(ctx, opts); break;
  }

  return canvas.toBuffer("image/png");
}

// ─────────────────── CHARACTER IMAGE BACKGROUND ───────────────────

interface CharImageOpts {
  overlayColor: string;
  textColor: string;
  textShadow: string;
  accentColor: string;
  label: string;
}

async function renderCharacterImage(
  ctx: SKRSContext2D,
  opts: TimerImageOptions,
  filename: string,
  style: CharImageOpts,
): Promise<void> {
  const isBreak = opts.phase === "break";
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;

  // Draw character image as background, cover-fit
  try {
    const img = await loadImage(assetPath(filename));
    const scale = Math.max(WIDTH / img.width, HEIGHT / img.height);
    const sw = img.width * scale;
    const sh = img.height * scale;
    const sx = (WIDTH - sw) / 2;
    const sy = (HEIGHT - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh);
  } catch {
    // fallback solid bg if image missing
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  // Dark gradient overlay left+right so text area is readable
  const overlayL = ctx.createLinearGradient(0, 0, WIDTH * 0.55, 0);
  overlayL.addColorStop(0, style.overlayColor);
  overlayL.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = overlayL;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const overlayR = ctx.createLinearGradient(WIDTH, 0, WIDTH * 0.45, 0);
  overlayR.addColorStop(0, style.overlayColor);
  overlayR.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = overlayR;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Horizontal band behind text for extra readability
  const band = ctx.createLinearGradient(0, cy - 85, 0, cy + 85);
  band.addColorStop(0, "rgba(0,0,0,0)");
  band.addColorStop(0.4, "rgba(0,0,0,0.35)");
  band.addColorStop(0.6, "rgba(0,0,0,0.35)");
  band.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Header label (top center)
  ctx.save();
  ctx.fillStyle = style.accentColor;
  ctx.shadowColor = style.textShadow;
  ctx.shadowBlur = 14;
  ctx.font = `bold 24px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(style.label, cx, 46);
  ctx.restore();

  // Main time text
  const timeText = formatTime(opts.remainingSeconds);
  ctx.save();
  // Thick shadow / outline for max contrast
  ctx.font = `bold 134px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.strokeText(timeText, cx, cy + 10);
  ctx.fillStyle = style.textColor;
  ctx.shadowColor = style.textShadow;
  ctx.shadowBlur = 30;
  ctx.fillText(timeText, cx, cy + 10);
  ctx.restore();

  // Phase label (bottom center)
  ctx.save();
  ctx.fillStyle = style.accentColor;
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 10;
  ctx.font = `bold 22px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const phaseEmoji = isBreak ? "☕ BREAK TIME" : "📚 FOCUS TIME";
  ctx.fillText(phaseEmoji, cx, HEIGHT - 32);
  ctx.restore();
}

// ─────────────────── NEON / RANDOM ───────────────────

function renderNeon(ctx: SKRSContext2D, opts: TimerImageOptions): void {
  const isBreak = opts.phase === "break";
  let accent: string, accentSoft: string;
  if (isBreak) {
    accent = "#22d3ee"; accentSoft = "#06b6d4";
  } else {
    const idx = (opts.paletteIndex ?? 0) % RANDOM_PALETTE.length;
    accent = RANDOM_PALETTE[idx]!.accent;
    accentSoft = RANDOM_PALETTE[idx]!.accentSoft;
  }

  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, "#08020c"); bg.addColorStop(1, "#1a0a1f");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const cx = WIDTH / 2, cy = HEIGHT / 2;
  ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = accentSoft;
  ctx.globalAlpha = 0.55; ctx.lineWidth = 1.2;
  for (let i = 0; i < 14; i++) {
    ctx.save(); ctx.rotate((Math.PI / 14) * i);
    ctx.beginPath(); ctx.ellipse(0, 0, 320, 110, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  ctx.save(); ctx.globalAlpha = 0.18;
  const glow = ctx.createRadialGradient(cx, cy, 40, cx, cy, 420);
  glow.addColorStop(0, accent); glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, WIDTH, HEIGHT); ctx.restore();

  ctx.save(); ctx.fillStyle = accent; ctx.shadowColor = accent; ctx.shadowBlur = 18;
  ctx.font = `bold 30px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("TIMER", cx, 60); ctx.restore();

  ctx.save();
  ctx.font = `bold 140px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = accent; ctx.shadowColor = accent; ctx.shadowBlur = 35;
  ctx.fillText(formatTime(opts.remainingSeconds), cx, cy + 10);
  ctx.shadowBlur = 0; ctx.fillStyle = "#ffffff"; ctx.globalAlpha = 0.18;
  ctx.fillText(formatTime(opts.remainingSeconds), cx, cy + 10); ctx.restore();

  ctx.save(); ctx.fillStyle = "#f5d0fe"; ctx.globalAlpha = 0.85;
  ctx.font = `bold 22px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(isBreak ? "BREAK TIME" : "FOCUS TIME", cx, HEIGHT - 36); ctx.restore();
}

// ─────────────────── HELLO KITTY ───────────────────

function renderHelloKitty(ctx: SKRSContext2D, opts: TimerImageOptions): void {
  const isBreak = opts.phase === "break";
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, "#ffd6ec"); bg.addColorStop(1, "#fff5fa");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, WIDTH, HEIGHT);

  drawScatteredHearts(ctx);
  drawBow(ctx, 70, 70, 50); drawBow(ctx, WIDTH - 70, 70, 50);

  const cx = WIDTH / 2, cy = HEIGHT / 2;
  drawKittyFace(ctx, 110, cy + 30, 70);
  drawKittyFace(ctx, WIDTH - 110, cy + 30, 70);

  ctx.save(); ctx.fillStyle = "#d6336c";
  ctx.font = `bold 28px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("♡ HELLO KITTY TIMER ♡", cx, 50); ctx.restore();

  ctx.save();
  ctx.fillStyle = "#ffffff"; ctx.font = `bold 130px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(formatTime(opts.remainingSeconds), cx + 3, cy + 13);
  ctx.fillStyle = "#e91e63"; ctx.fillText(formatTime(opts.remainingSeconds), cx, cy + 10); ctx.restore();

  ctx.save(); ctx.fillStyle = "#a61e4d";
  ctx.font = `bold 22px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(isBreak ? "♡ BREAK TIME ♡" : "♡ FOCUS TIME ♡", cx, HEIGHT - 32); ctx.restore();
}

function drawScatteredHearts(ctx: SKRSContext2D): void {
  const hearts = [
    { x: 60, y: 200, s: 16, a: 0.55 }, { x: 160, y: 270, s: 20, a: 0.45 },
    { x: 240, y: 130, s: 14, a: 0.5  }, { x: 380, y: 90,  s: 18, a: 0.4  },
    { x: 560, y: 270, s: 22, a: 0.4  }, { x: 640, y: 150, s: 16, a: 0.55 },
    { x: 720, y: 240, s: 14, a: 0.5  }, { x: 480, y: 305, s: 18, a: 0.4  },
  ];
  for (const h of hearts) {
    ctx.save(); ctx.globalAlpha = h.a; ctx.fillStyle = "#ff85b3";
    drawHeart(ctx, h.x, h.y, h.s); ctx.restore();
  }
}

function drawHeart(ctx: SKRSContext2D, x: number, y: number, size: number): void {
  const k = size;
  ctx.beginPath();
  ctx.moveTo(x, y + k * 0.3);
  ctx.bezierCurveTo(x, y, x - k, y, x - k, y + k * 0.5);
  ctx.bezierCurveTo(x - k, y + k * 0.9, x, y + k * 1.1, x, y + k * 1.4);
  ctx.bezierCurveTo(x, y + k * 1.1, x + k, y + k * 0.9, x + k, y + k * 0.5);
  ctx.bezierCurveTo(x + k, y, x, y, x, y + k * 0.3);
  ctx.fill();
}

function drawBow(ctx: SKRSContext2D, x: number, y: number, size: number): void {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "#ff5da8";
  ctx.beginPath(); ctx.ellipse(-size * 0.45, 0, size * 0.45, size * 0.32, -0.25, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(size * 0.45, 0, size * 0.45, size * 0.32, 0.25, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#e83e8c";
  ctx.beginPath(); ctx.ellipse(0, 0, size * 0.16, size * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawKittyFace(ctx: SKRSContext2D, x: number, y: number, size: number): void {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.moveTo(-size*0.6,-size*0.3); ctx.lineTo(-size*0.85,-size*0.95); ctx.lineTo(-size*0.25,-size*0.55); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(size*0.6,-size*0.3); ctx.lineTo(size*0.85,-size*0.95); ctx.lineTo(size*0.25,-size*0.55); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#e0a3c0"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, size*0.95, size*0.78, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  drawBow(ctx, -size*0.55, -size*0.55, size*0.55);
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath(); ctx.ellipse(-size*0.32, size*0.05, size*0.07, size*0.11, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(size*0.32, size*0.05, size*0.07, size*0.11, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = "#f5b942";
  ctx.beginPath(); ctx.ellipse(0, size*0.25, size*0.08, size*0.06, 0, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = "#888"; ctx.lineWidth = 1.5;
  for (const dir of [-1, 1] as const) {
    for (const yo of [-0.05, 0.1, 0.25]) {
      ctx.beginPath(); ctx.moveTo(dir*size*0.45, size*(0.1+yo)); ctx.lineTo(dir*size*0.95, size*(0.05+yo)); ctx.stroke();
    }
  }
  ctx.restore();
}

// ─────────────────── MY LITTLE PONY ───────────────────

async function renderMLP(ctx: SKRSContext2D, opts: TimerImageOptions): Promise<void> {
  const isBreak = opts.phase === "break";
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;

  // Draw image background — cover fit
  try {
    const img = await loadImage(assetPath("mylittlepony.png"));
    const scale = Math.max(WIDTH / img.width, HEIGHT / img.height);
    const sw = img.width * scale;
    const sh = img.height * scale;
    ctx.drawImage(img, (WIDTH - sw) / 2, (HEIGHT - sh) / 2, sw, sh);
  } catch {
    ctx.fillStyle = "#ffd6ec";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  // Very subtle top + bottom dark fade only (keep middle clear to show image)
  const topFade = ctx.createLinearGradient(0, 0, 0, 80);
  topFade.addColorStop(0, "rgba(120,0,80,0.45)");
  topFade.addColorStop(1, "rgba(120,0,80,0)");
  ctx.fillStyle = topFade;
  ctx.fillRect(0, 0, WIDTH, 80);

  const botFade = ctx.createLinearGradient(0, HEIGHT - 70, 0, HEIGHT);
  botFade.addColorStop(0, "rgba(120,0,80,0)");
  botFade.addColorStop(1, "rgba(120,0,80,0.45)");
  ctx.fillStyle = botFade;
  ctx.fillRect(0, HEIGHT - 70, WIDTH, 70);

  // Frosted glass pill behind the time text
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, cx - 300, cy - 78, 600, 140, 32);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#ff69b4";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  // Small sparkle dots on the pill border
  const sparkles = [cx - 290, cx - 150, cx, cx + 150, cx + 290];
  for (const sx of sparkles) {
    ctx.save();
    ctx.fillStyle = "#ff1493";
    ctx.shadowColor = "#ff69b4";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(sx, cy - 78, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Header label
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "#c71585";
  ctx.shadowBlur = 10;
  ctx.font = `bold 22px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🦄 MY LITTLE PONY TIMER 🦄", cx, 36);
  ctx.restore();

  // Main time text — hot pink with white glow
  const timeText = formatTime(opts.remainingSeconds);
  ctx.save();
  ctx.font = `bold 134px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // White outline for extra pop
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#ffffff";
  ctx.strokeText(timeText, cx, cy + 6);
  // Hot pink fill with glow
  ctx.fillStyle = "#ff1493";
  ctx.shadowColor = "#ff69b4";
  ctx.shadowBlur = 18;
  ctx.fillText(timeText, cx, cy + 6);
  ctx.restore();

  // Phase label
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "#c71585";
  ctx.shadowBlur = 8;
  ctx.font = `bold 22px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(isBreak ? "🌸 BREAK TIME 🌸" : "🌸 FOCUS TIME 🌸", cx, HEIGHT - 30);
  ctx.restore();
}

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x+r, y); ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r); ctx.arcTo(x, y, x+w, y, r); ctx.closePath();
}
