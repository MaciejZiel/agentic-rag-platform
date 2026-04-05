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
  CheckSquare,
  Square,
  Eye,
  Share2,
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
import { ChunkPreviewDialog } from "@/components/ChunkPreviewDialog";
import { ShareDialog } from "@/components/ShareDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DocumentListSkeleton } from "@/components/PageSkeletons";
import { toast } from "sonner";

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
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [shareDoc, setShareDoc] = useState<Document | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selectedIds.size === docs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(docs.map((d) => d.id)));
    }
  }

  async function handleBatchIndex() {
    const toIndex = docs.filter(
      (d) => selectedIds.has(d.id) && (d.status === "uploaded" || d.status === "failed"),
    );
    if (toIndex.length === 0) return;
    for (const doc of toIndex) {
      setIndexingIds((prev) => new Set(prev).add(doc.id));
    }
    let success = 0;
    for (const doc of toIndex) {
      try {
        await indexDocument(doc.id);
        success++;
      } catch { /* continue */ }
      setIndexingIds((prev) => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
    }
    toast.success(`Indexed ${success}/${toIndex.length} documents`);
    setSelectedIds(new Set());
    await refresh();
  }

  async function handleBatchDelete() {
    const toDelete = docs.filter((d) => selectedIds.has(d.id));
    if (toDelete.length === 0) return;
    let success = 0;
    for (const doc of toDelete) {
      try {
        await deleteDocument(doc.id);
        success++;
      } catch { /* continue */ }
    }
    toast.success(`Deleted ${success}/${toDelete.length} documents`);
    setSelectedIds(new Set());
    await refresh();
  }

  const refresh = useCallback(async () => {
    const data = await listDocuments();
    setDocs(data.documents);
    setTotal(data.total);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh when documents are processing
  useEffect(() => {
    const hasProcessing = docs.some((d) => d.status === "processing") || indexingIds.size > 0;
    if (!hasProcessing) return;
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [docs, indexingIds, refresh]);

  async function handleFiles(files: FileList | File[]) {
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        await uploadDocument(file);
      }
      toast.success("Upload complete", { description: `${files.length} file(s) uploaded successfully.` });
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setError(msg);
      toast.error("Upload failed", { description: msg });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDocument(id);
      toast.success("Document deleted");
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      setError(msg);
      toast.error("Delete failed", { description: msg });
    }
  }

  async function handleIndex(
    id: string,
    options?: { chunk_strategy?: string; max_tokens?: number; overlap_tokens?: number },
  ) {
    setIndexingIds((prev) => new Set(prev).add(id));
    try {
      await indexDocument(id, options);
      toast.success("Indexing complete", { description: "Document has been indexed with embeddings." });
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Indexing failed";
      setError(msg);
      toast.error("Indexing failed", { description: msg });
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

      {/* Batch toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleBatchIndex}>
            Index Selected
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => setBatchDeleteConfirm(true)}>
            <Trash2 className="h-3 w-3 mr-1" /> Delete Selected
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Document list */}
      {docs.length > 1 && (
        <button
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
          onClick={selectAll}
        >
          {selectedIds.size === docs.length ? (
            <CheckSquare className="h-3.5 w-3.5" />
          ) : (
            <Square className="h-3.5 w-3.5" />
          )}
          Select all
        </button>
      )}
      <div className="space-y-3">
        {docs.map((doc) => {
          const cfg = statusConfig[doc.status];
          const StatusIcon = cfg.icon;
          const isIndexing = indexingIds.has(doc.id);

          return (
            <Card key={doc.id} className={`cursor-pointer transition-colors ${selectedIds.has(doc.id) ? "border-primary" : "hover:border-primary/50"}`} onClick={() => setSelectedDoc(doc)}>
              <CardContent className="flex items-center gap-4 py-4">
                <button
                  className="shrink-0"
                  onClick={(e) => { e.stopPropagation(); toggleSelect(doc.id); }}
                >
                  {selectedIds.has(doc.id) ? (
                    <CheckSquare className="h-4 w-4 text-primary" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
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
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={(e) => { e.stopPropagation(); setPreviewDoc(doc); }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
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
                  </>
                )}

                {doc.status === "indexed" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={(e) => { e.stopPropagation(); setShareDoc(doc); }}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(doc.id); }}
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

        {loading && <DocumentListSkeleton />}

        {!loading && docs.length === 0 && (
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

      {previewDoc && (
        <ChunkPreviewDialog
          documentId={previewDoc.id}
          filename={previewDoc.filename}
          open={true}
          onClose={() => setPreviewDoc(null)}
          onIndex={async (strategy, maxTokens, overlapTokens) => {
            setPreviewDoc(null);
            await handleIndex(previewDoc.id, {
              chunk_strategy: strategy,
              max_tokens: maxTokens,
              overlap_tokens: overlapTokens,
            });
          }}
        />
      )}

      {shareDoc && (
        <ShareDialog
          documentId={shareDoc.id}
          filename={shareDoc.filename}
          open={true}
          onClose={() => setShareDoc(null)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete document"
        description="This will permanently delete the document, its chunks, and embeddings. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={batchDeleteConfirm}
        title={`Delete ${selectedIds.size} document(s)`}
        description="This will permanently delete all selected documents. This action cannot be undone."
        confirmLabel="Delete All"
        variant="destructive"
        onConfirm={() => {
          setBatchDeleteConfirm(false);
          handleBatchDelete();
        }}
        onCancel={() => setBatchDeleteConfirm(false)}
      />
    </div>
  );
}
