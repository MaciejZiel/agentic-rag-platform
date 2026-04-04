const BASE = "/api/v1";

// ─── Auth token management ──────────────────────────────────────

let accessToken: string | null = localStorage.getItem("access_token");
let refreshToken: string | null = localStorage.getItem("refresh_token");

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export function getAccessToken() {
  return accessToken;
}

function authHeaders(): Record<string, string> {
  if (accessToken) {
    return { Authorization: `Bearer ${accessToken}` };
  }
  return {};
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

/** Fetch with automatic token refresh on 401. */
async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = { ...authHeaders(), ...init?.headers };
  let res = await fetch(url, { ...init, headers });

  if (res.status === 401 && refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retryHeaders = { ...authHeaders(), ...init?.headers };
      res = await fetch(url, { ...init, headers: retryHeaders });
    }
  }
  return res;
}

// ─── Auth API ───────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  account_type: string;
  is_email_verified: boolean;
  is_2fa_enabled: boolean;
  tenant_id: string;
  created_at: string;
}

export async function authRegister(
  email: string,
  password: string,
  fullName: string,
  accountType: string,
): Promise<{ message: string }> {
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, full_name: fullName, account_type: accountType }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail ?? "Registration failed");
  }
  return res.json();
}

export async function authVerifyEmail(
  email: string,
  code: string,
): Promise<{ access_token: string; refresh_token: string }> {
  const res = await fetch(`${BASE}/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail ?? "Verification failed");
  }
  return res.json();
}

export async function authLogin(
  email: string,
  password: string,
): Promise<{ access_token: string; refresh_token: string }> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail ?? "Login failed");
  }
  return res.json();
}

export async function authGetMe(): Promise<AuthUser> {
  const res = await authFetch(`${BASE}/auth/me`);
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

export async function authResendCode(email: string): Promise<void> {
  await fetch(`${BASE}/auth/resend-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code: "" }),
  });
}

export interface Document {
  id: string;
  filename: string;
  content_type: string;
  file_size: number;
  status: "uploaded" | "processing" | "indexed" | "failed";
  chunk_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentList {
  documents: Document[];
  total: number;
}

export interface SourceCitation {
  document_id: string;
  chunk_index: number;
  content: string;
  score: number;
}

export interface AskResponse {
  answer: string;
  sources: SourceCitation[];
  model: string;
  token_usage: number;
  cost_usd: number;
}

export interface ExtractionResponse {
  document_id: string;
  extracted_data: Record<string, unknown>;
  model: string;
  token_usage: number;
  cost_usd: number;
}

export interface SSEEvent {
  type: "sources" | "token" | "done";
  sources?: Array<{ document_id: string; chunk_index: number; score: number }>;
  content?: string;
  conversation_id?: string;
}

export async function uploadDocument(file: File): Promise<Document> {
  const form = new FormData();
  form.append("file", file);
  const res = await authFetch(`${BASE}/documents/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
  return res.json();
}

export async function listDocuments(): Promise<DocumentList> {
  const res = await authFetch(`${BASE}/documents`);
  return res.json();
}

export async function getDocument(id: string): Promise<Document> {
  const res = await authFetch(`${BASE}/documents/${id}`);
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
  return res.json();
}

export async function indexDocument(id: string): Promise<Document> {
  const res = await authFetch(`${BASE}/documents/${id}/index`, { method: "POST" });
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
  return res.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await authFetch(`${BASE}/documents/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
}

export async function askQuestion(
  question: string,
  documentIds?: string[],
  topK = 5,
  model?: string,
): Promise<AskResponse> {
  const res = await authFetch(`${BASE}/qa/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, document_ids: documentIds, top_k: topK, model }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
  return res.json();
}

export async function* askStream(
  question: string,
  documentIds?: string[],
  topK = 5,
  model?: string,
  conversationId?: string,
): AsyncGenerator<SSEEvent> {
  const res = await authFetch(`${BASE}/qa/ask/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question, document_ids: documentIds, top_k: topK, model,
      conversation_id: conversationId,
    }),
  });
  if (!res.ok) throw new Error("Stream failed");
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        yield JSON.parse(line.slice(6));
      }
    }
  }
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
}

export interface ModelsResponse {
  models: ModelInfo[];
  default: string;
}

export async function listModels(): Promise<ModelsResponse> {
  const res = await authFetch(`${BASE}/models`);
  return res.json();
}

export async function extractJson(
  documentId: string,
  schemaDefinition: Record<string, unknown>,
  instructions?: string,
  model?: string,
): Promise<ExtractionResponse> {
  const res = await authFetch(`${BASE}/extract/json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      document_id: documentId,
      schema_definition: schemaDefinition,
      instructions,
      model,
    }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
  return res.json();
}

// --- Stats ---

export interface PlatformStats {
  total_documents: number;
  indexed_documents: number;
  total_chunks: number;
  total_queries: number;
  total_extractions: number;
  total_conversations: number;
  total_tokens_used: number;
  total_cost_usd: number;
  recent_queries: Array<{
    id: string;
    question: string;
    model: string;
    token_usage: number;
    cost_usd: number;
    created_at: string;
  }>;
}

export async function getStats(): Promise<PlatformStats> {
  const res = await authFetch(`${BASE}/stats`);
  return res.json();
}

// --- Tenants / Auth ---

export interface TenantResponse {
  id: string;
  name: string;
  api_key: string;
}

export async function createTenant(name: string): Promise<TenantResponse> {
  const res = await fetch(`${BASE}/tenants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
  return res.json();
}

// --- Query history ---

export async function getQueryHistory(): Promise<Array<{
  id: string;
  question: string;
  answer: string | null;
  model: string;
  token_usage: number;
  cost_usd: number;
  created_at: string;
}>> {
  const res = await authFetch(`${BASE}/qa/history`);
  if (!res.ok) return [];
  return res.json();
}
