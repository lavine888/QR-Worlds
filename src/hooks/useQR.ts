import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CONTENT, generateQRMatrix, MIN_QUIET_ZONE, type QRMatrix } from '../qr/generateQR';
import { validateQR, type QRVerification } from '../qr/validateQR';

const INITIAL_VERIFICATION: QRVerification = {
  status: 'unavailable',
  message: 'Checking QR',
};

export function useQR(value: string) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [quietZone, setQuietZone] = useState(MIN_QUIET_ZONE);
  const [verification, setVerification] = useState<QRVerification>(INITIAL_VERIFICATION);
  const recoveryKey = useRef('');
  const lastValidMatrix = useRef<QRMatrix | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), 300);
    return () => window.clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    setQuietZone(MIN_QUIET_ZONE);
    recoveryKey.current = '';
  }, [debouncedValue]);

  const qrState = useMemo(() => {
    try {
      return {
        matrix: generateQRMatrix(debouncedValue, quietZone),
        error: '',
      };
    } catch {
      return {
        matrix: lastValidMatrix.current || generateQRMatrix(DEFAULT_CONTENT, quietZone),
        error: 'This content is too long for an H-level QR. Try a shorter URL or text.',
      };
    }
  }, [debouncedValue, quietZone]);

  useEffect(() => {
    if (!qrState.error) lastValidMatrix.current = qrState.matrix;
  }, [qrState]);

  const { matrix, error } = qrState;
  useEffect(() => {
    let active = true;
    setVerification(INITIAL_VERIFICATION);
    if (error) {
      setVerification({
        status: 'low',
        message: 'Showing the last usable QR while this input is too long',
      });
      return () => {
        active = false;
      };
    }
    const handle = window.setTimeout(() => {
      const result = validateQR(matrix);
      if (!active) return;
      setVerification(result);
      if (
        result.status === 'low' &&
        matrix.quietZone < 8 &&
        recoveryKey.current !== matrix.content + ':' + matrix.quietZone
      ) {
        recoveryKey.current = matrix.content + ':' + matrix.quietZone;
        setQuietZone((current) => Math.min(8, current + 2));
      }
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [error, matrix]);

  const expectedContent = debouncedValue.trim() || DEFAULT_CONTENT;
  return {
    debouncedValue,
    expectedContent,
    matrix: qrState.matrix as QRMatrix,
    error,
    quietZone,
    verification,
  };
}
