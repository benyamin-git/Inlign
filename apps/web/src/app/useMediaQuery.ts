import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query. jsdom has no `matchMedia`, so the fallback
 * reports `false`: desktop layout and no drawer.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return () => {};
      }

      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);

      return () => {
        media.removeEventListener("change", onChange);
      };
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return false;
      }

      return window.matchMedia(query).matches;
    },
    () => false,
  );
}
