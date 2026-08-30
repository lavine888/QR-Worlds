import { useCallback, useRef, useState } from 'react';

export function useSceneCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const onCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
    setCanvasReady(true);
  }, []);
  return { canvasRef, canvasReady, onCanvasReady };
}
