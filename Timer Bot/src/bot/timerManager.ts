import {
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Message,
  type TextBasedChannel,
  ActionRowBuilder,
  type APIEmbed,
  ChannelType,
} from "discord.js";
import {
  renderTimerImage,
  RANDOM_PALETTE,
  type TimerStyle,
} from "./timerImage.js";
import { logger } from "../lib/logger.js";

const UPDATE_INTERVAL_MS = 30_000;
const REPOST_INTERVAL_MS = 5 * 60 * 1000;

type Phase = "study" | "break";

interface ActiveTimer {
  channelId: string;
  guildId: string | null;
  userId: string;
  studyMinutes: number;
  breakMinutes: number;
  phase: Phase;
  phaseEndsAt: number;
  message: Message;
  interval: NodeJS.Timeout;
  lastRepostAt: number;
  style: TimerStyle;
  paletteIndex: number;
}

const active = new Map<string, ActiveTimer>();

function formatRemaining(seconds: number): string {
  const raw = Math.max(0, Math.floor(seconds));
  const safe = Math.floor(raw / 30) * 30;
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function styleColor(t: ActiveTimer): number {
  if (t.phase === "break") return 0x22d3ee;
  if (t.style === "hellokitty") return 0xff5da8;
  if (t.style === "kuromie") return 0xe91e8c;
  // random
  const hex = RANDOM_PALETTE[t.paletteIndex % RANDOM_PALETTE.length]!.accent;
  return parseInt(hex.slice(1), 16);
}

function buildEmbed(t: ActiveTimer, remainingSeconds: number): APIEmbed {
  const isBreak = t.phase === "break";
  const title = isBreak ? "☕ وقت البريك" : "📚 Focus Study Session";

  const description = [
    `📖 مدة المذاكرة: **${t.studyMinutes} دقيقة**`,
    `☕ البريك: **${t.breakMinutes} دقيقة**`,
    "",
    `⏳ الوقت المتبقي`,
    `**${formatRemaining(remainingSeconds)}**`,
  ].join("\n");

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(styleColor(t))
    .setImage("attachment://timer.png")
    .setTimestamp(new Date())
    .toJSON();
}

function buildStopRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("timer:stop")
      .setLabel("⏹ إيقاف التايمر")
      .setStyle(ButtonStyle.Danger),
  );
}

function buildAttachment(t: ActiveTimer, remainingSeconds: number): AttachmentBuilder {
  const buf = renderTimerImage({
    remainingSeconds,
    phase: t.phase,
    style: t.style,
    paletteIndex: t.paletteIndex,
  });
  return new AttachmentBuilder(buf, { name: "timer.png" });
}

async function repostMessage(t: ActiveTimer, remainingSeconds: number): Promise<void> {
  const channel = t.message.channel;
  if (!channel.isSendable()) return;

  if (t.style === "random") {
    t.paletteIndex = (t.paletteIndex + 1) % RANDOM_PALETTE.length;
  }

  const attachment = buildAttachment(t, remainingSeconds);
  const embed = buildEmbed(t, remainingSeconds);

  const newMessage = await channel.send({
    embeds: [embed],
    files: [attachment],
    components: [buildStopRow()],
  });

  const oldMessage = t.message;
  t.message = newMessage;
  t.lastRepostAt = Date.now();

  try {
    await oldMessage.delete();
  } catch (err) {
    logger.error({ err }, "Failed to delete previous timer message");
  }
}

async function tick(channelId: string): Promise<void> {
  const t = active.get(channelId);
  if (!t) return;

  const now = Date.now();
  let remainingSeconds = Math.ceil((t.phaseEndsAt - now) / 1000);

  if (remainingSeconds <= 0) {
    if (t.phase === "study") {
      t.phase = "break";
      t.phaseEndsAt = now + t.breakMinutes * 60 * 1000;
      remainingSeconds = Math.ceil((t.phaseEndsAt - now) / 1000);

      try {
        const channel = t.message.channel;
        if (channel.isSendable()) {
          await channel.send({
            content: `<@${t.userId}> ⏰ خلصت مدة المذاكرة! ابدأ البريك (**${t.breakMinutes} دقيقة**) ☕`,
          });
        }
      } catch (err) {
        logger.error({ err }, "Failed to send phase change message");
      }

      try {
        await repostMessage(t, remainingSeconds);
      } catch (err) {
        logger.error({ err }, "Failed to repost timer at phase change");
      }
      return;
    } else {
      try {
        const channel = t.message.channel;
        if (channel.isSendable()) {
          await channel.send({
            content: `<@${t.userId}> ✅ خلص البريك! جلسة المذاكرة انتهت بنجاح. شغل تاني بـ \`/timer\``,
          });
        }
      } catch (err) {
        logger.error({ err }, "Failed to send completion message");
      }
      await stopTimer(channelId, true);
      return;
    }
  }

  const sinceRepost = now - t.lastRepostAt;
  if (sinceRepost >= REPOST_INTERVAL_MS) {
    try {
      await repostMessage(t, remainingSeconds);
    } catch (err) {
      logger.error({ err, channelId }, "Failed to repost timer message");
    }
    return;
  }

  try {
    const attachment = buildAttachment(t, remainingSeconds);
    const embed = buildEmbed(t, remainingSeconds);
    await t.message.edit({
      embeds: [embed],
      files: [attachment],
      components: [buildStopRow()],
    });
  } catch (err) {
    logger.error({ err, channelId }, "Failed to update timer message");
  }
}

export async function startTimer(opts: {
  channel: TextBasedChannel;
  userId: string;
  studyMinutes: number;
  breakMinutes: number;
  style: TimerStyle;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { channel, userId, studyMinutes, breakMinutes, style } = opts;

  if (!channel.isSendable()) {
    return { ok: false, reason: "مش قادر أبعت رسائل في القناة دي." };
  }

  if (
    channel.type !== ChannelType.GuildText &&
    channel.type !== ChannelType.PublicThread &&
    channel.type !== ChannelType.PrivateThread &&
    channel.type !== ChannelType.GuildAnnouncement &&
    channel.type !== ChannelType.AnnouncementThread &&
    channel.type !== ChannelType.GuildVoice &&
    channel.type !== ChannelType.GuildStageVoice &&
    channel.type !== ChannelType.DM
  ) {
    return { ok: false, reason: "نوع القناة دي غير مدعوم." };
  }

  if (active.has(channel.id)) {
    return {
      ok: false,
      reason:
        "في تايمر شغال بالفعل في القناة دي. أوقفه الأول بـ `/break` أو زر الإيقاف.",
    };
  }

  if (
    !Number.isFinite(studyMinutes) ||
    !Number.isFinite(breakMinutes) ||
    studyMinutes <= 0 ||
    breakMinutes <= 0 ||
    studyMinutes > 1440 ||
    breakMinutes > 1440
  ) {
    return {
      ok: false,
      reason: "المدد لازم تكون أرقام بين 1 و 1440 دقيقة (24 ساعة).",
    };
  }

  const phaseEndsAt = Date.now() + studyMinutes * 60 * 1000;
  const placeholder: ActiveTimer = {
    channelId: channel.id,
    guildId: "guildId" in channel ? (channel.guildId ?? null) : null,
    userId,
    studyMinutes,
    breakMinutes,
    phase: "study",
    phaseEndsAt,
    message: undefined as unknown as Message,
    interval: undefined as unknown as NodeJS.Timeout,
    lastRepostAt: Date.now(),
    style,
    paletteIndex: Math.floor(Math.random() * RANDOM_PALETTE.length),
  };

  const remainingSeconds = Math.ceil((phaseEndsAt - Date.now()) / 1000);
  const attachment = buildAttachment(placeholder, remainingSeconds);
  const embed = buildEmbed(placeholder, remainingSeconds);

  const message = await channel.send({
    embeds: [embed],
    files: [attachment],
    components: [buildStopRow()],
  });

  placeholder.message = message;
  placeholder.lastRepostAt = Date.now();
  const interval = setInterval(() => {
    void tick(channel.id);
  }, UPDATE_INTERVAL_MS);
  placeholder.interval = interval;

  active.set(channel.id, placeholder);
  return { ok: true };
}

export async function stopTimer(
  channelId: string,
  silent = false,
  stoppedByUserId?: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const t = active.get(channelId);
  if (!t) {
    return { ok: false, reason: "مفيش تايمر شغال في القناة دي." };
  }

  clearInterval(t.interval);
  active.delete(channelId);

  try {
    const isBreak = t.phase === "break";

    let stopLine: string;
    if (silent) {
      stopLine = "✅ الجلسة انتهت بنجاح.";
    } else if (stoppedByUserId) {
      stopLine = `🛑 تم إيقاف التايمر بواسطة <@${stoppedByUserId}>`;
    } else {
      stopLine = "🛑 تم الإيقاف يدويًا.";
    }

    const finalEmbed = new EmbedBuilder()
      .setTitle(isBreak ? "☕ تم إيقاف البريك" : "⏹ تم إيقاف التايمر")
      .setDescription(
        [
          `📖 مدة المذاكرة: **${t.studyMinutes} دقيقة**`,
          `☕ البريك: **${t.breakMinutes} دقيقة**`,
          "",
          stopLine,
        ].join("\n"),
      )
      .setColor(silent ? 0x22c55e : 0xef4444)
      .setTimestamp(new Date())
      .toJSON();

    await t.message.edit({
      embeds: [finalEmbed],
      files: [],
      components: [],
    });
  } catch (err) {
    logger.error({ err, channelId }, "Failed to finalize timer message");
  }

  return { ok: true };
}

export function hasTimer(channelId: string): boolean {
  return active.has(channelId);
}

export function findTimerByUser(userId: string): string | null {
  for (const [channelId, t] of active) {
    if (t.userId === userId) return channelId;
  }
  return null;
}

export function shutdownAllTimers(): void {
  for (const t of active.values()) {
    clearInterval(t.interval);
  }
  active.clear();
}
