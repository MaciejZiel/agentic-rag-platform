const BASE = "/api/v1";

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
}

export async function uploadDocument(file: File): Promise<Document> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/documents/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
  return res.json();
}

export async function listDocuments(): Promise<DocumentList> {
  const res = await fetch(`${BASE}/documents`);
  return res.json();
}

export async function getDocument(id: string): Promise<Document> {
  const res = await fetch(`${BASE}/documents/${id}`);
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
  return res.json();
}

export async function indexDocument(id: string): Promise<Document> {
  const res = await fetch(`${BASE}/documents/${id}/index`, { method: "POST" });
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
  return res.json();
}

export async function askQuestion(
  question: string,
  documentIds?: string[],
  topK = 5,
): Promise<AskResponse> {
  const res = await fetch(`${BASE}/qa/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, document_ids: documentIds, top_k: topK }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
  return res.json();
}

export async function* askStream(
  question: string,
  documentIds?: string[],
  topK = 5,
): AsyncGenerator<SSEEvent> {
  const res = await fetch(`${BASE}/qa/ask/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, document_ids: documentIds, top_k: topK }),
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

export async function extractJson(
  documentId: string,
  schemaDefinition: Record<string, unknown>,
  instructions?: string,
): Promise<ExtractionResponse> {
  const res = await fetch(`${BASE}/extract/json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      document_id: documentId,
      schema_definition: schemaDefinition,
      instructions,
    }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
  return res.json();
}
