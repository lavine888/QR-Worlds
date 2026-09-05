import { useMemo, useState, type KeyboardEvent } from 'react';
import { QRInput } from './components/QRInput';
import { useQR } from './hooks/useQR';
import { DEFAULT_CONTENT } from './qr/generateQR';
import { WorldCanvas } from './scene/WorldCanvas';

const REFERENCE_BENCHMARK_CONTENT = 'https://enzo.fyi';

function readInitialContent() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('benchmark') === '1') return REFERENCE_BENCHMARK_CONTENT;
  return params.get('data') || DEFAULT_CONTENT;
}

export default function App() {
  const initialContent = useMemo(readInitialContent, []);
  const [value, setValue] = useState(initialContent);
  const [scanMode, setScanMode] = useState(false);
  const { matrix, error } = useQR(value);

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
        <WorldCanvas matrix={matrix} scanMode={scanMode} />
      </section>

      {error ? <div className="reference-error">{error}</div> : null}

      <div className="reference-input" onClick={(event) => event.stopPropagation()}>
        <QRInput value={value} onChange={setValue} />
      </div>
    </main>
  );
}
