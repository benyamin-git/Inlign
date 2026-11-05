import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";

import { CheckIcon } from "./icons.tsx";
import { IconButton } from "./IconButton.tsx";
import { cx } from "./cx.ts";

export type MenuItem = {
  id: string;
  label: string;
  onSelect: () => void;
  /** Present for a toggle item; exposes `menuitemcheckbox` and its state. */
  checked?: boolean;
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

type MenuPosition = { top: number; left: number; maxHeight: number };

const MENU_GAP = 4;
const MENU_MARGIN = 8;
const MENU_MIN_WIDTH = 192;

/**
 * Anchor the menu to the trigger: below by default, above when the content
 * would overflow the viewport bottom, clamped on both axes, and capped to the
 * space actually available so a tall menu scrolls instead of leaving the
 * viewport. Physical `left` matches the `getBoundingClientRect` math; the app
 * is LTR.
 */
function measureMenuPosition(trigger: HTMLElement, menu: HTMLElement): MenuPosition {
  const triggerRect = trigger.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const contentHeight = Math.max(menu.scrollHeight, menuRect.height);
  const width = Math.max(menuRect.width, MENU_MIN_WIDTH);
  const spaceBelow = Math.max(viewportHeight - triggerRect.bottom - MENU_GAP - MENU_MARGIN, 0);
  const spaceAbove = Math.max(triggerRect.top - MENU_GAP - MENU_MARGIN, 0);
  const desiredHeight = contentHeight > 0 ? contentHeight : Number.POSITIVE_INFINITY;
  const openAbove = desiredHeight > spaceBelow && spaceAbove > spaceBelow;
  const available = openAbove ? spaceAbove : spaceBelow;
  const height = Math.min(desiredHeight, available);
  const top = openAbove
    ? Math.max(MENU_MARGIN, triggerRect.top - MENU_GAP - height)
    : triggerRect.bottom + MENU_GAP;
  const maxLeft = Math.max(MENU_MARGIN, viewportWidth - width - MENU_MARGIN);
  const left = Math.min(Math.max(triggerRect.left, MENU_MARGIN), maxLeft);

  return {
    top: Math.round(top),
    left: Math.round(left),
    maxHeight: Math.round(height),
  };
}

function initialPosition(trigger: HTMLElement): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const width = Math.max(rect.width, MENU_MIN_WIDTH);
  const spaceBelow = Math.max(window.innerHeight - rect.bottom - MENU_GAP - MENU_MARGIN, 0);
  const maxLeft = Math.max(MENU_MARGIN, window.innerWidth - width - MENU_MARGIN);
  const left = Math.min(Math.max(rect.left, MENU_MARGIN), maxLeft);

  return {
    top: Math.round(rect.bottom + MENU_GAP),
    left: Math.round(left),
    maxHeight: Math.round(spaceBelow),
  };
}

export function Menu({ label, items, children, triggerClassName }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<MenuPosition>({
    top: 0,
    left: 0,
    maxHeight: 0,
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const openMenu = useCallback((index: number) => {
    const trigger = triggerRef.current;

    if (trigger) {
      setPosition(initialPosition(trigger));
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

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const trigger = triggerRef.current;
    const menu = menuRef.current;

    if (!trigger || !menu) {
      return;
    }

    setPosition(measureMenuPosition(trigger, menu));
  }, [open, items.length]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const target = menuRef.current?.querySelectorAll<HTMLElement>(
      '[role="menuitem"], [role="menuitemcheckbox"]',
    )[activeIndex];
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

  // A fixed menu cannot follow a scroll or resize; close rather than float in
  // the wrong place. Scrolling inside a tall menu is not a viewport change.
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleViewportChange(event: Event): void {
      if (
        event.type === "scroll" &&
        event.target instanceof Node &&
        menuRef.current?.contains(event.target)
      ) {
        return;
      }

      setOpen(false);
    }

    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);

    return () => {
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
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
                left: position.left,
                minWidth: MENU_MIN_WIDTH,
                maxHeight: position.maxHeight,
              }}
              className="fixed z-[60] flex flex-col gap-0.5 overflow-y-auto rounded-card border border-outline bg-surface-container-high p-1"
              onKeyDown={handleMenuKeyDown}
            >
              {items.map((item, index) => {
                const checkable = item.checked !== undefined;

                return (
                  <button
                    key={item.id}
                    type="button"
                    role={checkable ? "menuitemcheckbox" : "menuitem"}
                    aria-checked={checkable ? item.checked : undefined}
                    tabIndex={index === activeIndex ? 0 : -1}
                    disabled={item.disabled}
                    onPointerMove={() => {
                      setActiveIndex(index);
                    }}
                    onClick={() => {
                      select(item);
                    }}
                    className={cx(
                      "flex min-h-12 w-full items-center gap-3 rounded-chip px-3 text-start text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 md:min-h-10",
                      item.destructive
                        ? "text-loss hover:bg-surface-container"
                        : "text-on-surface hover:bg-surface-container",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.checked ? <CheckIcon className="h-4 w-4 shrink-0" /> : null}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
