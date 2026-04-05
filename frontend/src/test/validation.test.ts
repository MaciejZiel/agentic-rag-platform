import { describe, it, expect } from "vitest";
import {
  sanitizeInput,
  isValidEmail,
  isWithinLength,
  isSafeFilename,
  isValidJson,
  getValidationError,
} from "@/lib/validation";

describe("sanitizeInput", () => {
  it("escapes HTML tags", () => {
    expect(sanitizeInput("<script>alert('xss')</script>")).not.toContain("<script>");
  });

  it("escapes quotes", () => {
    expect(sanitizeInput('"hello"')).toBe("&quot;hello&quot;");
  });

  it("passes safe text through", () => {
    expect(sanitizeInput("hello world")).toBe("hello world");
  });
});

describe("isValidEmail", () => {
  it("accepts valid emails", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("test+tag@domain.co.uk")).toBe(true);
  });

  it("rejects invalid emails", () => {
    expect(isValidEmail("not-email")).toBe(false);
    expect(isValidEmail("@domain.com")).toBe(false);
    expect(isValidEmail("user@")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("isWithinLength", () => {
  it("validates length range", () => {
    expect(isWithinLength("hello", 1, 10)).toBe(true);
    expect(isWithinLength("", 1, 10)).toBe(false);
    expect(isWithinLength("a".repeat(11), 1, 10)).toBe(false);
  });

  it("trims whitespace", () => {
    expect(isWithinLength("  hi  ", 1, 5)).toBe(true);
  });
});

describe("isSafeFilename", () => {
  it("accepts safe filenames", () => {
    expect(isSafeFilename("document.pdf")).toBe(true);
    expect(isSafeFilename("my report (2024).docx")).toBe(true);
  });

  it("rejects path traversal", () => {
    expect(isSafeFilename("../etc/passwd")).toBe(false);
    expect(isSafeFilename("..\\windows\\system32")).toBe(false);
  });

  it("rejects dotfiles", () => {
    expect(isSafeFilename(".env")).toBe(false);
  });
});

describe("isValidJson", () => {
  it("accepts valid JSON", () => {
    expect(isValidJson('{"key": "value"}')).toBe(true);
    expect(isValidJson("[]")).toBe(true);
  });

  it("rejects invalid JSON", () => {
    expect(isValidJson("{bad}")).toBe(false);
    expect(isValidJson("")).toBe(false);
  });
});

describe("getValidationError", () => {
  it("returns null for valid input", () => {
    expect(getValidationError("Name", "John", { required: true, minLength: 1 })).toBeNull();
  });

  it("returns error for required empty field", () => {
    expect(getValidationError("Name", "", { required: true })).toBe("Name is required");
  });

  it("returns error for too short input", () => {
    expect(getValidationError("Password", "abc", { minLength: 8 })).toBe(
      "Password must be at least 8 characters",
    );
  });

  it("returns error for invalid email", () => {
    expect(getValidationError("Email", "bad", { email: true })).toBe(
      "Please enter a valid email address",
    );
  });
});
