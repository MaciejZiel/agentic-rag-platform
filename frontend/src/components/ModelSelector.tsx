import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type ModelInfo, listModels } from "@/lib/api";

interface Props {
  value: string;
  onChange: (model: string) => void;
}

export function ModelSelector({ value, onChange }: Props) {
  const [models, setModels] = useState<ModelInfo[]>([]);

  useEffect(() => {
    listModels().then((res) => {
      setModels(res.models);
      if (!value) onChange(res.default);
    });
  }, []);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[220px] h-8 text-xs">
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent>
        {models.map((m) => (
          <SelectItem key={m.id} value={m.id} className="text-xs">
            <span className="font-medium">{m.name}</span>
            <span className="text-muted-foreground ml-1.5">{m.provider}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
