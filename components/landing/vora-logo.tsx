import { cn } from '@/lib/utils';

interface VoraLogoProps {
  className?: string;
  tone?: 'forest' | 'cream';
  showByline?: boolean;
}

/** VORA by Venesoft wordmark used on the public landing. */
export function VoraLogo({ className, tone = 'forest', showByline = true }: VoraLogoProps) {
  const isCream = tone === 'cream';
  return (
    <span className={cn('inline-flex items-baseline gap-2 font-jakarta', className)}>
      <span className={cn('text-[1.7rem] font-extrabold leading-none tracking-[-0.05em]', isCream ? 'text-[#F6F2E9]' : 'text-[#285C49]')}>
        vora<span className="text-[#C97857]">.</span>
      </span>
      {showByline && (
        <span className={cn('text-[11px] font-semibold tracking-wide', isCream ? 'text-[#DCE6D9]' : 'text-[#52675A]')}>by Venesoft</span>
      )}
    </span>
  );
}
