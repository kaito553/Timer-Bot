import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  MessageFlags,
  ActivityType,
  ChannelType,
  type Interaction,
  type TextBasedChannel,
} from "discord.js";
import { logger } from "../lib/logger.js";
import {
  startTimer,
  stopTimer,
  shutdownAllTimers,
  findTimerByUser,
} from "./timerManager.js";

const COMMAND_TIMER = "timer";
const COMMAND_STOP = "break";

const OPT_STUDY = "study_minutes";
const OPT_BREAK = "break_minutes";
const OPT_STYLE = "style";

const STYLE_CHOICES = [
  { name: "Random colors (default)", value: "random" },
  { name: "Hello Kitty 🎀", value: "hellokitty" },
  { name: "Girl Style 🌸", value: "kuromie" },
] as const;

type StyleValue = (typeof STYLE_CHOICES)[number]["value"];

function isStyleValue(v: string | null): v is StyleValue {
  return v === "random" || v === "hellokitty" || v === "kuromie";
}

function buildCommands() {
  const timer = new SlashCommandBuilder()
    .setName(COMMAND_TIMER)
    .setDescription("ابدأ تايمر مذاكرة وبريك")
    .addIntegerOption((o) =>
      o
        .setName(OPT_STUDY)
        .setDescription("مدة المذاكرة بالدقايق")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1440),
    )
    .addIntegerOption((o) =>
      o
        .setName(OPT_BREAK)
        .setDescription("مدة البريك بالدقايق")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1440),
    )
    .addStringOption((o) =>
      o
        .setName(OPT_STYLE)
        .setDescription("شكل صورة التايمر")
        .setRequired(false)
        .addChoices(...STYLE_CHOICES),
    );

  const stop = new SlashCommandBuilder()
    .setName(COMMAND_STOP)
    .setDescription("إيقاف التايمر الشغال في القناة دي");

  return [timer.toJSON(), stop.toJSON()];
}

async function registerCommands(token: string, clientId: string): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationCommands(clientId), {
    body: buildCommands(),
  });
  logger.info("Discord slash commands registered globally");
}

async function handleInteraction(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isButton() && interaction.customId === "timer:stop") {
      const channelId = interaction.channelId;
      const stopperId = interaction.user.id;
      const result = await stopTimer(channelId, false, stopperId);
      if (result.ok) {
        await interaction.reply({
          content: `🛑 تم إيقاف التايمر بواسطة <@${stopperId}>`,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        const fallbackChannelId = findTimerByUser(stopperId);
        if (fallbackChannelId) {
          const r2 = await stopTimer(fallbackChannelId, false, stopperId);
          await interaction.reply({
            content: r2.ok
              ? `🛑 تم إيقاف تايمرك بواسطة <@${stopperId}> (كان شغال في قناة تانية).`
              : r2.reason,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.reply({
            content: result.reason,
            flags: MessageFlags.Ephemeral,
          });
        }
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === COMMAND_TIMER) {
      const studyMinutes = interaction.options.getInteger(OPT_STUDY, true);
      const breakMinutes = interaction.options.getInteger(OPT_BREAK, true);
      const styleRaw = interaction.options.getString(OPT_STYLE, false);
      const style = isStyleValue(styleRaw) ? styleRaw : "random";

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      let channel: TextBasedChannel | null = interaction.channel;
      if (!channel && interaction.channelId) {
        try {
          const fetched = await interaction.client.channels.fetch(
            interaction.channelId,
          );
          if (
            fetched &&
            (fetched.type === ChannelType.GuildText ||
              fetched.type === ChannelType.PublicThread ||
              fetched.type === ChannelType.PrivateThread ||
              fetched.type === ChannelType.GuildAnnouncement ||
              fetched.type === ChannelType.AnnouncementThread ||
              fetched.type === ChannelType.GuildVoice ||
              fetched.type === ChannelType.GuildStageVoice ||
              fetched.type === ChannelType.DM)
          ) {
            channel = fetched as TextBasedChannel;
          }
        } catch (err) {
          logger.error({ err }, "Failed to fetch channel for timer command");
        }
      }

      if (!channel) {
        await interaction.editReply({
          content:
            "❌ مش قادر أوصل للقناة دي. تأكد إن البوت عنده صلاحية **View Channel** و **Send Messages** و **Embed Links** و **Attach Files** في القناة.",
        });
        return;
      }
      const result = await startTimer({
        channel,
        userId: interaction.user.id,
        studyMinutes,
        breakMinutes,
        style,
      });

      if (result.ok) {
        await interaction.editReply({
          content: `✅ بدأ التايمر — مذاكرة **${studyMinutes} دقيقة** ثم بريك **${breakMinutes} دقيقة**.`,
        });
      } else {
        await interaction.editReply({ content: `❌ ${result.reason}` });
      }
      return;
    }

    if (interaction.commandName === COMMAND_STOP) {
      const channelId = interaction.channelId;
      const stopperId = interaction.user.id;
      if (!channelId) {
        await interaction.reply({
          content: "مش لاقي القناة.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const result = await stopTimer(channelId, false, stopperId);
      if (result.ok) {
        await interaction.reply({
          content: `🛑 تم إيقاف التايمر بواسطة <@${stopperId}>`,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        const fallbackChannelId = findTimerByUser(stopperId);
        if (fallbackChannelId) {
          const r2 = await stopTimer(fallbackChannelId, false, stopperId);
          await interaction.reply({
            content: r2.ok
              ? `🛑 تم إيقاف تايمرك بواسطة <@${stopperId}> (كان شغال في قناة تانية).`
              : r2.reason,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.reply({
            content: result.reason,
            flags: MessageFlags.Ephemeral,
          });
        }
      }
      return;
    }
  } catch (err) {
    logger.error({ err }, "Interaction handler error");
    if (interaction.isRepliable() && !interaction.replied) {
      try {
        await interaction.reply({
          content: "حصل خطأ غير متوقع. حاول تاني.",
          flags: MessageFlags.Ephemeral,
        });
      } catch {
        /* noop */
      }
    }
  }
}

export async function startBot(): Promise<void> {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) {
    logger.warn("DISCORD_BOT_TOKEN not set — Discord bot will not start");
    return;
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.once(Events.ClientReady, async (c) => {
    logger.info({ user: c.user.tag }, "Discord bot is ready");

    const permissions =
      (1n << 10n) |
      (1n << 11n) |
      (1n << 14n) |
      (1n << 15n) |
      (1n << 16n) |
      (1n << 18n) |
      (1n << 31n);
    const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${c.user.id}&permissions=${permissions.toString()}&scope=bot%20applications.commands`;
    logger.info(
      { inviteUrl },
      "===== افتح اللينك ده عشان تضيف البوت للسيرفر =====",
    );

    try {
      c.user.setPresence({
        status: "online",
        activities: [
          {
            name: "/timer — Focus Study",
            type: ActivityType.Watching,
          },
        ],
      });
    } catch (err) {
      logger.error({ err }, "Failed to set bot presence");
    }
    try {
      await registerCommands(token, c.user.id);
    } catch (err) {
      logger.error({ err }, "Failed to register slash commands");
    }
  });

  client.on(Events.InteractionCreate, (interaction) => {
    void handleInteraction(interaction);
  });

  client.on(Events.Error, (err) => {
    logger.error({ err }, "Discord client error");
  });

  await client.login(token);

  const shutdown = () => {
    shutdownAllTimers();
    client.destroy().catch(() => undefined);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
