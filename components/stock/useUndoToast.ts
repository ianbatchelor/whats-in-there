"use client";

import { useCallback, useState } from "react";
import type { ToastData } from "@/components/ui/Toast";
import { friendlyError } from "@/lib/supabase/errors";
import { undo } from "@/lib/stock";

/** One toast per screen, with an Undo that reverses the change in the database. */
export function useUndoToast(afterChange: () => void) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const announce = useCallback(
    (message: string, movementId: string | null) => {
      setToast({
        id: Date.now(),
        message,
        actionLabel: movementId ? "Undo" : undefined,
        onAction: movementId
          ? async () => {
              try {
                await undo(movementId);
                afterChange();
                setToast({ id: Date.now(), message: "Undone" });
              } catch (e) {
                setToast({ id: Date.now(), message: friendlyError(e) });
              }
            }
          : undefined,
      });
    },
    [afterChange],
  );
  return { toast, clear: useCallback(() => setToast(null), []), announce, show: setToast };
}
