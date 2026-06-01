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
  rotate: boolean;
  phase: "study" | "break";
  phaseEnd: number;
  cycleCount: number;
  paletteIndex: number;
  imageIndex: number;
  intervalId: ReturnType<typeof setInterval>;
  repostIntervalId: ReturnType<typeof setInterval>;
  channelId: string;
  interaction: ChatInputCommandInteraction;
  row: ActionRowBuilder<ButtonBuilder>;
  currentMessage: Message | null;
  isInteractionReply: boolean;
  stopped: boolean;
  startedByName: string;
  cycleImages: boolean;
  stoppedById?: string;
  stoppedByName?: string;
}

const activeTimers = new Map<string, TimerState>();

function styleColor(style: TimerStyle, rotate: boolean, cycleCount: number): number {
  const effective = rotate
    ? (["random", "hellokitty", "kuromi", "kaitokid", "gojo", "mylittlepony", "anime"] as TimerStyle[])[
        cycleCount % 7
      ]
    : style;
  switch (effective) {
    case "hellokitty":    return 0xff69b4;
    case "kuromi":        return 0x9b59b6;
    case "kaitokid":      return 0x2c3e7a;
    case "gojo":          return 0x7c3aed;
    case "mylittlepony":  return 0xff9ecd;
    case "anime":         return 0x00bfff;
    default:              return 0x00ffff;
  }
}

function snapMs(ms: number): number {
  return Math.floor(ms / 30000) * 30000;
}

function formatDisplay(ms: number): string {
  const snapped = snapMs(ms);
  const totalSecs = Math.floor(snapped / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

async function buildAttachment(
  state: TimerState,
): Promise<{ attachment: AttachmentBuilder; embed: EmbedBuilder }> {
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
    imageIndex: state.imageIndex,
    rotate: state.rotate,
  });

  const attachment = new AttachmentBuilder(imgBuf, { name: "timer.png" });

  const phaseLabel = state.phase === "study" ? "📚 Study Time" : "☕ Break Time";
  const timeStr = formatDisplay(remaining);

  const embed = new EmbedBuilder()
    .setColor(styleColor(state.style, state.rotate, state.cycleCount))
    .setTitle(phaseLabel)
    .setDescription(`**Time remaining:** ${timeStr}`)
    .setImage("attachment://timer.png")
    .setFooter({ text: `Updates every 30s` });

  return { attachment, embed };
}

async function postTimerMessage(state: TimerState): Promise<void> {
  const channel = await state.interaction.client.channels.fetch(state.channelId);
  if (!channel?.isTextBased() || !("send" in channel)) return;

  if (state.currentMessage) {
    if (state.isInteractionReply) {
      await state.interaction.deleteReply().catch(() => {});
    } else {
      await state.currentMessage.delete().catch(() => {});
    }
    state.currentMessage = null;
    state.isInteractionReply = false;
  }

  if (state.cycleImages) state.imageIndex++;

  const { attachment, embed } = await buildAttachment(state);
  const msg = await (channel as any).send({
    embeds: [embed],
    files: [attachment],
    components: [state.row],
  });
  state.currentMessage = msg;
}

async function updateTimerMessage(state: TimerState): Promise<void> {
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
  opts?: { stoppedById?: string; stoppedByName?: string; silent?: boolean },
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
    const whoStopped = state.stoppedByName ? `\nStopped by: **${state.stoppedByName}**` : "";
    const finalEmbed = new EmbedBuilder()
      .setColor(0xff4444)
      .setTitle("⏹️ Timer Stopped")
      .setDescription(`Study session ended.${whoStopped}`)
      .setFooter(null);
    state.currentMessage
      .edit({ embeds: [finalEmbed], files: [], components: [] })
      .catch(() => {});
  }

  return true;
}

export function shutdownAllTimers(): void {
  for (const [channelId] of activeTimers) {
    stopTimer(channelId, { silent: true });
  }
}

export async function startTimer(opts: {
  channelId: string;
  studyMinutes: number;
  breakMinutes: number;
  style: TimerStyle;
  rotate: boolean;
  cycleImages: boolean;
  interaction: ChatInputCommandInteraction;
  row: ActionRowBuilder<ButtonBuilder>;
  startedByName: string;
}): Promise<void> {
  const state: TimerState = {
    studyMs:  opts.studyMinutes * 60000,
    breakMs:  opts.breakMinutes * 60000,
    style:    opts.style,
    rotate:   opts.rotate,
    phase:    "study",
    phaseEnd: Date.now() + opts.studyMinutes * 60000,
    cycleCount:   0,
    paletteIndex: Math.floor(Math.random() * 100),
    imageIndex:   0,
    cycleImages:  opts.cycleImages,
    intervalId:        undefined as any,
    repostIntervalId:  undefined as any,
    channelId:   opts.channelId,
    interaction: opts.interaction,
    row:         opts.row,
    currentMessage:     null,
    isInteractionReply: false,
    stopped:            false,
    startedByName:  opts.startedByName,
  };

  activeTimers.set(opts.channelId, state);

  const { attachment, embed } = await buildAttachment(state);
  const replyMsg = await opts.interaction.editReply({
    embeds: [embed],
    files: [attachment],
    components: [opts.row],
  });
  state.currentMessage     = replyMsg as Message;
  state.isInteractionReply = true;

  state.intervalId = setInterval(async () => {
    if (state.stopped) return;
    const now = Date.now();

    if (now >= state.phaseEnd) {
      if (state.phase === "study") {
        state.phase = "break";
        state.phaseEnd = now + state.breakMs;
      } else {
        stopTimer(state.channelId, { silent: false });
        return;
      }
    }

    state.paletteIndex++;
    await updateTimerMessage(state).catch((e) =>
      logger.error(e, "update error"),
    );
  }, 30000);

  state.repostIntervalId = setInterval(async () => {
    if (state.stopped) return;
    await postTimerMessage(state).catch((e) =>
      logger.error(e, "repost error"),
    );
  }, 5 * 60000);
}
