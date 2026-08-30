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
        Randomize world
      </button>
      <button type="button" className="ghost-button" onClick={onShare}>
        {copied ? 'Copied' : 'Copy link'}
      </button>
      <button type="button" className="ghost-button" onClick={onDownloadGarden} disabled={!canDownloadGarden}>
        Garden PNG
      </button>
      <button type="button" className="primary-button" onClick={onDownloadQR}>
        QR PNG
      </button>
    </div>
  );
}
