import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long"),
  fullName: z
    .string()
    .min(1, "Name is required")
    .max(256, "Name too long"),
  accountType: z.enum(["personal", "organization"]),
});

export const webhookUrlSchema = z
  .string()
  .url("Must be a valid URL")
  .startsWith("http", "URL must start with http:// or https://");

export const collectionSchema = z.object({
  name: z.string().min(1, "Name is required").max(128, "Name too long"),
  description: z.string().max(1024, "Description too long").optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color (#RRGGBB)")
    .optional(),
});

export const assistantSchema = z.object({
  name: z.string().min(1, "Name is required").max(128, "Name too long"),
  systemPrompt: z.string().min(1, "System prompt is required").max(4096, "Prompt too long"),
  model: z.string().min(1, "Model is required"),
  temperature: z.number().min(0).max(2),
});

export const workflowSchema = z.object({
  name: z.string().min(1, "Name is required").max(128, "Name too long"),
  description: z.string().max(1024, "Description too long").optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
