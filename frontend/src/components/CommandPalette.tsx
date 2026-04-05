import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  FileText,
  MessageSquare,
  LayoutDashboard,
  Braces,
  FolderOpen,
  Terminal,
  Bot,
  BarChart3,
  Settings,
  ShieldCheck,
  GitCompare,
  Workflow,
  CreditCard,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  section: string;
  icon: React.ElementType;
  action: () => void;
  keywords?: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const items: CommandItem[] = [
    { id: "dashboard", label: "Dashboard", section: "Pages", icon: LayoutDashboard, action: () => navigate("/"), keywords: "home overview stats" },
    { id: "documents", label: "Documents", section: "Pages", icon: FileText, action: () => navigate("/documents"), keywords: "upload files pdf" },
    { id: "chat", label: "Chat", section: "Pages", icon: MessageSquare, action: () => navigate("/chat"), keywords: "ask question qa" },
    { id: "extract", label: "Extract", section: "Pages", icon: Braces, action: () => navigate("/extract"), keywords: "json schema structured" },
    { id: "collections", label: "Collections", section: "Pages", icon: FolderOpen, action: () => navigate("/collections"), keywords: "projects groups" },
    { id: "playground", label: "API Playground", section: "Pages", icon: Terminal, action: () => navigate("/playground"), keywords: "api test endpoints" },
    { id: "assistants", label: "AI Assistants", section: "Pages", icon: Bot, action: () => navigate("/assistants"), keywords: "custom prompt agent" },
    { id: "usage", label: "Usage & Billing", section: "Pages", icon: BarChart3, action: () => navigate("/usage"), keywords: "tokens cost billing" },
    { id: "compare", label: "Compare Documents", section: "Pages", icon: GitCompare, action: () => navigate("/compare"), keywords: "diff comparison" },
    { id: "workflows", label: "Workflows", section: "Pages", icon: Workflow, action: () => navigate("/workflows"), keywords: "automation pipeline" },
    { id: "plans", label: "Plans", section: "Pages", icon: CreditCard, action: () => navigate("/subscriptions"), keywords: "pricing subscription" },
    { id: "admin", label: "Admin Panel", section: "Pages", icon: ShieldCheck, action: () => navigate("/admin"), keywords: "users system health" },
    { id: "settings", label: "Settings", section: "Pages", icon: Settings, action: () => navigate("/settings"), keywords: "profile 2fa api keys" },
  ];

  const filtered = query.trim()
    ? items.filter((item) => {
        const q = query.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          item.section.toLowerCase().includes(q) ||
          (item.keywords?.toLowerCase().includes(q) ?? false)
        );
      })
    : items;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
        setSelectedIndex(0);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  function handleSelect(item: CommandItem) {
    item.action();
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      handleSelect(filtered[selectedIndex]);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setOpen(false)} />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg z-50">
        <div className="bg-background border rounded-xl shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search pages, actions..."
              className="flex-1 h-12 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 text-[10px] text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No results found
              </p>
            ) : (
              filtered.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      i === selectedIndex
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted"
                    }`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(i)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {item.section}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground">
            <span><kbd className="rounded border bg-muted px-1">↑↓</kbd> navigate</span>
            <span><kbd className="rounded border bg-muted px-1">↵</kbd> select</span>
            <span><kbd className="rounded border bg-muted px-1">esc</kbd> close</span>
          </div>
        </div>
      </div>
    </>
  );
}
