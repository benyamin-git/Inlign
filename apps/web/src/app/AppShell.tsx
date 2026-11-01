import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import { useMediaQuery } from "./useMediaQuery.ts";
import { IconButton } from "../ui/IconButton.tsx";
import { Sheet } from "../ui/Sheet.tsx";
import { MenuIcon, SettingsIcon } from "../ui/icons.tsx";

export type SidebarRenderOptions = {
  onNavigate: (() => void) | undefined;
  onClose: (() => void) | undefined;
};

export type AppShellProps = {
  activeTitle: string | null;
  sidebar: (options: SidebarRenderOptions) => ReactNode;
  children: ReactNode;
};

const NARROW_QUERY = "(max-width: 767px)";

export function AppShell({ activeTitle, sidebar, children }: AppShellProps) {
  const isNarrow = useMediaQuery(NARROW_QUERY);
  const [sidebarOpen, setSidebarOpen] = useState(!isNarrow);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((open) => !open);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-on-surface">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-outline bg-surface px-3">
        <IconButton label={sidebarOpen ? "Hide sidebar" : "Show sidebar"} onClick={toggleSidebar}>
          <MenuIcon />
        </IconButton>
        <h1 className="shrink-0 text-lg font-semibold tracking-tight text-on-surface">Inlign</h1>
        <p
          data-testid="active-title"
          className="min-w-0 flex-1 truncate text-sm text-on-surface-variant"
        >
          {activeTitle ?? ""}
        </p>
        <IconButton label="Settings, coming soon" disabled>
          <SettingsIcon />
        </IconButton>
      </header>
      <div className="flex min-h-0 flex-1">
        {isNarrow ? (
          <Sheet open={sidebarOpen} label="Notebooks" onClose={closeSidebar}>
            {sidebar({ onNavigate: closeSidebar, onClose: closeSidebar })}
          </Sheet>
        ) : sidebarOpen ? (
          <aside
            aria-label="Notebooks"
            className="w-[280px] shrink-0 border-e border-outline bg-surface"
          >
            {sidebar({ onNavigate: undefined, onClose: undefined })}
          </aside>
        ) : null}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
