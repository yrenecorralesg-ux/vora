'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { VoraLogo } from '@/components/landing/vora-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, AlertCircle, BarChart3, Loader2, ShieldCheck, Users } from 'lucide-react';

const highlights = [
  { icon: BarChart3, text: 'Ventas, inventario y finanzas conectados.' },
  { icon: Users, text: 'Cada empresa con su espacio y su equipo.' },
  { icon: ShieldCheck, text: 'Acceso seguro con permisos por rol.' },
];

const inputClass =
  'h-12 rounded-xl border-[#DCE3D6] bg-[#FBF9F4] text-[#25332D] placeholder:text-[#8A968E] focus-visible:ring-[#285C49] focus-visible:ring-offset-0';

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Si ya hay una sesion activa, redirigir al panel.
  useEffect(() => {
    if (!loading && user) {
      void fetch('/api/auth/destination', { cache: 'no-store' })
        .then((response) => response.json())
        .then((payload: { destination?: string }) => router.replace(payload.destination ?? '/access-pending'))
        .catch(() => router.replace('/access-pending'));
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error } = await signIn(email.trim(), password);

    if (error) {
      setError(error);
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/destination', { cache: 'no-store' });
      const payload = (await response.json()) as { destination?: string };
      if (!response.ok || !payload.destination) {
        setError('La sesión se creó, pero no se pudo determinar tu acceso.');
        setSubmitting(false);
        return;
      }
      router.replace(payload.destination);
    } catch {
      setError('No se pudo completar el acceso. Inténtalo nuevamente.');
      setSubmitting(false);
    }
  };

  // Mientras se resuelve la sesion inicial, evitamos flashear el formulario.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F2E9]">
        <Loader2 className="h-8 w-8 animate-spin text-[#285C49]" aria-label="Cargando" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F6F2E9] font-inter text-[#25332D]">
      {/* Panel de marca (escritorio) */}
      <aside className="relative hidden w-[46%] max-w-2xl flex-col justify-between overflow-hidden bg-[#285C49] p-12 text-[#F6F2E9] lg:flex">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#A9BEA5]/25 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-[#C97857]/20 blur-3xl" />

        <Link href="/" aria-label="VORA by Venesoft, inicio" className="relative w-max rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6F2E9]">
          <VoraLogo tone="cream" height={36} priority />
        </Link>

        <div className="relative max-w-md">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E9DCC8]">Plataforma empresarial</p>
          <h2 className="mt-4 font-jakarta text-4xl font-extrabold leading-[1.1] tracking-[-0.03em]">
            Tu negocio tiene grandes ideas. <span className="text-[#E9DCC8]">VORA las ayuda a crecer.</span>
          </h2>
          <ul className="mt-10 space-y-4">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[#DCE6D9]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#F6F2E9]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-[#C9D6C5]">VORA by Venesoft · Tecnología con propósito</p>
      </aside>

      {/* Formulario */}
      <main className="relative flex flex-1 flex-col items-center justify-center px-5 py-12 sm:px-8">
        <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-[#E9DCC8]/60 blur-3xl lg:hidden" />

        <div className="relative w-full max-w-md">
          <div className="mb-8 flex justify-center lg:hidden">
            <Link href="/" aria-label="VORA by Venesoft, inicio" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#285C49]">
              <VoraLogo height={44} priority />
            </Link>
          </div>

          <div className="rounded-[1.75rem] border border-[#E2DACB] bg-white p-7 shadow-xl shadow-[#25332D]/10 sm:p-10">
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A4573A]">Acceso</p>
              <h1 className="mt-2 font-jakarta text-3xl font-extrabold tracking-[-0.02em] text-[#285C49]">Iniciar sesión</h1>
              <p className="mt-2 text-sm text-[#52675A]">Accede a tu panel de VORA.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[#25332D]">
                  Correo electrónico
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="tu@empresa.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-[#25332D]">
                  Contraseña
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  className={inputClass}
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-[#E9C9B8] bg-[#FBF1EA] px-3 py-2.5 text-sm text-[#8A4528]"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="h-12 w-full rounded-full bg-[#285C49] font-semibold text-white hover:bg-[#1F4A3A] focus-visible:ring-[#285C49]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  <>
                    Ingresar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Enlaces secundarios */}
            <div className="mt-8 space-y-3 border-t border-[#EFE8DC] pt-6">
              <Link
                href="/#contacto"
                className="flex items-center justify-center gap-2 rounded-full text-sm font-semibold text-[#285C49] transition-colors hover:text-[#1F4A3A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#285C49]"
              >
                Solicitar demostración
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/"
                className="flex items-center justify-center gap-2 rounded-full text-sm text-[#52675A] transition-colors hover:text-[#25332D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#285C49]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver al inicio
              </Link>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-[#52675A] lg:hidden">VORA by Venesoft</p>
        </div>
      </main>
    </div>
  );
}
