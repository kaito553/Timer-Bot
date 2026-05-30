import { startBot } from "./bot/index.js";
import { logger } from "./lib/logger.js";

startBot().catch((err) => {
  logger.error({ err }, "Failed to start Discord bot");
  process.exit(1);
});
