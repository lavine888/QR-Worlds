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
  scanMode: boolean;
  verification: QRVerification;
  copied: boolean;
  shareError: string;
  canDownloadGarden: boolean;
  onValueChange: (value: string) => void;
  onSeasonChange: (season: SeasonName) => void;
  onPaletteChange: (palette: PaletteName) => void;
  onToggleMode: () => void;
  onDownloadQR: () => void;
  onDownloadGarden: () => void;
  onShare: () => void;
  onRandomize: () => void;
};

export function ControlDock({
  value,
  season,
  palette,
  scanMode,
  verification,
  copied,
  shareError,
  canDownloadGarden,
  onValueChange,
  onSeasonChange,
  onPaletteChange,
  onToggleMode,
  onDownloadQR,
  onDownloadGarden,
  onShare,
  onRandomize,
}: ControlDockProps) {
  const verificationLabel =
    verification.status === 'verified'
      ? 'QR verified'
      : verification.status === 'unavailable'
        ? 'Checking QR'
        : 'QR low · recovering';

  return (
    <section className="control-dock" onClick={(event) => event.stopPropagation()}>
      <div className="input-row">
        <QRInput value={value} onChange={onValueChange} />
        <button className="mode-button" type="button" onClick={onToggleMode}>
          <span aria-hidden="true">{scanMode ? '✦' : '⌗'}</span>
          {scanMode ? 'Garden view' : 'Scan view'}
        </button>
      </div>

      <div className="selection-row">
        <SeasonPicker value={season} onChange={onSeasonChange} />
        <PalettePicker value={palette} onChange={onPaletteChange} />
      </div>

      <div className="dock-bottom">
        <div className={'verification-pill ' + verification.status}>
          <span className="verification-dot" />
          <span>{verificationLabel}</span>
          <span className="verification-copy">{verification.message}</span>
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
      {shareError ? <p className="share-error">{shareError}</p> : null}
    </section>
  );
}
