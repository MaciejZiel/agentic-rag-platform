import { formatCost } from "@/lib/utils";
import { useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { GitCompare, Loader2, FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type Document,
  type CompareResponse,
  listDocuments,
  compareDocuments,
} from "@/lib/api";
import { ModelSelector } from "@/components/ModelSelector";
import { toast } from "sonner";

export function ComparePage() {
  usePageTitle("Compare");
  const [docs, setDocs] = useState<Document[]>([]);
  const [docA, setDocA] = useState<string>("");
  const [docB, setDocB] = useState<string>("");
  const [model, setModel] = useState("");
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listDocuments().then((d) =>
      setDocs(d.documents.filter((doc) => doc.status === "indexed")),
    );
  }, []);

  async function handleCompare() {
    if (!docA || !docB) return;
    if (docA === docB) {
      setError("Please select two different documents.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await compareDocuments(docA, docB, model || undefined);
      setResult(res);
      toast.success("Comparison complete");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Comparison failed";
      setError(msg);
      toast.error("Comparison failed", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <GitCompare className="h-6 w-6" /> Document Comparison
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Compare two documents and get AI-powered analysis of their differences.
        </p>
      </div>

      {/* Selection */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 w-full">
              <label className="text-xs font-medium mb-1 block">Document A</label>
              <select
                value={docA}
                onChange={(e) => setDocA(e.target.value)}
                className="w-full h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Select document...</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.filename}
                  </option>
                ))}
              </select>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 hidden sm:block mt-4" />
            <div className="flex-1 w-full">
              <label className="text-xs font-medium mb-1 block">Document B</label>
              <select
                value={docB}
                onChange={(e) => setDocB(e.target.value)}
                className="w-full h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Select document...</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.filename}
                  </option>
                ))}
              </select>
            </div>
            <div className="shrink-0 mt-4">
              <ModelSelector value={model} onChange={setModel} />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleCompare} disabled={loading || !docA || !docB}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <GitCompare className="h-4 w-4 mr-1" /> Compare
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {result.document_a} vs {result.document_b}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {result.model.split("/").pop()}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {result.token_usage.toLocaleString()} tokens
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {formatCost(result.cost_usd)}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4">
            <ScrollArea className="max-h-[500px]">
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                {result.analysis}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {!result && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <GitCompare className="h-10 w-10 mb-2" />
            <p className="text-sm">
              Select two indexed documents and click Compare
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
