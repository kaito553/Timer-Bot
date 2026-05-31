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
import { startTimer, stopTimer, hasActiveTimer } from "./timerManager.js";
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

function isStyleValue(v: string): v is TimerStyle {
  return ["random","hellokitty","kuromi","kaitokid","gojo","mylittlepony","anime"].includes(v);
}

const commands = [
  new SlashCommandBuilder()
    .setName("timer")
    .setDescription("Start a study timer")
    .addIntegerOption(o =>
      o.setName("study_minutes").setDescription("Study duration in minutes").setRequired(true).setMinValue(1).setMaxValue(180))
    .addIntegerOption(o =>
      o.setName("break_minutes").setDescription("Break duration in minutes").setRequired(true).setMinValue(1).setMaxValue(60))
    .addStringOption(o =>
      o.setName("style").setDescription("Timer visual style").setRequired(false)
        .addChoices(...STYLE_CHOICES))
    .toJSON(),
  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop the current timer")
    .toJSON(),
];

export async function startBot() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN missing");

  const clientId = process.env.DISCORD_CLIENT_ID ?? "1494745593225023539";

  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  logger.info("Slash commands registered");

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.on("interactionCreate", async (interaction) => {
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    }
  });

  client.once("ready", () => logger.info({ tag: client.user?.tag }, "Bot ready"));
  await client.login(token);
}

async function handleCommand(interaction: ChatInputCommandInteraction) {
  if (interaction.commandName === "timer") {
    const studyMin = interaction.options.getInteger("study_minutes", true);
    const breakMin = interaction.options.getInteger("break_minutes", true);
    const styleRaw = interaction.options.getString("style") ?? "random";
    const style: TimerStyle = isStyleValue(styleRaw) ? styleRaw : "random";

    if (hasActiveTimer(interaction.channelId ?? "")) {
      await interaction.reply({ content: "⚠️ A timer is already running! Stop it first with /stop", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();

    const stopButton = new ButtonBuilder()
      .setCustomId("stop_timer")
      .setLabel("Stop Timer")
      .setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(stopButton);

    await startTimer({
      channelId: interaction.channelId ?? "",
      studyMinutes: studyMin,
      breakMinutes: breakMin,
      style,
      interaction,
      row,
    });
  } else if (interaction.commandName === "stop") {
    const stopped = stopTimer(interaction.channelId ?? "", {
      stoppedById: interaction.user.id,
      stoppedByName: interaction.user.displayName,
    });
    if (stopped) {
      await interaction.reply({ content: "✅ Timer stopped.", flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: "⚠️ No active timer found.", flags: MessageFlags.Ephemeral });
    }
  }
}

async function handleButton(interaction: ButtonInteraction) {
  if (interaction.customId === "stop_timer") {
    const stopped = stopTimer(interaction.channelId ?? "", {
      stoppedById: interaction.user.id,
      stoppedByName: interaction.user.displayName,
    });
    if (stopped) {
      await interaction.reply({ content: `✅ Timer stopped by ${interaction.user.displayName}`, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: "⚠️ No active timer found.", flags: MessageFlags.Ephemeral });
    }
  }
}
