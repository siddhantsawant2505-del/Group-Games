import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Settings2 } from 'lucide-react';

interface SettingsSheetProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Bottom-sheet shell shared by the lobby's room settings and by each game
 * card's settings. Styled with soothing neo-brutalist drawer aesthetics.
 */
export function SettingsSheet({ open, title, subtitle, onClose, children }: SettingsSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className="absolute inset-0 bg-[#18181B]/40 backdrop-blur-xs cursor-pointer"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 40, opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="relative w-full sm:max-w-md max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[var(--surface-card)] border-[2.5px] border-[var(--border-neo)] shadow-[0px_-6px_0px_var(--border-neo)] sm:shadow-[6px_6px_0px_var(--border-neo)] p-5 pb-8"
          >
            {/* Drawer Grab Handle for mobile thumb gestures */}
            <div className="w-12 h-1.5 bg-[var(--border-neo)] rounded-full mx-auto mb-3 sm:hidden" />

            <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b-2 border-[var(--border-neo)]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#FEF08A] text-[#18181B] border-2 border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] flex items-center justify-center shrink-0 font-black">
                  <Settings2 className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-black text-[var(--text-primary)] leading-tight truncate">
                    {title}
                  </h2>
                  {subtitle && (
                    <p className="text-[11px] font-bold opacity-60 truncate">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close settings"
                className="w-8 h-8 rounded-xl bg-[var(--surface-card-subtle)] border-2 border-[var(--border-neo)] shadow-[1px_1px_0px_var(--border-neo)] flex items-center justify-center cursor-pointer tactile-btn text-[var(--text-primary)] font-black text-sm"
              >
                <X className="w-4 h-4 stroke-[3]" />
              </button>
            </div>

            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
