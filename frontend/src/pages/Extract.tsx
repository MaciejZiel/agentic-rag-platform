import { useCallback, useEffect, useState } from "react";
import {
  Braces,
  FileText,
  Loader2,
  Play,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  type Document,
  type ExtractionResponse,
  listDocuments,
  extractJson,
} from "@/lib/api";
import { ModelSelector } from "@/components/ModelSelector";

const EXAMPLE_SCHEMA = JSON.stringify(
  {
    title: "string",
    author: "string",
    date: "string",
    summary: "string",
    key_topics: ["string"],
  },
  null,
  2,
);

export function ExtractPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [schema, setSchema] = useState(EXAMPLE_SCHEMA);
  const [instructions, setInstructions] = useState("");
  const [result, setResult] = useState<ExtractionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [model, setModel] = useState("");

  useEffect(() => {
    listDocuments().then((d) =>
      setDocs(d.documents.filter((doc) => doc.status === "indexed")),
    );
  }, []);

  const handleExtract = useCallback(async () => {
    if (!selectedDoc) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const parsed = JSON.parse(schema);
      const res = await extractJson(
        selectedDoc,
        parsed,
        instructions.trim() || undefined,
        model || undefined,
      );
      setResult(res);
    } catch (e) {
      if (e instanceof SyntaxError) {
        setError("Invalid JSON schema. Please check your syntax.");
      } else {
        setError(e instanceof Error ? e.message : "Extraction failed");
      }
    } finally {
      setLoading(false);
    }
  }, [selectedDoc, schema, instructions, model]);

  function handleCopy() {
    if (!result) return;
    navigator.clipboard.writeText(
      JSON.stringify(result.extracted_data, null, 2),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const selectedDocName =
    docs.find((d) => d.id === selectedDoc)?.filename ?? null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Braces className="h-6 w-6" /> Structured Extraction
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Extract structured JSON data from your documents using AI.
          </p>
        </div>
        <ModelSelector value={model} onChange={setModel} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — Configuration */}
        <div className="space-y-4">
          {/* Document selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Select Document
              </CardTitle>
            </CardHeader>
            <CardContent>
              {docs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No indexed documents available. Upload and index a document
                  first.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {docs.map((doc) => (
                    <Badge
                      key={doc.id}
                      variant={selectedDoc === doc.id ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() =>
                        setSelectedDoc(
                          selectedDoc === doc.id ? null : doc.id,
                        )
                      }
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      {doc.filename}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Schema editor */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                JSON Schema Definition
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={schema}
                onChange={(e) => setSchema(e.target.value)}
                placeholder='{"field": "type", ...}'
                className="font-mono text-xs min-h-[200px] resize-y"
                rows={10}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Define the structure of the data you want to extract. The AI
                will fill in the values.
              </p>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Instructions{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g., Focus on the executive summary section. Use ISO date format."
                className="min-h-[80px] resize-y text-sm"
                rows={3}
              />
            </CardContent>
          </Card>

          <Button
            onClick={handleExtract}
            disabled={loading || !selectedDoc}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Extract Data
              </>
            )}
          </Button>
        </div>

        {/* Right — Result */}
        <div className="space-y-4">
          <Card className="min-h-[400px] flex flex-col">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Result</CardTitle>
              {result && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 mr-1" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" /> Copy JSON
                    </>
                  )}
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex-1">
              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              {!result && !error && !loading && (
                <div className="flex flex-col items-center justify-center h-full text-center py-16 space-y-2">
                  <Braces className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Select a document, define your schema, and click Extract.
                  </p>
                </div>
              )}

              {loading && (
                <div className="flex flex-col items-center justify-center h-full py-16 space-y-2">
                  <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                  <p className="text-sm text-muted-foreground">
                    Analyzing document...
                  </p>
                </div>
              )}

              {result && (
                <div className="space-y-4">
                  <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-auto max-h-[400px] whitespace-pre-wrap">
                    {JSON.stringify(result.extracted_data, null, 2)}
                  </pre>

                  <Separator />

                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>
                      Model:{" "}
                      <span className="font-medium text-foreground">
                        {result.model}
                      </span>
                    </span>
                    <span>
                      Tokens:{" "}
                      <span className="font-medium text-foreground">
                        {result.token_usage.toLocaleString()}
                      </span>
                    </span>
                    <span>
                      Cost:{" "}
                      <span className="font-medium text-foreground">
                        ${result.cost_usd.toFixed(4)}
                      </span>
                    </span>
                  </div>

                  {selectedDocName && (
                    <p className="text-xs text-muted-foreground">
                      Extracted from:{" "}
                      <span className="font-medium">{selectedDocName}</span>
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
