import { useEffect, useState } from "react";
import { FileText, Hash, Clock, Loader2, Search, ChevronDown, ChevronUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { type Document } from "@/lib/api";

interface Chunk {
  id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  created_at: string;
}

interface Props {
  document: Document | null;
  open: boolean;
  onClose: () => void;
  highlightChunks?: number[];
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function DocumentDetail({ document: doc, open, onClose, highlightChunks = [] }: Props) {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!doc || !open) return;
    setLoading(true);
    setSearch("");
    setExpandedChunks(new Set(highlightChunks));

    const token = localStorage.getItem("access_token");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`/api/v1/documents/${doc.id}/chunks`, { headers })
      .then((r) => r.json())
      .then((data) => setChunks(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [doc?.id, open]);

  if (!doc) return null;

  const highlightSet = new Set(highlightChunks);
  const filteredChunks = search.trim()
    ? chunks.filter((c) => c.content.toLowerCase().includes(search.toLowerCase()))
    : chunks;

  // Sort highlighted chunks first
  const sortedChunks = [...filteredChunks].sort((a, b) => {
    const aH = highlightSet.has(a.chunk_index) ? 0 : 1;
    const bH = highlightSet.has(b.chunk_index) ? 0 : 1;
    if (aH !== bH) return aH - bH;
    return a.chunk_index - b.chunk_index;
  });

  function toggleExpand(idx: number) {
    setExpandedChunks((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" />
            {doc.filename}
          </DialogTitle>
        </DialogHeader>

        {/* Metadata */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>Size: <strong className="text-foreground">{formatSize(doc.file_size)}</strong></span>
          <span>Type: <strong className="text-foreground">{doc.content_type}</strong></span>
          <span>Status: <Badge variant="outline" className="text-[10px] ml-1">{doc.status}</Badge></span>
          <span>Chunks: <strong className="text-foreground">{doc.chunk_count}</strong></span>
        </div>

        {doc.error_message && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
            {doc.error_message}
          </div>
        )}

        <Separator />

        {/* Search + header */}
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium flex-1">Document Chunks</p>
          <div className="relative w-48">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search chunks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 pl-7 text-xs"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {filteredChunks.length}/{chunks.length}
          </span>
        </div>

        {highlightChunks.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Source chunks:</span>
            {highlightChunks.map((idx) => (
              <Badge key={idx} className="bg-primary/20 text-primary text-[10px]">
                #{idx}
              </Badge>
            ))}
          </div>
        )}

        <ScrollArea className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sortedChunks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              {chunks.length === 0
                ? "No chunks available. Index the document first."
                : "No chunks match your search."}
            </p>
          ) : (
            <div className="space-y-3 pr-3">
              {sortedChunks.map((chunk) => {
                const isHighlighted = highlightSet.has(chunk.chunk_index);
                const isExpanded = expandedChunks.has(chunk.chunk_index);
                const isLong = chunk.content.length > 400;
                const displayContent = isExpanded
                  ? chunk.content
                  : chunk.content.slice(0, 400);

                return (
                  <div
                    key={chunk.id}
                    className={`rounded-lg border p-3 space-y-2 transition-colors ${
                      isHighlighted
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={isHighlighted ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          <Hash className="h-2.5 w-2.5 mr-0.5" />
                          {chunk.chunk_index}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {chunk.token_count} tokens
                        </span>
                        {isHighlighted && (
                          <Badge variant="outline" className="text-[10px] text-primary">
                            Source
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(chunk.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                      {search.trim()
                        ? highlightText(displayContent, search)
                        : displayContent}
                      {isLong && !isExpanded && "..."}
                    </p>
                    {isLong && (
                      <button
                        className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                        onClick={() => toggleExpand(chunk.chunk_index)}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3 w-3" /> Show less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3" /> Show more
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
