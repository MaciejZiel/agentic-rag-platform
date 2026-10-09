import { useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Play, Copy, Check, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAccessToken } from "@/lib/api";

const ENDPOINTS = [
  { method: "GET", path: "/api/v1/documents", label: "List Documents", body: false },
  { method: "GET", path: "/api/v1/stats", label: "Platform Stats", body: false },
  { method: "GET", path: "/api/v1/models", label: "Available Models", body: false },
  { method: "GET", path: "/api/v1/conversations", label: "Conversations", body: false },
  { method: "GET", path: "/api/v1/qa/history", label: "Query History", body: false },
  { method: "GET", path: "/api/v1/collections", label: "List Collections", body: false },
  { method: "GET", path: "/api/v1/notifications", label: "Notifications", body: false },
  { method: "GET", path: "/api/v1/health", label: "Health Check", body: false },
  {
    method: "POST",
    path: "/api/v1/qa/ask",
    label: "Ask Question (RAG)",
    body: true,
    defaultBody: JSON.stringify({ question: "What is this document about?", top_k: 5 }, null, 2),
  },
  {
    method: "POST",
    path: "/api/v1/extract/json",
    label: "Extract JSON",
    body: true,
    defaultBody: JSON.stringify(
      {
        document_id: "<document-id>",
        schema_definition: { type: "object", properties: { title: { type: "string" } } },
      },
      null,
      2,
    ),
  },
  {
    method: "POST",
    path: "/api/v1/collections",
    label: "Create Collection",
    body: true,
    defaultBody: JSON.stringify({ name: "My Collection", description: "Test collection" }, null, 2),
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-green-500/10 text-green-600 dark:text-green-400",
  POST: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  PUT: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  DELETE: "bg-red-500/10 text-red-600 dark:text-red-400",
  PATCH: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

export function PlaygroundPage() {
  usePageTitle("API Playground");
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/api/v1/documents");
  const [body, setBody] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSend() {
    setLoading(true);
    setResponse(null);
    setStatus(null);
    setDuration(null);

    const token = getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (body && method !== "GET") headers["Content-Type"] = "application/json";

    const start = performance.now();
    try {
      const res = await fetch(path, {
        method,
        headers,
        body: method !== "GET" && body ? body : undefined,
      });
      const elapsed = Math.round(performance.now() - start);
      setDuration(elapsed);
      setStatus(res.status);

      const text = await res.text();
      try {
        const json = JSON.parse(text);
        setResponse(JSON.stringify(json, null, 2));
      } catch {
        setResponse(text);
      }
    } catch (e) {
      setDuration(Math.round(performance.now() - start));
      setResponse(e instanceof Error ? e.message : "Request failed");
      setStatus(0);
    } finally {
      setLoading(false);
    }
  }

  function selectEndpoint(ep: (typeof ENDPOINTS)[number]) {
    setMethod(ep.method);
    setPath(ep.path);
    setBody(ep.body && "defaultBody" in ep ? (ep as { defaultBody: string }).defaultBody : "");
    setResponse(null);
    setStatus(null);
  }

  function handleCopy() {
    if (response) {
      navigator.clipboard.writeText(response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Terminal className="h-6 w-6" /> API Playground
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Test API endpoints interactively.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Endpoint picker */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Endpoints</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-3">
            {ENDPOINTS.map((ep) => (
              <button
                key={ep.path + ep.method}
                className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left transition-colors hover:bg-muted ${
                  path === ep.path && method === ep.method ? "bg-muted font-medium" : ""
                }`}
                onClick={() => selectEndpoint(ep)}
              >
                <Badge className={`text-[9px] px-1 py-0 font-mono ${METHOD_COLORS[ep.method]}`}>
                  {ep.method}
                </Badge>
                <span className="truncate">{ep.label}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Request/Response */}
        <div className="lg:col-span-3 space-y-4">
          {/* Request bar */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex gap-2">
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="h-9 rounded-md border bg-background px-2 text-sm font-mono"
                >
                  <option>GET</option>
                  <option>POST</option>
                  <option>PUT</option>
                  <option>PATCH</option>
                  <option>DELETE</option>
                </select>
                <Input
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  className="font-mono text-sm"
                  placeholder="/api/v1/..."
                />
                <Button onClick={handleSend} disabled={loading}>
                  <Play className="h-4 w-4 mr-1" />
                  {loading ? "Sending..." : "Send"}
                </Button>
              </div>
              {method !== "GET" && (
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Request body (JSON)"
                  className="font-mono text-xs min-h-[100px]"
                />
              )}
            </CardContent>
          </Card>

          {/* Response */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Response</CardTitle>
              <div className="flex items-center gap-3">
                {status !== null && (
                  <Badge
                    variant={status >= 200 && status < 300 ? "default" : "destructive"}
                    className="text-xs"
                  >
                    {status}
                  </Badge>
                )}
                {duration !== null && (
                  <span className="text-xs text-muted-foreground">{duration}ms</span>
                )}
                {response && (
                  <Button variant="ghost" size="sm" className="h-7" onClick={handleCopy}>
                    {copied ? (
                      <Check className="h-3 w-3 mr-1" />
                    ) : (
                      <Copy className="h-3 w-3 mr-1" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[400px]">
                {response ? (
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-muted/50 rounded-md p-3">
                    {response}
                  </pre>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-12">
                    Send a request to see the response
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
