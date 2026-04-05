import { describe, it, expect, beforeEach } from "vitest";
import { setTokens, clearTokens, getAccessToken } from "@/lib/api";

describe("token management", () => {
  beforeEach(() => {
    clearTokens();
    localStorage.clear();
  });

  it("stores and retrieves access token", () => {
    setTokens("test-access", "test-refresh");
    expect(getAccessToken()).toBe("test-access");
  });

  it("clears tokens", () => {
    setTokens("test-access", "test-refresh");
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });

  it("persists to localStorage", () => {
    setTokens("access-123", "refresh-456");
    expect(localStorage.getItem("access_token")).toBe("access-123");
    expect(localStorage.getItem("refresh_token")).toBe("refresh-456");
  });
});
