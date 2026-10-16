'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, CheckCircle2, Clock3, Mail, MessageSquareText, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { INTEREST_EVENT } from './interest-link';
import { CONTACT_EMAIL, CONTACT_MAILTO } from './landing-data';
import { SectionHeading, focusRing } from './landing-ui';

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

const emptyForm = { full_name: '', email: '', company: '', phone: '', interest: '', consent: true };

/** Demo request form. Posts to the existing /api/demo-requests endpoint (same payload and honeypot as before). */
export function DemoRequestSection() {
  const [formStatus, setFormStatus] = useState<FormStatus>('idle');
  const [formData, setFormData] = useState(emptyForm);
  const autoInterest = useRef('');

  useEffect(() => {
    const onInterest = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (!detail) return;
      const suggestion = `Me interesa: ${detail}`;
      setFormData((previous) => {
        const untouched = previous.interest.trim() === '' || previous.interest === autoInterest.current;
        if (!untouched) return previous;
        autoInterest.current = suggestion;
        return { ...previous, interest: suggestion };
      });
      setFormStatus((status) => (status === 'success' ? 'idle' : status));
    };
    window.addEventListener(INTEREST_EVENT, onInterest);
    return () => window.removeEventListener(INTEREST_EVENT, onInterest);
  }, []);

  const submitDemo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormStatus('submitting');
    try {
      const response = await fetch('/api/demo-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, website: '' }),
      });
      setFormStatus(response.ok ? 'success' : 'error');
      if (response.ok) {
        setFormData(emptyForm);
        autoInterest.current = '';
      }
    } catch {
      setFormStatus('error');
    }
  };

  return (
    <section aria-labelledby="contacto-title" id="contacto" className="scroll-mt-24 bg-[#E9DCC8]/45 py-20 lg:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div>
          <SectionHeading
            id="contacto-title"
            eyebrow="Solicitar demostración"
            title="Descubre cómo VORA puede ayudarte."
            description="Cuéntanos sobre tu negocio. Registraremos tu solicitud para que el equipo de Venesoft la revise y te contacte."
          />
          <ul className="mt-8 space-y-4 text-[#25332D]">
            <Point icon={<MessageSquareText className="h-5 w-5" aria-hidden="true" />}>Una conversación sobre tu operación, sin compromiso.</Point>
            <Point icon={<Clock3 className="h-5 w-5" aria-hidden="true" />}>Te mostramos lo que ya funciona y lo que viene en camino.</Point>
            <Point icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}>Usamos tus datos solo para responder a tu solicitud.</Point>
          </ul>
          <div className="mt-8 rounded-2xl bg-white/70 p-5">
            <p className="text-sm font-semibold text-[#25332D]">¿Prefieres escribirnos para recibir asesoría?</p>
            <a
              href={CONTACT_MAILTO}
              className={cn('mt-2 inline-flex items-center gap-2 rounded-full font-jakarta text-lg font-bold text-[#285C49] underline-offset-4 hover:underline', focusRing)}
            >
              <Mail className="h-5 w-5" aria-hidden="true" /> {CONTACT_EMAIL}
            </a>
          </div>
          <p className="mt-4 text-sm text-[#52675A]">No enviamos un correo automático de confirmación.</p>
        </div>

        <div className="rounded-[2rem] bg-white p-6 shadow-xl shadow-[#25332D]/10 sm:p-9">
          {formStatus === 'success' ? (
            <div role="status" className="py-12 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-[#285C49]" aria-hidden="true" />
              <h3 className="mt-5 font-jakarta text-2xl font-bold text-[#285C49]">Solicitud registrada</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#52675A]">
                Guardamos tus datos correctamente. El contacto posterior depende del equipo de Venesoft. Si lo necesitas, escríbenos a{' '}
                <a href={CONTACT_MAILTO} className="font-semibold text-[#285C49] underline-offset-4 hover:underline">{CONTACT_EMAIL}</a>.
              </p>
              <button type="button" onClick={() => setFormStatus('idle')} className={cn('mt-6 rounded-full px-5 py-2.5 text-sm font-semibold text-[#285C49] hover:bg-[#E6EBDF]', focusRing)}>
                Enviar otra solicitud
              </button>
            </div>
          ) : (
            <form onSubmit={submitDemo} className="space-y-5" aria-describedby="demo-form-note">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Nombre completo" id="full_name" required>
                  <Input id="full_name" name="full_name" autoComplete="name" required minLength={2} maxLength={120} value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
                </Field>
                <Field label="Correo electrónico" id="email" required>
                  <Input id="email" name="email" type="email" autoComplete="email" required maxLength={254} value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Empresa" id="company">
                  <Input id="company" name="company" autoComplete="organization" maxLength={160} value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} />
                </Field>
                <Field label="Teléfono" id="phone">
                  <Input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={40} value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </Field>
              </div>
              <Field label="¿Qué te interesa explorar?" id="interest">
                <Textarea
                  id="interest"
                  name="interest"
                  rows={4}
                  maxLength={1200}
                  value={formData.interest}
                  onChange={(e) => setFormData({ ...formData, interest: e.target.value })}
                  placeholder="Cuéntanos sobre tu operación o los módulos que te interesan."
                />
              </Field>
              <div className="flex items-start gap-3">
                <Checkbox id="consent" checked={formData.consent} onCheckedChange={(checked) => setFormData({ ...formData, consent: checked === true })} className="mt-0.5" />
                <Label htmlFor="consent" className="text-sm font-normal leading-5 text-[#52675A]">
                  Acepto ser contactado por Venesoft sobre VORA.
                </Label>
              </div>
              {formStatus === 'error' && (
                <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
                  No pudimos registrar la solicitud. Revisa los datos e inténtalo de nuevo.
                </p>
              )}
              <button
                type="submit"
                disabled={formStatus === 'submitting' || !formData.consent}
                className={cn('inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#285C49] px-6 py-4 font-semibold text-white transition hover:bg-[#1F4A3A] disabled:cursor-not-allowed disabled:opacity-60', focusRing)}
              >
                {formStatus === 'submitting' ? 'Registrando solicitud...' : 'Solicitar demostración'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <p id="demo-form-note" className="text-xs text-[#52675A]">Los campos marcados con * son obligatorios.</p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({ label, id, required, children }: { label: string; id: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <Label htmlFor={id} className="text-[#25332D]">
        {label}
        {required && <span aria-hidden="true" className="text-[#A4573A]"> *</span>}
      </Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Point({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#285C49] shadow-sm">{icon}</span>
      <span className="pt-2 leading-6">{children}</span>
    </li>
  );
}
