import { palettes, type PaletteName } from '../scene/themes';

type PalettePickerProps = {
  value: PaletteName;
  onChange: (palette: PaletteName) => void;
};

export function PalettePicker({ value, onChange }: PalettePickerProps) {
  return (
    <div className="picker-block palette-block">
      <span className="picker-label">Palette</span>
      <div className="palette-row" aria-label="Palette">
        {palettes.map((palette) => (
          <button
            key={palette.name}
            type="button"
            className={'palette-chip ' + (value === palette.name ? 'active' : '')}
            onClick={() => onChange(palette.name)}
            aria-label={palette.label}
            aria-pressed={value === palette.name}
            title={palette.label}
          >
            <span className="palette-dot" style={{ backgroundColor: palette.color }} />
          </button>
        ))}
      </div>
    </div>
  );
}
