import qrcode from 'qrcode-generator';

export type QRMatrix = {
  cells: boolean[][];
  moduleCount: number;
  quietZone: number;
  size: number;
};

export function generateQRMatrix(value: string, quietZone = 4): QRMatrix {
  const content = value.trim() || 'https://github.com/lavine888/QR-Worlds';
  const qr = qrcode(0, 'H');
  qr.addData(content, 'Byte');
  qr.make();

  const moduleCount = qr.getModuleCount();
  const size = moduleCount + quietZone * 2;
  const cells = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => {
      const sourceRow = row - quietZone;
      const sourceCol = col - quietZone;
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

  return { cells, moduleCount, quietZone, size };
}
