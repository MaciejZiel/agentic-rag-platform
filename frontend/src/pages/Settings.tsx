import { useEffect, useState } from "react";
import {
  Settings,
  Key,
  Webhook,
  Cpu,
  Copy,
  Check,
  Plus,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type ModelInfo, listModels } from "@/lib/api";

export function SettingsPage() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [defaultModel, setDefaultModel] = useState("");
  const [chunkStrategy, setChunkStrategy] = useState("fixed_size");
  const [maxTokens, setMaxTokens] = useState("512");
  const [overlapTokens, setOverlapTokens] = useState("50");

  // API key management (demo)
  const [apiKeys, setApiKeys] = useState<Array<{ id: string; prefix: string; label: string; created: string }>>([
    { id: "1", prefix: "rag_abc12345", label: "Default Key", created: "2026-04-01" },
  ]);
  const [showKey, setShowKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Webhooks (demo)
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhooks, setWebhooks] = useState<Array<{ id: string; url: string; event: string }>>([]);

  useEffect(() => {
    listModels().then((res) => {
      setModels(res.models);
      setDefaultModel(res.default);
    });
    // Load webhooks
    fetch("/api/v1/webhooks")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setWebhooks(data);
      })
      .catch(() => {});
  }, []);

  function handleCopyKey(prefix: string) {
    navigator.clipboard.writeText(prefix + "...");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleAddWebhook() {
    if (!webhookUrl.trim()) return;
    try {
      const res = await fetch("/api/v1/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl, event_type: "*" }),
      });
      if (res.ok) {
        const wh = await res.json();
        setWebhooks((prev) => [...prev, wh]);
        setWebhookUrl("");
      }
    } catch {}
  }

  async function handleDeleteWebhook(id: string) {
    await fetch(`/api/v1/webhooks/${id}`, { method: "DELETE" });
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6" /> Settings
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your API keys, webhooks, and default configurations.
        </p>
      </div>

      {/* API Keys */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Key className="h-4 w-4" /> API Keys
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {apiKeys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{key.label}</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-muted-foreground">
                    {showKey === key.id ? key.prefix + "..." : key.prefix.slice(0, 8) + "••••••••"}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => setShowKey(showKey === key.id ? null : key.id)}
                  >
                    {showKey === key.id ? (
                      <EyeOff className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">Created {key.created}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => handleCopyKey(key.prefix)}
              >
                {copied ? (
                  <Check className="h-3 w-3 mr-1" />
                ) : (
                  <Copy className="h-3 w-3 mr-1" />
                )}
                Copy
              </Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Use the X-API-Key header to authenticate requests and scope data to your tenant.
          </p>
        </CardContent>
      </Card>

      {/* Default Model */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Cpu className="h-4 w-4" /> Default Model
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Chat Model</label>
            <Select value={defaultModel} onValueChange={setDefaultModel}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-sm">
                    {m.name} — {m.provider}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">
              Chunking Strategy
            </label>
            <Select value={chunkStrategy} onValueChange={setChunkStrategy}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed_size">Fixed Size</SelectItem>
                <SelectItem value="sentence">Sentence-based</SelectItem>
                <SelectItem value="paragraph">Paragraph-based</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Max Tokens per Chunk
              </label>
              <Input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Overlap Tokens
              </label>
              <Input
                type="number"
                value={overlapTokens}
                onChange={(e) => setOverlapTokens(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            These defaults apply when indexing new documents without explicit parameters.
          </p>
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Webhook className="h-4 w-4" /> Webhooks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-server.com/webhook"
              className="text-sm"
            />
            <Button size="sm" onClick={handleAddWebhook} disabled={!webhookUrl.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>

          {webhooks.length > 0 && (
            <div className="space-y-2">
              {webhooks.map((wh) => (
                <div
                  key={wh.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{wh.url}</p>
                    <Badge variant="outline" className="text-[10px] mt-0.5">
                      {wh.event_type ?? "*"}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => handleDeleteWebhook(wh.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Webhooks receive POST notifications for indexing.completed and indexing.failed events with HMAC signatures.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
