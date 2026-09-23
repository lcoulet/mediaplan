// test/multi-select.test.ts — Tests for the MultiSelect component (searchable multi-select with pills)

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MultiSelect, { readableTextColor } from '../src/presentation/MultiSelect';
import type { MultiSelectOption, MultiSelectProps } from '../src/presentation/MultiSelect';

const OPTIONS: MultiSelectOption[] = [
  { value: 'med_1', label: 'Alice Tempête', color: '#e74c3c' }, // dark red → white text
  { value: 'med_2', label: 'Maxime Fortin', color: '#f39c12' }, // orange → dark text
  { value: 'med_3', label: 'Léonie Vermillon', color: '#3498db' },
];

function renderSelect(props: Partial<MultiSelectProps> = {}) {
  const onChange = vi.fn();
  const utils = render(
    React.createElement(MultiSelect, {
      options: OPTIONS,
      value: [],
      onChange,
      ariaLabel: 'Médiateurs',
      ...props,
    })
  );
  return { onChange, ...utils };
}

/** Open the dropdown menu and return the search input. */
function openMenu(): HTMLInputElement {
  const input = screen.getByRole('combobox') as HTMLInputElement;
  fireEvent.mouseDown(input);
  return input;
}

/** Pill elements for a selected label (menu must be closed). */
function getPill(label: string): { pill: HTMLElement; labelEl: HTMLElement } {
  const labelEl = screen.getByText(label);
  const pill = labelEl.parentElement as HTMLElement;
  return { pill, labelEl };
}

describe('MultiSelect', () => {
  it('renders an accessible combobox input', () => {
    renderSelect();
    const input = screen.getByRole('combobox');
    expect(input.getAttribute('aria-label')).toBe('Médiateurs');
  });

  it('shows a placeholder when nothing is selected', () => {
    renderSelect({ placeholder: 'Rechercher un médiateur…' });
    expect(screen.getByText('Rechercher un médiateur…')).toBeTruthy();
  });

  it('lists all options when opened', () => {
    renderSelect();
    openMenu();
    const labels = screen.getAllByRole('option').map((o) => o.textContent);
    expect(labels).toEqual(['Alice Tempête', 'Maxime Fortin', 'Léonie Vermillon']);
  });

  it('filters options by search text', () => {
    renderSelect();
    const input = openMenu();
    fireEvent.change(input, { target: { value: 'max' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Maxime Fortin']);
  });

  it('shows a message when no option matches', () => {
    renderSelect({ noOptionsMessage: 'Aucun résultat' });
    const input = openMenu();
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.getByText('Aucun résultat')).toBeTruthy();
  });

  it('hides already selected options from the menu', () => {
    renderSelect({ value: ['med_1'] });
    openMenu();
    expect(screen.queryByRole('option', { name: 'Alice Tempête' })).toBeNull();
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('calls onChange with the selected ids when an option is clicked', () => {
    const { onChange } = renderSelect({ value: ['med_1'] });
    openMenu();
    fireEvent.click(screen.getByText('Maxime Fortin'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['med_1', 'med_2']);
  });

  it('selects the focused option with the Enter key', () => {
    const { onChange } = renderSelect();
    const input = openMenu();
    fireEvent.change(input, { target: { value: 'léo' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['med_3']);
  });

  it('renders pills with remove buttons for selected values', () => {
    renderSelect({ value: ['med_1', 'med_3'] });
    expect(screen.getByLabelText('Remove Alice Tempête')).toBeTruthy();
    expect(screen.getByLabelText('Remove Léonie Vermillon')).toBeTruthy();
  });

  it('uses the option color as pill background with readable text', () => {
    renderSelect({ value: ['med_1', 'med_2'] });
    const dark = getPill('Alice Tempête');
    expect(getComputedStyle(dark.pill).backgroundColor).toBe('rgb(231, 76, 60)');
    expect(getComputedStyle(dark.labelEl).color).toBe('rgb(255, 255, 255)');

    const light = getPill('Maxime Fortin');
    expect(getComputedStyle(light.pill).backgroundColor).toBe('rgb(243, 156, 18)');
    expect(getComputedStyle(light.labelEl).color).toBe('rgb(43, 43, 43)');
  });

  it('calls onChange without the id when a pill remove button is clicked', () => {
    const { onChange } = renderSelect({ value: ['med_1', 'med_2'] });
    fireEvent.click(screen.getByLabelText('Remove Alice Tempête'));
    expect(onChange).toHaveBeenCalledWith(['med_2']);
  });

  it('removes the last pill with Backspace', () => {
    const { onChange } = renderSelect({ value: ['med_1', 'med_2'] });
    const input = openMenu();
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(onChange).toHaveBeenCalledWith(['med_1']);
  });

  it('does not select a disabled option', () => {
    const options: MultiSelectOption[] = [
      ...OPTIONS,
      { value: 'med_9', label: 'Occupé', color: '#000000', isDisabled: true },
    ];
    const { onChange } = renderSelect({ options });
    openMenu();
    const disabled = screen.getByText('Occupé').closest('[role="option"]');
    expect(disabled?.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByText('Occupé'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('readableTextColor', () => {
  it('returns white for dark backgrounds and dark for light backgrounds', () => {
    expect(readableTextColor('#e74c3c')).toBe('#ffffff');
    expect(readableTextColor('#2c6e49')).toBe('#ffffff');
    expect(readableTextColor('#f39c12')).toBe('#2b2b2b');
    expect(readableTextColor('#d9d9d9')).toBe('#2b2b2b');
  });

  it('falls back to white for missing or invalid colors', () => {
    expect(readableTextColor(undefined)).toBe('#ffffff');
    expect(readableTextColor('not-a-color')).toBe('#ffffff');
  });
});
