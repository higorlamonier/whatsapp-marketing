import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().default(""),
  BASE_URL: z.string().default(""),
  META_APP_ID: z.string().default(""),
  META_APP_SECRET: z.string().default(""),
  WHATSAPP_TOKEN: z.string().default(""),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(""),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().default(""),
  WHATSAPP_API_VERSION: z.string().default("v22.0"),
  WEBHOOK_VERIFY_TOKEN: z.string().default(""),
  N8N_WEBHOOK_URL: z.string().default(""),
  N8N_WEBHOOK_AUTH_TOKEN: z.string().default("")
});

const parsed = envSchema.parse(process.env);

const requiredVars = [
  "DATABASE_URL",
  "BASE_URL",
  "META_APP_ID",
  "META_APP_SECRET",
  "WHATSAPP_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_BUSINESS_ACCOUNT_ID",
  "WEBHOOK_VERIFY_TOKEN"
] as const;

const missingVars = requiredVars.filter((key) => !parsed[key]);

if (missingVars.length > 0) {
  console.warn(
    `[CONFIG] Variaveis ausentes: ${missingVars.join(", ")}. O servidor inicia, mas recursos dependentes podem falhar.`
  );
}

export const env = parsed;
