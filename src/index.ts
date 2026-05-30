import { initBot, shutdownBot } from "./bot/index.js";
import { logger } from "./lib/logger.js";

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  logger.error({}, "DISCORD_BOT_TOKEN environment variable is not set.");
  process.exit(1);
}

async function main(): Promise<void> {
  logger.info({}, "Starting Discord Timer Bot...");
  await initBot(token!);
  logger.info({}, "Bot is online.");
}

async function shutdown(sig: string): Promise<void> {
  logger.info({ sig }, "Shutting down...");
  await shutdownBot();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT",  () => void shutdown("SIGINT"));

main().catch((err) => {
  logger.error({ err }, "Fatal error during startup");
  process.exit(1);
});
