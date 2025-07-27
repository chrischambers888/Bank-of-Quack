import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface EmptyStateCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyStateCard({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
  className = "",
}: EmptyStateCardProps) {
  return (
    <Card className={`text-center py-12 ${className}`}>
      <CardContent>
        <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground mb-4">{description}</p>
        {actionText && onAction && (
          <Button onClick={onAction}>{actionText}</Button>
        )}
      </CardContent>
    </Card>
  );
}
