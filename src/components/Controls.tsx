type ControlsProps = {
  copied: boolean;
  canDownloadGarden: boolean;
  onShare: () => void;
  onDownloadQR: () => void;
  onDownloadGarden: () => void;
  onRandomize: () => void;
};

export function Controls({
  copied,
  canDownloadGarden,
  onShare,
  onDownloadQR,
  onDownloadGarden,
  onRandomize,
}: ControlsProps) {
  return (
    <div className="dock-actions">
      <button type="button" className="ghost-button" onClick={onRandomize}>
        <span aria-hidden="true">↻</span>
        New bloom
      </button>
      <button type="button" className="ghost-button" onClick={onShare}>
        <span aria-hidden="true">⌁</span>
        {copied ? 'Copied' : 'Copy'}
      </button>
      <button type="button" className="ghost-button" onClick={onDownloadGarden} disabled={!canDownloadGarden}>
        <span aria-hidden="true">↓</span>
        Garden
      </button>
      <button type="button" className="primary-button" onClick={onDownloadQR}>
        <span aria-hidden="true">▦</span>
        QR
      </button>
    </div>
  );
}
