import { themes, type ThemeName } from '../scene/themes';

type ThemePickerProps = {
  value: ThemeName;
  onChange: (theme: ThemeName) => void;
};

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  return (
    <div className="theme-picker" aria-label="World theme">
      {(Object.keys(themes) as ThemeName[]).map((name) => {
        const theme = themes[name];
        return (
          <button
            key={name}
            type="button"
            className={`theme-chip ${value === name ? 'active' : ''}`}
            onClick={() => onChange(name)}
          >
            <span className="theme-dot" style={{ background: theme.accent }} />
            {theme.label}
          </button>
        );
      })}
    </div>
  );
}
