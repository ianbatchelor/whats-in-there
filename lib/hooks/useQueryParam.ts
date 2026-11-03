import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** Reads one query-string value on the client. Static export has no server to read it. */
export function useQueryParam(name: string): string | null | undefined {
  return useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(window.location.search).get(name),
    () => undefined,
  );
}
