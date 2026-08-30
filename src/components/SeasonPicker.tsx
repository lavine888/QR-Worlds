import { seasons, type SeasonName } from '../scene/themes';

type SeasonPickerProps = {
  value: SeasonName;
  onChange: (season: SeasonName) => void;
};

export function SeasonPicker({ value, onChange }: SeasonPickerProps) {
  return (
    <div className="picker-block">
      <span className="picker-label">Season</span>
      <div className="chip-row" aria-label="Season">
        {seasons.map((season) => (
          <button
            key={season.name}
            type="button"
            className={'theme-chip ' + (value === season.name ? 'active' : '')}
            onClick={() => onChange(season.name)}
            aria-pressed={value === season.name}
          >
            <span className="theme-glyph" aria-hidden="true">{season.glyph}</span>
            {season.label}
          </button>
        ))}
      </div>
    </div>
  );
}
