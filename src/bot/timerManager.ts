import {
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  AttachmentBuilder,
  EmbedBuilder,
  Message,
} from "discord.js";
import { logger } from "../lib/logger.js";
import { renderTimerImage, TimerStyle } from "./timerImage.js";

interface TimerState {
  studyMs: number;
  breakMs: number;
  style: TimerStyle;
  phase: "study" | "break";
  phaseEnd: number;
  cycleCount: number;
  paletteIndex: number;
  intervalId: ReturnType<typeof setInterval>;
  repostIntervalId: ReturnType<typeof setInterval>;
  channelId: string;
  interaction: ChatInputCommandInteraction;
  row: ActionRowBuilder<ButtonBuilder>;
  currentMessage: Message | null;
  stopped: boolean;
  stoppedById?: string;
  stoppedByName?: string;
}

const activeTimers = new Map<string, TimerState>();

function styleColor(style: TimerStyle): number {
  switch (style) {
    case "hellokitty":  return 0xff69b4;
    case "kuromi":      return 0x9b59b6;
    case "kaitokid":    return 0x2c3e7a;
    case "gojo":        return 0x7c3aed;
    case "mylittlepony":return 0xff9ecd;
    default:            return 0x00ffff;
  }
}

async function buildAttachment(state: TimerState): Promise<{ attachment: AttachmentBuilder; embed: EmbedBuilder }> {
  const now = Date.now();
  const remaining = Math.max(0, state.phaseEnd - now);
  const totalMs = state.phase === "study" ? state.studyMs : state.breakMs;

  const imgBuf = await renderTimerImage({
    phase: state.phase,
    remainingMs: remaining,
    totalMs,
    style: state.style,
    cycleCount: state.cycleCount,
    paletteIndex: state.paletteIndex,
  });

  const attachment = new AttachmentBuilder(imgBuf, { name: "timer.png" });

  const phaseLabel = state.phase === "study" ? "📚 وقت المذاكرة" : "☕ وقت البريك";
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  const embed = new EmbedBuilder()
    .setColor(styleColor(state.style))
    .setTitle(phaseLabel)
    .setDescription(`**الوقت المتبقي:** ${timeStr}`)
    .setImage("attachment://timer.png")
    .setFooter({ text: `دورة ${state.cycleCount + 1} • يتحدث كل 30 ثانية` });

  return { attachment, embed };
}

async function postTimerMessage(state: TimerState) {
  const channel = await state.interaction.client.channels.fetch(state.channelId);
  if (!channel?.isTextBased() || !("send" in channel)) return;

  const { attachment, embed } = await buildAttachment(state);
  const msg = await channel.send({ embeds: [embed], files: [attachment], components: [state.row] });
  state.currentMessage = msg;
}

async function updateTimerMessage(state: TimerState) {
  if (!state.currentMessage) return;
  try {
    const { attachment, embed } = await buildAttachment(state);
    await state.currentMessage.edit({ embeds: [embed], files: [attachment], components: [state.row] });
  } catch {
    await postTimerMessage(state);
  }
}

export function hasActiveTimer(channelId: string): boolean {
  return activeTimers.has(channelId);
}

export function stopTimer(
  channelId: string,
  opts?: { stoppedById?: string; stoppedByName?: string; silent?: boolean }
): boolean {
  const state = activeTimers.get(channelId);
  if (!state) return false;

  state.stopped = true;
  state.stoppedById = opts?.stoppedById;
  state.stoppedByName = opts?.stoppedByName;
  clearInterval(state.intervalId);
  clearInterval(state.repostIntervalId);
  activeTimers.delete(channelId);

  if (!opts?.silent && state.currentMessage) {
    const whoStopped = state.stoppedByName ? `\n⛔ وقّفه: **${state.stoppedByName}**` : "";
    const finalEmbed = new EmbedBuilder()
      .setColor(0xff4444)
      .setTitle("⏹️ التايمر اتوقف")
      .setDescription(`انتهت جلسة المذاكرة.${whoStopped}`)
      .setFooter({ text: `دورات مكتملة: ${state.cycleCount}` });
    state.currentMessage.edit({ embeds: [finalEmbed], files: [], components: [] }).catch(() => {});
  }

  return true;
}

export async function startTimer(opts: {
  channelId: string;
  studyMinutes: number;
  breakMinutes: number;
  style: TimerStyle;
  interaction: ChatInputCommandInteraction;
  row: ActionRowBuilder<ButtonBuilder>;
}) {
  const state: TimerState = {
    studyMs: opts.studyMinutes * 60000,
    breakMs: opts.breakMinutes * 60000,
    style: opts.style,
    phase: "study",
    phaseEnd: Date.now() + opts.studyMinutes * 60000,
    cycleCount: 0,
    paletteIndex: 0,
    intervalId: undefined as any,
    repostIntervalId: undefined as any,
    channelId: opts.channelId,
    interaction: opts.interaction,
    row: opts.row,
    currentMessage: null,
    stopped: false,
  };

  activeTimers.set(opts.channelId, state);

  const { attachment, embed } = await buildAttachment(state);
  const replyMsg = await opts.interaction.editReply({ embeds: [embed], files: [attachment], components: [opts.row] });
  state.currentMessage = replyMsg as Message;

  state.intervalId = setInterval(async () => {
    if (state.stopped) return;

    const now = Date.now();
    if (now >= state.phaseEnd) {
      if (state.phase === "study") {
        state.phase = "break";
        state.phaseEnd = now + state.breakMs;
        state.paletteIndex++;
      } else {
        state.phase = "study";
        state.phaseEnd = now + state.studyMs;
        state.cycleCount++;
        state.paletteIndex++;
      }
    }

    await updateTimerMessage(state).catch(e => logger.error(e, "update error"));
  }, 30000);

  state.repostIntervalId = setInterval(async () => {
    if (state.stopped) return;
    await postTimerMessage(state).catch(e => logger.error(e, "repost error"));
  }, 5 * 60000);
}
