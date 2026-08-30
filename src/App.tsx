import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ControlDock } from './components/ControlDock';
import { downloadQRSvg } from './qr/downloadQR';
import { generateQRMatrix } from './qr/generateQR';
import { themes, type ThemeName } from './scene/themes';
import { WorldCanvas } from './scene/WorldCanvas';

const DEFAULT_VALUE = 'https://github.com/lavine888/QR-Worlds';

function readInitialState() {
  const params = new URLSearchParams(window.location.search);
  const data = params.get('data') || DEFAULT_VALUE;
  const rawTheme = params.get('theme') as ThemeName | null;
  const theme = rawTheme && rawTheme in themes ? rawTheme : 'sakura';
  return { data, theme };
}

export default function App() {
  const initial = useMemo(readInitialState, []);
  const [value, setValue] = useState(initial.data);
  const [debouncedValue, setDebouncedValue] = useState(initial.data);
  const [themeName, setThemeName] = useState<ThemeName>(initial.theme);
  const [scanMode, setScanMode] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), 240);
    return () => window.clearTimeout(timer);
  }, [value]);

  const qrState = useMemo(() => {
    try {
      return { matrix: generateQRMatrix(debouncedValue), error: '' };
    } catch {
      return {
        matrix: generateQRMatrix(DEFAULT_VALUE),
        error: 'That content is too long for this V1 QR generator. Try a shorter URL or text.',
      };
    }
  }, [debouncedValue]);

  const { matrix, error } = qrState;
  const theme = themes[themeName];

  const handleShare = async () => {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('data', debouncedValue.trim() || DEFAULT_VALUE);
    url.searchParams.set('theme', themeName);
    await navigator.clipboard.writeText(url.toString());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
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
          <span className="version-tag">V1</span>
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
        <div className="canvas-card" onClick={() => setScanMode((current) => !current)}>
          <WorldCanvas
            matrix={matrix}
            theme={theme}
            seedText={debouncedValue.trim() || DEFAULT_VALUE}
            scanMode={scanMode}
          />
          <div className="mode-hint">
            <span className={`status-dot ${scanMode ? 'scan' : ''}`} />
            {scanMode ? 'Scan mode · tap to grow' : 'World mode · tap to reveal QR'}
          </div>
          <div className="qr-meta">
            <span>{matrix.moduleCount}×{matrix.moduleCount}</span>
            <span>EC · H</span>
            <span>Quiet zone · 4</span>
          </div>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <ControlDock
          value={value}
          theme={themeName}
          scanMode={scanMode}
          onValueChange={setValue}
          onThemeChange={setThemeName}
          onToggleMode={() => setScanMode((current) => !current)}
          onDownload={() => downloadQRSvg(matrix)}
          onShare={handleShare}
          copied={copied}
        />
      </section>

      <footer className="footer">
        <span>Generated locally in your browser.</span>
        <span>No links or text are uploaded.</span>
      </footer>
    </main>
  );
}
