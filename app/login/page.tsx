'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { EkosLogo } from '@/components/ekos-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

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
      <div className="min-h-screen bg-navy-gradient flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/80" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-gradient flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Acentos de fondo turquesa */}
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl" style={{ background: '#63DCE5' }} />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full blur-3xl" style={{ background: '#00AFEF' }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" aria-label="Volver al inicio">
            <EkosLogo textClassName="text-white" />
          </Link>
        </div>

        {/* Tarjeta de acceso */}
        <div className="rounded-2xl bg-white shadow-2xl p-8 sm:p-10">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Iniciar sesion</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Accede a tu panel de EKOSCRM
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">
                Email
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
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">
                Contrasena
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
                className="bg-background"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
              >
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
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
          <div className="mt-8 pt-6 border-t border-border space-y-3">
            <Link
              href="/#contacto"
              className="flex items-center justify-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Solicitar demo
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/"
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver al inicio
            </Link>
          </div>
        </div>

        {/* Pie */}
        <p className="mt-6 text-center text-xs text-white/60">
          EKOSCRM por EKOS Solutions
        </p>
      </div>
    </div>
  );
}
