## Local-first by design

All notebooks and settings live on your device: in IndexedDB when Inlign runs
as a web app or installed PWA, and in the app's own data store in the desktop
and Android builds. There is no account, no server, no sync, and no telemetry.
Nothing leaves the device unless you export it.

Why: a drafting notepad holds half-finished, private thinking. Local-first
also means the app works fully offline, and the data stays yours to copy.

## Notebooks

- Autosave writes changes shortly after you stop typing; there is no save
  button.
- Titles are edited in the top bar; the switcher lists notebooks by last edit.
- Deleting a notebook is permanent and asks for confirmation first.

## `.inlign` files

Exporting a notebook produces an `.inlign` file: UTF-8 plain text with exactly
the lines you wrote and no metadata. Importing one creates a new notebook and
takes its title from the filename.

Why plain text: an `.inlign` file stays readable in any editor, diffable in
git, and openable even if Inlign itself changes. It carries no hidden state
that could later become unreadable.

## JSON backup

- **Export backup** writes every notebook plus all settings to one JSON file.
- **Restore backup** replaces every notebook and all settings with the file's
  contents. A confirmation appears first because the replacement cannot be
  undone.

Why backups exist: browser storage can be cleared by the user, by storage
pressure, or by the operating system, and devices are lost. The backup file is
the copy that survives the device, and it is the way to move notebooks to
another machine or browser.

## Care points

- Clearing site data or uninstalling the app deletes local notebooks. Export a
  backup first.
- Devices do not sync with each other; restore a backup to move work across.
- `.inlign` is the format for sharing a single notebook; JSON backup is the
  format for protecting or migrating everything.
