import { useEffect, useRef } from "react";
import type { RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

// Only the topmost modal handles Escape and Tab. Without this, a confirmation
// dialog opened from the narrow-screen drawer would close both on Escape.
const modalStack: HTMLElement[] = [];

function isTopmost(container: HTMLElement): boolean {
  return modalStack[modalStack.length - 1] === container;
}

/**
 * Modal focus management shared by Dialog and Sheet: move focus in, keep Tab
 * inside the panel, close on Escape, lock body scroll and restore the previous
 * focus on close. Programmatic focus outside the panel (a portaled menu, for
 * example) is left alone so layered overlays still work.
 */
export function useModalFocus(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void,
  initialFocusRef?: RefObject<HTMLElement | null>,
): void {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const container = containerRef.current;

    if (!container) {
      return;
    }

    modalStack.push(container);

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    function focusableElements(): HTMLElement[] {
      if (!container) {
        return [];
      }

      return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) =>
          !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true",
      );
    }

    const initialTarget = initialFocusRef?.current ?? focusableElements()[0] ?? container;
    initialTarget.focus();

    function handleKeyDown(event: KeyboardEvent): void {
      if (!container || !isTopmost(container)) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const items = focusableElements();
      const first = items[0];
      const last = items[items.length - 1];

      if (!first || !last) {
        event.preventDefault();
        container?.focus();
        return;
      }

      const current = document.activeElement;

      if (event.shiftKey) {
        if (current === first || !current || !container?.contains(current)) {
          event.preventDefault();
          last.focus();
        }
      } else if (current === last || !current || !container?.contains(current)) {
        event.preventDefault();
        first.focus();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;

      const index = modalStack.lastIndexOf(container);

      if (index !== -1) {
        modalStack.splice(index, 1);
      }

      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [active, containerRef, initialFocusRef]);
}
