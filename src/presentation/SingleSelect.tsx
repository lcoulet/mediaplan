// SingleSelect.tsx — Searchable single-select with colored dots, built on react-select
//
// Same look-and-feel as MultiSelect (the mediator picker), in single mode:
// - type-ahead search built in
// - optional color dot per option (e.g. offer color)
// - styled to match the app's form controls

import ReactSelect, { type StylesConfig, type SingleValue } from 'react-select';

export interface SingleSelectOption {
  value: string;
  label: string;
  /** Optional color dot shown before the label. */
  color?: string;
  /** When true, the option cannot be selected. */
  isDisabled?: boolean;
}

export interface SingleSelectProps {
  /** All selectable options. */
  options: SingleSelectOption[];
  /** Selected option value ('' when nothing is selected). */
  value: string;
  /** Called with the newly selected value. */
  onChange: (value: string) => void;
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

const SELECT_STYLES: StylesConfig<SingleSelectOption, false> = {
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
  singleValue: (base) => ({
    ...base,
    color: 'var(--color-text)',
    fontSize: 14,
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

function renderOption(option: SingleSelectOption) {
  return (
    <span className="single-select-label">
      {option.color && (
        <span className="single-select-dot" style={{ backgroundColor: option.color }}></span>
      )}
      {option.label}
    </span>
  );
}

export default function SingleSelect({
  options,
  value,
  onChange,
  ariaLabel,
  placeholder = 'Rechercher…',
  noOptionsMessage = 'Aucun résultat',
  isDisabled = false,
  inputId,
}: SingleSelectProps) {
  const selected = options.find((o) => o.value === value) || null;

  function handleChange(newValue: SingleValue<SingleSelectOption>) {
    onChange(newValue ? newValue.value : '');
  }

  return (
    <ReactSelect
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
      isSearchable
      classNamePrefix="mp-singleselect"
      formatOptionLabel={(option) => renderOption(option)}
    />
  );
}
