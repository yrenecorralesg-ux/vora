'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  KeyRound,
  AlertCircle,
  ArrowRight,
  Loader2,
  Mail,
  WifiOff,
  UserCheck,
} from 'lucide-react';
import { SwRegister } from '@/components/sw-register';
import { loadOfflineSnapshot } from '@/lib/pos-offline-db';
import { verifyPinAndUnlockKey, type OfflineOperatorInfo } from '@/lib/pos-offline-crypto';

export default function TenantIsolatedLoginPage({ params }: { params: { slug: string } }) {
  const [emailOrUser, setEmailOrUser] = useState('');
  const [passwordOrPin, setPasswordOrPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [isOffline, setIsOffline] = useState(false);
  const [offlineOps, setOfflineOps] = useState<OfflineOperatorInfo[]>([]);
  const [selectedOpId, setSelectedOpId] = useState('');
  const [offlinePin, setOfflinePin] = useState('');
  const [unlockingOffline, setUnlockingOffline] = useState(false);

  const [tenantBranding, setTenantBranding] = useState<{
    name: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontFamily: string;
    logoUrl?: string | null;
  }>({
    name: params.slug === 'test1' ? 'Stunt Riders / Vora' : params.slug.toUpperCase(),
    primaryColor: '#1E6B4E',
    secondaryColor: '#A9BEA5',
    accentColor: '#C97857',
    fontFamily: 'Poppins',
    logoUrl: null,
  });

  useEffect(() => {
    const updateConn = () => setIsOffline(typeof navigator !== 'undefined' && !navigator.onLine);
    updateConn();
    window.addEventListener('online', updateConn);
    window.addEventListener('offline', updateConn);

    loadOfflineSnapshot(params.slug)
      .then((snap) => {
        if (!snap) return;
        const ready = (snap.offlineOperators || []).filter((o) => o.offline_pin_ready && o.offline_bundle);
        setOfflineOps(ready);
        if (ready.length > 0) setSelectedOpId(ready[0].id);
        if (snap.tenantMeta) {
          setTenantBranding((prev) => ({
            ...prev,
            name: snap.tenantMeta.tenantName || prev.name,
            primaryColor: snap.tenantMeta.tenantBranding?.primaryColor || prev.primaryColor,
            secondaryColor: snap.tenantMeta.tenantBranding?.secondaryColor || prev.secondaryColor,
            accentColor: snap.tenantMeta.tenantBranding?.accentColor || prev.accentColor,
            fontFamily: snap.tenantMeta.tenantBranding?.fontFamily || prev.fontFamily,
            logoUrl: snap.tenantMeta.tenantBranding?.logoUrl ?? prev.logoUrl,
          }));
        }
      })
      .catch(() => {});

    fetch(`/api/t/${params.slug}/branding`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.branding) {
          setTenantBranding({
            name: data.branding.commercial_name || data.tenant?.commercial_name || params.slug.toUpperCase(),
            primaryColor: data.branding.primary_color || '#1E6B4E',
            secondaryColor: data.branding.secondary_color || '#A9BEA5',
            accentColor: data.branding.accent_color || '#C97857',
            fontFamily: data.branding.font_family || 'Poppins',
            logoUrl: data.branding.logo_url || null,
          });
        }
      })
      .catch(() => {});

    return () => {
      window.removeEventListener('online', updateConn);
      window.removeEventListener('offline', updateConn);
    };
  }, [params.slug]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const emailClean = emailOrUser.trim().toLowerCase();
    const passwordClean = passwordOrPin.trim();

    try {
      const res = await fetch(`/api/t/${params.slug}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailClean,
          password: passwordClean,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error || 'Credenciales inválidas o sin acceso a esta empresa.');
        setLoading(false);
        return;
      }

      const destUrl = data.redirect_url || `/t/${params.slug}`;
      window.location.href = destUrl;
    } catch (err: any) {
      setError(err.message || 'Error de red al conectar con el servidor.');
      setLoading(false);
    }
  };

  const handleOfflineUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const op = offlineOps.find((o) => o.id === selectedOpId);
    if (!op) {
      setError('Selecciona un operador con PIN offline habilitado.');
      return;
    }
    setUnlockingOffline(true);
    const check = await verifyPinAndUnlockKey({
      slug: params.slug,
      userId: op.id,
      bundle: op.offline_bundle,
      pin: offlinePin,
    });
    setUnlockingOffline(false);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    try {
      sessionStorage.setItem(
        `vora_pos_offline_unlock_${params.slug}`,
        JSON.stringify({ userId: op.id, at: Date.now() }),
      );
    } catch {
      // Ignorar
    }
    window.location.href = `/t/${params.slug}/pos`;
  };

  const primary = tenantBranding.primaryColor;
  const secondary = tenantBranding.secondaryColor;

  return (
    <div
      data-tenant-root
      className="flex min-h-screen flex-col justify-center bg-[#F6F5F0] px-4 py-12 sm:px-6 lg:px-8"
      style={{
        '--crm-primary': primary,
        '--crm-secondary': secondary,
        fontFamily: tenantBranding.fontFamily,
      } as React.CSSProperties}
    >
      <SwRegister />
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          {tenantBranding.logoUrl ? (
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-white shadow-md p-1 border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tenantBranding.logoUrl} alt={tenantBranding.name} className="h-full w-full object-contain" />
            </div>
          ) : (
            <div
              className="flex h-16 w-16 items-center justify-center rounded-3xl text-2xl font-black text-white shadow-md uppercase"
              style={{ backgroundColor: primary }}
            >
              {tenantBranding.name.charAt(0)}
            </div>
          )}
        </div>

        <h1 className="mt-4 text-center text-2xl font-black tracking-tight text-[#111827]">
          {tenantBranding.name}
        </h1>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md space-y-4">
        {isOffline && offlineOps.length > 0 && (
          <div className="rounded-3xl border border-[#FDE68A] bg-[#FFFBEB] p-6 shadow-md space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-[#92400E]">
              <WifiOff className="h-4 w-4 shrink-0" />
              <span>Sin conexión · Desbloqueo rápido de caja POS</span>
            </div>
            <form onSubmit={handleOfflineUnlock} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#92400E]">
                  Operador
                </label>
                <div className="relative mt-1">
                  <select
                    value={selectedOpId}
                    onChange={(e) => setSelectedOpId(e.target.value)}
                    className="w-full rounded-2xl border border-[#FDE68A] bg-white p-3 pl-10 text-xs font-bold text-[#111827]"
                  >
                    {offlineOps.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.name} ({op.role})
                      </option>
                    ))}
                  </select>
                  <UserCheck className="absolute left-3.5 top-3.5 h-4 w-4 text-[#92400E]" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#92400E]">
                  PIN de Caja (4–8 dígitos)
                </label>
                <div className="relative mt-1">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    required
                    value={offlinePin}
                    onChange={(e) => setOfflinePin(e.target.value)}
                    placeholder="••••"
                    className="w-full rounded-2xl border border-[#FDE68A] bg-white p-3 pl-10 text-xs font-mono font-bold tracking-widest text-[#111827]"
                  />
                  <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-[#92400E]" />
                </div>
              </div>
              <button
                type="submit"
                disabled={unlockingOffline}
                className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm disabled:opacity-50"
                style={{ backgroundColor: primary }}
              >
                <span>{unlockingOffline ? 'Verificando PIN...' : 'Abrir POS sin conexión'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        <div className="rounded-3xl border border-[#DCE3DF] bg-white p-8 shadow-xl space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-2xl border border-[#FCA5A5] bg-[#FEF2F2] p-3 text-xs text-[#991B1B]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
                Correo Electrónico
              </label>
              <div className="relative mt-1">
                <input
                  type="email"
                  required
                  value={emailOrUser}
                  onChange={(e) => setEmailOrUser(e.target.value)}
                  placeholder="ej: usuario@empresa.com"
                  className="w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-3 pl-10 text-xs font-semibold text-[#111827] focus:outline-none focus:ring-2 focus:ring-offset-1"
                  style={{
                    borderColor: '#DCE3DF',
                  }}
                />
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-[#52635A]" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
                  Contraseña de acceso
                </label>
                <span className="text-[10px] text-[#52635A]">Mínimo 6 caracteres</span>
              </div>
              <div className="relative mt-1">
                <input
                  type="password"
                  required
                  value={passwordOrPin}
                  onChange={(e) => setPasswordOrPin(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-3 pl-10 pr-10 text-xs font-mono font-bold text-[#111827] focus:outline-none focus:ring-2 focus:ring-offset-1"
                />
                <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-[#52635A]" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-md transition disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: primary }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verificando membresía...</span>
                </>
              ) : (
                <>
                  <span>Ingresar a la empresa</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="border-t border-[#E5E9E7] pt-4 text-center">
            <Link
              href="/login"
              className="text-xs text-[#52635A] hover:text-[#111827] hover:underline transition"
            >
              ¿Acceso administrativo global? Ir a VORA Core
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
