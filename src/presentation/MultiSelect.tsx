// MultiSelect.tsx — Searchable multi-select with colored pills, built on react-select
//
// Wraps react-select's multi mode:
// - type-ahead search built in
// - selected values shown as pills/chips (multiValue), colored with the
//   option color (e.g. mediator color) and a readable text color
// - pills are removable (× button / Backspace)
// - styled to match the app's form controls (border, radius, fonts)

import { useMemo } from 'react';
import ReactSelect, { type MultiValue, type StylesConfig } from 'react-select';

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Pill/indicator color (e.g. mediator color). Optional. */
  color?: string;
  /** When true, the option cannot be selected (e.g. conflicting mediator). */
  isDisabled?: boolean;
}

export interface MultiSelectProps {
  /** All selectable options. */
  options: MultiSelectOption[];
  /** Selected option values (ids). */
  value: string[];
  /** Called with the new array of selected values. */
  onChange: (values: string[]) => void;
  /** Accessible name for the search input (combobox). */
  ariaLabel: string;
  /** Text shown when nothing is selected. */
  placeholder?: string;
  /** Text shown when search matches nothing. */
  noOptionsMessage?: string;
  /** Disable the whole control. */
  isDisabled?: boolean;
  /** id for the underlying input (optional, for form wiring). */
  inputId?: string;
}

const SELECT_STYLES: StylesConfig<MultiSelectOption, true> = {
  control: (base) => ({
    ...base,
    minHeight: 42,
    borderColor: 'var(--color-border)',
    borderRadius: 'var(--radius)',
    fontFamily: 'inherit',
    fontSize: 14,
    backgroundColor: 'var(--color-surface)',
    boxShadow: 'none',
    cursor: 'text',
    '&:hover': { borderColor: 'var(--color-border)' },
    '&:focus-within': {
      borderColor: 'var(--color-primary)',
      boxShadow: '0 0 0 2px rgba(44,110,73,0.15)',
    },
  }),
  option: (base, { isDisabled, isFocused, isSelected }) => ({
    ...base,
    color: isDisabled
      ? 'var(--color-text-muted)'
      : isSelected
        ? 'var(--color-surface)'
        : 'var(--color-text)',
    backgroundColor: isDisabled
      ? 'transparent'
      : isSelected
        ? 'var(--color-primary)'
        : isFocused
          ? 'var(--color-primary-light)'
          : 'var(--color-surface)',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    ':active': {
      backgroundColor: isDisabled ? 'transparent' : 'var(--color-primary-light)',
    },
  }),
  multiValue: (base, { data }) => ({
    ...base,
    backgroundColor: data.color || 'var(--color-primary)',
    borderRadius: 'var(--radius)',
  }),
  multiValueLabel: (base, { data }) => ({
    ...base,
    color: readableTextColor(data.color),
    fontWeight: 600,
    fontSize: 13,
  }),
  multiValueRemove: (base, { data }) => ({
    ...base,
    color: readableTextColor(data.color),
    borderRadius: 'var(--radius)',
    ':hover': {
      backgroundColor: 'rgba(0,0,0,0.15)',
      color: readableTextColor(data.color),
    },
  }),
  menu: (base) => ({
    ...base,
    zIndex: 3,
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-md)',
  }),
  noOptionsMessage: (base) => ({
    ...base,
    color: 'var(--color-text-muted)',
    fontSize: 13,
  }),
  placeholder: (base) => ({
    ...base,
    color: 'var(--color-text-muted)',
  }),
  dropdownIndicator: (base) => ({ ...base, padding: '0 6px', cursor: 'pointer' }),
  indicatorSeparator: () => ({ display: 'none' }),
};

/**
 * Pick white or the app's dark text color for a pill, depending on the
 * background luminance. Falls back to white (the default pill background
 * is the green primary, which is dark).
 */
export function readableTextColor(bg?: string): string {
  if (!bg) return '#ffffff';
  const hex = bg.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#ffffff';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // WCAG relative luminance (sRGB channels are already 0–255 here)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#2b2b2b' : '#ffffff';
}

/**
 * MultiSelect — searchable multi-select with pills.
 *
 * Values are plain ids (strings); options carry the label/color shown in the
 * menu and pills. Selection order follows the options order, so callers get
 * a stable `value` array regardless of pick order.
 */
export default function MultiSelect({
  options,
  value,
  onChange,
  ariaLabel,
  placeholder = 'Rechercher…',
  noOptionsMessage = 'Aucun résultat',
  isDisabled = false,
  inputId,
}: MultiSelectProps) {
  const byValue = useMemo(
    () => new Map(options.map((o) => [o.value, o])),
    [options]
  );
  const selected = useMemo(
    () => value.map((v) => byValue.get(v)).filter((o): o is MultiSelectOption => !!o),
    [value, byValue]
  );

  function handleChange(newValue: MultiValue<MultiSelectOption>) {
    // Keep options order for a stable value array
    const set = new Set(newValue.map((o) => o.value));
    const ordered = options.filter((o) => set.has(o.value)).map((o) => o.value);
    onChange(ordered);
  }

  return (
    <ReactSelect
      isMulti
      hideSelectedOptions
      isDisabled={isDisabled}
      inputId={inputId}
      aria-label={ariaLabel}
      placeholder={placeholder}
      noOptionsMessage={() => noOptionsMessage}
      options={options}
      value={selected}
      onChange={handleChange}
      styles={SELECT_STYLES}
      isClearable={false}
      closeMenuOnSelect={false}
      classNamePrefix="mp-multiselect"
    />
  );
}
