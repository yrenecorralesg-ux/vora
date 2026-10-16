import { CheckCircle2, CircleDashed, Server, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ADMIN_STATUS_LABEL, TECHNICAL_STATUS_LABEL, infrastructureLabel, isOperational } from '@/lib/tenant-management';
import type { CommercialStatus, InfrastructureMode, TechnicalStatus } from '@/lib/types';

const pill = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-none';

const ADMIN_STATUS_STYLE: Record<CommercialStatus, string> = {
  pending: 'bg-[#F3E2D2] text-[#8A4528]',
  trial: 'bg-[#E6EBDF] text-[#1F4A3A]',
  active: 'bg-[#DDE8D8] text-[#1F4A3A]',
  suspended: 'bg-[#F8E1DD] text-[#8F2D22]',
  cancelled: 'bg-[#EFE8DC] text-[#5F5446]',
};

const TECHNICAL_STATUS_STYLE: Record<TechnicalStatus, string> = {
  pending_setup: 'bg-[#EFE8DC] text-[#5F5446]',
  ready: 'bg-[#DDE8D8] text-[#1F4A3A]',
  error: 'bg-[#F8E1DD] text-[#8F2D22]',
};

export function AdminStatusBadge({ status, className }: { status: CommercialStatus; className?: string }) {
  return (
    <span className={cn(pill, ADMIN_STATUS_STYLE[status] ?? ADMIN_STATUS_STYLE.cancelled, className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {ADMIN_STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function TechnicalStatusBadge({ status, className }: { status: TechnicalStatus; className?: string }) {
  return (
    <span className={cn(pill, TECHNICAL_STATUS_STYLE[status] ?? TECHNICAL_STATUS_STYLE.pending_setup, className)}>
      {TECHNICAL_STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function InfrastructureBadge({ mode, className }: { mode: InfrastructureMode | null | undefined; className?: string }) {
  const dedicated = mode === 'dedicated';
  const Icon = dedicated ? Server : Share2;
  return (
    <span className={cn(pill, dedicated ? 'bg-[#285C49] text-white' : 'border border-[#A9BEA5] bg-white text-[#285C49]', className)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {infrastructureLabel(mode)}
    </span>
  );
}

export function OperationalIndicator({ status, technical }: { status: CommercialStatus; technical: TechnicalStatus }) {
  const operational = isOperational(status, technical);
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', operational ? 'text-[#1F4A3A]' : 'text-[#6B5E4F]')}>
      {operational ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <CircleDashed className="h-4 w-4" aria-hidden="true" />}
      {operational ? 'Operativa' : 'No operativa'}
    </span>
  );
}
