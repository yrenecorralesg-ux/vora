import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { FeatureStatus, LandingModule } from './landing-data';

const statusStyles: Record<LandingModule['status'], string> = {
  Disponible: 'bg-[#DDE8D8] text-[#1F4A3A]',
  'Base disponible': 'bg-[#DDE8D8] text-[#1F4A3A]',
  'En desarrollo': 'bg-[#F3E2D2] text-[#8A4528]',
  Próximamente: 'bg-[#EFE8DC] text-[#5F5446]',
};

export function StatusBadge({ status, className }: { status: LandingModule['status'] | FeatureStatus; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none', statusStyles[status], className)}>
      {status}
    </span>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = 'left',
  className,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A4573A]">{eyebrow}</p>
      <h2 id={id} className="mt-3 font-jakarta text-3xl font-extrabold leading-tight tracking-[-0.02em] text-[#285C49] sm:text-4xl">
        {title}
      </h2>
      {description && <p className="mt-4 text-base leading-7 text-[#52675A] sm:text-lg">{description}</p>}
    </div>
  );
}

/** Shared focus ring for links and buttons on the cream background. */
export const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#285C49] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F6F2E9]';
