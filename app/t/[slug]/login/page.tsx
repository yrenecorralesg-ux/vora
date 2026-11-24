'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  KeyRound,
  AlertCircle,
  ArrowRight,
  Loader2,
  Mail,
} from 'lucide-react';

export default function TenantIsolatedLoginPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const [emailOrUser, setEmailOrUser] = useState('');
  const [passwordOrPin, setPasswordOrPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  // Cargar branding del tenant desde la API pública de branding
  useEffect(() => {
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
      router.replace(destUrl);
    } catch (err: any) {
      setError(err.message || 'Error de red al conectar con el servidor.');
      setLoading(false);
    }
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
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Identidad Corporativa del Tenant */}
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

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
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
                  Contraseña o PIN de Caja
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

          {/* Enlace al Portal General */}
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
