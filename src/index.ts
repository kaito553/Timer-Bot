import { startBot } from "./bot/index.js";
import { logger } from "./lib/logger.js";

process.on("unhandledRejection", (err) => logger.error(err, "unhandledRejection"));
process.on("uncaughtException", (err) => logger.error(err, "uncaughtException"));

startBot();
