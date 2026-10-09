import { useCallback, useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDate } from "@/lib/date";
import {
  Bot,
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  Thermometer,
  Cpu,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  type AssistantItem,
  listAssistants,
  createAssistant,
  updateAssistant,
  deleteAssistant,
} from "@/lib/api";
import { ModelSelector } from "@/components/ModelSelector";
import { toast } from "sonner";

const ICONS = ["bot", "brain", "star", "zap", "book", "code", "heart", "shield"];

const ICON_MAP: Record<string, string> = {
  bot: "🤖",
  brain: "🧠",
  star: "⭐",
  zap: "⚡",
  book: "📚",
  code: "💻",
  heart: "❤️",
  shield: "🛡️",
};

export function AssistantsPage() {
  usePageTitle("Assistants");
  const [assistants, setAssistants] = useState<AssistantItem[]>([]);
  const [selected, setSelected] = useState<AssistantItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [temp, setTemp] = useState(0.7);
  const [icon, setIcon] = useState("bot");

  const refresh = useCallback(async () => {
    try {
      const data = await listAssistants();
      setAssistants(data.assistants);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  function resetForm() {
    setName("");
    setDesc("");
    setPrompt("");
    setModel("openai/gpt-4o-mini");
    setTemp(0.7);
    setIcon("bot");
  }

  function loadForm(a: AssistantItem) {
    setName(a.name);
    setDesc(a.description ?? "");
    setPrompt(a.system_prompt);
    setModel(a.model);
    setTemp(a.temperature);
    setIcon(a.icon);
  }

  async function handleCreate() {
    if (!name.trim() || !prompt.trim()) return;
    setError(null);
    try {
      await createAssistant({
        name: name.trim(),
        description: desc.trim() || undefined,
        system_prompt: prompt.trim(),
        model,
        temperature: temp,
        icon,
      });
      toast.success("Assistant created");
      setShowCreate(false);
      resetForm();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  }

  async function handleUpdate() {
    if (!selected || !name.trim() || !prompt.trim()) return;
    setError(null);
    try {
      const updated = await updateAssistant(selected.id, {
        name: name.trim(),
        description: desc.trim() || undefined,
        system_prompt: prompt.trim(),
        model,
        temperature: temp,
        icon,
      });
      toast.success("Assistant updated");
      setSelected(updated);
      setEditing(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteAssistant(id);
      toast.success("Assistant deleted");
      if (selected?.id === id) setSelected(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Bot className="h-6 w-6" /> AI Assistants
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create custom assistants with specialized system prompts and configurations.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setShowCreate(true);
            setSelected(null);
            setEditing(false);
            resetForm();
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> New Assistant
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assistant list */}
        <div className="space-y-3 lg:col-span-1">
          {assistants.length === 0 && !showCreate && (
            <p className="text-sm text-muted-foreground text-center py-12">
              No assistants yet. Create one to get started.
            </p>
          )}
          {assistants.map((a) => (
            <Card
              key={a.id}
              className={`cursor-pointer transition-colors ${
                selected?.id === a.id ? "border-primary" : "hover:border-primary/50"
              }`}
              onClick={() => {
                setSelected(a);
                setShowCreate(false);
                setEditing(false);
                loadForm(a);
              }}
            >
              <CardContent className="flex items-center gap-3 py-3">
                <span className="text-xl">{ICON_MAP[a.icon] ?? "🤖"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {a.description || a.model.split("/").pop()}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(a.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detail/Create panel */}
        <div className="lg:col-span-2">
          {showCreate || (selected && editing) ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {showCreate ? "Create Assistant" : "Edit Assistant"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium">Name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Legal Analyst" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Description</label>
                  <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Brief description (optional)" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">System Prompt</label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="You are a helpful assistant that specializes in..."
                    rows={5}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium flex items-center gap-1">
                      <Cpu className="h-3 w-3" /> Model
                    </label>
                    <ModelSelector value={model} onChange={setModel} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium flex items-center gap-1">
                      <Thermometer className="h-3 w-3" /> Temperature: {temp}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={temp}
                      onChange={(e) => setTemp(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Icon</label>
                  <div className="flex gap-2">
                    {ICONS.map((ic) => (
                      <button
                        key={ic}
                        className={`text-xl p-1 rounded-md transition-colors ${
                          icon === ic ? "bg-primary/20 ring-2 ring-primary" : "hover:bg-muted"
                        }`}
                        onClick={() => setIcon(ic)}
                      >
                        {ICON_MAP[ic]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={showCreate ? handleCreate : handleUpdate} disabled={!name.trim() || !prompt.trim()}>
                    <Check className="h-3 w-3 mr-1" />
                    {showCreate ? "Create" : "Save"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreate(false);
                      setEditing(false);
                    }}
                  >
                    <X className="h-3 w-3 mr-1" /> Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : selected ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <span className="text-xl">{ICON_MAP[selected.icon] ?? "🤖"}</span>
                  {selected.name}
                </CardTitle>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {selected.description && (
                  <p className="text-sm text-muted-foreground">{selected.description}</p>
                )}
                <Separator />
                <div>
                  <p className="text-xs font-medium mb-1">System Prompt</p>
                  <div className="bg-muted/50 rounded-md p-3 text-xs whitespace-pre-wrap">
                    {selected.system_prompt}
                  </div>
                </div>
                <div className="flex gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Model</p>
                    <Badge variant="outline" className="text-xs mt-1">
                      {selected.model.split("/").pop()}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Temperature</p>
                    <Badge variant="outline" className="text-xs mt-1">
                      {selected.temperature}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <span className="text-xs">
                      {formatDate(selected.created_at)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Bot className="h-10 w-10 mb-2" />
                <p className="text-sm">Select an assistant or create a new one</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
