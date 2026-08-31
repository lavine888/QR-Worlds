type QRInputProps = {
  value: string;
  onChange: (value: string) => void;
};

export function QRInput({ value, onChange }: QRInputProps) {
  return (
    <label className="reference-field">
      <span className="sr-only">QR content</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="QR content"
        placeholder="https://qr-worlds.vercel.app/"
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
      />
    </label>
  );
}
