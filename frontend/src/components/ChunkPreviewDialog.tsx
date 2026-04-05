import { useEffect, useState } from "react";
import { Loader2, Layers, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type ChunkPreview,
  type ChunkPreviewResponse,
  previewChunks,
} from "@/lib/api";

interface Props {
  documentId: string;
  filename: string;
  open: boolean;
  onClose: () => void;
  onIndex: (strategy: string, maxTokens: number, overlapTokens: number) => void;
}

const strategies = [
  { value: "fixed_size", label: "Fixed Size" },
  { value: "sentence", label: "Sentence" },
  { value: "paragraph", label: "Paragraph" },
];

export function ChunkPreviewDialog({
  documentId,
  filename,
  open,
  onClose,
  onIndex,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ChunkPreviewResponse | null>(null);
  const [strategy, setStrategy] = useState("fixed_size");
  const [maxTokens, setMaxTokens] = useState(512);
  const [overlapTokens, setOverlapTokens] = useState(50);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedChunk, setExpandedChunk] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      setData(null);
      setExpandedChunk(null);
      return;
    }
    loadPreview();
  }, [open, strategy, maxTokens, overlapTokens]);

  async function loadPreview() {
    if (!open) return;
    setLoading(true);
    setExpandedChunk(null);
    try {
      const result = await previewChunks(
        documentId,
        strategy,
        maxTokens,
        overlapTokens,
      );
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border rounded-xl shadow-lg w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Chunk Preview
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{filename}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings((s) => !s)}
              className="h-8"
            >
              <Settings2 className="h-3.5 w-3.5 mr-1" />
              Settings
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8">
              Close
            </Button>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="px-6 py-3 border-b bg-muted/30 space-y-3">
            <div className="flex items-center gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium">Strategy</label>
                <div className="flex gap-1">
                  {strategies.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setStrategy(s.value)}
                      className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                        strategy === s.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">
                  Max tokens: {maxTokens}
                </label>
                <input
                  type="range"
                  min={64}
                  max={2048}
                  step={64}
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                  className="w-32"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">
                  Overlap: {overlapTokens}
                </label>
                <input
                  type="range"
                  min={0}
                  max={256}
                  step={10}
                  value={overlapTokens}
                  onChange={(e) => setOverlapTokens(Number(e.target.value))}
                  className="w-32"
                />
              </div>
            </div>
          </div>
        )}

        {/* Stats bar */}
        {data && !loading && (
          <div className="px-6 py-2 border-b flex items-center gap-3 text-xs text-muted-foreground">
            <Badge variant="secondary" className="text-xs">
              {data.total_chunks} chunks
            </Badge>
            <span>
              Avg{" "}
              {data.chunks.length > 0
                ? Math.round(
                    data.chunks.reduce((s, c) => s + c.token_count, 0) /
                      data.chunks.length,
                  )
                : 0}{" "}
              tokens/chunk
            </span>
            <span>
              Total{" "}
              {data.chunks.reduce((s, c) => s + c.token_count, 0).toLocaleString()}{" "}
              tokens
            </span>
          </div>
        )}

        {/* Chunk list */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading &&
            data?.chunks.map((chunk: ChunkPreview) => {
              const isExpanded = expandedChunk === chunk.chunk_index;
              const preview = chunk.content.slice(0, 200);
              const isTruncated = chunk.content.length > 200;

              return (
                <div
                  key={chunk.chunk_index}
                  className="rounded-lg border p-3 hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() =>
                    setExpandedChunk(isExpanded ? null : chunk.chunk_index)
                  }
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">
                      Chunk #{chunk.chunk_index}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {chunk.token_count} tokens
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {isExpanded ? chunk.content : preview}
                    {isTruncated && !isExpanded && (
                      <span className="text-primary ml-1">...more</span>
                    )}
                  </p>
                </div>
              );
            })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={loading || !data}
            onClick={() => onIndex(strategy, maxTokens, overlapTokens)}
          >
            Index with these settings
          </Button>
        </div>
      </div>
    </div>
  );
}
