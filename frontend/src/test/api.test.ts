import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setTokens, clearTokens, getAccessToken, indexDocument, waitForJob } from "@/lib/api";

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

describe("background indexing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }

  it("indexDocument returns the queued job", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json({ job_id: "j1", status: "pending", document: { id: "d1", status: "processing" } }, 202),
    );
    vi.stubGlobal("fetch", fetchMock);
    const queued = await indexDocument("d1", { chunk_strategy: "sentence" });
    expect(queued.job_id).toBe("j1");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/documents/d1/index");
  });

  it("waitForJob polls until the job finishes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ id: "j1", status: "pending" }))
      .mockResolvedValueOnce(json({ id: "j1", status: "running" }))
      .mockResolvedValueOnce(json({ id: "j1", status: "completed" }));
    vi.stubGlobal("fetch", fetchMock);
    const job = await waitForJob("j1", { intervalMs: 1 });
    expect(job.status).toBe("completed");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/jobs/j1");
  });

  it("waitForJob resolves with failed jobs so callers can show the error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ id: "j1", status: "failed", error_message: "No text extracted" })));
    const job = await waitForJob("j1", { intervalMs: 1 });
    expect(job.error_message).toBe("No text extracted");
  });

  it("waitForJob gives up after the timeout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(json({ id: "j1", status: "running" }))));
    await expect(waitForJob("j1", { intervalMs: 1, timeoutMs: 5 })).rejects.toThrow("Timed out");
  });
});
