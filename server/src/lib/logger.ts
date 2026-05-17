import pino from "pino";
import { env } from "./env";

const isDev = env.NODE_ENV === "development";
const isTest = env.NODE_ENV === "test";

export const logger = pino({
  level: isTest ? "silent" : (process.env.LOG_LEVEL ?? "info"),
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss.l",
        ignore: "pid,hostname",
      },
    },
  }),
});
