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
  try {
    const reader = new BrowserQRCodeReader();
    const result = reader.decodeFromCanvas(createQRCanvas(matrix, 1024));
    const decoded = result.getText();
    if (decoded === matrix.content) {
      return { status: 'verified', decoded, message: 'QR verified' };
    }
    return { status: 'low', decoded, message: 'QR decoded with different text' };
  } catch {
    return {
      status: 'low',
      message: 'QR needs a little more contrast or quiet space',
    };
  }
}
