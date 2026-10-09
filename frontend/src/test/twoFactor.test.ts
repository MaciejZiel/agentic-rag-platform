import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { authLogin, authVerify2FA, enable2FA, get2FAStatus, setTokens, clearTokens } from "@/lib/api";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("two-factor API client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    clearTokens();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("surfaces the 2FA challenge from login without tokens", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ two_factor_required: true, challenge_token: "chal", access_token: null }),
    );
    const result = await authLogin("a@example.com", "pw");
    expect(result.two_factor_required).toBe(true);
    if (result.two_factor_required) expect(result.challenge_token).toBe("chal");
  });

  it("exchanges the challenge and code for tokens", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ access_token: "a", refresh_token: "r" }));
    const tokens = await authVerify2FA("chal", "123456");
    expect(tokens.access_token).toBe("a");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/auth/2fa/verify");
    expect(JSON.parse(init.body)).toEqual({ challenge_token: "chal", code: "123456" });
  });

  it("reports the server's error message on a wrong code", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: "Invalid verification code." }, 401));
    await expect(authVerify2FA("chal", "000000")).rejects.toThrow("Invalid verification code.");
  });

  it("calls the enrolment endpoints with the bearer token", async () => {
    setTokens("access", "refresh");
    fetchMock.mockResolvedValueOnce(jsonResponse({ enabled: false, recovery_codes_remaining: 0 }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ recovery_codes: ["aaaa-bbbb-cccc"] }));

    expect((await get2FAStatus()).enabled).toBe(false);
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");

    expect((await enable2FA("123456")).recovery_codes).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/v1/auth/2fa/enable");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer access");
  });
});
