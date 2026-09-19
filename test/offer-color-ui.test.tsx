// test/offer-color-ui.test.tsx — Offer color: picker in OfferModal, pills in views/modals
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataProvider } from '../src/presentation/DataContext';
import OfferModal from '../src/presentation/OfferModal';
import type { AppData, Offer } from '../src/domain/types';

// Minimal localStorage mock (jsdom doesn't provide localStorage)
class LocalStorageMock {
  data: Record<string, string> = {};
  getItem(key: string): string | null { return this.data[key] || null; }
  setItem(key: string, value: string): void { this.data[key] = String(value); }
  removeItem(key: string): void { delete this.data[key]; }
  clear(): void { this.data = {}; }
}
vi.stubGlobal('localStorage', new LocalStorageMock());

function storedOffer(color = '#123456'): Offer {
  return {
    id: 'off_1',
    name: 'Visite guidée Dinosauria',
    description: '',
    duration: 90,
    capacity: 25,
    location: 'Galerie Dinosauria',
    color,
  };
}

function seedStorage(offers: Offer[]): void {
  const data: AppData = {
    mediators: [],
    offers,
    schedules: [],
    slots: [],
    absences: [],
  };
  localStorage.setItem('mediaplan_data_v1', JSON.stringify(data));
}

function readStoredOffers(): Offer[] {
  const raw = localStorage.getItem('mediaplan_data_v1');
  return JSON.parse(raw!).offers as Offer[];
}

describe('OfferModal — color picker', () => {
  beforeEach(() => localStorage.clear());

  it('renders a color input bound to the offer color', () => {
    seedStorage([storedOffer('#123456')]);
    render(
      <DataProvider>
        <OfferModal offer={storedOffer('#123456')} onClose={() => {}} />
      </DataProvider>
    );
    const input = document.querySelector('input[type="color"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('#123456');
  });

  it('saves the picked color on submit', () => {
    seedStorage([storedOffer('#123456')]);
    render(
      <DataProvider>
        <OfferModal offer={storedOffer('#123456')} onClose={() => {}} />
      </DataProvider>
    );
    const input = document.querySelector('input[type="color"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '#abcdef' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    const offers = readStoredOffers();
    expect(offers[0].color).toBe('#abcdef');
  });

  it('gives a new offer a default color from the palette', () => {
    // Seed one mediator so DataProvider does not auto-seed demo data
    seedStorage([]);
    localStorage.setItem(
      'mediaplan_data_v1',
      JSON.stringify({
        mediators: [{ id: 'med_1', lastName: 'X', firstName: '', email: '', phone: '', skills: [], active: true, color: '#123456', notes: '' }],
        offers: [],
        schedules: [],
        slots: [],
        absences: [],
      })
    );
    render(
      <DataProvider>
        <OfferModal offer={null} onClose={() => {}} />
      </DataProvider>
    );
    const input = document.querySelector('input[type="color"]') as HTMLInputElement;
    expect(input.value).toMatch(/^#[0-9a-fA-F]{6}$/);
    const nameInput = document.querySelector('#form-offer input[type="text"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Nouvelle visite' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    const offers = readStoredOffers();
    expect(offers.length).toBe(1);
    expect(offers[0].color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe('offers — colored pills display', () => {
  const offerRed = storedOffer('#e74c3c');
  const offerBlue = { ...storedOffer('#2980b9'), id: 'off_2', name: 'Atelier volcan' };

  function seedViewsData() {
    seedStorage([offerRed, offerBlue]);
    localStorage.setItem(
      'mediaplan_data_v1',
      JSON.stringify({
        mediators: [{
          id: 'med_1', lastName: 'Dupont', firstName: 'Marie', email: '', phone: '',
          competences: [{ offerId: 'off_1', status: 'confirmed' }, { offerId: 'off_2', status: 'confirmed' }], active: true, color: '#1abc9c', notes: '',
        }],
        offers: [offerRed, offerBlue],
        schedules: [],
        slots: [],
        absences: [],
      })
    );
  }

  it('OffersView shows colored pills for each offer', async () => {
    seedViewsData();
    const { default: OffersView } = await import('../src/presentation/OffersView');
    render(
      <DataProvider>
        <OffersView />
      </DataProvider>
    );
    const pills = [...document.querySelectorAll('.offer-pill')] as HTMLElement[];
    expect(pills.length).toBe(2);
    expect(pills[0].style.background).toBe('rgb(231, 76, 60)'); // #e74c3c
    expect(pills[1].style.background).toBe('rgb(41, 128, 185)'); // #2980b9
    // Pill is inside the name cell of its own row
    expect(pills[0].closest('tr')?.textContent).toContain('Visite guidée Dinosauria');
    expect(pills[1].closest('tr')?.textContent).toContain('Atelier volcan');
  });

  it('MediatorsView shows offer pills in the skills column', async () => {
    seedViewsData();
    const { default: MediatorsView } = await import('../src/presentation/MediatorsView');
    render(
      <DataProvider>
        <MediatorsView />
      </DataProvider>
    );
    const pills = [...document.querySelectorAll('.offer-pill')] as HTMLElement[];
    expect(pills.length).toBe(2);
    expect(pills[0].style.background).toBe('rgb(231, 76, 60)');
    expect(pills[1].style.background).toBe('rgb(41, 128, 185)');
    expect(pills[0].textContent).toContain('Visite guidée Dinosauria');
    expect(pills[1].textContent).toContain('Atelier volcan');
  });

  it('SlotModal shows the selected offer as a colored pill', async () => {
    seedViewsData();
    const { default: SlotModal } = await import('../src/presentation/SlotModal');
    const slot = {
      id: 'slot_1', scheduleId: '', offerId: 'off_1', mediatorIds: ['med_1'],
      date: '2026-09-15', startTime: '09:00', endTime: '10:00', participantCount: 10,
      status: 'planned' as const, notes: '', origin: 'manual' as const,
      importSource: '', importedAt: '', modifiedAfterImport: false,
    };
    render(
      <DataProvider>
        <SlotModal slot={slot} mediatorOnly={false} defaultDate="2026-09-15" onClose={() => {}} />
      </DataProvider>
    );
    const pill = document.querySelector('.offer-pill') as HTMLElement;
    expect(pill).toBeTruthy();
    expect(pill.style.background).toBe('rgb(231, 76, 60)');
    expect(pill.textContent).toContain('Visite guidée Dinosauria');
  });

  it('MediatorModal shows the selected offer as a colored pill (skills)', async () => {
    seedViewsData();
    const { default: MediatorModal } = await import('../src/presentation/MediatorModal');
    const mediator = {
      id: 'med_1', lastName: 'Dupont', firstName: 'Marie', email: '', phone: '',
      competences: [{ offerId: 'off_1', status: 'confirmed' as const }], active: true, color: '#1abc9c', notes: '',
    };
    render(
      <DataProvider>
        <MediatorModal mediator={mediator} onClose={() => {}} />
      </DataProvider>
    );
    // Selected offer renders as a react-select multiValue pill colored with offer.color
    const label = screen.getByText('Visite guidée Dinosauria');
    const pill = label.parentElement as HTMLElement;
    expect(pill).toBeTruthy();
    expect(getComputedStyle(pill).backgroundColor).toBe('rgb(231, 76, 60)');
  });

  it('SlotDetailModal shows the offer as a colored pill', async () => {
    seedViewsData();
    const { default: SlotDetailModal } = await import('../src/presentation/SlotDetailModal');
    const slot = {
      id: 'slot_1', scheduleId: '', offerId: 'off_1', mediatorIds: ['med_1'],
      date: '2026-09-15', startTime: '09:00', endTime: '10:00', participantCount: 10,
      status: 'planned' as const, notes: '', origin: 'manual' as const,
      importSource: '', importedAt: '', modifiedAfterImport: false,
    };
    render(
      <DataProvider>
        <SlotDetailModal slot={slot} onClose={() => {}} />
      </DataProvider>
    );
    const pill = document.querySelector('.offer-pill') as HTMLElement;
    expect(pill).toBeTruthy();
    expect(pill.style.background).toBe('rgb(231, 76, 60)');
    expect(pill.textContent).toContain('Visite guidée Dinosauria');
  });
});
