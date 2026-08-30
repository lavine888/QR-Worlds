import { useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ControlDock } from './components/ControlDock';
import { useQR } from './hooks/useQR';
import { useSceneCanvas } from './hooks/useScene';
import { copyText, downloadGardenPng, downloadQRPng } from './qr/downloadQR';
import { DEFAULT_CONTENT } from './qr/generateQR';
import { hashString, randomSeed } from './procedural/hash';
import {
  getWorldTheme,
  type PaletteName,
  type SeasonName,
} from './scene/themes';
import { WorldCanvas } from './scene/WorldCanvas';

const legacyThemeMap: Record<string, { season: SeasonName; palette: PaletteName }> = {
  sakura: { season: 'spring', palette: 'pink' },
  forest: { season: 'summer', palette: 'green' },
  autumn: { season: 'autumn', palette: 'gold' },
  snow: { season: 'winter', palette: 'blue' },
};

function isSeason(value: string | null): value is SeasonName {
  return value === 'spring' || value === 'summer' || value === 'autumn' || value === 'winter';
}

function isPalette(value: string | null): value is PaletteName {
  return (
    value === 'pink' ||
    value === 'green' ||
    value === 'gold' ||
    value === 'blue' ||
    value === 'white' ||
    value === 'lavender'
  );
}

function readInitialState() {
  const params = new URLSearchParams(window.location.search);
  const data = params.get('data') || DEFAULT_CONTENT;
  const legacy = legacyThemeMap[params.get('theme') || ''];
  const rawSeason = params.get('season');
  const rawPalette = params.get('palette');
  const season = isSeason(rawSeason) ? rawSeason : legacy?.season || 'spring';
  const palette = isPalette(rawPalette)
    ? rawPalette
    : legacy?.palette || 'pink';
  const parsedSeed = Number.parseInt(params.get('seed') || '', 10);
  const worldSeed = Number.isFinite(parsedSeed) ? parsedSeed >>> 0 : hashString(data + ':world');
  return { data, season, palette, worldSeed };
}

export default function App() {
  const initial = useMemo(readInitialState, []);
  const [value, setValue] = useState(initial.data);
  const [season, setSeason] = useState<SeasonName>(initial.season);
  const [palette, setPalette] = useState<PaletteName>(initial.palette);
  const [worldSeed, setWorldSeed] = useState(initial.worldSeed);
  const [scanMode, setScanMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState('');
  const { canvasRef, canvasReady, onCanvasReady } = useSceneCanvas();
  const { debouncedValue, matrix, error, quietZone, verification } = useQR(value);
  const theme = getWorldTheme(season, palette);

  const toggleMode = () => setScanMode((current) => !current);
  const handleCanvasKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleMode();
    }
  };

  const handleShare = async () => {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('data', debouncedValue.trim() || DEFAULT_CONTENT);
    url.searchParams.set('season', season);
    url.searchParams.set('palette', palette);
    url.searchParams.set('seed', String(worldSeed >>> 0));
    try {
      await copyText(url.toString());
      setCopied(true);
      setShareError('');
      window.setTimeout(() => setCopied(false), 1400);
    } catch (shareFailure) {
      setShareError(shareFailure instanceof Error ? shareFailure.message : 'Copy failed.');
    }
  };

  return (
    <main className="app-shell" style={{ '--accent': theme.accent } as CSSProperties}>
      <header className="topbar">
        <a className="brand" href="./" aria-label="QR Worlds home">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>QR Worlds</span>
          <span className="version-tag">V2</span>
        </a>
        <div className="topbar-copy">Turn any QR code into a tiny world.</div>
        <a
          className="github-link"
          href="https://github.com/lavine888/QR-Worlds"
          target="_blank"
          rel="noreferrer"
        >
          GitHub ↗
        </a>
      </header>

      <section className="hero">
        <div
          className="canvas-card"
          onClick={toggleMode}
          onKeyDown={handleCanvasKeyDown}
          role="button"
          tabIndex={0}
          aria-label={scanMode ? 'Switch to garden view' : 'Switch to scan view'}
        >
          <WorldCanvas
            matrix={matrix}
            theme={theme}
            seedText={matrix.content}
            worldSeed={worldSeed}
            scanMode={scanMode}
            onCanvasReady={onCanvasReady}
          />
          <div className="mode-hint">
            <span className={'status-dot ' + (scanMode ? 'scan' : '')} />
            {scanMode ? 'Scan mode · tap to grow' : 'Garden mode · tap to reveal QR'}
          </div>
          <div className="qr-meta">
            <span>{matrix.moduleCount}×{matrix.moduleCount}</span>
            <span>EC · {matrix.errorCorrectionLevel}</span>
            <span>Quiet zone · {quietZone}</span>
          </div>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <ControlDock
          value={value}
          season={season}
          palette={palette}
          scanMode={scanMode}
          verification={verification}
          copied={copied}
          shareError={shareError}
          canDownloadGarden={canvasReady}
          onValueChange={setValue}
          onSeasonChange={setSeason}
          onPaletteChange={setPalette}
          onToggleMode={toggleMode}
          onDownloadQR={() => downloadQRPng(matrix)}
          onDownloadGarden={() => {
            if (canvasRef.current) downloadGardenPng(canvasRef.current);
          }}
          onShare={handleShare}
          onRandomize={() => setWorldSeed(randomSeed())}
        />
      </section>

      <footer className="footer">
        <span>Generated locally in your browser.</span>
        <span>No links or text are uploaded.</span>
      </footer>
    </main>
  );
}
