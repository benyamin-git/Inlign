import { Button } from "../ui/Button.tsx";

export type EmptyStateProps = {
  onCreate: () => void;
};

export function EmptyState({ onCreate }: EmptyStateProps) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-xl font-semibold text-on-surface">No notebooks yet</h2>
      <p className="max-w-[52ch] text-sm text-on-surface-variant">
        A notebook is a stack of single-line cards. Create one to start drafting.
      </p>
      <Button onClick={onCreate}>New notebook</Button>
    </div>
  );
}
