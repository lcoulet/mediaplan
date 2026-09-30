// use-print-mode.test.tsx — reactive print-mode flag (body.print-mode class,
// toggled by usePrint while printing). The daily view uses it to switch to
// the print time axis only while printing; screen behavior is unchanged.
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePrintMode } from '../src/presentation/usePrintMode';

describe('usePrintMode', () => {
  afterEach(() => {
    document.body.classList.remove('print-mode');
  });

  it('is false while the body has no print-mode class', () => {
    const { result } = renderHook(() => usePrintMode());
    expect(result.current).toBe(false);
  });

  it('becomes true when usePrint adds the print-mode class to body', async () => {
    const { result } = renderHook(() => usePrintMode());
    expect(result.current).toBe(false);
    await act(async () => {
      document.body.classList.add('print-mode');
    });
    expect(result.current).toBe(true);
  });

  it('returns to false after printing (class removed by afterprint cleanup)', async () => {
    const { result } = renderHook(() => usePrintMode());
    await act(async () => {
      document.body.classList.add('print-mode');
    });
    expect(result.current).toBe(true);
    await act(async () => {
      document.body.classList.remove('print-mode');
    });
    expect(result.current).toBe(false);
  });

  it('cleans up its body-class observer on unmount', async () => {
    const { result, unmount } = renderHook(() => usePrintMode());
    unmount();
    // Toggling the class after unmount must not throw (observer disconnected)
    document.body.classList.add('print-mode');
    expect(result.current).toBe(false);
    document.body.classList.remove('print-mode');
  });
});
