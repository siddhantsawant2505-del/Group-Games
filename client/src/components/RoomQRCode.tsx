import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QrCode, Copy, Check, X, Smartphone, Download } from 'lucide-react';

interface RoomQRCodeProps {
  roomCode: string;
  isOpen: boolean;
  onClose: () => void;
}

export function RoomQRCodeModal({ roomCode, isOpen, onClose }: RoomQRCodeProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  // Build the complete direct join URL
  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomCode)}`
    : `https://partygame.app/?room=${roomCode}`;

  useEffect(() => {
    if (!isOpen || !roomCode) return;

    let isMounted = true;
    setLoading(true);

    import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(joinUrl, {
          width: 400,
          margin: 2,
          color: {
            dark: '#18181B',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'M',
        })
      )
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate QR code', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, roomCode, joinUrl]);

  const copyJoinUrl = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `room-${roomCode}-qrcode.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#18181B]/40 backdrop-blur-xs"
          />

          {/* Dialog Container */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-modal-title"
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
            className="relative w-full max-w-sm bg-[var(--surface-card)] border-[2.5px] border-[var(--border-neo)] rounded-3xl p-6 shadow-[6px_6px_0px_var(--border-neo)] z-10 text-center"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-[var(--surface-card-subtle)] border-2 border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] flex items-center justify-center font-black text-sm cursor-pointer tactile-btn"
              aria-label="Close QR Code dialog"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#86EFAC] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] text-xs font-black mb-3">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Instant Camera Join</span>
            </div>

            <h3
              id="qr-modal-title"
              className="text-xl font-black text-[var(--text-primary)] tracking-tight mb-1"
            >
              Scan to Join Room
            </h3>

            <p className="text-xs font-bold opacity-60 mb-4">
              Point your phone camera at the QR code to open the game room directly.
            </p>

            {/* QR Code Container with High-Contrast White Backing */}
            <div className="mx-auto w-64 h-64 p-3 bg-white rounded-2xl border-2 border-[var(--border-neo)] shadow-[3px_3px_0px_var(--border-neo)] flex items-center justify-center relative overflow-hidden">
              {loading ? (
                <div className="flex flex-col items-center justify-center gap-3 text-neutral-400">
                  <div className="w-8 h-8 border-3 border-neutral-300 border-t-neutral-800 rounded-full animate-spin" />
                  <span className="text-xs font-bold">Generating QR Code...</span>
                </div>
              ) : qrDataUrl ? (
                <motion.img
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  src={qrDataUrl}
                  alt={`QR Code for Room ${roomCode}`}
                  className="w-full h-full object-contain rounded-lg"
                />
              ) : (
                <span className="text-xs text-red-500 font-bold">Failed to generate QR</span>
              )}
            </div>

            {/* Room Code Badge */}
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="text-xs uppercase font-black opacity-60">
                Room Code:
              </span>
              <span className="font-mono text-xl font-black tracking-widest text-[#18181B] bg-[#FEF08A] px-3 py-1 rounded-xl border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)]">
                {roomCode}
              </span>
            </div>

            {/* Actions */}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={copyJoinUrl}
                className="w-full py-2.5 px-3 rounded-xl bg-[var(--surface-card-subtle)] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] text-xs font-black text-[var(--text-primary)] flex items-center justify-center gap-1.5 cursor-pointer tactile-btn"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3] text-emerald-600" />
                    <span>URL Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy URL</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={downloadQr}
                disabled={!qrDataUrl}
                className="w-full py-2.5 px-3 rounded-xl bg-[#93C5FD] border-2 border-[var(--border-neo)] shadow-[2px_2px_0px_var(--border-neo)] text-xs font-black text-[#18181B] flex items-center justify-center gap-1.5 cursor-pointer tactile-btn disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>Save Image</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function InlineRoomQR({
  roomCode,
  onOpenModal,
}: {
  roomCode: string;
  onOpenModal?: () => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomCode)}`
    : `https://partygame.app/?room=${roomCode}`;

  useEffect(() => {
    let isMounted = true;
    import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(joinUrl, {
          width: 160,
          margin: 1,
          color: {
            dark: '#18181B',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'M',
        })
      )
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => console.error('Failed to generate inline QR', err));

    return () => {
      isMounted = false;
    };
  }, [roomCode, joinUrl]);

  return (
    <div
      onClick={onOpenModal}
      className={`inline-flex items-center gap-3 p-2.5 rounded-2xl bg-[var(--surface-card)] border-2 border-[var(--border-neo)] shadow-[3px_3px_0px_var(--border-neo)] ${
        onOpenModal ? 'cursor-pointer tactile-btn' : ''
      }`}
      title="Click to enlarge QR code for easy scanning"
    >
      <div className="w-14 h-14 bg-white p-1 rounded-xl shrink-0 flex items-center justify-center border-2 border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)]">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`QR code for room ${roomCode}`}
            className="w-full h-full object-contain rounded"
          />
        ) : (
          <div className="w-4 h-4 border-2 border-neutral-300 border-t-neutral-800 rounded-full animate-spin" />
        )}
      </div>

      <div className="text-left pr-1">
        <div className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-[var(--text-primary)]">
          <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
          <span>Scan to Join</span>
        </div>
        <p className="text-[11px] font-bold opacity-60 leading-tight mt-0.5">
          Phone camera opens room directly
        </p>
      </div>

      <div className="ml-auto pl-1 pr-1 opacity-70">
        <QrCode className="w-4 h-4" />
      </div>
    </div>
  );
}
