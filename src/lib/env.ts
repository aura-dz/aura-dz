import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  REDIS_URL: z.string().url().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  ADMIN_SESSION_SECRET: z.string().min(32).optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  YALIDINE_API_ID: z.string().optional(),
  YALIDINE_API_TOKEN: z.string().optional(),
  ZR_EXPRESS_TOKEN: z.string().optional(),
  MAYSTRO_API_KEY: z.string().optional(),
  ECOTRACK_API_TOKEN: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export function requireDatabaseUrl() {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return env.DATABASE_URL;
}