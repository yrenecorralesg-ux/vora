'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { VoraLogo } from '@/components/landing/vora-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type InvitationLink = { token_hash: string; type: string; invitation: string };

export default function ActivatePage() {
  const [link, setLink] = useState<InvitationLink | null>(null);
  const [step, setStep] = useState<'initial'|'password'|'invalid'>('initial');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const token_hash = fragment.get('token_hash'), type = fragment.get('type'), invitation = fragment.get('invitation');
    if (token_hash && type && invitation) {
      setLink({ token_hash, type, invitation });
      window.history.replaceState(null, '', window.location.pathname);
    } else setStep('invalid');
  }, []);
  async function confirmAccess() {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/auth/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(link) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setStep('password');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo confirmar el enlace.'); }
    finally { setBusy(false); }
  }
  async function accept(e: FormEvent) {
    e.preventDefault(); setError('');
    if (password !== confirmation) { setError('Las contraseñas no coinciden.'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/auth/accept-invitation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invitation: link?.invitation, password }) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      // Full navigation synchronizes AuthProvider with the server-set invitation session.
      window.location.assign(b.destination);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar el acceso.'); setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#F6F2E9] p-5 text-[#25332D]">
    <section className="w-full max-w-md space-y-5 rounded-3xl border bg-white p-8 shadow-sm">
      <VoraLogo height={40} />
      <h1 className="text-2xl font-bold text-[#285C49]">Activa tu acceso a VORA</h1>
      {step === 'invalid' ? <p>Abre el enlace completo del correo de invitación. Si venció o ya lo utilizaste, solicita un reenvío a Venesoft.</p> : step === 'initial' ? <>
        <p>Continúa para verificar la invitación e iniciar sesión con la cuenta que recibió el correo.</p>
        <p className="text-sm">Si tienes otra sesión abierta en este navegador, se sustituirá por la cuenta invitada.</p>
        <Button disabled={!link || busy} onClick={confirmAccess}>{busy ? 'Verificando…' : 'Continuar con mi invitación'}</Button>
      </> : <form onSubmit={accept} className="space-y-4">
        <p>Establece una contraseña de al menos 12 caracteres.</p>
        <p className="text-sm">Si ya usabas VORA, esta contraseña reemplaza la anterior para tu cuenta en todas tus empresas.</p>
        <Label htmlFor="new-password">Nueva contraseña</Label>
        <Input id="new-password" autoComplete="new-password" type="password" minLength={12} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} />
        <Label htmlFor="confirm-password">Repetir contraseña</Label>
        <Input id="confirm-password" autoComplete="new-password" type="password" minLength={12} maxLength={128} required value={confirmation} onChange={e => setConfirmation(e.target.value)} />
        <Button disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña y entrar'}</Button>
      </form>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Link className="block text-sm underline" href="/login">Ir a iniciar sesión</Link>
    </section>
  </main>;
}
