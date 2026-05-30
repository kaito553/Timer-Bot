const ts = () => new Date().toISOString();

function fmt(level: string, obj: unknown, msg?: string): string {
  if (msg && obj && typeof obj === "object") {
    return `[${ts()}] ${level}: ${msg} ${JSON.stringify(obj)}`;
  }
  if (msg) return `[${ts()}] ${level}: ${msg}`;
  return `[${ts()}] ${level}: ${JSON.stringify(obj)}`;
}

export const logger = {
  info:  (obj: unknown, msg?: string) => console.log(fmt("INFO",  obj, msg)),
  warn:  (obj: unknown, msg?: string) => console.warn(fmt("WARN",  obj, msg)),
  error: (obj: unknown, msg?: string) => console.error(fmt("ERROR", obj, msg)),
  debug: (obj: unknown, msg?: string) => console.debug(fmt("DEBUG", obj, msg)),
};
