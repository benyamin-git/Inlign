export type Debounced<Args extends unknown[]> = {
  (...args: Args): void;
  flush: () => void;
  cancel: () => void;
};

/**
 * Trailing debounce. Repeated calls keep only the latest arguments, and
 * `flush()` invokes the callback right away when work is pending.
 */
export function debounce<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay: number,
): Debounced<Args> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Args | null = null;

  const cancel = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }

    pendingArgs = null;
  };

  const flush = (): void => {
    if (timer === null || pendingArgs === null) {
      return;
    }

    const args = pendingArgs;

    clearTimeout(timer);
    timer = null;
    pendingArgs = null;
    callback(...args);
  };

  const debounced = (...args: Args): void => {
    pendingArgs = args;

    if (timer !== null) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      const latest = pendingArgs;

      timer = null;
      pendingArgs = null;

      if (latest !== null) {
        callback(...latest);
      }
    }, delay);
  };

  debounced.flush = flush;
  debounced.cancel = cancel;

  return debounced;
}
