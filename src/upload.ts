// File uploads. The KYC and instance endpoints take multipart/form-data, so this
// turns a plain object of fields plus a set of file inputs into a FormData the
// transport sends as-is. A file can be a Blob, raw bytes with a name, or read
// from disk with `fileFromPath`.

import { readFile } from "node:fs/promises";
import { basename } from "node:path";

/** A file to upload: a Blob, or raw bytes with a filename. */
export type FileInput =
  | Blob
  | { data: Uint8Array | Blob; filename: string; contentType?: string };

/** Read a file off disk into a FileInput, taking the name from the path. */
export async function fileFromPath(
  path: string,
  contentType?: string,
): Promise<FileInput> {
  const data = await readFile(path);
  return { data: new Uint8Array(data), filename: basename(path), contentType };
}

function toBlobPart(file: FileInput): { blob: Blob; filename?: string } {
  if (file instanceof Blob) {
    const name = (file as { name?: string }).name;
    return { blob: file, filename: name };
  }
  const blob =
    file.data instanceof Blob
      ? file.data
      : new Blob([file.data], file.contentType ? { type: file.contentType } : {});
  return { blob, filename: file.filename };
}

/**
 * Build a FormData from scalar fields and file fields. Undefined and null fields
 * are skipped; objects are sent as JSON strings, the way the API reads metadata.
 */
export function buildFormData(
  fields: Record<string, unknown>,
  files: Record<string, FileInput | undefined> = {},
): FormData {
  const form = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "object") form.set(key, JSON.stringify(value));
    else form.set(key, String(value));
  }

  for (const [key, file] of Object.entries(files)) {
    if (!file) continue;
    const { blob, filename } = toBlobPart(file);
    if (filename) form.set(key, blob, filename);
    else form.set(key, blob);
  }

  return form;
}
