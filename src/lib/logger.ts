type LogObj = Record<string, unknown>;

function fmt(level: string, obj: LogObj | string, msg?: string): string {
  if (typeof obj === "string") {
    return `[${new Date().toISOString()}] ${level} ${obj}`;
  }
  const message = msg ?? "";
  let extra = "";
  try {
    extra = Object.keys(obj).length ? " " + JSON.stringify(obj) : "";
  } catch {
    extra = "";
  }
  return `[${new Date().toISOString()}] ${level} ${message}${extra}`;
}

export const logger = {
  info(obj: LogObj | string, msg?: string): void {
    console.log(fmt("INFO ", obj, msg));
  },
  warn(obj: LogObj | string, msg?: string): void {
    console.warn(fmt("WARN ", obj, msg));
  },
  error(obj: LogObj | string, msg?: string): void {
    console.error(fmt("ERROR", obj, msg));
  },
  debug(obj: LogObj | string, msg?: string): void {
    console.log(fmt("DEBUG", obj, msg));
  },
};
