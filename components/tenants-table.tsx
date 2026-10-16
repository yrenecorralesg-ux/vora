'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { AdminStatusBadge, InfrastructureBadge, TechnicalStatusBadge } from '@/components/admin/tenant-badges';
import { ADMIN_STATUS_LABEL } from '@/lib/tenant-management';
import type { CommercialStatus, InfrastructureMode, TechnicalStatus } from '@/lib/types';

export interface TenantRow {
  id: string;
  commercial_name: string;
  legal_name: string | null;
  tax_id: string | null;
  slug: string;
  commercial_status: CommercialStatus;
  technical_status: TechnicalStatus;
  infrastructure_mode: InfrastructureMode;
  plan_id: string | null;
  plan_name: string | null;
  created_at: string;
}

const STATUS_FILTERS: CommercialStatus[] = ['pending', 'active', 'suspended', 'trial', 'cancelled'];

/** Deterministic dd/mm/yyyy (same output on server and browser). */
function formatDate(iso: string) {
  const [date] = iso.split('T');
  const [year, month, day] = date.split('-');
  return day && month && year ? `${day}/${month}/${year}` : iso;
}

const selectClass =
  'h-11 rounded-xl border border-[#DCE3D6] bg-white px-3 text-sm text-[#25332D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#285C49]';

export function TenantsTable({ tenants, plans }: { tenants: TenantRow[]; plans: { id: string; name: string }[] }) {
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState<'all' | CommercialStatus>('all');
  const [planId, setPlanId] = React.useState('all');
  const [mode, setMode] = React.useState<'all' | InfrastructureMode>('all');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return tenants.filter((t) => {
      if (status !== 'all' && t.commercial_status !== status) return false;
      if (planId !== 'all' && (planId === 'none' ? t.plan_id !== null : t.plan_id !== planId)) return false;
      if (mode !== 'all' && t.infrastructure_mode !== mode) return false;
      if (!q) return true;
      return [t.commercial_name, t.legal_name, t.tax_id, t.slug].some((value) => value?.toLowerCase().includes(q));
    });
  }, [tenants, query, status, planId, mode]);

  const hasFilters = query !== '' || status !== 'all' || planId !== 'all' || mode !== 'all';
  const clearFilters = () => {
    setQuery('');
    setStatus('all');
    setPlanId('all');
    setMode('all');
  };

  return (
    <section aria-label="Listado de empresas" className="rounded-[1.5rem] border border-[#E2DACB] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#EFE8DC] p-4 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Buscar empresa</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#52675A]" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, razón social, RIF o slug"
            className="h-11 w-full rounded-xl border border-[#DCE3D6] bg-[#FBF9F4] pl-9 pr-3 text-sm text-[#25332D] placeholder:text-[#7A8A7F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#285C49]"
          />
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex">
          <select aria-label="Filtrar por estado" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={selectClass}>
            <option value="all">Todos los estados</option>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>{ADMIN_STATUS_LABEL[s]}</option>
            ))}
          </select>
          <select aria-label="Filtrar por plan" value={planId} onChange={(e) => setPlanId(e.target.value)} className={selectClass}>
            <option value="all">Todos los planes</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            <option value="none">Sin plan</option>
          </select>
          <select aria-label="Filtrar por modalidad" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className={selectClass}>
            <option value="all">Shared y Dedicated</option>
            <option value="shared">Shared</option>
            <option value="dedicated">Dedicated</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 text-sm text-[#52675A]">
        <p aria-live="polite">
          {filtered.length} de {tenants.length} empresa{tenants.length === 1 ? '' : 's'}
        </p>
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold text-[#285C49] hover:bg-[#E6EBDF]">
            <X className="h-3.5 w-3.5" aria-hidden="true" /> Limpiar filtros
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 pb-14 pt-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E6EBDF] text-[#285C49]">
            <Building2 className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="font-jakarta text-lg font-bold text-[#285C49]">{tenants.length === 0 ? 'Todavía no hay empresas registradas' : 'Ninguna empresa coincide con los filtros'}</p>
          <p className="max-w-sm text-sm text-[#52675A]">
            {tenants.length === 0 ? 'Registra la primera empresa para asignarle un plan y su modalidad de infraestructura.' : 'Prueba con otro término o limpia los filtros.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-y border-[#EFE8DC] bg-[#FBF9F4] text-xs uppercase tracking-wider text-[#52675A]">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Empresa</th>
                  <th scope="col" className="px-4 py-3 font-semibold">RIF</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Estado</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Plan</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Modalidad</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Creada</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE8DC]">
                {filtered.map((t) => (
                  <tr key={t.id} className="transition hover:bg-[#FBF9F4]">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#25332D]">{t.commercial_name}</p>
                      <p className="text-xs text-[#52675A]">{t.legal_name ?? '—'}</p>
                      <code className="text-[11px] text-[#7A8A7F]">/{t.slug}</code>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[#25332D]">{t.tax_id ?? '—'}</td>
                    <td className="px-4 py-3"><AdminStatusBadge status={t.commercial_status} /></td>
                    <td className="px-4 py-3 text-[#25332D]">{t.plan_name ?? <span className="text-[#7A8A7F]">Sin plan</span>}</td>
                    <td className="space-y-1.5 px-4 py-3">
                      <InfrastructureBadge mode={t.infrastructure_mode} />
                      <TechnicalStatusBadge status={t.technical_status} className="block w-max" />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#52675A]">{formatDate(t.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/tenants/${t.id}`}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-[#285C49] hover:bg-[#E6EBDF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#285C49]"
                        aria-label={`Ver detalle de ${t.commercial_name}`}
                      >
                        Ver <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile / tablet cards */}
          <ul className="divide-y divide-[#EFE8DC] border-t border-[#EFE8DC] lg:hidden">
            {filtered.map((t) => (
              <li key={t.id}>
                <Link href={`/admin/tenants/${t.id}`} className={cn('block px-4 py-4 transition hover:bg-[#FBF9F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#285C49]')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#25332D]">{t.commercial_name}</p>
                      <p className="truncate text-xs text-[#52675A]">{t.legal_name ?? '—'} · <span className="font-mono">{t.tax_id ?? 'sin RIF'}</span></p>
                    </div>
                    <AdminStatusBadge status={t.commercial_status} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#52675A]">
                    <InfrastructureBadge mode={t.infrastructure_mode} />
                    <span>{t.plan_name ?? 'Sin plan'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDate(t.created_at)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
