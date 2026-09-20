'use client';

interface Props<T extends string> {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
}

export function SingleChoice<T extends string>({ label, options, labels, value, onChange }: Props<T>) {
  return (
    <fieldset>
      <legend className="pm-label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            aria-pressed={value === opt}
            onClick={() => onChange(opt)}
            className={value === opt ? 'pm-chip-on' : 'pm-chip-off'}
          >
            {labels[opt]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

interface MultiProps {
  label: string;
  hint?: string;
  options: readonly string[];
  value: string[];
  max: number;
  onChange: (v: string[]) => void;
}

export function MultiChoice({ label, hint, options, value, max, onChange }: MultiProps) {
  function toggle(opt: string) {
    if (value.includes(opt)) {
      onChange(value.filter((v) => v !== opt));
    } else if (value.length < max) {
      onChange([...value, opt]);
    }
  }

  return (
    <fieldset>
      <legend className="pm-label">
        {label}
        <span className="ml-2 font-normal normal-case tracking-normal text-zinc-500">
          {value.length}/{max}
          {hint ? ` · ${hint}` : ''}
        </span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const on = value.includes(opt);
          const full = !on && value.length >= max;
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={on}
              disabled={full}
              onClick={() => toggle(opt)}
              className={`${on ? 'pm-chip-on' : 'pm-chip-off'} ${full ? 'opacity-35' : ''}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
