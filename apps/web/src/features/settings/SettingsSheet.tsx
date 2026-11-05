import type { Notebook } from "../../data/models.ts";
import { Button } from "../../ui/Button.tsx";
import { Checkbox } from "../../ui/Checkbox.tsx";
import { Dialog } from "../../ui/Dialog.tsx";
import { TransferActions } from "../transfer/TransferActions.tsx";
import type { TransferModel } from "../transfer/useTransfer.ts";
import { AccentPicker } from "./AccentPicker.tsx";
import { ThemePicker } from "./ThemePicker.tsx";
import type { SettingsModel } from "./useSettings.ts";

export type SettingsSheetProps = {
  open: boolean;
  settings: SettingsModel;
  active: Notebook | null;
  onExport: (notebook: Notebook) => void;
  transfer: TransferModel;
  onClose: () => void;
};

export function SettingsSheet({
  open,
  settings,
  active,
  onExport,
  transfer,
  onClose,
}: SettingsSheetProps) {
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
          <h3 className="text-sm font-semibold text-on-surface">New notebooks</h3>
          <div className="mt-3">
            <Checkbox
              label="Ignore variable case by default"
              description="A new notebook treats X and x as the same variable."
              checked={settings.defaultIgnoreCase}
              onChange={(checked) => {
                void settings.setDefaultIgnoreCase(checked);
              }}
            />
          </div>
        </section>
        <section>
          <h3 className="text-sm font-semibold text-on-surface">Data</h3>
          <TransferActions active={active} onExport={onExport} transfer={transfer} />
        </section>
      </div>
    </Dialog>
  );
}
