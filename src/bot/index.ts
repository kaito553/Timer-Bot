import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  type TextBasedChannel,
  MessageFlags,
  ChannelType,
} from "discord.js";
import { logger } from "../lib/logger.js";
import {
  startTimer,
  stopTimer,
  shutdownAllTimers,
  findTimerByUser,
} from "./timerManager.js";

const COMMAND_TIMER = "timer";
const COMMAND_STOP  = "break";
const OPT_STUDY = "study_minutes";
const OPT_BREAK = "break_minutes";
const OPT_STYLE = "style";

const STYLE_CHOICES = [
  { name: "🎨 ألوان عشوائية (افتراضي)", value: "random"     },
  { name: "🎀 Hello Kitty",              value: "hellokitty" },
  { name: "🖤 Kuromi",                    value: "kuromi"    },
  { name: "♠ Kaito Kid",                 value: "kaitokid"  },
  { name: "∞ Satoru Gojo",               value: "gojo"      },
] as const;

type StyleValue = (typeof STYLE_CHOICES)[number]["value"];

function isStyleValue(v: string | null): v is StyleValue {
  return ["random", "hellokitty", "kuromi", "kaitokid", "gojo"].includes(v ?? "");
}

const CLIENT_ID =
  process.env.DISCORD_CLIENT_ID ?? "1494745593225023539";

function buildCommands() {
  const timer = new SlashCommandBuilder()
    .setName(COMMAND_TIMER)
    .setDescription("ابدأ تايمر مذاكرة وبريك")
    .addIntegerOption((o) =>
      o.setName(OPT_STUDY).setDescription("مدة المذاكرة بالدقايق")
        .setRequired(true).setMinValue(1).setMaxValue(1440),
    )
    .addIntegerOption((o) =>
      o.setName(OPT_BREAK).setDescription("مدة البريك بالدقايق")
        .setRequired(true).setMinValue(1).setMaxValue(1440),
    )
    .addStringOption((o) =>
      o.setName(OPT_STYLE).setDescription("شكل صورة التايمر")
        .setRequired(false).addChoices(...STYLE_CHOICES),
    );

  const stop = new SlashCommandBuilder()
    .setName(COMMAND_STOP)
    .setDescription("إيقاف التايمر الشغال في القناة دي");

  return [timer.toJSON(), stop.toJSON()];
}

async function registerCommands(token: string): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: buildCommands() });
  logger.info({}, "Slash commands registered globally.");
}

let client: Client | null = null;

export async function initBot(token: string): Promise<void> {
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
    ],
  });

  client.once("ready", (c) => {
    logger.info({ tag: c.user.tag }, "Discord client ready");
    void registerCommands(token).catch((err) =>
      logger.error({ err }, "Failed to register slash commands"),
    );
  });

  client.on("interactionCreate", async (interaction) => {
    // ── Button: stop timer ──
    if (interaction.isButton() && interaction.customId === "timer:stop") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const channelId = interaction.channelId;
      const result = await stopTimer(channelId, {
        stoppedById:   interaction.user.id,
        stoppedByName: interaction.user.displayName ?? interaction.user.username,
      });

      if (result.ok) {
        await interaction.editReply({ content: "✅ تم إيقاف التايمر." });
      } else {
        await interaction.editReply({ content: `❌ ${result.reason}` });
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    // ── /timer ──
    if (interaction.commandName === COMMAND_TIMER) {
      const studyMinutes = interaction.options.getInteger(OPT_STUDY, true);
      const breakMinutes = interaction.options.getInteger(OPT_BREAK, true);
      const styleRaw     = interaction.options.getString(OPT_STYLE, false);
      const style        = isStyleValue(styleRaw) ? styleRaw : "random";

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      let channel: TextBasedChannel | null = interaction.channel;
      if (!channel && interaction.channelId) {
        try {
          const fetched = await interaction.client.channels.fetch(interaction.channelId);
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
          logger.error({ err }, "Failed to fetch channel");
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

    // ── /break (stop) ──
    if (interaction.commandName === COMMAND_STOP) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Try the current channel first, then fall back to any timer the user owns
      let channelId: string | null = interaction.channelId;
      if (!channelId || !interaction.client.channels.cache.has(channelId)) {
        channelId = findTimerByUser(interaction.user.id);
      }

      if (!channelId) {
        await interaction.editReply({ content: "❌ مفيش تايمر شغال في القناة دي." });
        return;
      }

      const result = await stopTimer(channelId, {
        stoppedById:   interaction.user.id,
        stoppedByName: interaction.user.displayName ?? interaction.user.username,
      });

      if (result.ok) {
        await interaction.editReply({ content: "✅ تم إيقاف التايمر." });
      } else {
        await interaction.editReply({ content: `❌ ${result.reason}` });
      }
    }
  });

  await client.login(token);
}

export async function shutdownBot(): Promise<void> {
  shutdownAllTimers();
  if (client) {
    client.destroy();
    client = null;
  }
}
