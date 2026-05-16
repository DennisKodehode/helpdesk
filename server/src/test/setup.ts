import { config } from "dotenv";

config({ path: ".env.test" });

// Tests never actually hit Gemini (the worker is mocked / not invoked); satisfy env.ts
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-placeholder";
}
