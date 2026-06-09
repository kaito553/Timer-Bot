import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ButtonInteraction,
  MessageFlags,
} from "discord.js";
import { logger } from "../lib/logger.js";
import { startTimer, stopTimer, hasActiveTimer, shutdownAllTimers } from "./timerManager.js";
import { TimerStyle } from "./timerImage.js";

const STYLE_CHOICES = [
  { name: "Random (Neon)", value: "random" },
  { name: "Hello Kitty 🎀", value: "hellokitty" },
  { name: "Kuromi 🖤", value: "kuromi" },
  { name: "Kaito Kid ♠", value: "kaitokid" },
  { name: "Satoru Gojo ∞", value: "gojo" },
  { name: "My Little Pony 🦄", value: "mylittlepony" },
  { name: "Anime 🌙", value: "anime" },
];

const ROTATE_CHOICES = [
  { name: "ثابت (نفس الستايل طول الوقت)", value: "no" },
  { name: "يتغير 🔄 (يدور على كل الستايلات كل cycle)", value: "yes" },
];

const IMAGE_CHOICES = [
  { name: "ثابتة (نفس الصورة دايما)", value: "no" },
  { name: "تتغير 🖼️ (صورة جديدة مع كل رسالة جديدة)", value: "yes" },
];

function isStyleValue(v: string): v is TimerStyle {
  return ["random", "hellokitty", "kuromi", "kaitokid", "gojo", "mylittlepony", "anime"].includes(v);
}

const commands = [
  new SlashCommandBuilder()
    .setName("timer")
    .setDescription("Start a study timer")
    .addIntegerOption((o) =>
      o.setName("study_minutes").setDescription("Study duration in minutes")
        .setRequired(true).setMinValue(1).setMaxValue(360),
    )
    .addIntegerOption((o) =>
      o.setName("break_minutes").setDescription("Break duration in minutes")
        .setRequired(true).setMinValue(1).setMaxValue(60),
    )
    .addStringOption((o) =>
      o.setName("style").setDescription("Timer visual style")
        .setRequired(false).addChoices(...STYLE_CHOICES),
    )
    .addStringOption((o) =>
      o.setName("rotate").setDescription("عايز الستايل يتغير كل cycle ولا يفضل ثابت؟")
        .setRequired(false).addChoices(...ROTATE_CHOICES),
    )
    .addStringOption((o) =>
      o.setName("images").setDescription("الصور تفضل ثابتة ولا تتغير مع كل رسالة جديدة؟")
        .setRequired(false).addChoices(...IMAGE_CHOICES),
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop the current timer")
    .toJSON(),
];

export async function startBot(): Promise<void> {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) throw new Error("DISCORD_BOT_TOKEN missing");

  const clientId = process.env["DISCORD_CLIENT_ID"] ?? "1494745593225023539";

  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  logger.info("Slash commands registered");

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.on("interactionCreate", async (interaction) => {
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction as ButtonInteraction);
    }
  });

  client.once("ready", () => logger.info({ tag: client.user?.tag }, "Bot ready"));

  await client.login(token);

  const shutdown = (): void => {
    shutdownAllTimers();
    client.destroy().catch(() => undefined);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (interaction.commandName === "timer") {
    const studyMin  = interaction.options.getInteger("study_minutes", true);
    const breakMin  = interaction.options.getInteger("break_minutes", true);
    const styleRaw      = interaction.options.getString("style") ?? "random";
    const rotateRaw     = interaction.options.getString("rotate") ?? "no";
    const imagesRaw     = interaction.options.getString("images") ?? "no";

    const style: TimerStyle  = isStyleValue(styleRaw) ? styleRaw : "random";
    const rotate             = rotateRaw === "yes";
    const cycleImages        = imagesRaw === "yes";

    if (hasActiveTimer(interaction.channelId ?? "")) {
      await interaction.reply({
        content: "⚠️ A timer is already running! Stop it first with /stop",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();

    const stopButton = new ButtonBuilder()
      .setCustomId("stop_timer")
      .setLabel("Stop Timer")
      .setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(stopButton);

    await startTimer({
      channelId:    interaction.channelId ?? "",
      studyMinutes: studyMin,
      breakMinutes: breakMin,
      style,
      rotate,
      cycleImages,
      interaction,
      row,
      startedByName: interaction.user.displayName,
    });
  } else if (interaction.commandName === "stop") {
    const stopped = stopTimer(interaction.channelId ?? "", {
      stoppedById:  interaction.user.id,
      stoppedByName: interaction.user.displayName,
    });
    if (stopped) {
      await interaction.reply({ content: "✅ Timer stopped.", flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: "⚠️ No active timer found.", flags: MessageFlags.Ephemeral });
    }
  }
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId === "stop_timer") {
    const stopped = stopTimer(interaction.channelId ?? "", {
      stoppedById:  interaction.user.id,
      stoppedByName: interaction.user.displayName,
    });
    if (stopped) {
      await interaction.reply({
        content: `✅ Timer stopped by ${interaction.user.displayName}`,
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({ content: "⚠️ No active timer found.", flags: MessageFlags.Ephemeral });
    }
  }
}

// Aliases for compatibility with src/index.ts entry point
export async function initBot(_opts?: unknown): Promise<void> {
  return startBot();
}
export async function shutdownBot(_signal?: unknown): Promise<void> {
  shutdownAllTimers();
}
