import { useEffect, useState } from "react";
import { Keyboard, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  // Navigation
  { keys: ["Cmd", "K"], description: "Open command palette", category: "Navigation" },
  { keys: ["G", "D"], description: "Go to Dashboard", category: "Navigation" },
  { keys: ["G", "F"], description: "Go to Documents (Files)", category: "Navigation" },
  { keys: ["G", "C"], description: "Go to Chat", category: "Navigation" },
  { keys: ["G", "E"], description: "Go to Extract", category: "Navigation" },
  { keys: ["G", "U"], description: "Go to Usage", category: "Navigation" },
  { keys: ["G", "S"], description: "Go to Settings", category: "Navigation" },
  // Actions
  { keys: ["?"], description: "Show keyboard shortcuts", category: "Actions" },
  { keys: ["Escape"], description: "Close dialog / cancel", category: "Actions" },
  { keys: ["N"], description: "New chat (when on Chat page)", category: "Actions" },
  { keys: ["R"], description: "Refresh documents list", category: "Actions" },
];

const IS_MAC = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

function formatKey(key: string): string {
  if (key === "Cmd") return IS_MAC ? "\u2318" : "Ctrl";
  return key;
}

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const [pendingG, setPendingG] = useState(false);

  useEffect(() => {
    let gTimeout: ReturnType<typeof setTimeout>;

    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // ? key — toggle shortcuts help
      if (e.key === "?" && !isInput) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }

      // Escape — close
      if (e.key === "Escape" && open) {
        setOpen(false);
        return;
      }

      // Skip inputs for navigation shortcuts
      if (isInput) return;

      // G-based navigation (press G, then a letter)
      if (e.key === "g" && !pendingG) {
        setPendingG(true);
        gTimeout = setTimeout(() => setPendingG(false), 1000);
        return;
      }

      if (pendingG) {
        setPendingG(false);
        clearTimeout(gTimeout);
        const routes: Record<string, string> = {
          d: "/",
          f: "/documents",
          c: "/chat",
          e: "/extract",
          u: "/usage",
          s: "/settings",
        };
        const route = routes[e.key.toLowerCase()];
        if (route) {
          e.preventDefault();
          window.location.hash = "";
          // Navigate via browser
          window.history.pushState({}, "", route);
          window.dispatchEvent(new PopStateEvent("popstate"));
          return;
        }
      }
    }

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      clearTimeout(gTimeout);
    };
  }, [open, pendingG]);

  if (!open) return null;

  const grouped = shortcuts.reduce<Record<string, Shortcut[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setOpen(false)}
    >
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Keyboard className="h-4 w-4" />
              Keyboard Shortcuts
            </h3>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  {category}
                </h4>
                <div className="space-y-1.5">
                  {items.map((shortcut, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-sm">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, j) => (
                          <span key={j}>
                            {j > 0 && (
                              <span className="text-muted-foreground text-xs mx-0.5">
                                +
                              </span>
                            )}
                            <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-mono border rounded bg-muted">
                              {formatKey(key)}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground text-center mt-4 pt-3 border-t">
            Press <kbd className="px-1 border rounded text-[10px] bg-muted">?</kbd> to toggle this panel
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
