import { useEffect, useState } from "react";
import { FileText, Hash, Clock, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
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
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function DocumentDetail({ document: doc, open, onClose }: Props) {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!doc || !open) return;
    setLoading(true);
    fetch(`/api/v1/documents/${doc.id}/chunks`)
      .then((r) => r.json())
      .then((data) => setChunks(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [doc?.id, open]);

  if (!doc) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
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

        {/* Chunks */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Document Chunks</p>
          <span className="text-xs text-muted-foreground">{chunks.length} chunks</span>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : chunks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              No chunks available. Index the document first.
            </p>
          ) : (
            <div className="space-y-3 pr-3">
              {chunks.map((chunk) => (
                <div
                  key={chunk.id}
                  className="rounded-lg border p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        <Hash className="h-2.5 w-2.5 mr-0.5" />
                        {chunk.chunk_index}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {chunk.token_count} tokens
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(chunk.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {chunk.content.length > 500
                      ? chunk.content.slice(0, 500) + "..."
                      : chunk.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
