import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { QRInput } from './components/QRInput';
import { useQR } from './hooks/useQR';
import { DEFAULT_CONTENT } from './qr/generateQR';
import { WorldCanvas } from './scene/WorldCanvas';

const REFERENCE_BENCHMARK_CONTENT = 'https://enzo.fyi';

type FixedViewport = {
  width: number;
  height: number;
};

type RuntimeOptions = {
  initialContent: string;
  fixedProgress: number | null;
  fixedViewport: FixedViewport | null;
  forceWebGPU: boolean;
};

function parseViewport(value: string | null): FixedViewport | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{3,4})x(\d{3,4})$/i);
  if (!match) return null;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;

  return {
    width: Math.min(1600, Math.max(280, width)),
    height: Math.min(2400, Math.max(480, height)),
  };
}

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
    fixedViewport: parseViewport(params.get('viewport')),
    forceWebGPU: params.get('forceWebGPU') === '1',
  };
}

export default function App() {
  const runtime = useMemo(readRuntimeOptions, []);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(runtime.initialContent);
  const [scanMode, setScanMode] = useState(false);
  const { matrix, error } = useQR(value);

  const toggleMode = () => {
    inputRef.current?.focus();
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

  const referenceStyle = runtime.fixedViewport
    ? ({
        '--reference-width': `${runtime.fixedViewport.width}px`,
        '--reference-canvas-height': `${runtime.fixedViewport.height * 0.6}px`,
        '--reference-top-offset': `${runtime.fixedViewport.width * 0.1}px`,
      } as CSSProperties)
    : undefined;

  return (
    <main className="reference-app" style={referenceStyle}>
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
        <QRInput ref={inputRef} value={value} onChange={setValue} />
      </div>
    </main>
  );
}
