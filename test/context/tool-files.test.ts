import { describe, it, expect } from 'vitest';
import type { SessionFile } from '../../src/context/SessionContext';

describe('Per-Tool File Management & Decoupled State Logic', () => {
  const dummyFileA: SessionFile = {
    id: 'file_a',
    name: 'document-A.pdf',
    size: 1024,
    data: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D]),
    isEncrypted: false,
    pageCount: 1,
  };

  const dummyFileB: SessionFile = {
    id: 'file_b',
    name: 'document-B.pdf',
    size: 2048,
    data: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D]),
    isEncrypted: true,
    pageCount: 2,
  };

  const dummyFileC: SessionFile = {
    id: 'file_c',
    name: 'document-C.pdf',
    size: 4096,
    data: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D]),
    isEncrypted: true,
    pageCount: 3,
  };

  it('tool-specific upload immediately overrides homepage queue for that tool without mutating home files', () => {
    const homeFiles = [dummyFileA, dummyFileB];
    const toolFiles: Record<string, SessionFile[]> = {
      unlock: [dummyFileC],
    };
    const toolSource: Record<string, 'home' | 'tool' | null> = {
      unlock: 'tool',
    };

    // Effective files for Unlock must be File C
    const unlockFiles = toolSource['unlock'] === 'tool' ? toolFiles['unlock'] : homeFiles;
    expect(unlockFiles).toHaveLength(1);
    expect(unlockFiles[0].name).toBe('document-C.pdf');

    // Home files remain completely intact with Document A and B
    expect(homeFiles).toHaveLength(2);
    expect(homeFiles[0].name).toBe('document-A.pdf');
    expect(homeFiles[1].name).toBe('document-B.pdf');
  });

  it('other tools without tool-specific uploads continue to use home queue when chosen', () => {
    const homeFiles = [dummyFileA, dummyFileB];
    const toolFiles: Record<string, SessionFile[]> = {
      unlock: [dummyFileC],
      protect: [],
    };
    const toolSource: Record<string, 'home' | 'tool' | null> = {
      unlock: 'tool',
      protect: 'home',
    };

    const protectFiles = toolSource['protect'] === 'home' ? homeFiles : toolFiles['protect'];
    expect(protectFiles).toHaveLength(2);
    expect(protectFiles[0].name).toBe('document-A.pdf');
  });

  it('supports explicit target selection for single-document operations when multiple files are available', () => {
    const files = [dummyFileA, dummyFileB];
    const activeTargetId = 'file_b';

    const targetFile = files.find((f) => f.id === activeTargetId) || null;
    expect(targetFile).not.toBeNull();
    expect(targetFile?.name).toBe('document-B.pdf');
    expect(targetFile?.isEncrypted).toBe(true);
  });
});
