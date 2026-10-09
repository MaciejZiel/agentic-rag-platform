import { useCallback, useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  FolderOpen,
  Plus,
  Trash2,
  FileText,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  type CollectionItem,
  type Document,
  listCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  listDocuments,
  addDocumentToCollection,
  removeDocumentFromCollection,
} from "@/lib/api";

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];

export function CollectionsPage() {
  usePageTitle("Collections");
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createColor, setCreateColor] = useState(COLORS[0]);
  const [selected, setSelected] = useState<CollectionItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [colls, docData] = await Promise.all([
      listCollections(),
      listDocuments(),
    ]);
    setCollections(colls.collections);
    setDocs(docData.documents);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCreate() {
    if (!createName.trim()) return;
    setError(null);
    try {
      await createCollection({
        name: createName.trim(),
        description: createDesc.trim() || undefined,
        color: createColor,
      });
      setShowCreate(false);
      setCreateName("");
      setCreateDesc("");
      setCreateColor(COLORS[0]);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteCollection(id);
      if (selected?.id === id) setSelected(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function handleUpdate() {
    if (!selected || !editName.trim()) return;
    setError(null);
    try {
      const updated = await updateCollection(selected.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      });
      setSelected(updated);
      setEditing(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function handleAddDoc(docId: string) {
    if (!selected) return;
    setError(null);
    try {
      await addDocumentToCollection(selected.id, docId);
      await refresh();
      // Re-fetch selected collection count
      const colls = await listCollections();
      const updated = colls.collections.find((c) => c.id === selected.id);
      if (updated) setSelected(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add document");
    }
  }

  async function handleRemoveDoc(docId: string) {
    if (!selected) return;
    setError(null);
    try {
      await removeDocumentFromCollection(selected.id, docId);
      await refresh();
      const colls = await listCollections();
      const updated = colls.collections.find((c) => c.id === selected.id);
      if (updated) setSelected(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove document");
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FolderOpen className="h-6 w-6" /> Collections
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Organize documents into projects and collections.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Collection
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Input
              placeholder="Collection name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
            />
            <Textarea
              placeholder="Description (optional)"
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              rows={2}
            />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Color:</span>
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    createColor === c ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setCreateColor(c)}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={!createName.trim()}>
                Create
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Collection list */}
        <div className="space-y-3 lg:col-span-1">
          {collections.length === 0 && !showCreate && (
            <p className="text-sm text-muted-foreground text-center py-12">
              No collections yet. Create one to get started.
            </p>
          )}
          {collections.map((c) => (
            <Card
              key={c.id}
              className={`cursor-pointer transition-colors ${
                selected?.id === c.id ? "border-primary" : "hover:border-primary/50"
              }`}
              onClick={() => {
                setSelected(c);
                setEditing(false);
                setEditName(c.name);
                setEditDesc(c.description ?? "");
              }}
            >
              <CardContent className="flex items-center gap-3 py-3">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.document_count} document{c.document_count !== 1 ? "s" : ""}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(c.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2">
          {selected ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  {editing ? (
                    <div className="flex-1 space-y-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="text-lg font-semibold"
                      />
                      <Textarea
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Description"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleUpdate}>
                          <Check className="h-3 w-3 mr-1" /> Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditing(false)}
                        >
                          <X className="h-3 w-3 mr-1" /> Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: selected.color }}
                          />
                          {selected.name}
                        </CardTitle>
                        {selected.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {selected.description}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(true)}
                      >
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium mb-3">
                  Add documents to this collection:
                </p>
                <div className="space-y-2">
                  {docs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-2 rounded-md border"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1 truncate">
                        {doc.filename}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {doc.status}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handleAddDoc(doc.id)}
                      >
                        Add
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive"
                        onClick={() => handleRemoveDoc(doc.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  {docs.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No documents uploaded yet.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <FolderOpen className="h-10 w-10 mb-2" />
                <p className="text-sm">Select a collection to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
