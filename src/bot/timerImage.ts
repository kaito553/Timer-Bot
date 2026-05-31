import { createCanvas, loadImage, GlobalFonts, SKRSContext2D } from "@napi-rs/canvas";
import path from "path";
import fs from "fs";

export type TimerStyle = "random" | "hellokitty" | "kuromi" | "kaitokid" | "gojo" | "mylittlepony" | "anime";

const ASSETS = path.join(process.cwd(), "assets");
const FONTS  = path.join(process.cwd(), "fonts");

let fontLoaded = false;
function ensureFont() {
  if (fontLoaded) return;
  const f = path.join(FONTS, "DejaVuSans-Bold.ttf");
  if (fs.existsSync(f)) { GlobalFonts.registerFromPath(f, "DejaVu"); fontLoaded = true; }
}

export interface RenderOpts {
  phase: "study" | "break";
  remainingMs: number;
  totalMs: number;
  style: TimerStyle;
  cycleCount: number;
  paletteIndex: number;
}

const W = 900, H = 400;

const NEON_PALETTES = [
  { bg: "#0a0a1a", primary: "#00ffff", secondary: "#ff00ff", accent: "#ffff00" },
  { bg: "#0d0d0d", primary: "#ff6b35", secondary: "#f7c59f", accent: "#efefd0" },
  { bg: "#050510", primary: "#7b2fff", secondary: "#00e5ff", accent: "#ff2975" },
  { bg: "#0a1a0a", primary: "#39ff14", secondary: "#00ff9f", accent: "#ff00ff" },
  { bg: "#1a0a0a", primary: "#ff073a", secondary: "#ff6ec7", accent: "#ffd700" },
  { bg: "#0a0a2a", primary: "#4fc3f7", secondary: "#e040fb", accent: "#69ff47" },
  { bg: "#1a1a0a", primary: "#ffea00", secondary: "#ff6d00", accent: "#00e676" },
  { bg: "#100a1a", primary: "#f50057", secondary: "#d500f9", accent: "#00bcd4" },
];

function renderNeon(ctx: SKRSContext2D, opts: RenderOpts) {
  const pal = NEON_PALETTES[opts.paletteIndex % NEON_PALETTES.length];
  const { primary, secondary, accent, bg } = pal;

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, bg);
  grad.addColorStop(1, shiftColor(bg, 20));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = primary + "22";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  for (const [cx, cy, r, col] of [[200, 100, 80, primary], [700, 300, 60, secondary], [450, 200, 40, accent]] as [number,number,number,string][]) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, col + "55"); g.addColorStop(1, "transparent");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  const phaseText = opts.phase === "study" ? "STUDY MODE" : "BREAK TIME";
  ctx.font = `bold 28px "DejaVu", sans-serif`;
  ctx.fillStyle = secondary;
  ctx.shadowColor = secondary; ctx.shadowBlur = 15;
  ctx.textAlign = "center";
  ctx.fillText(phaseText, W / 2, 80);

  const mins = Math.floor(opts.remainingMs / 60000);
  const secs = Math.floor((opts.remainingMs % 60000) / 1000);
  const timeStr = `${mins.toString().padStart(2,"0")}:${secs.toString().padStart(2,"0")}`;
  ctx.font = `bold 140px "DejaVu", sans-serif`;
  ctx.fillStyle = primary;
  ctx.shadowColor = primary; ctx.shadowBlur = 40;
  ctx.fillText(timeStr, W / 2, 240);

  drawProgressBar(ctx, opts, { x: 80, y: 300, width: W - 160, height: 18, color: primary, bgColor: primary + "33", glowColor: primary });

  ctx.font = `bold 22px "DejaVu", sans-serif`;
  ctx.fillStyle = accent; ctx.shadowColor = accent; ctx.shadowBlur = 10;
  ctx.fillText(`CYCLE ${opts.cycleCount + 1}`, W / 2, 370);
  ctx.shadowBlur = 0;
}

function shiftColor(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16) + amt);
  const g = Math.min(255, ((n >> 8) & 0xff) + amt);
  const b = Math.min(255, (n & 0xff) + amt);
  return `#${((r<<16)|(g<<8)|b).toString(16).padStart(6,"0")}`;
}

function renderHelloKitty(ctx: SKRSContext2D, opts: RenderOpts) {
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, "#ffe4f0"); bgGrad.addColorStop(1, "#ffd6e7");
  ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#ffb3d1";
  for (let x = 30; x < W; x += 60) for (let y = 30; y < H; y += 60) {
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
  }

  drawKittyFace(ctx, 720, 200, 130);

  ctx.font = `bold 30px "DejaVu", sans-serif`;
  ctx.fillStyle = "#ff4d94";
  ctx.shadowColor = "#ff4d94"; ctx.shadowBlur = 8;
  ctx.textAlign = "center";
  const label = opts.phase === "study" ? "🎀 وقت المذاكرة 🎀" : "🎀 وقت الاستراحة 🎀";
  ctx.fillText(label, 360, 80);

  const mins = Math.floor(opts.remainingMs / 60000);
  const secs = Math.floor((opts.remainingMs % 60000) / 1000);
  const timeStr = `${mins.toString().padStart(2,"0")}:${secs.toString().padStart(2,"0")}`;
  ctx.font = `bold 130px "DejaVu", sans-serif`;
  ctx.strokeStyle = "#c2185b"; ctx.lineWidth = 6;
  ctx.strokeText(timeStr, 360, 240);
  ctx.fillStyle = "#ff69b4"; ctx.shadowColor = "#ff1493"; ctx.shadowBlur = 20;
  ctx.fillText(timeStr, 360, 240);

  drawProgressBar(ctx, opts, { x: 60, y: 295, width: 560, height: 16, color: "#ff4d94", bgColor: "#ffb3d1", glowColor: "#ff69b4" });
  drawBow(ctx, 100, 340, "#ff4d94");

  ctx.font = `bold 22px "DejaVu", sans-serif`;
  ctx.fillStyle = "#c2185b"; ctx.shadowBlur = 0;
  ctx.fillText(`دورة ${opts.cycleCount + 1}`, 360, 370);
}

function drawKittyFace(ctx: SKRSContext2D, cx: number, cy: number, r: number) {
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "#ffb3d1"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  for (const [ex, ey] of [[cx - r * 0.65, cy - r * 0.8], [cx + r * 0.65, cy - r * 0.8]] as [number,number][]) {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(ex, ey - 35); ctx.lineTo(ex - 22, ey + 10); ctx.lineTo(ex + 22, ey + 10);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffb3d1";
    ctx.beginPath();
    ctx.moveTo(ex, ey - 22); ctx.lineTo(ex - 12, ey + 5); ctx.lineTo(ex + 12, ey + 5);
    ctx.closePath(); ctx.fill();
  }

  ctx.fillStyle = "#222";
  ctx.beginPath(); ctx.arc(cx - r * 0.3, cy - r * 0.1, 7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r * 0.3, cy - r * 0.1, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ff9f43";
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.1, 5, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = "#999"; ctx.lineWidth = 1.5;
  for (const [x1,y1,x2,y2] of [
    [cx-50, cy+r*0.1-8, cx-r*0.15, cy+r*0.1-2],
    [cx-50, cy+r*0.1+4, cx-r*0.15, cy+r*0.1+2],
    [cx+50, cy+r*0.1-8, cx+r*0.15, cy+r*0.1-2],
    [cx+50, cy+r*0.1+4, cx+r*0.15, cy+r*0.1+2],
  ] as [number,number,number,number][]) {
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  }
  drawBow(ctx, cx + r * 0.55, cy - r * 0.7, "#ff4d94", 0.7);
}

function drawBow(ctx: SKRSContext2D, x: number, y: number, color: string, scale = 1) {
  ctx.fillStyle = color; ctx.strokeStyle = "#c2185b"; ctx.lineWidth = 1.5;
  for (const [dx] of [[-1],[1]] as [number][]) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x+dx*22*scale, y-16*scale, x+dx*32*scale, y-4*scale, x+dx*28*scale, y+6*scale);
    ctx.bezierCurveTo(x+dx*24*scale, y+14*scale, x, y+6*scale, x, y);
    ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = "#ff69b4";
  ctx.beginPath(); ctx.arc(x, y, 6*scale, 0, Math.PI*2); ctx.fill();
}

interface CharOpts {
  overlayColor: string; textColor: string; textShadow: string; accentColor: string; label: string;
}

async function renderCharacterImage(ctx: SKRSContext2D, opts: RenderOpts, imgFile: string, charOpts: CharOpts) {
  const img = await loadImage(path.join(ASSETS, imgFile));
  const scale = Math.max(W / img.width, H / img.height);
  const dw = img.width * scale, dh = img.height * scale;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);

  const leftG = ctx.createLinearGradient(0, 0, 260, 0);
  leftG.addColorStop(0, charOpts.overlayColor); leftG.addColorStop(1, "transparent");
  ctx.fillStyle = leftG; ctx.fillRect(0, 0, 260, H);

  const rightG = ctx.createLinearGradient(W, 0, W - 100, 0);
  rightG.addColorStop(0, charOpts.overlayColor); rightG.addColorStop(1, "transparent");
  ctx.fillStyle = rightG; ctx.fillRect(W - 100, 0, 100, H);

  const topG = ctx.createLinearGradient(0, 0, 0, 80);
  topG.addColorStop(0, charOpts.overlayColor); topG.addColorStop(1, "transparent");
  ctx.fillStyle = topG; ctx.fillRect(0, 0, W, 80);

  const botG = ctx.createLinearGradient(0, H, 0, H - 80);
  botG.addColorStop(0, charOpts.overlayColor); botG.addColorStop(1, "transparent");
  ctx.fillStyle = botG; ctx.fillRect(0, H - 80, W, 80);

  ctx.textAlign = "left";
  ctx.font = `bold 22px "DejaVu", sans-serif`;
  ctx.fillStyle = charOpts.accentColor; ctx.shadowColor = charOpts.accentColor; ctx.shadowBlur = 10;
  ctx.fillText(charOpts.label, 30, 50);

  const mins = Math.floor(opts.remainingMs / 60000);
  const secs = Math.floor((opts.remainingMs % 60000) / 1000);
  const timeStr = `${mins.toString().padStart(2,"0")}:${secs.toString().padStart(2,"0")}`;

  ctx.font = `bold 130px "DejaVu", sans-serif`;
  ctx.strokeStyle = "#000"; ctx.lineWidth = 12; ctx.lineJoin = "round";
  ctx.shadowColor = charOpts.textShadow; ctx.shadowBlur = 30;
  ctx.strokeText(timeStr, 30, 250);
  ctx.fillStyle = charOpts.textColor; ctx.shadowBlur = 20;
  ctx.fillText(timeStr, 30, 250);

  const phaseLabel = opts.phase === "study" ? "📚 وقت المذاكرة" : "☕ وقت البريك";
  ctx.font = `bold 26px "DejaVu", sans-serif`;
  ctx.fillStyle = charOpts.accentColor; ctx.shadowColor = charOpts.accentColor; ctx.shadowBlur = 10;
  ctx.fillText(phaseLabel, 30, 305);

  drawProgressBar(ctx, opts, { x: 30, y: 330, width: 340, height: 14, color: charOpts.accentColor, bgColor: charOpts.accentColor + "44", glowColor: charOpts.accentColor });
  ctx.shadowBlur = 0;
}

async function renderMLP(ctx: SKRSContext2D, opts: RenderOpts) {
  const img = await loadImage(path.join(ASSETS, "mylittlepony.png"));
  const scale = Math.max(W / img.width, H / img.height);
  const dw = img.width * scale, dh = img.height * scale;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);

  const topG = ctx.createLinearGradient(0,0,0,90);
  topG.addColorStop(0,"rgba(255,240,250,0.55)"); topG.addColorStop(1,"transparent");
  ctx.fillStyle=topG; ctx.fillRect(0,0,W,90);

  const botG = ctx.createLinearGradient(0,H,0,H-100);
  botG.addColorStop(0,"rgba(255,240,250,0.55)"); botG.addColorStop(1,"transparent");
  ctx.fillStyle=botG; ctx.fillRect(0,H-100,W,100);

  ctx.save();
  ctx.beginPath();
  roundRect(ctx, 30, 90, 480, 160, 30);
  ctx.fillStyle="rgba(255,245,255,0.30)"; ctx.fill();
  ctx.strokeStyle="rgba(255,180,220,0.50)"; ctx.lineWidth=2; ctx.stroke();
  ctx.restore();

  for (const [sx,sy] of [[520,60],[600,120],[550,200],[650,80],[480,160]] as [number,number][]) {
    drawSparkle(ctx, sx, sy, "#ffb6e6", 14);
  }

  ctx.textAlign="left";
  ctx.font=`bold 24px "DejaVu", sans-serif`;
  ctx.fillStyle="#c2185b"; ctx.shadowColor="#ff69b4"; ctx.shadowBlur=10;
  ctx.fillText(opts.phase==="study" ? "🦄 My Little Study Time 🌈" : "🌸 My Little Break Time 🌈", 40, 76);

  const mins=Math.floor(opts.remainingMs/60000);
  const secs=Math.floor((opts.remainingMs%60000)/1000);
  const timeStr=`${mins.toString().padStart(2,"0")}:${secs.toString().padStart(2,"0")}`;
  ctx.font=`bold 130px "DejaVu", sans-serif`;
  ctx.strokeStyle="rgba(255,255,255,0.8)"; ctx.lineWidth=8; ctx.lineJoin="round";
  ctx.shadowColor="#ff80c0"; ctx.shadowBlur=20;
  ctx.strokeText(timeStr, 45, 220);
  ctx.fillStyle="#e91e8c"; ctx.shadowBlur=15;
  ctx.fillText(timeStr, 45, 220);

  drawProgressBar(ctx, opts, { x:40, y:265, width:420, height:14, color:"#ff80c0", bgColor:"rgba(255,150,200,0.30)", glowColor:"#ff69b4" });

  ctx.font=`bold 20px "DejaVu", sans-serif`;
  ctx.fillStyle="#c2185b"; ctx.shadowBlur=6;
  ctx.fillText(`دورة ${opts.cycleCount+1} ✨`, 40, 315);
  ctx.shadowBlur=0;
}

function drawSparkle(ctx: SKRSContext2D, x:number, y:number, color:string, size:number) {
  ctx.save(); ctx.translate(x,y);
  ctx.fillStyle=color; ctx.globalAlpha=0.7;
  for (let i=0;i<4;i++) {
    ctx.save(); ctx.rotate((i*Math.PI)/2);
    ctx.beginPath();
    ctx.moveTo(0,0); ctx.lineTo(size*0.2,size*0.2); ctx.lineTo(0,size); ctx.lineTo(-size*0.2,size*0.2);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}

function roundRect(ctx: SKRSContext2D, x:number, y:number, w:number, h:number, r:number) {
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.arcTo(x+w, y, x+w, y+r, r);
  ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
  ctx.lineTo(x+r, y+h); ctx.arcTo(x, y+h, x, y+h-r, r);
  ctx.lineTo(x, y+r); ctx.arcTo(x, y, x+r, y, r);
}

function drawProgressBar(ctx: SKRSContext2D, opts: RenderOpts, bar: { x:number; y:number; width:number; height:number; color:string; bgColor:string; glowColor:string }) {
  const pct = opts.totalMs > 0 ? 1 - opts.remainingMs / opts.totalMs : 0;
  const { x, y, width: bw, height: bh, color, bgColor, glowColor } = bar;
  const r = bh / 2;

  ctx.fillStyle = bgColor;
  ctx.beginPath(); roundRect(ctx, x, y, bw, bh, r); ctx.fill();

  if (pct > 0) {
    ctx.fillStyle = color;
    ctx.shadowColor = glowColor; ctx.shadowBlur = 12;
    ctx.beginPath(); roundRect(ctx, x, y, Math.max(bw * pct, bh), bh, r); ctx.fill();
    ctx.shadowBlur = 0;
  }
}

export async function renderTimerImage(opts: RenderOpts): Promise<Buffer> {
  ensureFont();
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.textAlign = "center";

  switch (opts.style) {
    case "hellokitty": renderHelloKitty(ctx, opts); break;
    case "mylittlepony": await renderMLP(ctx, opts); break;
    case "kuromi": await renderCharacterImage(ctx, opts, "kuromi.png", {
      overlayColor: "rgba(20,0,20,0.30)", textColor: "#1a1a1a",
      textShadow: "#6a0dad", accentColor: "#7c3aed", label: "🖤 KUROMI TIMER 🖤",
    }); break;
    case "kaitokid": {
      const idx = (opts.paletteIndex % 4) + 1;
      await renderCharacterImage(ctx, opts, `kaitokid${idx}.jpg`, {
        overlayColor: "rgba(10,20,60,0.45)", textColor: "#ffffff",
        textShadow: "#000000", accentColor: "#d4af37", label: "♠ KAITO KID TIMER ♠",
      }); break;
    }
    case "gojo": {
      const idx = (opts.paletteIndex % 4) + 1;
      await renderCharacterImage(ctx, opts, `gojo${idx}.png`, {
        overlayColor: "rgba(15,5,40,0.45)", textColor: "#ffffff",
        textShadow: "#7c3aed", accentColor: "#a78bfa", label: "∞ SATORU GOJO TIMER ∞",
      }); break;
    }
    case "anime": {
      const idx = (opts.paletteIndex % 6) + 1;
      await renderCharacterImage(ctx, opts, `anime${idx}.jpg`, {
        overlayColor: "rgba(5,5,20,0.50)", textColor: "#e0f0ff",
        textShadow: "#00bfff", accentColor: "#7dd3fc", label: "🌙 ANIME TIMER 🌙",
      }); break;
    }
    default: renderNeon(ctx, opts); break;
  }

  return canvas.toBuffer("image/png");
}
