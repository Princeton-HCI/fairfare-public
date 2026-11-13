import { randomUUID } from 'crypto';
import {
  uploadChunk,
  downloadChunk,
  listChunkPaths,
  concatenateChunksToFinalFile,
  downloadFinalFile,
  deleteChunks,
  deleteExport
} from './exportStorage';

describe('exportStorage', () => {
  let exportId: string;

  beforeEach(() => {
    exportId = `test-${randomUUID()}`;
  });

  afterEach(async () => {
    try {
      await deleteExport(exportId);
    } catch {
      // Ignore cleanup errors -- folder may already be empty
    }
  });

  it('uploads and downloads a chunk with matching content', async () => {
    const content = 'header1,header2\nvalue1,value2\n';
    await uploadChunk(exportId, 0, content);

    const path = `policy-analysis/${exportId}/chunk_0000.csv`;
    const downloaded = await downloadChunk(path);
    expect(downloaded).toBe(content);
  });

  it('lists chunk paths in sorted order', async () => {
    await uploadChunk(exportId, 0, 'chunk0\n');
    await uploadChunk(exportId, 1, 'chunk1\n');
    await uploadChunk(exportId, 2, 'chunk2\n');

    const paths = await listChunkPaths(exportId);
    expect(paths).toHaveLength(3);
    expect(paths[0]).toContain('chunk_0000.csv');
    expect(paths[1]).toContain('chunk_0001.csv');
    expect(paths[2]).toContain('chunk_0002.csv');
  });

  it('concatenates chunks into a final file', async () => {
    await uploadChunk(exportId, 0, 'header\n');
    await uploadChunk(exportId, 1, 'row1\n');

    const filePath = await concatenateChunksToFinalFile(exportId);
    expect(filePath).toBe(`policy-analysis/${exportId}/export.csv`);

    const content = await downloadFinalFile(exportId);
    expect(content).toBe('header\nrow1\n');
  });

  it('deletes chunks but keeps the final file', async () => {
    await uploadChunk(exportId, 0, 'chunk0\n');
    await uploadChunk(exportId, 1, 'chunk1\n');
    await concatenateChunksToFinalFile(exportId);

    await deleteChunks(exportId);

    const remaining = await listChunkPaths(exportId);
    expect(remaining).toHaveLength(0);

    const finalContent = await downloadFinalFile(exportId);
    expect(finalContent).toBe('chunk0\nchunk1\n');
  });

  it('deletes all files for an export', async () => {
    await uploadChunk(exportId, 0, 'data\n');
    await concatenateChunksToFinalFile(exportId);

    await deleteExport(exportId);

    const chunks = await listChunkPaths(exportId);
    expect(chunks).toHaveLength(0);
  });

  it('downloadFinalFile returns correct content after concatenation', async () => {
    await uploadChunk(exportId, 0, 'A,B\n1,2\n');
    await uploadChunk(exportId, 1, '3,4\n');
    await concatenateChunksToFinalFile(exportId);

    const content = await downloadFinalFile(exportId);
    expect(content).toBe('A,B\n1,2\n3,4\n');
  });
});
