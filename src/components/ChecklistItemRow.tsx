import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChecklistItemProps {
  item: {
    id: string;
    label: string;
    done: boolean;
    required_by: string | null;
  };
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ChecklistItemRow({ item, onToggle, onDelete }: ChecklistItemProps) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0 group">
      <Checkbox
        checked={item.done}
        onCheckedChange={() => onToggle(item.id)}
        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
      />
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {item.label}
        </span>
        {item.required_by && (
          <span className="text-xs text-muted-foreground ml-2">
            ({item.required_by})
          </span>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onDelete(item.id)}
      >
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
}
