import type { QRVerification } from '../qr/validateQR';
import type { PaletteName, SeasonName } from '../scene/themes';
import { Controls } from './Controls';
import { PalettePicker } from './PalettePicker';
import { QRInput } from './QRInput';
import { SeasonPicker } from './SeasonPicker';

type ControlDockProps = {
  value: string;
  season: SeasonName;
  palette: PaletteName;
  verification: QRVerification;
  copied: boolean;
  shareError: string;
  canDownloadGarden: boolean;
  onValueChange: (value: string) => void;
  onSeasonChange: (season: SeasonName) => void;
  onPaletteChange: (palette: PaletteName) => void;
  onDownloadQR: () => void;
  onDownloadGarden: () => void;
  onShare: () => void;
  onRandomize: () => void;
};

export function ControlDock({
  value,
  season,
  palette,
  verification,
  copied,
  shareError,
  canDownloadGarden,
  onValueChange,
  onSeasonChange,
  onPaletteChange,
  onDownloadQR,
  onDownloadGarden,
  onShare,
  onRandomize,
}: ControlDockProps) {
  const verificationLabel =
    verification.status === 'verified'
      ? 'Ready to scan'
      : verification.status === 'unavailable'
        ? 'Checking scan'
        : 'Improving contrast';

  return (
    <section className="control-dock" onClick={(event) => event.stopPropagation()}>
      <div className="input-row input-row-single">
        <QRInput value={value} onChange={onValueChange} />
      </div>

      <div className="utility-row">
        <div className="world-pickers">
          <SeasonPicker value={season} onChange={onSeasonChange} />
          <PalettePicker value={palette} onChange={onPaletteChange} />
        </div>
        <div className="dock-utilities">
          <div
            className={'verification-pill ' + verification.status}
            title={verification.message}
            aria-live="polite"
          >
            <span className="verification-dot" />
            <span>{verificationLabel}</span>
          </div>
          <Controls
            copied={copied}
            canDownloadGarden={canDownloadGarden}
            onShare={onShare}
            onDownloadQR={onDownloadQR}
            onDownloadGarden={onDownloadGarden}
            onRandomize={onRandomize}
          />
        </div>
      </div>
      {shareError ? <p className="share-error">{shareError}</p> : null}
    </section>
  );
}
