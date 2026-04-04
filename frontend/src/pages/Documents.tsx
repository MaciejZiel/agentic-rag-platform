import { useCallback, useEffect, useState } from "react";
import {
  Upload,
  FileText,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  type Document,
  listDocuments,
  uploadDocument,
  indexDocument,
  deleteDocument,
} from "@/lib/api";
import { DocumentDetail } from "@/components/DocumentDetail";

const statusConfig = {
  uploaded: { icon: Clock, variant: "secondary" as const, label: "Uploaded" },
  processing: { icon: Loader2, variant: "default" as const, label: "Processing" },
  indexed: { icon: CheckCircle2, variant: "default" as const, label: "Indexed" },
  failed: { icon: XCircle, variant: "destructive" as const, label: "Failed" },
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

export function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [indexingIds, setIndexingIds] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  const refresh = useCallback(async () => {
    const data = await listDocuments();
    setDocs(data.documents);
    setTotal(data.total);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleFiles(files: FileList | File[]) {
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        await uploadDocument(file);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDocument(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function handleIndex(id: string) {
    setIndexingIds((prev) => new Set(prev).add(id));
    try {
      await indexDocument(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Indexing failed");
    } finally {
      setIndexingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Documents</h2>
          <p className="text-sm text-muted-foreground">
            {total} document{total !== 1 ? "s" : ""} in the platform
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Drop zone */}
      <Card
        className={`border-2 border-dashed transition-colors cursor-pointer ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.multiple = true;
          input.accept = ".pdf,.docx,.txt,.md";
          input.onchange = () => {
            if (input.files?.length) handleFiles(input.files);
          };
          input.click();
        }}
      >
        <CardContent className="flex flex-col items-center justify-center py-10 gap-2">
          {uploading ? (
            <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
          ) : (
            <Upload className="h-10 w-10 text-muted-foreground" />
          )}
          <p className="text-sm font-medium">
            {uploading ? "Uploading..." : "Drop files here or click to upload"}
          </p>
          <p className="text-xs text-muted-foreground">
            PDF, DOCX, TXT, Markdown — max 50 MB
          </p>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Document list */}
      <div className="space-y-3">
        {docs.map((doc) => {
          const cfg = statusConfig[doc.status];
          const StatusIcon = cfg.icon;
          const isIndexing = indexingIds.has(doc.id);

          return (
            <Card key={doc.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedDoc(doc)}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="rounded-lg bg-muted p-2.5">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.filename}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{formatSize(doc.file_size)}</span>
                    <span>{doc.chunk_count} chunks</span>
                    <span>{formatDate(doc.created_at)}</span>
                  </div>
                  {doc.error_message && (
                    <p className="text-xs text-destructive mt-1 truncate">
                      {doc.error_message}
                    </p>
                  )}
                </div>

                <Badge variant={cfg.variant} className="gap-1">
                  <StatusIcon
                    className={`h-3 w-3 ${
                      doc.status === "processing" ? "animate-spin" : ""
                    }`}
                  />
                  {cfg.label}
                </Badge>

                {(doc.status === "uploaded" || doc.status === "failed") && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isIndexing}
                    onClick={(e) => { e.stopPropagation(); handleIndex(doc.id); }}
                  >
                    {isIndexing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Index"
                    )}
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>

                <code className="text-[10px] text-muted-foreground hidden lg:block">
                  {doc.id.slice(0, 8)}
                </code>
              </CardContent>
            </Card>
          );
        })}

        {docs.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-12">
            No documents yet. Upload one above.
          </p>
        )}
      </div>

      <DocumentDetail
        document={selectedDoc}
        open={selectedDoc !== null}
        onClose={() => setSelectedDoc(null)}
      />
    </div>
  );
}
