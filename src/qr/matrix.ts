import type { QRMatrix } from './generateQR';

export const QR_EXPORT_SIZE = 1024;

export function drawQRMatrix(
  matrix: QRMatrix,
  canvas: HTMLCanvasElement,
  pixelSize = QR_EXPORT_SIZE,
) {
  canvas.width = pixelSize;
  canvas.height = pixelSize;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas 2D context is unavailable.');

  context.imageSmoothingEnabled = false;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, pixelSize, pixelSize);

  const moduleSize = pixelSize / matrix.size;
  context.fillStyle = '#111111';
  matrix.cells.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (!dark) return;
      const left = Math.floor(x * moduleSize);
      const top = Math.floor(y * moduleSize);
      const right = Math.ceil((x + 1) * moduleSize);
      const bottom = Math.ceil((y + 1) * moduleSize);
      context.fillRect(left, top, right - left, bottom - top);
    });
  });
  return canvas;
}

export function createQRCanvas(matrix: QRMatrix, pixelSize = QR_EXPORT_SIZE) {
  return drawQRMatrix(matrix, document.createElement('canvas'), pixelSize);
}
