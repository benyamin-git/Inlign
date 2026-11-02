import { useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { useModalFocus } from "./useModalFocus.ts";

export type SheetProps = {
  open: boolean;
  /** Accessible name for the drawer dialog. */
  label: string;
  onClose: () => void;
  children: ReactNode;
};

export function Sheet({ open, label, onClose, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useModalFocus(panelRef, open, onClose);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-40">
      <div
        role="presentation"
        className="absolute inset-0 bg-scrim"
        onMouseDown={(event) => {
          // Same focus restoration contract as Dialog: the scrim must not move
          // focus to <body> before the opener is restored.
          event.preventDefault();
          onClose();
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="absolute inset-y-0 start-0 flex w-[var(--sidebar-width)] max-w-[85vw] flex-col border-e border-outline bg-surface"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
