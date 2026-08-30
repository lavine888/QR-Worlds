import { BrowserQRCodeReader } from '@zxing/browser';
import type { QRMatrix } from './generateQR';
import { createQRCanvas } from './matrix';

export type QRVerification = {
  status: 'verified' | 'low' | 'unavailable';
  decoded?: string;
  message: string;
};

export function validateQR(matrix: QRMatrix): QRVerification {
  if (typeof document === 'undefined' || typeof HTMLCanvasElement === 'undefined') {
    return {
      status: 'unavailable',
      message: 'QR verification is only available in a browser',
    };
  }
  const reader = new BrowserQRCodeReader();
  let decodedMismatch = '';
  for (const modulePixels of [12, 16, 20]) {
    try {
      const result = reader.decodeFromCanvas(
        createQRCanvas(matrix, matrix.size * modulePixels),
      );
      const decoded = result.getText();
      if (decoded === matrix.content) {
        return { status: 'verified', decoded, message: 'QR verified' };
      }
      decodedMismatch = decoded;
    } catch {
      // Detector sensitivity varies by matrix version, so retry another exact pitch.
    }
  }
  return decodedMismatch
    ? { status: 'low', decoded: decodedMismatch, message: 'QR decoded with different text' }
    : { status: 'low', message: 'QR needs a little more contrast or quiet space' };
}
