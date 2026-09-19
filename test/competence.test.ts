// Test file for competence management in mediators
import { describe, it, expect } from 'vitest';
import type { Mediator } from '../src/domain/types';

// Test data
const mockMediatorConfirmed: Mediator = {
  id: 'm1',
  firstName: 'Jean',
  lastName: 'Dupont',
  email: '',
  phone: '',
  competences: [{ offerId: 'o1', status: 'confirmed' as const }],
  active: true,
  color: '#FF0000',
  notes: '',
};

const mockMediatorLearning: Mediator = {
  id: 'm2',
  firstName: 'Marie',
  lastName: 'Martin',
  email: '',
  phone: '',
  competences: [{ offerId: 'o1', status: 'learning' as const }],
  active: true,
  color: '#00FF00',
  notes: '',
};

const mockMediatorNone: Mediator = {
  id: 'm3',
  firstName: 'Pierre',
  lastName: 'Bernard',
  email: '',
  phone: '',
  competences: [],
  active: true,
  color: '#0000FF',
  notes: '',
};

const mockMediatorMixed: Mediator = {
  id: 'm4',
  firstName: 'Paul',
  lastName: 'Durand',
  email: '',
  phone: '',
  competences: [
    { offerId: 'o1', status: 'confirmed' as const },
    { offerId: 'o2', status: 'learning' as const },
  ],
  active: true,
  color: '#FFFF00',
  notes: '',
};

describe('normalizeCompetences', () => {
  it('should be exported from models', async () => {
    const { normalizeCompetences } = await import('../src/domain/models');
    expect(normalizeCompetences).toBeDefined();
    expect(typeof normalizeCompetences).toBe('function');
  });

  it('should keep only confirmed when both confirmed and learning exist for same offer', async () => {
    const { normalizeCompetences } = await import('../src/domain/models');
    const input = [
      { offerId: 'o1', status: 'confirmed' as const },
      { offerId: 'o1', status: 'learning' as const },
      { offerId: 'o2', status: 'learning' as const },
    ];
    const result = normalizeCompetences(input);
    expect(result.length).toBe(2);
    expect(result.some(c => c.offerId === 'o1' && c.status === 'confirmed')).toBe(true);
    expect(result.some(c => c.offerId === 'o1' && c.status === 'learning')).toBe(false);
    expect(result.some(c => c.offerId === 'o2' && c.status === 'learning')).toBe(true);
  });

  it('should upgrade learning to confirmed when confirmed is added', async () => {
    const { normalizeCompetences } = await import('../src/domain/models');
    const input = [
      { offerId: 'o1', status: 'learning' as const },
      { offerId: 'o1', status: 'confirmed' as const },
    ];
    const result = normalizeCompetences(input);
    expect(result.length).toBe(1);
    expect(result[0].status).toBe('confirmed');
  });

  it('should keep learning when no conflict', async () => {
    const { normalizeCompetences } = await import('../src/domain/models');
    const input = [
      { offerId: 'o1', status: 'learning' as const },
      { offerId: 'o2', status: 'learning' as const },
    ];
    const result = normalizeCompetences(input);
    expect(result.length).toBe(2);
    expect(result.every(c => c.status === 'learning')).toBe(true);
  });

  it('should remove learning when confirmed is added later', async () => {
    const { normalizeCompetences } = await import('../src/domain/models');
    const input = [
      { offerId: 'o1', status: 'learning' as const },
      { offerId: 'o2', status: 'confirmed' as const },
      { offerId: 'o1', status: 'confirmed' as const },
    ];
    const result = normalizeCompetences(input);
    expect(result.length).toBe(2);
    expect(result.find(c => c.offerId === 'o1')?.status).toBe('confirmed');
    expect(result.find(c => c.offerId === 'o2')?.status).toBe('confirmed');
  });
});

describe('Competence helper functions', () => {
  it('should correctly identify confirmed competence', async () => {
    const { mediatorConfirmedForOffer } = await import('../src/domain/models');
    expect(mediatorConfirmedForOffer(mockMediatorConfirmed, 'o1')).toBe(true);
    expect(mediatorConfirmedForOffer(mockMediatorConfirmed, 'o2')).toBe(false);
    expect(mediatorConfirmedForOffer(mockMediatorLearning, 'o1')).toBe(false);
    expect(mediatorConfirmedForOffer(mockMediatorNone, 'o1')).toBe(false);
  });

  it('should correctly identify learning competence', async () => {
    const { mediatorLearningOffer } = await import('../src/domain/models');
    expect(mediatorLearningOffer(mockMediatorLearning, 'o1')).toBe(true);
    expect(mediatorLearningOffer(mockMediatorLearning, 'o2')).toBe(false);
    expect(mediatorLearningOffer(mockMediatorConfirmed, 'o1')).toBe(false);
    expect(mediatorLearningOffer(mockMediatorNone, 'o1')).toBe(false);
  });

  it('should correctly identify when mediator knows offer (confirmed or learning)', async () => {
    const { mediatorKnowsOffer } = await import('../src/domain/models');
    expect(mediatorKnowsOffer(mockMediatorConfirmed, 'o1')).toBe(true);
    expect(mediatorKnowsOffer(mockMediatorLearning, 'o1')).toBe(true);
    expect(mediatorKnowsOffer(mockMediatorMixed, 'o1')).toBe(true);
    expect(mediatorKnowsOffer(mockMediatorMixed, 'o2')).toBe(true);
    expect(mediatorKnowsOffer(mockMediatorNone, 'o1')).toBe(false);
  });

  it('should correctly identify when mediator does not know offer', async () => {
    const { mediatorKnowsOffer } = await import('../src/domain/models');
    expect(mediatorKnowsOffer(mockMediatorConfirmed, 'unknown')).toBe(false);
    expect(mediatorKnowsOffer(mockMediatorLearning, 'unknown')).toBe(false);
    expect(mediatorKnowsOffer(mockMediatorNone, 'o1')).toBe(false);
  });
});

describe('Mediator model with competences', () => {
  it('should create mediator with empty competences by default', async () => {
    const { createMediator } = await import('../src/domain/models');
    const m = createMediator();
    expect(m.competences).toEqual([]);
  });

  it('should create mediator with provided competences', async () => {
    const { createMediator } = await import('../src/domain/models');
    const m = createMediator({
      competences: [
        { offerId: 'o1', status: 'confirmed' as const },
        { offerId: 'o2', status: 'learning' as const },
      ],
    });
    expect(m.competences.length).toBe(2);
    expect(m.competences[0].offerId).toBe('o1');
    expect(m.competences[0].status).toBe('confirmed');
    expect(m.competences[1].offerId).toBe('o2');
    expect(m.competences[1].status).toBe('learning');
  });
});
