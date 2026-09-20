// StatusBar — app-wide footer with version, storage usage, last modified
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBar from '../src/presentation/StatusBar';

describe('StatusBar', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      // ~1 KB of data + a last-modified timestamp
      getItem: vi.fn((key: string) => {
        if (key === 'mediaplan_data_v1') return 'x'.repeat(1024);
        if (key === 'mediaplan_last_modified') return '2026-09-14T19:30:00.000Z';
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.useFakeTimers();
  });

  it('renders the app version, storage usage ratio and last-modified date', async () => {
    render(<StatusBar />);

    // Version from package.json (injected at build; fallback in tests)
    expect(screen.getByText(/MediaPlan v/)).toBeInTheDocument();

    // Storage: 1024 bytes / 5 MB
    const usage = screen.getByText(/Données :/);
    expect(usage.textContent).toContain('1.0 Ko');
    expect(usage.textContent).toContain('5 Mo');
    expect(usage.textContent).toContain('%');

    // Last modified: formatted French date
    const lastMod = screen.getByText(/MAJ :/);
    expect(lastMod.textContent).toMatch(/14 sept\. 2026/);
  });

  it('shows an em dash when no data was ever saved', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    render(<StatusBar />);
    expect(screen.getByText(/MAJ : —/)).toBeInTheDocument();
  });
});
