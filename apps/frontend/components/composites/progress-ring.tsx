import { cn } from '@/lib/tokens/cn';

export type ProgressRingProps = {
  /** Progress 0..1 (values outside this range are clamped) */
  value: number;
  /** Diameter in pixels. Default 64. */
  size?: number;
  /** Stroke width in pixels. Default 6. */
  strokeWidth?: number;
  /** Color of the progress arc. Default brand-500. */
  color?: string;
  /** Color of the track circle. Default border-subtle. */
  trackColor?: string;
  /** Optional label rendered in the center (e.g. "75%") */
  label?: string;
  className?: string;
  /** ARIA label for screen readers (required when no visible `label` is provided) */
  'aria-label'?: string;
};

/**
 * ProgressRing — a circular progress indicator.
 *
 * Used wherever a percentage-based completion needs to be visualized:
 * storage usage, task completion, AI credit consumption, etc. Uses
 * stroke-dasharray + stroke-dashoffset to draw the arc, which is GPU-
 * accelerated and animates smoothly without JS.
 */
export function ProgressRing({
  value,
  size = 64,
  strokeWidth = 6,
  color = 'var(--color-brand-500)',
  trackColor = 'var(--color-border-subtle)',
  label,
  className,
  'aria-label': ariaLabel,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel ?? label ?? `${Math.round(clamped * 100)} percent`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.3s ease-out' }}
        />
      </svg>
      {label && (
        <span
          className="absolute inset-0 flex items-center justify-center text-xs font-medium"
          aria-hidden
        >
          {label}
        </span>
      )}
    </div>
  );
}
