import { useState } from "react";
import {
  Upload,
  Search,
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  X,
  FileText,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STORAGE_KEY = "cortex_onboarding_complete";

const steps = [
  {
    icon: Upload,
    title: "Upload Documents",
    description:
      "Start by uploading your PDF, DOCX, TXT, or Markdown files. Drag and drop them into the Documents page or click to browse.",
    tip: "You can upload multiple files at once. Max size is 50 MB per file.",
    route: "/documents",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: Search,
    title: "Index for Search",
    description:
      'After uploading, click the "Index" button on each document. This splits the document into chunks and creates embeddings for semantic search.',
    tip: "Use batch operations to index multiple documents at once by selecting them with checkboxes.",
    route: "/documents",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    icon: MessageSquare,
    title: "Chat with Your Data",
    description:
      "Go to the Chat page and ask questions about your indexed documents. The AI will find relevant passages and generate answers with source citations.",
    tip: "Filter by specific documents using the badges at the top, or search across everything.",
    route: "/chat",
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  {
    icon: Sparkles,
    title: "Explore More Features",
    description:
      "Extract structured data, compare documents, build workflows, create custom AI assistants, and organize files into collections.",
    tip: "Press Cmd+K (or Ctrl+K) anytime to quickly navigate between features.",
    route: "/",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
];

export function isOnboardingComplete(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function resetOnboarding() {
  localStorage.removeItem(STORAGE_KEY);
}

interface Props {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  function finish() {
    localStorage.setItem(STORAGE_KEY, "true");
    onComplete();
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-lg relative">
        <button
          onClick={finish}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <CardContent className="pt-8 pb-6 px-8">
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i === step
                    ? "w-8 bg-primary"
                    : i < step
                      ? "w-2 bg-primary/60"
                      : "w-2 bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>

          {/* Step icon */}
          <div className={`mx-auto w-16 h-16 rounded-2xl ${current.bg} flex items-center justify-center mb-6`}>
            <Icon className={`h-8 w-8 ${current.color}`} />
          </div>

          {/* Step content */}
          <div className="text-center space-y-3 mb-6">
            <h3 className="text-xl font-semibold">
              Step {step + 1}: {current.title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {current.description}
            </p>
          </div>

          {/* Tip box */}
          <div className="rounded-lg bg-muted/50 border px-4 py-3 mb-8">
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">{current.tip}</p>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className="gap-1"
            >
              <ArrowLeft className="h-3 w-3" /> Back
            </Button>

            <Button variant="ghost" size="sm" onClick={finish} className="text-muted-foreground">
              Skip tour
            </Button>

            {isLast ? (
              <Button size="sm" onClick={finish} className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Get started
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((s) => s + 1)} className="gap-1">
                Next <ArrowRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
