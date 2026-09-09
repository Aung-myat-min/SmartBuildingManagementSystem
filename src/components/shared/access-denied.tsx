import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function AccessDenied({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <Card className="max-w-105 gap-3 p-7.5 text-center">
        <Lock className="text-muted-foreground mx-auto size-8.5" />
        <div className="text-[14px] font-semibold">{title}</div>
        <p className="text-muted-foreground text-[12.5px] leading-relaxed">
          {body}
        </p>
        {actionLabel && onAction && (
          <Button variant="outline" onClick={onAction} className="mt-1 w-full">
            {actionLabel}
          </Button>
        )}
      </Card>
    </div>
  );
}
