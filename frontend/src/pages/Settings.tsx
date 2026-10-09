import { useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDate } from "@/lib/date";
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
  User,
  Mail,
  Building2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type ModelInfo,
  type AuthUser,
  listModels,
  listWebhooks,
  createWebhook,
  deleteWebhook as apiDeleteWebhook,
} from "@/lib/api";
import { toast } from "sonner";
import { TwoFactorSetup } from "@/components/TwoFactorSetup";

interface Props {
  user: AuthUser;
  onUserUpdate: (user: AuthUser) => void;
}

export function SettingsPage({ user, onUserUpdate }: Props) {
  usePageTitle("Settings");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [defaultModel, setDefaultModel] = useState("");
  const [chunkStrategy, setChunkStrategy] = useState("fixed_size");
  const [maxTokens, setMaxTokens] = useState("512");
  const [overlapTokens, setOverlapTokens] = useState("50");

  // Profile editing
  const [displayName, setDisplayName] = useState(user.full_name);
  const [profileEmail, setProfileEmail] = useState(user.email);
  const [profileSaved, setProfileSaved] = useState(false);

  // 2FA
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user.is_2fa_enabled);

  // API key management
  const [apiKeys] = useState<Array<{ id: string; prefix: string; label: string; created: string }>>([
    { id: "1", prefix: "rag_••••••••", label: "Default Key", created: formatDate(user.created_at) },
  ]);
  const [showKey, setShowKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Webhooks
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhooks, setWebhooks] = useState<Array<{ id: string; url: string; event_type?: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      listModels()
        .then((res) => {
          setModels(res.models);
          setDefaultModel(res.default);
        })
        .catch(() => toast.error("Failed to load models")),
      listWebhooks()
        .then(setWebhooks)
        .catch(() => toast.error("Failed to load webhooks")),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  function handleCopyKey(prefix: string) {
    navigator.clipboard.writeText(prefix + "...");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSaveProfile() {
    onUserUpdate({ ...user, full_name: displayName, email: profileEmail });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  function handleToggle2FA(enabled: boolean) {
    setTwoFactorEnabled(enabled);
    onUserUpdate({ ...user, is_2fa_enabled: enabled });
  }

  async function handleAddWebhook() {
    if (!webhookUrl.trim()) return;
    try {
      const wh = await createWebhook(webhookUrl);
      setWebhooks((prev) => [...prev, wh]);
      setWebhookUrl("");
      toast.success("Webhook added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add webhook");
    }
  }

  async function handleDeleteWebhook(id: string) {
    try {
      await apiDeleteWebhook(id);
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
    } catch {
      toast.error("Failed to delete webhook");
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6" /> Settings
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your profile, security, API keys, and configurations.
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-primary/10 p-4">
              {user.account_type === "organization" ? (
                <Building2 className="h-6 w-6 text-primary" />
              ) : (
                <User className="h-6 w-6 text-primary" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">{user.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {user.email} ·{" "}
                {user.account_type === "organization"
                  ? "Organization"
                  : "Personal"}{" "}
                account
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Display Name</Label>
              <Input
                id="profile-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="profile-email"
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="text-sm pl-9"
                />
              </div>
            </div>
          </div>

          <Button
            size="sm"
            onClick={handleSaveProfile}
            disabled={!displayName.trim()}
          >
            {profileSaved ? (
              <>
                <Check className="h-3 w-3 mr-1" /> Saved
              </>
            ) : (
              "Save Profile"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Security / 2FA */}
      <TwoFactorSetup enabled={twoFactorEnabled} onToggle={handleToggle2FA} />

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
            <Label>Chat Model</Label>
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
            <Label>Chunking Strategy</Label>
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
              <Label>Max Tokens per Chunk</Label>
              <Input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label>Overlap Tokens</Label>
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
