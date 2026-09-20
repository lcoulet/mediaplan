// Debug: verify a dragged 90min/15setup/5teardown offer produces a 110min block
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { DataProvider } from '../src/presentation/DataContext';
import DailyView from '../src/presentation/DailyView';
import type { AppData } from '../src/domain/types';

const mockData: AppData = {
  mediators: [
    { id: 'm1', firstName: 'Jean', lastName: 'Dupont', email: '', phone: '', notes: '', color: '#FF0000', active: true, competences: [] },
  ],
  offers: [
    // User's scenario: 90 min + 15 setup + 5 teardown = 110
    { id: 'o1', name: 'Grande visite', description: '', duration: 90, capacity: 20, location: '', setupTime: 15, teardownTime: 5 },
  ],
  schedules: [],
  slots: [],
  absences: [],
};

const MOCK_DATE = new Date('2026-09-19T10:00:00.000Z');

describe('drag & drop total duration', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(mockData)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    vi.stubGlobal('Date', class extends Date {
      constructor(...args: any[]) {
        if (args.length === 0) super(MOCK_DATE.getTime());
        else super(...(args as [any]));
      }
      static now() { return MOCK_DATE.getTime(); }
    });
  });

  it('indicator and created slot use setup + duration + teardown (110 min)', () => {
    const { container } = render(
      <DataProvider>
        <DailyView />
      </DataProvider>
    );

    const dataTransfer = {
      effectAllowed: 'move', dropEffect: 'move',
      setData: () => {}, getData: () => '',
    };

    const offer = container.querySelector('.daily-offer')!;
    const dragStartEvent = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(dragStartEvent, 'dataTransfer', { value: dataTransfer });
    act(() => { offer.dispatchEvent(dragStartEvent); });

    const track = container.querySelector('.daily-mediators-section .daily-mediator-track')!;
    Object.defineProperty(track, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 660, height: 40 }),
    });

    // dragover at 120px = 8:00 + 120 min = 10:00 (block start)
    const dragOverEvent = new MouseEvent('dragover', {
      bubbles: true, cancelable: true, clientX: 120, clientY: 20,
    });
    Object.defineProperty(dragOverEvent, 'dataTransfer', { value: dataTransfer });
    act(() => { track.dispatchEvent(dragOverEvent); });

    const indicator = container.querySelector('.daily-drag-indicator') as HTMLElement;
    expect(indicator).toBeTruthy();

    // Total block width must be 110 min = 110px (HOUR_HEIGHT=60 -> 1px/min)
    expect(indicator.style.width).toBe('110px');

    // Booking 10:15 - 11:45 shown in the label
    const label = indicator.querySelector('.drag-indicator-time');
    expect(label!.textContent).toContain('10:15');
    expect(label!.textContent).toContain('11:45');

    // Tooltip: total block 10:00 -> 11:50 (110 min)
    const title = indicator.getAttribute('title') || '';
    expect(title).toContain('10:00');
    expect(title).toContain('11:50');

    // Drop creates the slot: rendered block 110px wide starting at 10:00
    const dropEvent = new MouseEvent('drop', {
      bubbles: true, cancelable: true, clientX: 120, clientY: 20,
    });
    Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });
    act(() => { track.dispatchEvent(dropEvent); });

    const createdSlot = container.querySelector('.daily-mediators-section .daily-slot') as HTMLElement;
    expect(createdSlot).toBeTruthy();
    expect(createdSlot.style.width).toBe('110px');   // 110 min block
    expect(createdSlot.style.left).toBe('120px');    // 10:00
    // Booking label inside the slot
    expect(createdSlot.textContent).toContain('10:15');
    expect(createdSlot.textContent).toContain('11:45');
  });
});
