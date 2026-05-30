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

export type TimerStyle = "random" | "hellokitty" | "chromie" | "kaitokid" | "gojo";

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

export function renderTimerImage(opts: TimerImageOptions): Buffer {
  ensureFontRegistered();
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  switch (opts.style) {
    case "hellokitty": renderHelloKitty(ctx, opts); break;
    case "chromie":    renderChromie(ctx, opts);    break;
    case "kaitokid":   renderKaitoKid(ctx, opts);   break;
    case "gojo":       renderGojo(ctx, opts);        break;
    default:           renderNeon(ctx, opts);        break;
  }

  return canvas.toBuffer("image/png");
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
  ctx.fillStyle = accent; ctx.shadowColor = accent; ctx.shadowBlur = 35;
  ctx.font = `bold 140px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
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
  ctx.beginPath(); ctx.moveTo(-size * 0.6, -size * 0.3); ctx.lineTo(-size * 0.85, -size * 0.95); ctx.lineTo(-size * 0.25, -size * 0.55); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(size * 0.6, -size * 0.3); ctx.lineTo(size * 0.85, -size * 0.95); ctx.lineTo(size * 0.25, -size * 0.55); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#e0a3c0"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, size * 0.95, size * 0.78, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  drawBow(ctx, -size * 0.55, -size * 0.55, size * 0.55);
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath(); ctx.ellipse(-size * 0.32, size * 0.05, size * 0.07, size * 0.11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(size * 0.32, size * 0.05, size * 0.07, size * 0.11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f5b942";
  ctx.beginPath(); ctx.ellipse(0, size * 0.25, size * 0.08, size * 0.06, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#888"; ctx.lineWidth = 1.5;
  for (const dir of [-1, 1] as const) {
    for (const yo of [-0.05, 0.1, 0.25]) {
      ctx.beginPath(); ctx.moveTo(dir * size * 0.45, size * (0.1 + yo)); ctx.lineTo(dir * size * 0.95, size * (0.05 + yo)); ctx.stroke();
    }
  }
  ctx.restore();
}

// ─────────────────── CHROMIE ───────────────────

function renderChromie(ctx: SKRSContext2D, opts: TimerImageOptions): void {
  const isBreak = opts.phase === "break";
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, "#0b1220"); bg.addColorStop(0.5, "#1f2937"); bg.addColorStop(1, "#0b1220");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let i = -2; i < 8; i++) {
    const grad = ctx.createLinearGradient(i * 120, 0, i * 120 + 90, HEIGHT);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.5, "rgba(180,200,220,0.18)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad; ctx.fillRect(i * 120, 0, 90, HEIGHT);
  }
  ctx.restore();

  const cx = WIDTH / 2, cy = HEIGHT / 2;
  ctx.save();
  const plate = ctx.createLinearGradient(0, cy - 90, 0, cy + 90);
  plate.addColorStop(0, "#e6ecf2"); plate.addColorStop(0.5, "#7a8696"); plate.addColorStop(1, "#cfd6df");
  ctx.fillStyle = plate; roundRect(ctx, 70, cy - 95, WIDTH - 140, 170, 24); ctx.fill();
  ctx.strokeStyle = "#1a1f2a"; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();

  ctx.save(); ctx.fillStyle = "#cfd6df"; ctx.shadowColor = "#000"; ctx.shadowBlur = 6;
  ctx.font = `bold 28px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("⚙ CHROMIE TIMER ⚙", cx, 50); ctx.restore();

  ctx.save();
  const tg = ctx.createLinearGradient(0, cy - 70, 0, cy + 70);
  tg.addColorStop(0, "#ffffff"); tg.addColorStop(0.45, "#9aa4b2"); tg.addColorStop(0.55, "#3b4452"); tg.addColorStop(1, "#dde3ea");
  ctx.fillStyle = tg; ctx.font = `bold 130px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(formatTime(opts.remainingSeconds), cx, cy + 5);
  ctx.lineWidth = 3; ctx.strokeStyle = "#0f1422"; ctx.strokeText(formatTime(opts.remainingSeconds), cx, cy + 5);
  ctx.restore();

  ctx.save(); ctx.fillStyle = "#cfd6df";
  ctx.font = `bold 22px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(isBreak ? "■ BREAK TIME ■" : "■ FOCUS TIME ■", cx, HEIGHT - 32); ctx.restore();
}

// ─────────────────── KAITO KID ───────────────────

function renderKaitoKid(ctx: SKRSContext2D, opts: TimerImageOptions): void {
  const isBreak = opts.phase === "break";

  // Moonlit night sky background
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, "#03070f");
  bg.addColorStop(0.5, "#0a1628");
  bg.addColorStop(1, "#111827");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Stars
  const stars = [
    [40,30],[90,70],[150,20],[200,55],[300,15],[370,45],[450,25],[520,10],[600,50],
    [650,30],[720,18],[760,65],[30,120],[110,145],[200,100],[340,90],[480,80],[600,130],
    [700,100],[780,140],[60,200],[180,220],[260,170],[410,195],[530,175],[660,200],[740,185],
  ];
  ctx.save(); ctx.fillStyle = "#ffffff";
  for (const [sx, sy] of stars) {
    const r = Math.random() * 1.5 + 0.5;
    ctx.globalAlpha = Math.random() * 0.5 + 0.4;
    ctx.beginPath(); ctx.arc(sx!, sy!, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // Moon (top right)
  ctx.save();
  ctx.beginPath(); ctx.arc(720, 72, 52, 0, Math.PI * 2);
  ctx.fillStyle = "#f5f0c0"; ctx.fill();
  ctx.beginPath(); ctx.arc(738, 60, 44, 0, Math.PI * 2);
  ctx.fillStyle = "#0a1628"; ctx.fill();
  ctx.restore();

  // Playing cards fan (left side)
  const cardColors = ["#e8e8e8", "#f0e8ff", "#e8f0ff", "#ffe8e8"];
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(90, HEIGHT - 40);
    ctx.rotate((-0.6 + i * 0.28));
    ctx.fillStyle = cardColors[i % cardColors.length]!;
    ctx.strokeStyle = "#555"; ctx.lineWidth = 1.5;
    roundRect(ctx, -22, -140, 44, 68, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = i % 2 === 0 ? "#cc1111" : "#111";
    ctx.font = `bold 14px "${FONT_FAMILY}", sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(["♠", "♥", "♦", "♣"][i]!, 0, -132);
    ctx.restore();
  }

  // Top hat silhouette (right side)
  ctx.save(); ctx.translate(WIDTH - 95, HEIGHT - 30);
  // brim
  ctx.fillStyle = "#f8f8f8"; ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
  roundRect(ctx, -55, -22, 110, 22, 4); ctx.fill(); ctx.stroke();
  // body
  roundRect(ctx, -35, -130, 70, 112, 6); ctx.fill(); ctx.stroke();
  // band
  ctx.fillStyle = "#cc0044"; ctx.strokeStyle = "none";
  ctx.fillRect(-33, -50, 66, 12);
  // monocle sparkle
  ctx.fillStyle = "#fff176"; ctx.shadowColor = "#fff176"; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(-55, -80, 6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Silk ribbon across middle
  ctx.save(); ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, HEIGHT / 2 - 78, WIDTH, 156); ctx.restore();

  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;

  // Header
  ctx.save(); ctx.fillStyle = "#f8f8f8"; ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 8;
  ctx.font = `bold 26px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("♠ KAITO KID TIMER ♠", cx, 52); ctx.restore();

  // Main time text — elegant white with gold shadow
  ctx.save();
  const tg = ctx.createLinearGradient(0, cy - 65, 0, cy + 65);
  tg.addColorStop(0, "#ffffff"); tg.addColorStop(0.5, "#f5e48a"); tg.addColorStop(1, "#ffffff");
  ctx.fillStyle = tg;
  ctx.shadowColor = "#f0c060"; ctx.shadowBlur = 22;
  ctx.font = `bold 132px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(formatTime(opts.remainingSeconds), cx, cy + 8);
  ctx.lineWidth = 2; ctx.strokeStyle = "#000000";
  ctx.shadowBlur = 0; ctx.strokeText(formatTime(opts.remainingSeconds), cx, cy + 8);
  ctx.restore();

  // Phase label
  ctx.save(); ctx.fillStyle = "#d4af37";
  ctx.font = `bold 22px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(isBreak ? "— BREAK TIME —" : "— FOCUS TIME —", cx, HEIGHT - 32);
  ctx.restore();
}

// ─────────────────── GOJO SATORU ───────────────────

function renderGojo(ctx: SKRSContext2D, opts: TimerImageOptions): void {
  const isBreak = opts.phase === "break";

  // Deep void background
  const bg = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 0, WIDTH / 2, HEIGHT / 2, 500);
  bg.addColorStop(0, "#1e1b4b");
  bg.addColorStop(0.4, "#0d0020");
  bg.addColorStop(1, "#000000");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const cx = WIDTH / 2, cy = HEIGHT / 2;

  // Hollow Purple energy rings — Six Eyes aura
  const rings = [
    { r: 190, lw: 1.0, alpha: 0.12, color: "#818cf8" },
    { r: 160, lw: 1.5, alpha: 0.18, color: "#6366f1" },
    { r: 128, lw: 2.0, alpha: 0.25, color: "#7c3aed" },
    { r:  96, lw: 2.5, alpha: 0.35, color: "#8b5cf6" },
    { r:  64, lw: 3.0, alpha: 0.45, color: "#a78bfa" },
  ];
  for (const ring of rings) {
    ctx.save(); ctx.globalAlpha = ring.alpha;
    ctx.strokeStyle = ring.color; ctx.lineWidth = ring.lw;
    ctx.shadowColor = ring.color; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(cx, cy, ring.r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // Six cursed energy orbs (Six Eyes motif)
  const orbs = [
    { angle: 0, dist: 220 }, { angle: 60, dist: 220 },
    { angle: 120, dist: 220 }, { angle: 180, dist: 220 },
    { angle: 240, dist: 220 }, { angle: 300, dist: 220 },
  ];
  for (const orb of orbs) {
    const rad = (orb.angle * Math.PI) / 180;
    const ox = cx + Math.cos(rad) * orb.dist;
    const oy = cy + Math.sin(rad) * orb.dist;
    ctx.save();
    const orbGrad = ctx.createRadialGradient(ox, oy, 0, ox, oy, 18);
    orbGrad.addColorStop(0, "#c4b5fd"); orbGrad.addColorStop(0.5, "#7c3aed"); orbGrad.addColorStop(1, "transparent");
    ctx.fillStyle = orbGrad; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(ox, oy, 18, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // "Infinity" horizontal beam
  ctx.save(); ctx.globalAlpha = 0.15;
  const beam = ctx.createLinearGradient(0, cy, WIDTH, cy);
  beam.addColorStop(0, "transparent"); beam.addColorStop(0.3, "#6366f1"); beam.addColorStop(0.5, "#a78bfa"); beam.addColorStop(0.7, "#6366f1"); beam.addColorStop(1, "transparent");
  ctx.fillStyle = beam; ctx.fillRect(0, cy - 28, WIDTH, 56); ctx.restore();

  // Particle dots
  const particles = [
    [50,60],[120,90],[200,40],[320,80],[500,30],[600,70],[730,55],[760,130],
    [30,250],[150,280],[280,260],[430,290],[580,255],[700,275],[790,240],
  ];
  ctx.save(); ctx.fillStyle = "#a78bfa";
  for (const [px, py] of particles) {
    ctx.globalAlpha = Math.random() * 0.4 + 0.2;
    ctx.beginPath(); ctx.arc(px!, py!, 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // ∞ symbol behind time text
  ctx.save(); ctx.globalAlpha = 0.1;
  ctx.strokeStyle = "#7c3aed"; ctx.lineWidth = 28;
  ctx.shadowColor = "#7c3aed"; ctx.shadowBlur = 40;
  drawInfinity(ctx, cx, cy + 8, 100); ctx.restore();

  // Header label
  ctx.save(); ctx.fillStyle = "#a78bfa"; ctx.shadowColor = "#7c3aed"; ctx.shadowBlur = 14;
  ctx.font = `bold 26px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("∞ SATORU GOJO TIMER ∞", cx, 52); ctx.restore();

  // Main time text
  const tg = ctx.createLinearGradient(0, cy - 70, 0, cy + 70);
  tg.addColorStop(0, "#ffffff");
  tg.addColorStop(0.3, "#c4b5fd");
  tg.addColorStop(0.7, "#818cf8");
  tg.addColorStop(1, "#ffffff");

  ctx.save(); ctx.fillStyle = tg;
  ctx.shadowColor = "#7c3aed"; ctx.shadowBlur = 40;
  ctx.font = `bold 132px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(formatTime(opts.remainingSeconds), cx, cy + 8);

  ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.strokeStyle = "#1e1b4b";
  ctx.strokeText(formatTime(opts.remainingSeconds), cx, cy + 8);
  ctx.restore();

  // Phase label
  ctx.save(); ctx.fillStyle = "#c4b5fd";
  ctx.font = `bold 22px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(isBreak ? "∞ BREAK TIME ∞" : "∞ FOCUS TIME ∞", cx, HEIGHT - 32);
  ctx.restore();
}

function drawInfinity(ctx: SKRSContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  // Left lobe
  ctx.moveTo(cx, cy);
  ctx.bezierCurveTo(cx - r * 0.5, cy - r * 0.85, cx - r * 1.6, cy - r * 0.85, cx - r * 1.6, cy);
  ctx.bezierCurveTo(cx - r * 1.6, cy + r * 0.85, cx - r * 0.5, cy + r * 0.85, cx, cy);
  // Right lobe
  ctx.bezierCurveTo(cx + r * 0.5, cy - r * 0.85, cx + r * 1.6, cy - r * 0.85, cx + r * 1.6, cy);
  ctx.bezierCurveTo(cx + r * 1.6, cy + r * 0.85, cx + r * 0.5, cy + r * 0.85, cx, cy);
  ctx.stroke();
}

// ─────────────────── UTIL ───────────────────

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
