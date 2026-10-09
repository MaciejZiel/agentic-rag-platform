import { useCallback, useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  Workflow as WorkflowIcon,
  Plus,
  Trash2,
  Save,
  FileText,
  MessageSquare,
  Braces,
  Filter,
  Zap,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  type WorkflowItem,
  type WorkflowNode,
  type WorkflowEdge,
  listWorkflows,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
} from "@/lib/api";
import { toast } from "sonner";

const NODE_TYPES = [
  { type: "input", label: "Document Input", icon: FileText, color: "#3b82f6" },
  { type: "qa", label: "Q&A Query", icon: MessageSquare, color: "#10b981" },
  { type: "extract", label: "Extract JSON", icon: Braces, color: "#8b5cf6" },
  { type: "filter", label: "Filter / Route", icon: Filter, color: "#f59e0b" },
  { type: "output", label: "Output", icon: Zap, color: "#ef4444" },
];

const STATUS_BADGES: Record<string, { variant: "default" | "secondary" | "outline"; label: string }> = {
  draft: { variant: "secondary", label: "Draft" },
  active: { variant: "default", label: "Active" },
  paused: { variant: "outline", label: "Paused" },
};

function NodeComponent({
  node,
  isSelected,
  onSelect,
}: {
  node: WorkflowNode;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const typeDef = NODE_TYPES.find((t) => t.type === node.type) ?? NODE_TYPES[0];
  const Icon = typeDef.icon;

  return (
    <div
      className={`absolute cursor-pointer transition-all ${
        isSelected ? "ring-2 ring-primary" : ""
      }`}
      style={{ left: node.x, top: node.y }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <div
        className="flex items-center gap-2 rounded-lg border-2 bg-background px-3 py-2 shadow-sm min-w-[140px]"
        style={{ borderColor: typeDef.color }}
      >
        <Icon className="h-4 w-4 shrink-0" style={{ color: typeDef.color }} />
        <div>
          <p className="text-xs font-medium">{node.label}</p>
          <p className="text-[10px] text-muted-foreground">{typeDef.label}</p>
        </div>
      </div>
    </div>
  );
}

function EdgeLine({ nodes, edge }: { nodes: WorkflowNode[]; edge: WorkflowEdge }) {
  const source = nodes.find((n) => n.id === edge.source);
  const target = nodes.find((n) => n.id === edge.target);
  if (!source || !target) return null;

  const x1 = source.x + 140;
  const y1 = source.y + 20;
  const x2 = target.x;
  const y2 = target.y + 20;

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="hsl(var(--border))"
      strokeWidth={2}
      markerEnd="url(#arrowhead)"
    />
  );
}

export function WorkflowsPage() {
  usePageTitle("Workflows");
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [selected, setSelected] = useState<WorkflowItem | null>(null);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await listWorkflows();
    setWorkflows(data.workflows);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function selectWorkflow(w: WorkflowItem) {
    setSelected(w);
    setNodes(w.definition.nodes ?? []);
    setEdges(w.definition.edges ?? []);
    setSelectedNode(null);
    setConnecting(null);
  }

  async function handleCreate() {
    setError(null);
    try {
      const w = await createWorkflow({ name: "New Workflow" });
      toast.success("Workflow created");
      await refresh();
      selectWorkflow(w);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  }

  async function handleSave() {
    if (!selected) return;
    setError(null);
    try {
      const updated = await updateWorkflow(selected.id, {
        definition: { nodes, edges },
      });
      setSelected(updated);
      toast.success("Workflow saved");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteWorkflow(id);
      if (selected?.id === id) {
        setSelected(null);
        setNodes([]);
        setEdges([]);
      }
      toast.success("Workflow deleted");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  function addNode(type: string) {
    const typeDef = NODE_TYPES.find((t) => t.type === type);
    if (!typeDef) return;
    const id = `node_${Date.now()}`;
    setNodes((prev) => [
      ...prev,
      {
        id,
        type,
        label: typeDef.label,
        x: 100 + Math.random() * 200,
        y: 80 + Math.random() * 200,
      },
    ]);
  }

  function deleteNode(id: string) {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
    setSelectedNode(null);
  }

  function handleCanvasClick() {
    setSelectedNode(null);
    setConnecting(null);
  }

  function handleNodeSelect(id: string) {
    if (connecting) {
      if (connecting !== id) {
        setEdges((prev) => [
          ...prev,
          { id: `edge_${Date.now()}`, source: connecting, target: id },
        ]);
      }
      setConnecting(null);
    } else {
      setSelectedNode(id);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <WorkflowIcon className="h-6 w-6" /> AI Workflows
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Build automated document processing pipelines.
          </p>
        </div>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-1" /> New Workflow
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Workflow list */}
        <div className="space-y-3 lg:col-span-1">
          {workflows.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">
              No workflows yet.
            </p>
          )}
          {workflows.map((w) => {
            const badge = STATUS_BADGES[w.status] ?? STATUS_BADGES.draft;
            return (
              <Card
                key={w.id}
                className={`cursor-pointer transition-colors ${
                  selected?.id === w.id ? "border-primary" : "hover:border-primary/50"
                }`}
                onClick={() => selectWorkflow(w)}
              >
                <CardContent className="flex items-center gap-3 py-3">
                  <WorkflowIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{w.name}</p>
                    <Badge variant={badge.variant} className="text-[10px] mt-0.5">
                      {badge.label}
                    </Badge>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(w.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Canvas */}
        <div className="lg:col-span-3">
          {selected ? (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Input
                      value={selected.name}
                      onChange={async (e) => {
                        const name = e.target.value;
                        setSelected({ ...selected, name });
                        await updateWorkflow(selected.id, { name });
                        await refresh();
                      }}
                      className="h-7 text-sm font-medium w-48"
                    />
                    <Badge variant="outline" className="text-[10px]">
                      {nodes.length} nodes
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleSave}>
                      <Save className="h-3 w-3 mr-1" /> Save
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Node palette */}
              <div className="px-6 pb-2">
                <div className="flex gap-2 flex-wrap">
                  {NODE_TYPES.map((nt) => {
                    const Icon = nt.icon;
                    return (
                      <Button
                        key={nt.type}
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => addNode(nt.type)}
                      >
                        <Icon className="h-3 w-3 mr-1" style={{ color: nt.color }} />
                        {nt.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Canvas area */}
              <CardContent className="p-0">
                <div
                  className="relative bg-muted/30 overflow-hidden"
                  style={{ height: 400 }}
                  onClick={handleCanvasClick}
                >
                  {/* Grid */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <defs>
                      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />
                      </pattern>
                      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--border))" />
                      </marker>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                    {edges.map((e) => (
                      <EdgeLine key={e.id} nodes={nodes} edge={e} />
                    ))}
                  </svg>

                  {/* Nodes */}
                  {nodes.map((n) => (
                    <NodeComponent
                      key={n.id}
                      node={n}
                      isSelected={selectedNode === n.id}
                      onSelect={() => handleNodeSelect(n.id)}
                    />
                  ))}

                  {nodes.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <WorkflowIcon className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-sm">Add nodes from the palette above</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>

              {/* Node tools */}
              {selectedNode && (
                <div className="px-6 py-3 border-t flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Selected: {nodes.find((n) => n.id === selectedNode)?.label}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setConnecting(selectedNode)}
                  >
                    <ArrowRight className="h-3 w-3 mr-1" />
                    {connecting === selectedNode ? "Click target node..." : "Connect"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive"
                    onClick={() => deleteNode(selectedNode)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Delete
                  </Button>
                </div>
              )}
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <WorkflowIcon className="h-10 w-10 mb-2" />
                <p className="text-sm">Select a workflow or create a new one</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
