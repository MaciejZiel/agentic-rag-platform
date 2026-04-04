import { useEffect, useRef, useState } from "react";
import { Send, Loader2, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  type Document,
  type SourceCitation,
  type SSEEvent,
  listDocuments,
  askStream,
} from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: SourceCitation[];
  tokenUsage?: number;
  costUsd?: number;
  model?: string;
}

export function ChatPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listDocuments().then((d) =>
      setDocs(d.documents.filter((doc) => doc.status === "indexed")),
    );
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    const docIds = selectedDocs.size > 0 ? [...selectedDocs] : undefined;

    try {
      let answer = "";
      let sources: SourceCitation[] = [];

      // Add empty assistant message that we'll stream into
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      for await (const event of askStream(question, docIds)) {
        if (event.type === "sources" && event.sources) {
          sources = event.sources.map((s) => ({
            document_id: s.document_id,
            chunk_index: s.chunk_index,
            score: s.score,
            content: "",
          }));
        } else if (event.type === "token" && event.content) {
          answer += event.content;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: answer,
              sources,
            };
            return updated;
          });
        } else if (event.type === "done") {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: answer,
              sources,
            };
            return updated;
          });
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function toggleDoc(id: string) {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const docNameMap = Object.fromEntries(docs.map((d) => [d.id, d.filename]));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5" /> Chat with your documents
        </h2>
        {docs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {docs.map((doc) => (
              <Badge
                key={doc.id}
                variant={selectedDocs.has(doc.id) ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => toggleDoc(doc.id)}
              >
                <FileText className="h-3 w-3 mr-1" />
                {doc.filename}
              </Badge>
            ))}
            {selectedDocs.size > 0 && (
              <Badge
                variant="secondary"
                className="cursor-pointer text-xs"
                onClick={() => setSelectedDocs(new Set())}
              >
                Clear filter
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-20 space-y-2">
              <Sparkles className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground text-sm">
                Ask a question about your indexed documents.
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedDocs.size > 0
                  ? `Searching in ${selectedDocs.size} selected document(s)`
                  : "Searching across all documents"}
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i}>
              <div
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`rounded-lg px-4 py-2.5 max-w-[85%] text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {msg.content || (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </div>
              </div>

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 ml-1 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">
                    Sources:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.sources.map((src, j) => (
                      <Badge key={j} variant="outline" className="text-xs">
                        {docNameMap[src.document_id] ??
                          src.document_id.slice(0, 8)}
                        {" "}
                        #{src.chunk_index} — {(src.score * 100).toFixed(0)}%
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <Separator />

      {/* Input */}
      <div className="p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask a question..."
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
          />
          <Button onClick={handleSend} disabled={loading || !input.trim()}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
