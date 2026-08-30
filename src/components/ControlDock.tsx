import type { ThemeName } from '../scene/themes';
import { ThemePicker } from './ThemePicker';

type ControlDockProps = {
  value: string;
  theme: ThemeName;
  scanMode: boolean;
  onValueChange: (value: string) => void;
  onThemeChange: (theme: ThemeName) => void;
  onToggleMode: () => void;
  onDownload: () => void;
  onShare: () => void;
  copied: boolean;
};

export function ControlDock({
  value,
  theme,
  scanMode,
  onValueChange,
  onThemeChange,
  onToggleMode,
  onDownload,
  onShare,
  copied,
}: ControlDockProps) {
  return (
    <section className="control-dock" onClick={(event) => event.stopPropagation()}>
      <div className="input-row">
        <div className="url-field">
          <span className="url-icon">↗</span>
          <input
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            aria-label="QR content"
            placeholder="Paste a URL or type anything"
            spellCheck={false}
          />
        </div>
        <button className="mode-button" type="button" onClick={onToggleMode}>
          <span>{scanMode ? '✦' : '⌗'}</span>
          {scanMode ? 'World view' : 'Scan view'}
        </button>
      </div>

      <div className="dock-bottom">
        <ThemePicker value={theme} onChange={onThemeChange} />
        <div className="dock-actions">
          <button type="button" className="ghost-button" onClick={onShare}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <button type="button" className="primary-button" onClick={onDownload}>
            Download QR
          </button>
        </div>
      </div>
    </section>
  );
}
