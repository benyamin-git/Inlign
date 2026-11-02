import { useId, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { useModalFocus } from "./useModalFocus.ts";

export type DialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children?: ReactNode;
  actions?: ReactNode;
};

export function Dialog({ open, title, onClose, children, actions }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useModalFocus(panelRef, open, onClose);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        role="presentation"
        className="absolute inset-0 bg-scrim"
        onMouseDown={(event) => {
          // Keep focus where it is so the modal cleanup can restore the opener
          // instead of the browser focusing <body> after unmount.
          event.preventDefault();
          onClose();
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-sm flex-col rounded-dialog border border-outline bg-surface-container-high p-6 text-on-surface"
      >
        <h2 id={titleId} className="shrink-0 text-lg font-semibold">
          {title}
        </h2>
        {children ? (
          <div className="mt-2 min-h-0 overflow-y-auto p-1 text-sm text-on-surface-variant">
            {children}
          </div>
        ) : null}
        {actions ? <div className="mt-6 flex shrink-0 justify-end gap-2">{actions}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
