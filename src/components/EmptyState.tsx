import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-4 px-4">
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-2">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>
      {title && <p className="text-sm font-medium text-foreground">{title}</p>}
      {description && <p className="text-xs text-muted-foreground mt-1 text-center max-w-[240px]">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
