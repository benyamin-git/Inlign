import { Button } from "../../ui/Button.tsx";
import { Dialog } from "../../ui/Dialog.tsx";
import { AccentPicker } from "./AccentPicker.tsx";
import { ThemePicker } from "./ThemePicker.tsx";
import type { SettingsModel } from "./useSettings.ts";

export type SettingsSheetProps = {
  open: boolean;
  settings: SettingsModel;
  onClose: () => void;
};

export function SettingsSheet({ open, settings, onClose }: SettingsSheetProps) {
  return (
    <Dialog
      open={open}
      title="Settings"
      onClose={onClose}
      actions={<Button onClick={onClose}>Done</Button>}
    >
      <div className="flex flex-col gap-6">
        <section>
          <h3 className="text-sm font-semibold text-on-surface">Appearance</h3>
          <div className="mt-3 flex flex-col gap-5">
            <ThemePicker
              value={settings.theme}
              resolvedTheme={settings.resolvedTheme}
              onChange={(theme) => {
                void settings.setTheme(theme);
              }}
            />
            <AccentPicker
              value={settings.accent}
              resolvedTheme={settings.resolvedTheme}
              onChange={(accent) => {
                void settings.setAccent(accent);
              }}
            />
          </div>
        </section>
        <section>
          <h3 className="text-sm font-semibold text-on-surface">Data</h3>
          <p className="mt-2 text-sm text-on-surface-variant">
            Import and export actions will appear here.
          </p>
        </section>
      </div>
    </Dialog>
  );
}
