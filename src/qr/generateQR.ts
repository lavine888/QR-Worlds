import QRCode from 'qrcode';

export const DEFAULT_CONTENT = 'https://qr-worlds.vercel.app/';
export const QR_ERROR_CORRECTION = 'M' as const;
export const MIN_QUIET_ZONE = 4;

export type QRMatrix = {
  cells: boolean[][];
  moduleCount: number;
  quietZone: number;
  size: number;
  content: string;
  errorCorrectionLevel: typeof QR_ERROR_CORRECTION;
};

export class QREncodingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QREncodingError';
  }
}

export function generateQRMatrix(value: string, quietZone = MIN_QUIET_ZONE): QRMatrix {
  const content = value.trim() || DEFAULT_CONTENT;
  const safeQuietZone = Math.max(MIN_QUIET_ZONE, Math.floor(quietZone));

  try {
    const qr = QRCode.create(content, { errorCorrectionLevel: QR_ERROR_CORRECTION });
    const moduleCount = qr.modules.size;
    const size = moduleCount + safeQuietZone * 2;

    const cells = Array.from({ length: size }, (_, row) =>
      Array.from({ length: size }, (_, col) => {
        const sourceRow = row - safeQuietZone;
        const sourceCol = col - safeQuietZone;
        if (
          sourceRow < 0 ||
          sourceCol < 0 ||
          sourceRow >= moduleCount ||
          sourceCol >= moduleCount
        ) {
          return false;
        }
        return qr.modules.get(sourceCol, sourceRow) === 1;
      }),
    );

    return {
      cells,
      moduleCount,
      quietZone: safeQuietZone,
      size,
      content,
      errorCorrectionLevel: QR_ERROR_CORRECTION,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown encoder error';
    throw new QREncodingError(`This content cannot be encoded as a QR matrix (${detail}).`);
  }
}
