import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy } from 'lucide-react';

interface QrCardProps {
  name: string;
  token: string;
  origin: string;
}

export function QrCard({ name, token, origin }: QrCardProps) {
  const [copied, setCopied] = useState(false);

  const url = `${origin}/p/${token}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable (non-HTTPS, denied permission) — fail silently
    }
  };

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm flex flex-col items-center gap-3">
      <span className="text-stone-900 text-sm font-semibold text-center">{name}</span>

      {token ? (
        <>
          <QRCodeSVG value={url} size={120} includeMargin />
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 transition-colors"
          >
            <Copy className="size-3" />
            {copied ? '¡Copiado!' : 'Copiar link'}
          </button>
        </>
      ) : (
        <p className="text-xs text-stone-400 text-center">Sin link</p>
      )}
    </div>
  );
}
