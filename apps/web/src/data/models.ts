export type Line = { id: string; text: string };

export type Notebook = {
  id: string; // createId()
  title: string; // trimmed, max 120 chars
  lines: Line[]; // source of truth; at least one line
  pinned: boolean;
  sortOrder: number; // manual order within the pinned or unpinned section
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
};

export type Theme = "light" | "dark" | "oled";
export type Accent = "blue" | "teal" | "green" | "orange" | "rose" | "violet";
export type Settings = { theme: Theme | null; accent: Accent }; // null = follow OS
