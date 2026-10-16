import { cn } from '@/lib/utils';

interface EkosLogoProps {
  className?: string;
  showText?: boolean;
  textClassName?: string;
}

export function EkosLogo({ className, showText = true, textClassName }: EkosLogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)} aria-label="EKOSCRM por EKOS Solutions">
      {showText && (
        <span className={cn('text-lg font-semibold tracking-[0.18em]', textClassName)}>
          EKOS<span className="text-accent">CRM</span>
        </span>
      )}
    </div>
  );
}
