/** Save a text file: share sheet on touch devices (best on iOS), download elsewhere. */
export async function saveFile(filename: string, content: string, mime: string): Promise<void> {
  const file = new File([content], filename, { type: mime });
  const touch = window.matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
      // fall through to a regular download
    }
  }
  download(file);
}

export type ShareResult = 'shared' | 'cancelled' | 'downloaded';

/**
 * Hand a file to another app (Telegram, mail…) through the system share sheet, on any device that
 * supports sharing files. Where it doesn't, the file is downloaded instead so it can be sent from there.
 */
export async function shareFile(filename: string, content: string, mime: string, title?: string): Promise<ShareResult> {
  const file = new File([content], filename, { type: mime });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
      // fall through to a regular download
    }
  }
  download(file);
  return 'downloaded';
}

function download(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Open the system file picker. Resolves null if nothing is picked. */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      resolve(input.files?.[0] ?? null);
      input.remove();
    });
    input.addEventListener('cancel', () => {
      resolve(null);
      input.remove();
    });
    document.body.append(input);
    input.click();
  });
}

export function dateStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'deck';
}

/**
 * Copy text to the clipboard. The text may still be loading: Safari only allows copying during the
 * tap, so a pending text goes in a ClipboardItem that is handed over right away. Returns false if
 * the browser refused.
 */
export async function copyText(text: string | Promise<string>): Promise<boolean> {
  const clipboard = navigator.clipboard;
  if (typeof text !== 'string' && clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      const blob = text.then((s) => new Blob([s], { type: 'text/plain' }));
      await clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
      return true;
    } catch {
      // fall through
    }
  }
  const value = await text;
  try {
    await clipboard.writeText(value);
    return true;
  } catch {
    return copyWithTextarea(value);
  }
}

/** The old way, for browsers without the async clipboard or with it blocked. */
function copyWithTextarea(value: string): boolean {
  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
