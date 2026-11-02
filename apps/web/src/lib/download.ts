export function downloadFile(filename: string, contents: string, type = "text/plain"): void {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next task so the browser can start the download first.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
