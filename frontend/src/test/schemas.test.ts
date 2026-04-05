import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema, webhookUrlSchema, collectionSchema } from "@/lib/schemas";

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({ email: "user@test.com", password: "12345678" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-email", password: "12345678" });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = loginSchema.safeParse({ email: "user@test.com", password: "123" });
    expect(result.success).toBe(false);
  });

  it("rejects empty fields", () => {
    const result = loginSchema.safeParse({ email: "", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("accepts valid registration", () => {
    const result = registerSchema.safeParse({
      email: "user@test.com",
      password: "securepass123",
      fullName: "Test User",
      accountType: "personal",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = registerSchema.safeParse({
      email: "user@test.com",
      password: "securepass123",
      fullName: "",
      accountType: "personal",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid account type", () => {
    const result = registerSchema.safeParse({
      email: "user@test.com",
      password: "securepass123",
      fullName: "Test",
      accountType: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password over 128 chars", () => {
    const result = registerSchema.safeParse({
      email: "user@test.com",
      password: "a".repeat(129),
      fullName: "Test",
      accountType: "personal",
    });
    expect(result.success).toBe(false);
  });
});

describe("webhookUrlSchema", () => {
  it("accepts valid https URL", () => {
    expect(webhookUrlSchema.safeParse("https://example.com/webhook").success).toBe(true);
  });

  it("accepts valid http URL", () => {
    expect(webhookUrlSchema.safeParse("http://example.com/webhook").success).toBe(true);
  });

  it("rejects non-URL", () => {
    expect(webhookUrlSchema.safeParse("not a url").success).toBe(false);
  });

  it("rejects ftp URL", () => {
    expect(webhookUrlSchema.safeParse("ftp://files.com/data").success).toBe(false);
  });
});

describe("collectionSchema", () => {
  it("accepts valid collection", () => {
    expect(collectionSchema.safeParse({ name: "My Docs" }).success).toBe(true);
  });

  it("accepts collection with color", () => {
    expect(collectionSchema.safeParse({ name: "Docs", color: "#ff0000" }).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(collectionSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects invalid color", () => {
    expect(collectionSchema.safeParse({ name: "Docs", color: "red" }).success).toBe(false);
  });
});
