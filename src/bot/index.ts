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
  { name: "عشوائي (نيون)", value: "random" },
  { name: "هيلو كيتي 🎀", value: "hellokitty" },
  { name: "كورومي 🖤", value: "kuromi" },
  { name: "كايتو كيد ♠", value: "kaitokid" },
  { name: "ساتورو غوجو ∞", value: "gojo" },
  { name: "ماي ليتل بوني 🦄", value: "mylittlepony" },
  { name: "أنمي 🌙", value: "anime" },
];

function isStyleValue(v: string): v is TimerStyle {
  return ["random","hellokitty","kuromi","kaitokid","gojo","mylittlepony","anime"].includes(v);
}

const commands = [
  new SlashCommandBuilder()
    .setName("تايمر")
    .setDescription("ابدأ تايمر مذاكرة")
    .addIntegerOption(o =>
      o.setName("مدة_المذاكرة").setDescription("وقت المذاكرة بالدقايق").setRequired(true).setMinValue(1).setMaxValue(180))
    .addIntegerOption(o =>
      o.setName("مدة_البريك").setDescription("وقت البريك بالدقايق").setRequired(true).setMinValue(1).setMaxValue(60))
    .addStringOption(o =>
      o.setName("style").setDescription("شكل التايمر").setRequired(false)
        .addChoices(...STYLE_CHOICES))
    .toJSON(),
  new SlashCommandBuilder()
    .setName("ايقاف")
    .setDescription("وقّف التايمر الحالي")
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
  if (interaction.commandName === "تايمر") {
    const studyMin = interaction.options.getInteger("مدة_المذاكرة", true);
    const breakMin = interaction.options.getInteger("مدة_البريك", true);
    const styleRaw = interaction.options.getString("style") ?? "random";
    const style: TimerStyle = isStyleValue(styleRaw) ? styleRaw : "random";

    if (hasActiveTimer(interaction.channelId ?? "")) {
      await interaction.reply({ content: "⚠️ في تايمر شغال دلوقتي! وقّفه الأول بـ /ايقاف", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();

    const stopButton = new ButtonBuilder()
      .setCustomId("stop_timer")
      .setLabel("إيقاف التايمر")
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
  } else if (interaction.commandName === "ايقاف") {
    const stopped = stopTimer(interaction.channelId ?? "", {
      stoppedById: interaction.user.id,
      stoppedByName: interaction.user.displayName,
    });
    if (stopped) {
      await interaction.reply({ content: "✅ التايمر اتوقف.", flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: "⚠️ مفيش تايمر شغال.", flags: MessageFlags.Ephemeral });
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
      await interaction.reply({ content: `✅ التايمر اتوقف بواسطة ${interaction.user.displayName}`, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: "⚠️ مفيش تايمر شغال.", flags: MessageFlags.Ephemeral });
    }
  }
}
