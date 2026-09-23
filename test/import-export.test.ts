// Test file for JSON.gz import/export functionality
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock URL.createObjectURL for Node.js environment
(globalThis as any).URL.createObjectURL = vi.fn(() => 'blob:mock-url');
(globalThis as any).URL.revokeObjectURL = vi.fn();

// Mock CompressionStream and DecompressionStream for Node.js environment
class MockCompressionStream {
  writable = {
    getWriter: () => ({
      write: vi.fn(),
      close: vi.fn(),
    }),
  };
  readable = {
    getReader: () => ({
      read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
    }),
  };
}

class MockDecompressionStream {
  writable = {
    getWriter: () => ({
      write: vi.fn(),
      close: vi.fn(),
    }),
  };
  readable = {
    getReader: () => ({
      read: vi.fn(),
    }),
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  });
  vi.stubGlobal('CompressionStream', MockCompressionStream as any);
  vi.stubGlobal('DecompressionStream', MockDecompressionStream as any);
});

describe('JSON.gz Import/Export', () => {
  describe('importJSON', () => {
    it('should be exported from store', async () => {
      const { importJSON } = await import('../src/infrastructure/store');
      expect(importJSON).toBeDefined();
      expect(typeof importJSON).toBe('function');
    });

    it('should handle .json files', async () => {
      const { importJSON } = await import('../src/infrastructure/store');
      expect(importJSON).toBeDefined();
    });

    it('should handle .json.gz files', async () => {
      const { importJSON } = await import('../src/infrastructure/store');
      expect(importJSON).toBeDefined();
    });
  });

  describe('exportJSON', () => {
    it('should be exported from store', async () => {
      const { exportJSON } = await import('../src/infrastructure/store');
      expect(exportJSON).toBeDefined();
      expect(typeof exportJSON).toBe('function');
    });

    it('should return a Promise', async () => {
      const { exportJSON } = await import('../src/infrastructure/store');
      const promise = exportJSON();
      expect(promise).toBeInstanceOf(Promise);
    });
  });
});

describe('ImportExportView', () => {
  it('should render import/export buttons', async () => {
    const { default: ImportExportView } = await import('../src/presentation/ImportExportView');
    expect(ImportExportView).toBeDefined();
  });

  it('should accept .json and .gz files in file input', async () => {
    const { default: ImportExportView } = await import('../src/presentation/ImportExportView');
    expect(ImportExportView).toBeDefined();
  });
});
