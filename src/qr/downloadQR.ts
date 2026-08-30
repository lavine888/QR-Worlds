import type { QRMatrix } from './generateQR';

export function downloadQRSvg(matrix: QRMatrix, filename = 'qr-world.svg') {
  const rects: string[] = [];

  matrix.cells.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) rects.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
    });
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${matrix.size} ${matrix.size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><g fill="#111111">${rects.join('')}</g></svg>`;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
