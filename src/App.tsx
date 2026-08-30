import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
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

const HINT_STORAGE_KEY = 'qr-worlds:v4-interacted';
const LONG_PRESS_MS = 620;

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
  const palette = isPalette(rawPalette) ? rawPalette : legacy?.palette || 'pink';
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
  const [showTapHint, setShowTapHint] = useState(false);
  const [hintAcknowledged, setHintAcknowledged] = useState(false);
  const [surpriseTick, setSurpriseTick] = useState(0);
  const longPressTimer = useRef<number | null>(null);
  const suppressNextClick = useRef(false);
  const { canvasRef, canvasReady, onCanvasReady } = useSceneCanvas();
  const { debouncedValue, matrix, error, verification } = useQR(value);
  const theme = getWorldTheme(season, palette);

  useEffect(() => {
    if (hintAcknowledged) return;
    try {
      if (window.localStorage.getItem(HINT_STORAGE_KEY)) {
        setHintAcknowledged(true);
        return;
      }
    } catch {
      // The hint can still appear when storage is unavailable.
    }
    const timer = window.setTimeout(() => setShowTapHint(true), 1800);
    return () => window.clearTimeout(timer);
  }, [hintAcknowledged]);

  useEffect(
    () => () => {
      if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
    },
    [],
  );

  const markInteracted = () => {
    setShowTapHint(false);
    setHintAcknowledged(true);
    try {
      window.localStorage.setItem(HINT_STORAGE_KEY, '1');
    } catch {
      // Interaction remains fully functional without persistent storage.
    }
  };

  const toggleMode = () => {
    setScanMode((current) => !current);
    markInteracted();
  };

  const handleCanvasClick = () => {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      return;
    }
    toggleMode();
  };

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      suppressNextClick.current = true;
      setSurpriseTick((current) => current + 1);
      markInteracted();
      longPressTimer.current = null;
    }, LONG_PRESS_MS);
  };

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
        <a className="brand" href="./" aria-label="QR Worlds home">QR WORLDS</a>
        <a
          className="github-link"
          href="https://github.com/lavine888/QR-Worlds"
          target="_blank"
          rel="noreferrer"
        >
          GitHub ↗
        </a>
      </header>

      <section className="demo-shell">
        <div
          className="canvas-card"
          onClick={handleCanvasClick}
          onPointerDown={handlePointerDown}
          onPointerUp={clearLongPress}
          onPointerCancel={clearLongPress}
          onPointerLeave={clearLongPress}
          onKeyDown={handleCanvasKeyDown}
          role="button"
          tabIndex={0}
          aria-label={scanMode ? 'Return to world view' : 'Reveal the QR code'}
        >
          <WorldCanvas
            matrix={matrix}
            theme={theme}
            seedText={matrix.content}
            worldSeed={worldSeed}
            scanMode={scanMode}
            surpriseTick={surpriseTick}
            onCanvasReady={onCanvasReady}
          />
          {showTapHint ? <div className="tap-hint">Tap the world</div> : null}
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <ControlDock
          value={value}
          season={season}
          palette={palette}
          verification={verification}
          copied={copied}
          shareError={shareError}
          canDownloadGarden={canvasReady}
          onValueChange={setValue}
          onSeasonChange={setSeason}
          onPaletteChange={setPalette}
          onDownloadQR={() => downloadQRPng(matrix)}
          onDownloadGarden={() => {
            if (canvasRef.current) downloadGardenPng(canvasRef.current);
          }}
          onShare={handleShare}
          onRandomize={() => setWorldSeed(randomSeed())}
        />
      </section>
    </main>
  );
}
