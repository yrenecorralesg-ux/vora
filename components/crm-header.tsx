import React from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CrmHeaderProps {
  tenantName: string;
  title: string;
  subtitle: string;
  roleBadgeText?: string;
  ambientImageUrl?: string | null;
  secondaryColor?: string;
  className?: string;
  action?: React.ReactNode;
}

export function CrmHeader({
  tenantName,
  title,
  subtitle,
  roleBadgeText = 'Asesora',
  ambientImageUrl,
  secondaryColor = '#7c3aed',
  className,
  action,
}: CrmHeaderProps) {
  return (
    <div
      className={cn(
        'relative flex min-h-[125px] sm:min-h-[140px] flex-col justify-center overflow-hidden rounded-2xl bg-white/85 backdrop-blur-sm border border-slate-100/90 px-6 sm:px-8 py-4.5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]',
        className,
      )}
    >
      {/* Ambient background image on top right */}
      {ambientImageUrl && (
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-[55%] max-w-[560px] overflow-hidden select-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ambientImageUrl}
            alt=""
            className="h-full w-full object-cover object-right opacity-90"
            style={{
              maskImage:
                'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) 15%, black 45%)',
              WebkitMaskImage:
                'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) 15%, black 45%)',
            }}
          />
        </div>
      )}

      {/* Top right badges / actions */}
      <div className="absolute right-4 sm:right-6 top-4 z-20 flex items-center gap-2">
        {action}
        <div className="flex items-center gap-1.5 rounded-full border border-white/90 bg-white/90 px-3.5 py-1.5 shadow-sm backdrop-blur transition-all hover:bg-white cursor-pointer">
          <Sparkles className="h-3.5 w-3.5" style={{ color: secondaryColor }} />
          <span className="text-[11.5px] font-semibold text-slate-800">
            {roleBadgeText}
          </span>
          <ChevronDown className="h-3 w-3 text-slate-400" />
        </div>
      </div>

      {/* Title block */}
      <div className="relative z-10 max-w-xl space-y-1">
        <p
          className="text-[11px] font-bold uppercase tracking-[0.25em]"
          style={{ color: secondaryColor }}
        >
          {tenantName}
        </p>
        <h1 className="text-2xl sm:text-[30px] font-extrabold tracking-tight text-[#111827] leading-tight">
          {title}
        </h1>
        <p className="text-xs sm:text-[13px] font-normal text-[#6b7280]">
          {subtitle}
        </p>
      </div>
    </div>
  );
}
