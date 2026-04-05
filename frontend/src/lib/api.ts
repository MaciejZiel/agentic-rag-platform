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

export async function indexDocument(
  id: string,
  options?: { chunk_strategy?: string; max_tokens?: number; overlap_tokens?: number },
): Promise<Document> {
  const res = await authFetch(`${BASE}/documents/${id}/index`, {
    method: "POST",
    headers: options ? { "Content-Type": "application/json" } : {},
    body: options ? JSON.stringify(options) : undefined,
  });
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

// --- Chunk Preview ---

export interface ChunkPreview {
  chunk_index: number;
  content: string;
  token_count: number;
}

export interface ChunkPreviewResponse {
  document_id: string;
  filename: string;
  strategy: string;
  max_tokens: number;
  overlap_tokens: number;
  total_chunks: number;
  chunks: ChunkPreview[];
}

export async function previewChunks(
  documentId: string,
  strategy = "fixed_size",
  maxTokens = 512,
  overlapTokens = 50,
): Promise<ChunkPreviewResponse> {
  const res = await authFetch(`${BASE}/documents/${documentId}/preview-chunks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chunk_strategy: strategy,
      max_tokens: maxTokens,
      overlap_tokens: overlapTokens,
    }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Preview failed");
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

export interface DailyStats {
  date: string;
  queries: number;
  tokens: number;
  cost: number;
  extractions: number;
}

export interface ModelBreakdown {
  model: string;
  queries: number;
  tokens: number;
  cost: number;
}

export interface DocumentStatusBreakdown {
  status: string;
  count: number;
}

export interface DashboardTimeseries {
  daily: DailyStats[];
  by_model: ModelBreakdown[];
  by_status: DocumentStatusBreakdown[];
}

export async function getStatsTimeseries(days = 30): Promise<DashboardTimeseries> {
  const res = await authFetch(`${BASE}/stats/timeseries?days=${days}`);
  return res.json();
}

// --- Rate Limits ---

export interface RateLimitStatus {
  queries_used: number;
  queries_limit: number;
  tokens_used: number;
  tokens_limit: number;
  extractions_used: number;
  extractions_limit: number;
  window_minutes: number;
  resets_at: string;
}

export async function getRateLimits(): Promise<RateLimitStatus> {
  const res = await authFetch(`${BASE}/stats/rate-limits`);
  return res.json();
}

// --- Collections ---

export interface CollectionItem {
  id: string;
  name: string;
  description: string | null;
  color: string;
  document_count: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionList {
  collections: CollectionItem[];
  total: number;
}

export async function listCollections(): Promise<CollectionList> {
  const res = await authFetch(`${BASE}/collections`);
  return res.json();
}

export async function createCollection(data: {
  name: string;
  description?: string;
  color?: string;
}): Promise<CollectionItem> {
  const res = await authFetch(`${BASE}/collections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Failed to create collection");
  return res.json();
}

export async function updateCollection(
  id: string,
  data: { name?: string; description?: string; color?: string },
): Promise<CollectionItem> {
  const res = await authFetch(`${BASE}/collections/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Failed to update collection");
  return res.json();
}

export async function deleteCollection(id: string): Promise<void> {
  const res = await authFetch(`${BASE}/collections/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Failed to delete collection");
}

export async function addDocumentToCollection(collectionId: string, documentId: string): Promise<void> {
  const res = await authFetch(`${BASE}/collections/${collectionId}/documents/${documentId}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Failed to add document");
}

export async function removeDocumentFromCollection(collectionId: string, documentId: string): Promise<void> {
  const res = await authFetch(`${BASE}/collections/${collectionId}/documents/${documentId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Failed to remove document");
}

// --- Workflows ---

export interface WorkflowItem {
  id: string;
  name: string;
  description: string | null;
  definition: { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
  status: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  config?: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

export interface WorkflowList {
  workflows: WorkflowItem[];
  total: number;
}

export async function listWorkflows(): Promise<WorkflowList> {
  const res = await authFetch(`${BASE}/workflows`);
  return res.json();
}

export async function createWorkflow(data: {
  name: string;
  description?: string;
  definition?: { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
}): Promise<WorkflowItem> {
  const res = await authFetch(`${BASE}/workflows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Failed to create workflow");
  return res.json();
}

export async function updateWorkflow(
  id: string,
  data: {
    name?: string;
    description?: string;
    definition?: { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
    status?: string;
  },
): Promise<WorkflowItem> {
  const res = await authFetch(`${BASE}/workflows/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Failed to update workflow");
  return res.json();
}

export async function deleteWorkflow(id: string): Promise<void> {
  const res = await authFetch(`${BASE}/workflows/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Failed to delete workflow");
}

// --- Compare ---

export interface CompareResponse {
  document_a: string;
  document_b: string;
  analysis: string;
  model: string;
  token_usage: number;
  cost_usd: number;
}

export async function compareDocuments(
  documentIdA: string,
  documentIdB: string,
  model?: string,
): Promise<CompareResponse> {
  const res = await authFetch(`${BASE}/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document_id_a: documentIdA, document_id_b: documentIdB, model }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Comparison failed");
  return res.json();
}

// --- Admin ---

export interface AdminStats {
  total_users: number;
  verified_users: number;
  total_tenants: number;
  total_documents: number;
  total_queries: number;
  total_extractions: number;
  total_conversations: number;
  total_collections: number;
  total_assistants: number;
  total_tokens: number;
  total_cost_usd: number;
}

export interface UserInfo {
  id: string;
  email: string;
  full_name: string;
  account_type: string;
  is_email_verified: boolean;
  is_2fa_enabled: boolean;
  is_active: boolean;
  created_at: string;
}

export interface AdminOverview {
  health: { status: string; database: string; uptime_info: string };
  stats: AdminStats;
  recent_users: UserInfo[];
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const res = await authFetch(`${BASE}/admin/overview`);
  return res.json();
}

// --- Assistants ---

export interface AssistantItem {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  model: string;
  temperature: number;
  icon: string;
  created_at: string;
  updated_at: string;
}

export interface AssistantList {
  assistants: AssistantItem[];
  total: number;
}

export async function listAssistants(): Promise<AssistantList> {
  const res = await authFetch(`${BASE}/assistants`);
  return res.json();
}

export async function createAssistant(data: {
  name: string;
  description?: string;
  system_prompt: string;
  model?: string;
  temperature?: number;
  icon?: string;
}): Promise<AssistantItem> {
  const res = await authFetch(`${BASE}/assistants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Failed to create assistant");
  return res.json();
}

export async function updateAssistant(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    system_prompt: string;
    model: string;
    temperature: number;
    icon: string;
  }>,
): Promise<AssistantItem> {
  const res = await authFetch(`${BASE}/assistants/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Failed to update assistant");
  return res.json();
}

export async function deleteAssistant(id: string): Promise<void> {
  const res = await authFetch(`${BASE}/assistants/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Failed to delete assistant");
}

// --- Notifications ---

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  kind: "info" | "success" | "warning" | "error";
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export interface NotificationList {
  notifications: NotificationItem[];
  unread_count: number;
}

export async function listNotifications(): Promise<NotificationList> {
  const res = await authFetch(`${BASE}/notifications`);
  return res.json();
}

export async function markAllNotificationsRead(): Promise<void> {
  await authFetch(`${BASE}/notifications/read-all`, { method: "POST" });
}

export async function markNotificationRead(id: string): Promise<void> {
  await authFetch(`${BASE}/notifications/${id}/read`, { method: "POST" });
}

// --- Share Links ---

export interface ShareLinkOut {
  id: string;
  document_id: string;
  token: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export async function createShareLink(
  documentId: string,
  expiresInHours?: number,
): Promise<ShareLinkOut> {
  const res = await authFetch(`${BASE}/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      document_id: documentId,
      expires_in_hours: expiresInHours ?? 72,
    }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Failed to create share link");
  return res.json();
}

export async function revokeShareLink(token: string): Promise<void> {
  const res = await authFetch(`${BASE}/share/${token}`, { method: "DELETE" });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Failed to revoke link");
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
