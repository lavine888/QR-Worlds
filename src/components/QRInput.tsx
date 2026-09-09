import { forwardRef } from 'react';

type QRInputProps = {
  value: string;
  onChange: (value: string) => void;
};

export const QRInput = forwardRef<HTMLInputElement, QRInputProps>(
  function QRInput({ value, onChange }, ref) {
    return (
      <label className="reference-field">
        <span className="sr-only">QR content</span>
        <input
          ref={ref}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="QR content"
          placeholder="https://qr-worlds.vercel.app/"
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          inputMode="url"
          autoFocus
        />
      </label>
    );
  },
);
