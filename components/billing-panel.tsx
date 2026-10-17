'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
interface Invoice {
  id: string;
  tenant_id: string;
  period_start: string;
  period_end: string;
  amount_usd: number;
  amount_ves: number;
  ves_per_usd: number;
  status: string;
  recipient: { bank_code: string; phone: string; tax_id: string };
}
interface Payment {
  id: string;
  invoice_id: string;
  reference: string;
  amount_ves: number;
  status: string;
  bank_code: string;
  phone: string;
  paid_on: string;
}
interface Plan {
  id: string;
  name: string;
  monthly_price_usd: number | null;
  infrastructure_mode: string;
  limits: Record<string, number>;
}
interface Data {
  today: string;
  rates?: {
    id: string;
    effective_date: string;
    ves_per_usd: number;
    source: string;
  }[];
  recipient?: { bank_code: string; phone: string; tax_id: string } | null;
  invoices: Invoice[];
  payments: Payment[];
  tenants?: { id: string; commercial_name: string }[];
  plans?: Plan[];
}
const inputClass = 'space-y-2';
function Field({
  label,
  name,
  type = 'text',
  value,
  onChange,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
}) {
  return (
    <div className={inputClass}>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        step={step}
      />
    </div>
  );
}
export function BillingPanel({ slug }: { slug?: string }) {
  const admin = !slug,
    endpoint = admin ? '/api/admin/billing' : `/api/t/${slug}/billing`;
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const [rate, setRate] = useState(''),
    [source, setSource] = useState(''),
    [bank, setBank] = useState(''),
    [phone, setPhone] = useState(''),
    [tax, setTax] = useState('');
  const [tenant, setTenant] = useState(''),
    [period, setPeriod] = useState(''),
    [invoice, setInvoice] = useState(''),
    [ref, setRef] = useState(''),
    [payBank, setPayBank] = useState(''),
    [payPhone, setPayPhone] = useState(''),
    [payDate, setPayDate] = useState(''),
    [amount, setAmount] = useState('');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [planId, setPlanId] = useState(''),
    [planName, setPlanName] = useState(''),
    [price, setPrice] = useState('15'),
    [mode, setMode] = useState('shared'),
    [limits, setLimits] = useState('{"max_users":2,"max_stores":1}');
  const load = useCallback(async () => {
    const r = await fetch(endpoint, { cache: 'no-store' });
    const b = await r.json();
    if (!r.ok) throw new Error(b.error);
    setData(b);
    setBank(b.recipient?.bank_code ?? '');
    setPhone(b.recipient?.phone ?? '');
    setTax(b.recipient?.tax_id ?? '');
    setPeriod((p) => p || b.today.slice(0, 7) + '-01');
    setPayDate((p) => p || b.today);
  }, [endpoint]);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);
  async function act(body: object) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setMessage(b.message ?? 'Guardado correctamente.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar.');
    } finally {
      setBusy(false);
    }
  }
  const submit = (f: () => void) => (e: FormEvent) => {
    e.preventDefault();
    f();
  };
  const card = 'space-y-4 rounded-xl border bg-white p-5';
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#285C49]">
          Suscripciones y Pago Móvil
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cargos de VORA en USD y pago en bolívares. Cada cargo conserva la tasa
          y los datos de recepción originales. La confirmación del pago es
          manual.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!data && !error && <p>Cargando…</p>}
      {data && (
        <>
          {admin && (
            <div className="grid gap-5 lg:grid-cols-2">
              <form
                className={card}
                onSubmit={submit(
                  () =>
                    void act({
                      action: 'rate',
                      ves_per_usd: Number(rate),
                      source,
                    }),
                )}
              >
                <h2 className="font-semibold">
                  Tasa del día · {data.today} · Venezuela
                </h2>
                <p className="text-sm">
                  {data.rates?.find((r) => r.effective_date === data.today)
                    ? 'La tasa de hoy ya está registrada.'
                    : 'Pendiente: registra la tasa antes de emitir cargos.'}
                </p>
                <Field
                  label="Bs por US$1"
                  name="rate"
                  type="number"
                  step="0.000001"
                  value={rate}
                  onChange={setRate}
                />
                <Field
                  label="Fuente o referencia de la tasa"
                  name="source"
                  value={source}
                  onChange={setSource}
                />
                <Button
                  disabled={
                    busy ||
                    !!data.rates?.some((r) => r.effective_date === data.today)
                  }
                >
                  Registrar tasa de hoy
                </Button>
              </form>
              <form
                className={card}
                onSubmit={submit(
                  () =>
                    void act({
                      action: 'recipient',
                      bank_code: bank,
                      phone,
                      tax_id: tax,
                    }),
                )}
              >
                <h2 className="font-semibold">Pago Móvil de Venesoft</h2>
                <Field
                  label="Código de banco (4 dígitos)"
                  name="bank"
                  value={bank}
                  onChange={setBank}
                />
                <Field
                  label="Teléfono (04XXXXXXXXX)"
                  name="phone"
                  value={phone}
                  onChange={setPhone}
                />
                <Field
                  label="RIF / documento del receptor"
                  name="tax"
                  value={tax}
                  onChange={setTax}
                />
                <Button disabled={busy}>Guardar receptor</Button>
              </form>
              <form
                className={card}
                onSubmit={submit(() => {
                  try {
                    const parsed: unknown = JSON.parse(limits);
                    void act({
                      action: 'plan',
                      id: planId || undefined,
                      name: planName,
                      monthly_price_usd: Number(price),
                      infrastructure_mode: mode,
                      limits: parsed,
                    });
                  } catch {
                    setError('Los límites deben ser un objeto JSON válido.');
                  }
                })}
              >
                <h2 className="font-semibold">Planes parametrizables</h2>
                <Label htmlFor="plan-edit">Crear o editar</Label>
                <select
                  id="plan-edit"
                  className="h-10 w-full rounded-md border"
                  value={planId}
                  onChange={(e) => {
                    setPlanId(e.target.value);
                    const p = data.plans?.find((p) => p.id === e.target.value);
                    setPlanName(p?.name ?? '');
                    setPrice(String(p?.monthly_price_usd ?? 15));
                    setMode(p?.infrastructure_mode ?? 'shared');
                    setLimits(
                      JSON.stringify(
                        p?.limits ?? { max_users: 2, max_stores: 1 },
                      ),
                    );
                  }}
                >
                  <option value="">Nuevo plan</option>
                  {data.plans?.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Field
                  label="Nombre del plan"
                  name="plan-name"
                  value={planName}
                  onChange={setPlanName}
                />
                <Field
                  label="Precio mensual USD"
                  name="plan-price"
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={setPrice}
                />
                <Label htmlFor="plan-mode">Modalidad</Label>
                <select
                  id="plan-mode"
                  className="h-10 w-full rounded-md border"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                >
                  <option value="shared">Shared</option>
                  <option value="dedicated">Dedicated</option>
                </select>
                <Field
                  label="Límites por clave (JSON)"
                  name="plan-limits"
                  value={limits}
                  onChange={setLimits}
                />
                <p className="text-xs text-muted-foreground">
                  Las cuotas se guardan para los módulos futuros. Cada módulo
                  deberá aplicar sus límites en servidor.
                </p>
                <Button disabled={busy}>Guardar plan</Button>
              </form>
              <form
                className={card}
                onSubmit={submit(
                  () =>
                    void act({
                      action: 'invoice',
                      tenant_id: tenant,
                      period_start: period,
                    }),
                )}
              >
                <h2 className="font-semibold">Emitir cargo mensual</h2>
                <Label htmlFor="invoice-tenant">Empresa</Label>
                <select
                  id="invoice-tenant"
                  required
                  className="h-10 w-full rounded-md border"
                  value={tenant}
                  onChange={(e) => setTenant(e.target.value)}
                >
                  <option value="">Seleccionar empresa</option>
                  {data.tenants?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.commercial_name}
                    </option>
                  ))}
                </select>
                <Field
                  label="Inicio del período mensual"
                  name="period"
                  type="date"
                  value={period}
                  onChange={setPeriod}
                />
                <p className="text-xs text-muted-foreground">
                  Se utiliza el precio del plan asignado y la tasa de hoy. Un
                  cargo no es una factura fiscal autorizada.
                </p>
                <Button disabled={busy}>Generar cargo</Button>
              </form>
            </div>
          )}
          <section className="space-y-3">
            <h2 className="font-semibold">Cargos recientes</h2>
            {data.invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay cargos emitidos.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2">Empresa / período</th>
                      <th>USD</th>
                      <th>Tasa Bs/US$</th>
                      <th>Bs</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoices.map((i) => (
                      <tr key={i.id} className="border-b">
                        <td className="p-2">
                          {data.tenants?.find((t) => t.id === i.tenant_id)
                            ?.commercial_name ?? i.id.slice(0, 8)}
                          <br />
                          {i.period_start} → {i.period_end}
                          {!admin && (
                            <p className="mt-1 text-xs">
                              Pago Móvil: {i.recipient.bank_code} ·{' '}
                              {i.recipient.phone} · {i.recipient.tax_id}
                            </p>
                          )}
                        </td>
                        <td>{Number(i.amount_usd).toFixed(2)}</td>
                        <td>{Number(i.ves_per_usd).toFixed(6)}</td>
                        <td>{Number(i.amount_ves).toFixed(2)}</td>
                        <td>{i.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {!admin && (
            <form
              className={card}
              onSubmit={submit(
                () =>
                  void act({
                    invoice_id: invoice,
                    reference: ref,
                    bank_code: payBank,
                    phone: payPhone,
                    paid_on: payDate,
                    amount_ves: Number(amount),
                  }),
              )}
            >
              <h2 className="font-semibold">Reportar Pago Móvil</h2>
              <Label htmlFor="pay-invoice">Cargo pendiente</Label>
              <select
                id="pay-invoice"
                required
                className="h-10 w-full rounded-md border"
                value={invoice}
                onChange={(e) => {
                  setInvoice(e.target.value);
                  setAmount(
                    String(
                      data.invoices.find((i) => i.id === e.target.value)
                        ?.amount_ves ?? '',
                    ),
                  );
                }}
              >
                <option value="">Seleccionar cargo</option>
                {data.invoices
                  .filter((i) => i.status === 'pending')
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.period_start} · Bs {i.amount_ves}
                    </option>
                  ))}
              </select>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Referencia bancaria"
                  name="pay-ref"
                  value={ref}
                  onChange={setRef}
                />
                <Field
                  label="Banco emisor (código de 4 dígitos)"
                  name="pay-bank"
                  value={payBank}
                  onChange={setPayBank}
                />
                <Field
                  label="Teléfono emisor"
                  name="pay-phone"
                  value={payPhone}
                  onChange={setPayPhone}
                />
                <Field
                  label="Fecha del pago"
                  name="pay-date"
                  type="date"
                  value={payDate}
                  onChange={setPayDate}
                />
                <Field
                  label="Monto pagado en Bs"
                  name="pay-amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={setAmount}
                />
              </div>
              <Button disabled={busy}>Reportar para revisión</Button>
            </form>
          )}
          <section className="space-y-3">
            <h2 className="font-semibold">Pagos reportados</h2>
            {data.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay pagos reportados.
              </p>
            ) : (
              data.payments.map((p) => (
                <div key={p.id} className="space-y-3 border-b py-4">
                  <p className="text-sm">
                    Referencia {p.reference} · Bs {p.amount_ves} · {p.status}
                  </p>
                  <p className="text-xs">
                    Banco {p.bank_code} · {p.phone} · {p.paid_on} · Cargo{' '}
                    {p.invoice_id.slice(0, 8)}
                  </p>
                  {admin && p.status === 'pending' && (
                    <>
                      <Label htmlFor={`note-${p.id}`}>
                        Resultado de la revisión bancaria
                      </Label>
                      <Input
                        id={`note-${p.id}`}
                        value={reviewNotes[p.id] ?? ''}
                        onChange={(e) =>
                          setReviewNotes({
                            ...reviewNotes,
                            [p.id]: e.target.value,
                          })
                        }
                      />
                      <div className="flex gap-2">
                        <Button
                          disabled={
                            busy || (reviewNotes[p.id]?.trim().length ?? 0) < 3
                          }
                          onClick={() =>
                            void act({
                              action: 'review',
                              payment_id: p.id,
                              approve: true,
                              note: reviewNotes[p.id],
                            })
                          }
                        >
                          Confirmar pago recibido
                        </Button>
                        <Button
                          variant="outline"
                          disabled={
                            busy || (reviewNotes[p.id]?.trim().length ?? 0) < 3
                          }
                          onClick={() =>
                            void act({
                              action: 'review',
                              payment_id: p.id,
                              approve: false,
                              note: reviewNotes[p.id],
                            })
                          }
                        >
                          Rechazar
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </section>
          {admin && !!data.rates?.length && (
            <section>
              <h2 className="font-semibold">Historial de tasas</h2>
              {data.rates.map((r) => (
                <p key={r.id} className="mt-2 text-sm">
                  {r.effective_date} · {r.ves_per_usd} Bs/US$ · {r.source}
                </p>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
