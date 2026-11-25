'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, Activity, ArrowLeft, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { usePos } from './pos-context';

function CasheaIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#FFD200" />
      <path
        d="M14.8 7.5C13.8 6.5 12.2 6 10.5 6C6.9 6 4 8.7 4 12C4 15.3 6.9 18 10.5 18C12.2 18 13.8 17.5 14.8 16.5L13.2 14.9C12.5 15.6 11.5 16 10.5 16C8.2 16 6.3 14.2 6.3 12C6.3 9.8 8.2 8 10.5 8C11.5 8 12.5 8.4 13.2 9.1L14.8 7.5Z"
        fill="#111827"
      />
      <circle cx="17.5" cy="12" r="2.2" fill="#111827" />
    </svg>
  );
}

export function PosView18FiscalConfig() {
  const { activeBranch, showNotification, navigateTo, activeTenantSlug, me, can } = usePos();

  // Solo datos de la empresa y la REFERENCIA de credenciales: el usuario y la
  // clave de HKA viven en variables de entorno del servidor, nunca en el navegador.
  const [companyRif, setCompanyRif] = useState('');
  const [legalName, setLegalName] = useState('');
  const [fiscalAddress, setFiscalAddress] = useState(activeBranch.fiscal_address ?? '');
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [secretRef, setSecretRef] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [legalStatus, setLegalStatus] = useState<'sin_configurar' | 'sandbox_verificado' | 'productivo_activo'>('sin_configurar');
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    fetch(`/api/t/${activeTenantSlug}/pos/fiscal`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        const i = d.integration;
        if (!i) return;
        setCompanyRif(i.company_rif ?? '');
        setLegalName(i.company_legal_name ?? '');
        if (i.fiscal_address) setFiscalAddress(i.fiscal_address);
        setEnvironment(i.environment === 'production' ? 'production' : 'sandbox');
        setSecretRef(i.secret_reference ?? '');
        setIsEnabled(Boolean(i.enabled));
        setLegalStatus(i.legal_status ?? 'sin_configurar');
      })
      .catch(() => {});
  }, [activeTenantSlug]);

  // HKA Connection Test
  const [testingHka, setTestingHka] = useState(false);
  const [testResultHka, setTestResultHka] = useState<{ ok: boolean; message: string; data?: any } | null>(null);

  // Cashea Connection Test
  const [testingCashea, setTestingCashea] = useState(false);
  const [testResultCashea, setTestResultCashea] = useState<{
    ok: boolean;
    message: string;
    terminal?: any;
    store?: any;
    minAmountUsd?: number;
  } | null>(null);

  const handleTestHkaConnection = async () => {
    setTestingHka(true);
    setTestResultHka(null);

    try {
      const res = await fetch(`/api/t/${activeTenantSlug}/pos/fiscal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate' }),
      });
      const data = await res.json();
      setTestResultHka({ ok: data.ok, message: data.message, data: data.data });
      if (data.ok) {
        setLegalStatus(environment === 'sandbox' ? 'sandbox_verificado' : 'productivo_activo');
      }
      showNotification('The Factory HKA', data.message, data.ok ? 'success' : 'critical');
    } catch (err: any) {
      setTestResultHka({ ok: false, message: `Error de red: ${err.message}` });
      showNotification('The Factory HKA', err.message, 'critical');
    } finally {
      setTestingHka(false);
    }
  };

  const handleTestCasheaConnection = async () => {
    setTestingCashea(true);
    setTestResultCashea(null);

    try {
      const res = await fetch(`/api/t/${activeTenantSlug}/pos/cashea`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate' }),
      });
      const data = await res.json();
      setTestResultCashea({
        ok: data.ok,
        message: data.message,
        terminal: data.terminal,
        store: data.store,
        minAmountUsd: data.minAmountUsd,
      });
      showNotification('Cashea POS', data.message, data.ok ? 'success' : 'critical');
    } catch (err: any) {
      setTestResultCashea({ ok: false, message: `Error de red: ${err.message}` });
      showNotification('Cashea POS', err.message, 'critical');
    } finally {
      setTestingCashea(false);
    }
  };

  const handleSaveFiscalConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await fetch(`/api/t/${activeTenantSlug}/pos/fiscal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_config',
          company_rif: companyRif.trim(),
          company_legal_name: legalName.trim(),
          fiscal_address: fiscalAddress.trim(),
          environment,
          secret_reference: secretRef.trim(),
          enabled: isEnabled,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        showNotification('Configuración no guardada', data?.error ?? 'No se pudo guardar la configuración fiscal.', 'critical');
        return;
      }
      setLegalStatus(data.integration?.legal_status ?? 'sin_configurar');
      showNotification(
        'Configuración guardada',
        `Integración The Factory HKA guardada en modo ${environment.toUpperCase()}. Usa "Probar conexión" para verificarla.`,
        'success',
      );
    } finally {
      setSavingConfig(false);
    }
  };

  if (me && !can('pos.settings.manage')) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-[#DCE3DF] bg-white p-8 text-center shadow-sm space-y-4">
        <h1 className="text-lg font-bold text-[#111827]">Acceso restringido</h1>
        <p className="text-xs text-[#52635A]">
          Tu rol actual no tiene permisos para acceder a la configuración de este módulo.
        </p>
        <button
          type="button"
          onClick={() => navigateTo('POS-01')}
          className="inline-flex items-center justify-center rounded-2xl bg-[#1E6B4E] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#16523B]"
        >
          Volver a Caja y Terminal
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">
            Integraciones Externas VORA POS
          </h1>
          <p className="mt-1 text-xs text-[#52635A]">
            Facturación fiscal autorizada SENIAT (The Factory HKA) y pasarela BNPL en mostrador (Cashea).
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigateTo('POS-01')}
          className="rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] px-4 py-2 text-xs font-bold text-[#111827] hover:bg-[#DCE3DF]"
        >
          Volver al inicio
        </button>
      </div>

      {/* 1. SECCIÓN: THE FACTORY HKA */}
      <div className="rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E9E7]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#1E6B4E]" />
            <h2 className="text-base font-bold text-[#111827]">
              Facturación Fiscal Digital (The Factory HKA)
            </h2>
          </div>
          <span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-[11px] font-bold text-[#14532D]">
            {legalStatus}
          </span>
        </div>

        <form onSubmit={handleSaveFiscalConfig} className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[#111827]">Emisión Fiscal Electrónica</span>
              <p className="text-[11px] text-[#52635A]">
                Conexión directa mediante Web Services REST (/Autenticacion, /Emision, /EstadoDocumento).
              </p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="h-4 w-4 accent-[#1E6B4E]"
              />
              <span className="text-xs font-bold text-[#111827]">
                Habilitar conector HKA
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-[#111827]">
                RIF Emisor (SENIAT)
              </label>
              <input
                type="text"
                required
                value={companyRif}
                onChange={(e) => setCompanyRif(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-3 text-xs font-bold text-[#111827]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#111827]">
                Ambiente de facturación
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as any)}
                className="mt-1 w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-3 text-xs font-semibold text-[#111827]"
              >
                <option value="sandbox">Sandbox / Demo homologación SENIAT</option>
                <option value="production">Producción oficial SENIAT</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-[#111827]">
                Razón Social Fiscal
              </label>
              <input
                type="text"
                required
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-3 text-xs text-[#111827]"
              />
            </div>

          </div>

          <div>
            <label className="block text-xs font-bold text-[#111827]">
              Referencia de credenciales en el servidor
            </label>
            <input
              type="text"
              value={secretRef}
              onChange={(e) => setSecretRef(e.target.value.toUpperCase())}
              placeholder="Ej: HKA_MI_EMPRESA"
              className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-3 text-xs font-mono text-[#111827]"
            />
            <p className="mt-1 text-[11px] text-[#52635A]">
              El usuario y la clave de The Factory HKA se configuran como variables de entorno del servidor
              (<code>REFERENCIA_USER</code> y <code>REFERENCIA_PASSWORD</code>). Nunca se escriben aquí.
            </p>
          </div>

          {/* Resultado de Prueba HKA */}
          {testResultHka && (
            <div
              className={`rounded-2xl border p-4 text-xs font-semibold ${
                testResultHka.ok
                  ? 'border-[#86EFAC] bg-[#DCFCE7] text-[#14532D]'
                  : 'border-[#C83E3B] bg-[#FEF2F2] text-[#B91C1C]'
              }`}
            >
              <div className="flex items-center gap-2">
                {testResultHka.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{testResultHka.message}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <button
              type="button"
              disabled={testingHka}
              onClick={handleTestHkaConnection}
              className="flex-1 rounded-2xl border border-[#1E6B4E] bg-white py-3 text-xs font-bold uppercase tracking-wider text-[#1E6B4E] hover:bg-[#DCFCE7] disabled:opacity-50"
            >
              {testingHka ? 'Autenticando con HKA...' : 'Probar conexión API HKA'}
            </button>

            <button
              type="submit"
              disabled={savingConfig}
              className="flex-1 rounded-2xl bg-[#1E6B4E] py-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-[#16523B] disabled:opacity-60"
            >
              Guardar configuración fiscal
            </button>
          </div>
        </form>
      </div>

      {/* 2. SECCIÓN: CASHEA POS (BNPL) */}
      <div className="rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E9E7]">
          <div className="flex items-center gap-2">
            <CasheaIcon className="h-5 w-5" />
            <h2 className="text-base font-bold text-[#111827]">
              Pasarela de Crédito In-Store (Cashea POS)
            </h2>
          </div>
          <span className="rounded-full bg-[#FEF3C7] px-3 py-1 text-[11px] font-bold text-[#92400E]">
            Integrado Oficial
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
          <div className="rounded-2xl border border-[#E5E9E7] bg-[#F6F5F0] p-4 space-y-2">
            <div className="font-bold text-[#111827]">Terminal de Caja Asignada</div>
            <div className="text-[#52635A]">
              Nombre: <strong className="text-[#111827]">Stunt Riders Av Principal Dalla Costa 1</strong>
            </div>
            <div className="text-[11px] text-[#52635A] font-mono break-all">
              UUID: e9f8cc2a-1458-4f19-bf22-27462a5b6fe4
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5E9E7] bg-[#F6F5F0] p-4 space-y-2">
            <div className="font-bold text-[#111827]">Comercio y Política de Cuotas</div>
            <div className="text-[#52635A]">
              Tienda: <strong className="text-[#111827]">Stunt Riders Av Principal Dalla Costa (ID 49414)</strong>
            </div>
            <div className="text-[#52635A]">
              Monto mínimo financiable: <strong className="text-[#1E6B4E]">$25.00 USD</strong>
            </div>
          </div>
        </div>

        {/* Resultado de Prueba Cashea */}
        {testResultCashea && (
          <div
            className={`rounded-2xl border p-4 text-xs font-semibold ${
              testResultCashea.ok
                ? 'border-[#86EFAC] bg-[#DCFCE7] text-[#14532D]'
                : 'border-[#C83E3B] bg-[#FEF2F2] text-[#B91C1C]'
            }`}
          >
            <div className="flex items-center gap-2">
              {testResultCashea.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{testResultCashea.message}</span>
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={testingCashea}
          onClick={handleTestCasheaConnection}
          className="w-full rounded-2xl border border-[#111827] bg-[#111827] py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#1E293B] disabled:opacity-50"
        >
          {testingCashea ? 'Consultando Cashea API...' : 'Verificar terminal Cashea en vivo (/pos)'}
        </button>
      </div>
    </div>
  );
}
