/**
 * Thin abstraction over file storage for policy analysis exports.
 * Current implementation: Supabase Storage.
 * Future: swap to @google-cloud/storage (GCS) by reimplementing these functions.
 */

import { env } from '$env/dynamic/private';
import { supabase } from './db';

const BUCKET = env.EXPORT_STORAGE_BUCKET ?? 'exports';

function chunkPath(exportId: string, chunkIndex: number): string {
  return `policy-analysis/${exportId}/chunk_${String(chunkIndex).padStart(4, '0')}.csv`;
}

function finalPath(exportId: string): string {
  return `policy-analysis/${exportId}/export.csv`;
}

export async function uploadChunk(
  exportId: string,
  chunkIndex: number,
  csvData: string
): Promise<void> {
  const path = chunkPath(exportId, chunkIndex);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, csvData, { contentType: 'text/csv', upsert: true });

  if (error) {
    throw new Error(
      `Failed to upload chunk ${chunkIndex} for export ${exportId}: ${error.message}`
    );
  }
}

export async function listChunkPaths(exportId: string): Promise<string[]> {
  const folder = `policy-analysis/${exportId}`;
  const { data, error } = await supabase.storage.from(BUCKET).list(folder, {
    sortBy: { column: 'name', order: 'asc' }
  });

  if (error) {
    throw new Error(`Failed to list chunks for export ${exportId}: ${error.message}`);
  }

  return (data ?? [])
    .filter((file: { name: string }) => file.name.startsWith('chunk_'))
    .map((file: { name: string }) => `${folder}/${file.name}`);
}

export async function downloadChunk(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);

  if (error || !data) {
    throw new Error(`Failed to download chunk ${path}: ${error?.message}`);
  }

  if (typeof data === 'string') return data;
  if (typeof data.text === 'function') return data.text();
  if (typeof data.arrayBuffer === 'function') {
    return new TextDecoder().decode(await data.arrayBuffer());
  }
  // FileReader fallback for environments where Blob lacks modern methods (e.g. jsdom)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(data);
  });
}

/**
 * Concatenates all chunk files into a single final export file.
 * Returns the storage path of the concatenated file.
 */
export async function concatenateChunksToFinalFile(exportId: string): Promise<string> {
  const chunkPaths = await listChunkPaths(exportId);
  const parts: string[] = [];

  for (const path of chunkPaths) {
    parts.push(await downloadChunk(path));
  }

  const concatenated = parts.join('');
  const path = finalPath(exportId);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, concatenated, { contentType: 'text/csv', upsert: true });

  if (error) {
    throw new Error(`Failed to upload final file for export ${exportId}: ${error.message}`);
  }

  return path;
}

/**
 * Downloads the final concatenated export file.
 */
export async function downloadFinalFile(exportId: string): Promise<string> {
  const path = finalPath(exportId);
  return downloadChunk(path);
}

/**
 * Removes only the intermediate chunk files, keeping the final export.csv.
 * Call after concatenateChunksToFinalFile to reclaim ~50% storage.
 */
export async function deleteChunks(exportId: string): Promise<void> {
  const paths = await listChunkPaths(exportId);
  if (paths.length === 0) return;

  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) {
    console.error(`Failed to delete chunks for export ${exportId}: ${error.message}`);
  }
}

/**
 * Removes all storage files (chunks + final) for an export.
 */
export async function deleteExport(exportId: string): Promise<void> {
  const folder = `policy-analysis/${exportId}`;
  const { data, error: listError } = await supabase.storage.from(BUCKET).list(folder);

  if (listError) {
    throw new Error(`Failed to list files for export ${exportId}: ${listError.message}`);
  }

  const paths = (data ?? []).map((file: { name: string }) => `${folder}/${file.name}`);
  if (paths.length === 0) return;

  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) {
    throw new Error(`Failed to delete export ${exportId}: ${error.message}`);
  }
}
