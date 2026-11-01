import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";

import { IconButton } from "./IconButton.tsx";
import { cx } from "./cx.ts";

export type MenuItem = {
  id: string;
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

export type MenuProps = {
  /** Accessible name shared by the trigger and the menu. */
  label: string;
  items: MenuItem[];
  /** Trigger icon. */
  children: ReactNode;
  triggerClassName?: string | undefined;
};

type MenuPosition = { top: number; inlineStart: number; minWidth: number };

export function Menu({ label, items, children, triggerClassName }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<MenuPosition>({
    top: 0,
    inlineStart: 0,
    minWidth: 192,
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const openMenu = useCallback((index: number) => {
    const trigger = triggerRef.current;

    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      const width = Math.max(rect.width, 192);
      const maxInlineStart = Math.max(8, window.innerWidth - width - 8);

      setPosition({
        top: Math.round(rect.bottom + 4),
        inlineStart: Math.round(Math.min(Math.max(rect.left, 8), maxInlineStart)),
        minWidth: width,
      });
    }

    setActiveIndex(index);
    setOpen(true);
  }, []);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);

    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const target = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')[activeIndex];
    target?.focus();
  }, [open, activeIndex]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent): void {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  function select(item: MenuItem): void {
    if (item.disabled) {
      return;
    }

    close(true);
    item.onSelect();
  }

  function moveActive(step: number): void {
    const enabled = items.flatMap((item, index) => (item.disabled ? [] : [index]));

    if (enabled.length === 0) {
      return;
    }

    const current = enabled.indexOf(activeIndex);
    const next = current === -1 ? 0 : (current + step + enabled.length) % enabled.length;
    const target = enabled[next];

    if (target !== undefined) {
      setActiveIndex(target);
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        close(true);
        break;
      case "Tab":
        // Close, return focus to the trigger, and stop the drawer's trap from
        // moving focus to its first control.
        event.preventDefault();
        event.stopPropagation();
        close(true);
        break;
      case "ArrowDown":
        event.preventDefault();
        moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveActive(-1);
        break;
      case "Home": {
        event.preventDefault();
        const first = items.findIndex((item) => !item.disabled);

        if (first !== -1) {
          setActiveIndex(first);
        }
        break;
      }
      case "End": {
        event.preventDefault();
        let last = -1;

        items.forEach((item, index) => {
          if (!item.disabled) {
            last = index;
          }
        });

        if (last !== -1) {
          setActiveIndex(last);
        }
        break;
      }
      default:
        break;
    }
  }

  return (
    <>
      <IconButton
        ref={triggerRef}
        label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={triggerClassName}
        onClick={() => {
          if (open) {
            close(true);
          } else {
            openMenu(0);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            openMenu(0);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            openMenu(Math.max(0, items.length - 1));
          }
        }}
      >
        {children}
      </IconButton>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              tabIndex={-1}
              style={{
                top: position.top,
                insetInlineStart: position.inlineStart,
                minWidth: position.minWidth,
              }}
              className="fixed z-[60] flex flex-col gap-0.5 rounded-card border border-outline bg-surface-container-high p-1"
              onKeyDown={handleMenuKeyDown}
            >
              {items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  tabIndex={index === activeIndex ? 0 : -1}
                  disabled={item.disabled}
                  onPointerMove={() => {
                    setActiveIndex(index);
                  }}
                  onClick={() => {
                    select(item);
                  }}
                  className={cx(
                    "flex min-h-12 w-full items-center rounded-chip px-3 text-start text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 md:min-h-10",
                    item.destructive
                      ? "text-loss hover:bg-surface-container"
                      : "text-on-surface hover:bg-surface-container",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
