import { useMemo, useState, type KeyboardEvent } from 'react';
import { QRInput } from './components/QRInput';
import { useQR } from './hooks/useQR';
import { DEFAULT_CONTENT } from './qr/generateQR';
import { WorldCanvas } from './scene/WorldCanvas';

const REFERENCE_BENCHMARK_CONTENT = 'https://enzo.fyi';

type RuntimeOptions = {
  initialContent: string;
  fixedProgress: number | null;
  forceWebGPU: boolean;
};

function readRuntimeOptions(): RuntimeOptions {
  const params = new URLSearchParams(window.location.search);
  const benchmark = params.get('benchmark') === '1';
  const progressParam = params.get('progress');
  const parsedProgress = progressParam === null ? Number.NaN : Number(progressParam);

  return {
    initialContent: benchmark
      ? REFERENCE_BENCHMARK_CONTENT
      : params.get('data') || DEFAULT_CONTENT,
    fixedProgress: Number.isFinite(parsedProgress)
      ? Math.min(1, Math.max(0, parsedProgress))
      : null,
    forceWebGPU: params.get('forceWebGPU') === '1',
  };
}

export default function App() {
  const runtime = useMemo(readRuntimeOptions, []);
  const [value, setValue] = useState(runtime.initialContent);
  const [scanMode, setScanMode] = useState(false);
  const { matrix, error } = useQR(value);

  const toggleMode = () => {
    if (runtime.fixedProgress !== null) return;
    setScanMode((current) => !current);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleMode();
    }
  };

  const effectiveScanMode = runtime.fixedProgress === null
    ? scanMode
    : runtime.fixedProgress >= 0.5;

  return (
    <main className="reference-app">
      <section
        className="reference-canvas"
        data-mode={effectiveScanMode ? 'scan' : 'world'}
        data-fixed-progress={runtime.fixedProgress ?? undefined}
        onClick={toggleMode}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={
          runtime.fixedProgress !== null
            ? `Reference benchmark at progress ${runtime.fixedProgress}`
            : effectiveScanMode
              ? 'Return to the cherry blossom world'
              : 'Flatten the world into its QR code'
        }
      >
        <WorldCanvas
          matrix={matrix}
          scanMode={scanMode}
          fixedProgress={runtime.fixedProgress}
          forceWebGPU={runtime.forceWebGPU}
        />
      </section>

      {error ? <div className="reference-error">{error}</div> : null}

      <div className="reference-input" onClick={(event) => event.stopPropagation()}>
        <QRInput value={value} onChange={setValue} />
      </div>
    </main>
  );
}
