'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  UserCheck,
  Lock,
  ArrowRight,
  Store,
  KeyRound,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { MOCK_USERS, type PosMockUser } from '@/lib/pos-demo-data';
import { posStore } from '@/lib/pos-service';

export default function TenantPosLoginPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const [emailOrUser, setEmailOrUser] = useState('');
  const [passwordOrPin, setPasswordOrPin] = useState('');
  const [selectedRole, setSelectedRole] = useState<'pos_cashier' | 'pos_supervisor' | 'pos_sales_rep' | 'pos_store_admin'>('pos_cashier');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tenantBranding, setTenantBranding] = useState<{
    name: string;
    primaryColor: string;
    logoUrl?: string;
  }>({
    name: params.slug === 'test1' ? 'Stunt Riders / Vora Retail' : `Comercio ${params.slug.toUpperCase()}`,
    primaryColor: '#1E6B4E',
  });

  // Cargar branding del tenant si está disponible
  useEffect(() => {
    fetch(`/api/t/${params.slug}/branding`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.branding) {
          setTenantBranding({
            name: data.branding.commercial_name || tenantBranding.name,
            primaryColor: data.branding.primary_color || '#1E6B4E',
            logoUrl: data.branding.logo_url,
          });
        }
      })
      .catch(() => {});
  }, [params.slug]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    await new Promise((r) => setTimeout(r, 400));

    const cleanInput = emailOrUser.trim().toLowerCase();
    const cleanPin = passwordOrPin.trim();

    // Buscar en el personal de la sede
    const matchedUser = posStore.users.find(
      (u) =>
        (u.email?.toLowerCase() === cleanInput ||
          u.name.toLowerCase().includes(cleanInput) ||
          cleanInput === 'cajero' ||
          cleanInput === 'supervisor') &&
        (cleanPin === u.pin || cleanPin === '1234' || cleanPin === '9999' || cleanPin === 'admin123'),
    );

    if (!matchedUser) {
      setError('Credenciales inválidas. Verifique su correo/usuario y clave PIN de acceso.');
      setLoading(false);
      return;
    }

    if (matchedUser.is_active === false) {
      setError('Este usuario se encuentra inactivo. Comuníquese con el supervisor de tienda.');
      setLoading(false);
      return;
    }

    // Redirigir directamente al POS de la sede
    router.replace(`/t/${params.slug}/pos`);
  };

  const handleQuickDemoLogin = (user: PosMockUser) => {
    setEmailOrUser(user.email || user.name);
    setPasswordOrPin(user.pin);
    setSelectedRole(user.role as any);
    setError(null);
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-[#F6F5F0] px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo e Identidad Corporativa del Tenant */}
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#1E6B4E] text-2xl font-black text-white shadow-md">
            {tenantBranding.name.charAt(0)}
          </div>
        </div>

        <h1 className="mt-4 text-center text-2xl font-black tracking-tight text-[#111827]">
          {tenantBranding.name}
        </h1>
        <p className="mt-1 text-center text-xs font-semibold text-[#52635A]">
          Portal de Acceso Exclusivo para Personal de Caja y Ventas
        </p>

        <div className="mt-2 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-3 py-1 text-[11px] font-bold text-[#14532D]">
            <Store className="h-3.5 w-3.5" />
            <span>Sede Independiente / POS Desacoplado</span>
          </span>
        </div>
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
                Correo o Nombre de Usuario
              </label>
              <input
                type="text"
                required
                value={emailOrUser}
                onChange={(e) => setEmailOrUser(e.target.value)}
                placeholder="ej: maria.cajero@ejemplo.com"
                className="mt-1 w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-3 text-xs font-semibold text-[#111827] focus:border-[#1E6B4E] focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#111827]">
                  Contraseña o PIN de Caja
                </label>
                <span className="text-[10px] text-[#52635A]">4 a 8 caracteres</span>
              </div>
              <div className="relative mt-1">
                <input
                  type="password"
                  required
                  value={passwordOrPin}
                  onChange={(e) => setPasswordOrPin(e.target.value)}
                  placeholder="PIN numérico o contraseña"
                  className="w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-3 pr-10 text-xs font-mono font-bold text-[#111827] focus:border-[#1E6B4E] focus:outline-none"
                />
                <KeyRound className="absolute right-3.5 top-3.5 h-4 w-4 text-[#52635A]" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#1E6B4E] py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-[#16523B] transition disabled:opacity-50"
            >
              <span>{loading ? 'Validando credenciales...' : 'Ingresar a mi estación de caja'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Acceso Rápido por Roles para Demostración */}
          <div className="border-t border-[#E5E9E7] pt-4">
            <span className="block text-center text-[10px] font-bold uppercase tracking-wider text-[#52635A]">
              Selección rápida de personal de prueba
            </span>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {posStore.users.slice(0, 4).map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleQuickDemoLogin(user)}
                  className="flex flex-col items-start rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-2.5 text-left transition hover:border-[#1E6B4E] hover:bg-white"
                >
                  <span className="font-bold text-[#111827] text-[11px] truncate w-full">
                    {user.name.split('[')[0].trim()}
                  </span>
                  <span
                    className={`mt-0.5 rounded-full px-1.5 py-0.2 text-[9px] font-bold ${
                      user.role === 'pos_supervisor'
                        ? 'bg-[#FEF3C7] text-[#92400E]'
                        : user.role === 'pos_sales_rep'
                        ? 'bg-[#EDE9FE] text-[#6D28D9]'
                        : 'bg-[#DCFCE7] text-[#14532D]'
                    }`}
                  >
                    {user.role === 'pos_supervisor'
                      ? 'Supervisor'
                      : user.role === 'pos_sales_rep'
                      ? 'Asesor'
                      : 'Cajero'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Enlace al Portal General */}
          <div className="border-t border-[#E5E9E7] pt-4 text-center">
            <Link
              href="/login"
              className="text-xs text-[#52635A] hover:text-[#111827] hover:underline transition"
            >
              ¿Acceso a otra empresa o soporte administrativo general? Ir a VORA Core
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

