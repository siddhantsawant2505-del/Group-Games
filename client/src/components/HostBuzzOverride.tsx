import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface HostBuzzOverrideProps {
  buzzCount: number;
  requiredBuzzes: number;
  onResolveBuzz: (confirm: boolean) => void;
}

/**
 * Avoid the Word — host override on a pending buzz.
 * Lets the host confirm the slip (ends the turn as failed) or dismiss it
 * so the describer can keep going.
 */
export function HostBuzzOverride({
  buzzCount,
  requiredBuzzes,
  onResolveBuzz,
}: HostBuzzOverrideProps) {
  if (buzzCount <= 0) return null;

  return (
    <div className="party-card p-4 rounded-2xl border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 space-y-3">
      <div className="flex items-center justify-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
          Host Override
        </span>
      </div>

      <p className="text-xs font-semibold text-center text-amber-800 dark:text-amber-200">
        {buzzCount} of {requiredBuzzes} buzzes needed for the group to confirm.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="danger"
          size="sm"
          icon={<CheckCircle2 className="w-4 h-4" />}
          onClick={() => onResolveBuzz(true)}
        >
          Confirm Buzz
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={<XCircle className="w-4 h-4" />}
          onClick={() => onResolveBuzz(false)}
        >
          Dismiss Buzz
        </Button>
      </div>
    </div>
  );
}
