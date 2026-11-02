'use client';

import React, { useState } from 'react';
import { ShieldCheck, Activity, ArrowLeft } from 'lucide-react';
import { usePos } from './pos-context';
import { posStore, hkaProvider } from '@/lib/pos-service';

export function PosView18FiscalConfig() {
  const { activeBranch, activeUser, showNotification, navigateTo } = usePos();
  const integration = posStore.fiscalIntegration;

  const [companyRif, setCompanyRif] = useState(integration.company_rif ?? 'J-50123987-1');
  const [legalName, setLegalName] = useState(integration.company_legal_name ?? 'VORA Retail Piloto test1 C.A. [mock]');
  const [fiscalAddress, setFiscalAddress] = useState(integration.fiscal_address ?? activeBranch.fiscal_address ?? '');
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>(integration.environment);
  const [secretRef, setSecretRef] = useState(integration.secret_reference ?? 'vault:hka_secret_pilot_mock');
  const [isEnabled, setIsEnabled] = useState(integration.enabled);
  const [legalStatus, setLegalStatus] = useState(integration.legal_status);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    const res = await hkaProvider.validateConfiguration({
      ...integration,
      company_rif: companyRif,
      company_legal_name: legalName,
      fiscal_address: fiscalAddress,
      secret_reference: secretRef,
      enabled: isEnabled,
    });

    setTestResult({ ok: res.valid, message: res.message });
    setTesting(false);
    showNotification('Prueba de conexión', res.message, res.valid ? 'success' : 'critical');
  };

  const handleSaveFiscalConfig = (e: React.FormEvent) => {
    e.preventDefault();

    integration.company_rif = companyRif.trim();
    integration.company_legal_name = legalName.trim();
    integration.fiscal_address = fiscalAddress.trim();
    integration.environment = environment;
    integration.secret_reference = secretRef.trim();
    integration.enabled = isEnabled;
    integration.legal_status = isEnabled ? (environment === 'sandbox' ? 'sandbox_verificado' : 'productivo_activo') : 'sin_configurar';
    integration.updated_at = new Date().toISOString();
    setLegalStatus(integration.legal_status);

    posStore.addAudit({
      branch_id: activeBranch.id,
      shift_id: null,
      actor_id: activeUser.id,
      event_type: 'actualizacion_conector_hka',
      entity_type: 'pos_fiscal_integrations',
      entity_id: integration.id,
      description: 'Actualización de credenciales y parámetros de integración The Factory HKA [mock]',
      metadata: { environment, isEnabled, secretRef },
    });

    showNotification(
      'Configuración fiscal guardada',
      `Integración con The Factory HKA actualizada en modo ${environment.toUpperCase()} [mock].`,
      'success',
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Cabecera con Bordes Redondeados */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">
            Configuración Fiscal The Factory HKA
          </h1>
          <p className="mt-1 text-xs text-[#52635A]">
            Emisión desacoplada de facturación digital bajo normativa SENIAT.
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

      <div className="rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm">
        <form onSubmit={handleSaveFiscalConfig} className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E9E7]">
            <div>
              <span className="text-sm font-bold text-[#111827]">Estado de la integración</span>
              <p className="text-xs text-[#52635A]">
                Estatus legal actual: <strong className="text-[#111827]">{legalStatus}</strong>
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
                Habilitar conector fiscal HKA
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-[#111827]">
                RIF Fiscal de la Empresa
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
                <option value="sandbox">Sandbox / Pruebas de homologación</option>
                <option value="production">Producción SENIAT oficial</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#111827]">
              Razón Social registrada ante SENIAT
            </label>
            <input
              type="text"
              required
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-3 text-xs text-[#111827]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#111827]">
              Dirección Fiscal oficial
            </label>
            <input
              type="text"
              required
              value={fiscalAddress}
              onChange={(e) => setFiscalAddress(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-3 text-xs text-[#111827]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#111827]">
              Referencia del secreto de token HKA (Vault)
            </label>
            <input
              type="text"
              required
              value={secretRef}
              onChange={(e) => setSecretRef(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-[#DCE3DF] p-3 text-xs font-mono text-[#52635A]"
            />
          </div>

          {/* Resultado de Prueba */}
          {testResult && (
            <div
              className={`rounded-2xl border p-4 text-xs font-semibold ${
                testResult.ok
                  ? 'border-[#86EFAC] bg-[#DCFCE7] text-[#14532D]'
                  : 'border-[#C83E3B] bg-[#FEF2F2] text-[#B91C1C]'
              }`}
            >
              {testResult.message}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-4 sm:flex-row">
            <button
              type="button"
              disabled={testing}
              onClick={handleTestConnection}
              className="flex-1 rounded-2xl border border-[#1E6B4E] bg-white py-3.5 text-xs font-bold uppercase tracking-wider text-[#1E6B4E] hover:bg-[#DCFCE7] disabled:opacity-50"
            >
              {testing ? 'Comprobando conexión...' : 'Probar conexión con API HKA'}
            </button>

            <button
              type="submit"
              className="flex-1 rounded-2xl bg-[#1E6B4E] py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-[#16523B]"
            >
              Guardar configuración fiscal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
