import type { QRMatrix } from './generateQR';
import { createQRCanvas } from './matrix';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadQRPng(matrix: QRMatrix, filename = 'qr-world.png') {
  const canvas = createQRCanvas(matrix, 1024);
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, filename);
  }, 'image/png');
}

export function downloadQRSvg(matrix: QRMatrix, filename = 'qr-world.svg') {
  const rects: string[] = [];
  matrix.cells.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) rects.push(
        '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>',
      );
    });
  });
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 ' +
    matrix.size +
    ' ' +
    matrix.size +
    '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><g fill="#111">' +
    rects.join('') +
    '</g></svg>';
  downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), filename);
}

export function downloadGardenPng(canvas: HTMLCanvasElement, filename = 'qr-garden.png') {
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, filename);
  }, 'image/png');
}

export async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Clipboard access is unavailable in this browser.');
}
