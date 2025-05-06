"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface StatusControlCardProps {
  ufwStatus: string | null;
  isSubmitting: boolean;
  onEnable: () => void;
  onDisable: () => void;
}

export default function StatusControlCard({
  ufwStatus,
  isSubmitting,
  onEnable,
  onDisable,
}: StatusControlCardProps) {
  const statusColor = ufwStatus === 'active' ? 'text-green-600' : 'text-red-600';

  return (
    <Card>
      <CardHeader>
        <CardTitle>UFW Status & Control</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p>
            <strong>Status:</strong>{' '}
            {ufwStatus !== null ? (
              <span className={`font-semibold ${statusColor}`}>
                {ufwStatus}
              </span>
            ) : (
              <span className="text-muted-foreground">Loading...</span>
            )}
          </p>
          <div className="flex space-x-2">
            <Button
              onClick={onEnable}
              disabled={isSubmitting || ufwStatus === 'active'}
              variant="default"
              size="sm"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enable
            </Button>
            <Button
              onClick={onDisable}
              disabled={isSubmitting || ufwStatus !== 'active'}
              variant="destructive"
              size="sm"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Disable
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
