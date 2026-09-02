import qrcode from 'qrcode-generator';

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

function encodeUtf8(value: string) {
  return Array.from(new TextEncoder().encode(value));
}

export function generateQRMatrix(value: string, quietZone = MIN_QUIET_ZONE): QRMatrix {
  const content = value.trim() || DEFAULT_CONTENT;
  const safeQuietZone = Math.max(MIN_QUIET_ZONE, Math.floor(quietZone));

  try {
    qrcode.stringToBytes = encodeUtf8;
    const qr = qrcode(0, QR_ERROR_CORRECTION);
    qr.addData(content, 'Byte');
    qr.make();

    const moduleCount = qr.getModuleCount();
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
        return qr.isDark(sourceRow, sourceCol);
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
    throw new QREncodingError(
      'This content cannot fit in a version supported by the M-level QR encoder (' + detail + ').',
    );
  }
}
