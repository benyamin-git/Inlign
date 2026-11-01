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
      <div role="presentation" className="absolute inset-0 bg-scrim" onMouseDown={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-sm rounded-dialog border border-outline bg-surface-container-high p-6 text-on-surface"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        {children ? <div className="mt-3 text-sm text-on-surface-variant">{children}</div> : null}
        {actions ? <div className="mt-6 flex justify-end gap-2">{actions}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
