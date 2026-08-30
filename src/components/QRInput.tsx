type QRInputProps = {
  value: string;
  onChange: (value: string) => void;
};

export function QRInput({ value, onChange }: QRInputProps) {
  return (
    <label className="url-field">
      <span className="url-icon" aria-hidden="true">↗</span>
      <span className="sr-only">QR content</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="QR content"
        placeholder="Paste a URL or type anything"
        spellCheck={false}
      />
    </label>
  );
}
