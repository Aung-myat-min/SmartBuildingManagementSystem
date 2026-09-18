import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * A role-locked page. It states the role and who to ask — it no longer offers
 * to switch role, because with real accounts there is nothing to switch to.
 */
export function AccessDenied({
  title,
  body,
}: {
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <Card className="max-w-105 gap-3 p-7.5 text-center">
        <Lock className="text-muted-foreground mx-auto size-8.5" />
        <div className="text-[14px] font-semibold">{title}</div>
        <p className="text-muted-foreground text-[12.5px] leading-relaxed">
          {body}
        </p>
      </Card>
    </div>
  );
}
