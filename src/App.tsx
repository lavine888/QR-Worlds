import { useMemo, useState, type KeyboardEvent } from 'react';
import { QRInput } from './components/QRInput';
import { useQR } from './hooks/useQR';
import { hashString } from './procedural/hash';
import { DEFAULT_CONTENT } from './qr/generateQR';
import { getWorldTheme } from './scene/themes';
import { WorldCanvas } from './scene/WorldCanvas';

function readInitialContent() {
  const params = new URLSearchParams(window.location.search);
  return params.get('data') || DEFAULT_CONTENT;
}

export default function App() {
  const initialContent = useMemo(readInitialContent, []);
  const [value, setValue] = useState(initialContent);
  const [scanMode, setScanMode] = useState(false);
  const { matrix, error } = useQR(value);
  const theme = getWorldTheme('spring', 'pink');
  const worldSeed = useMemo(() => hashString(`${matrix.content}:v6-reference`), [matrix.content]);

  const toggleMode = () => setScanMode((current) => !current);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleMode();
    }
  };

  return (
    <main className="reference-app">
      <section
        className="reference-canvas"
        data-mode={scanMode ? 'scan' : 'world'}
        onClick={toggleMode}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={scanMode ? 'Return to the cherry blossom world' : 'Flatten the world into its QR code'}
      >
        <WorldCanvas
          matrix={matrix}
          theme={theme}
          seedText={matrix.content}
          worldSeed={worldSeed}
          scanMode={scanMode}
        />
      </section>

      {error ? <div className="reference-error">{error}</div> : null}

      <div className="reference-input" onClick={(event) => event.stopPropagation()}>
        <QRInput value={value} onChange={setValue} />
      </div>
    </main>
  );
}
