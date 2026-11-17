'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2, Truck } from 'lucide-react';

interface SupplierDialogProps {
  slug: string;
  secondaryColor?: string;
  supplierToEdit?: any;
  triggerButton?: React.ReactNode;
}

export function SupplierDialog({
  slug,
  secondaryColor = '#285C49',
  supplierToEdit,
  triggerButton,
}: SupplierDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState(supplierToEdit?.name ?? '');
  const [code, setCode] = useState(supplierToEdit?.code ?? '');
  const [taxId, setTaxId] = useState(supplierToEdit?.tax_id ?? '');
  const [category, setCategory] = useState(supplierToEdit?.category ?? 'materia_prima');
  const [contactName, setContactName] = useState(supplierToEdit?.contact_name ?? '');
  const [email, setEmail] = useState(supplierToEdit?.email ?? '');
  const [phone, setPhone] = useState(supplierToEdit?.phone ?? '');
  const [address, setAddress] = useState(supplierToEdit?.address ?? '');
  const [city, setCity] = useState(supplierToEdit?.city ?? '');
  const [paymentDays, setPaymentDays] = useState(
    supplierToEdit?.terms?.[0]?.payment_terms_days ?? supplierToEdit?.terms?.payment_terms_days ?? '0',
  );
  const [currency, setCurrency] = useState(
    supplierToEdit?.terms?.[0]?.currency ?? supplierToEdit?.terms?.currency ?? 'USD',
  );
  const [creditLimit, setCreditLimit] = useState(
    supplierToEdit?.terms?.[0]?.credit_limit ?? supplierToEdit?.terms?.credit_limit ?? '',
  );
  const [leadTime, setLeadTime] = useState(
    supplierToEdit?.terms?.[0]?.lead_time_days ?? supplierToEdit?.terms?.lead_time_days ?? '',
  );
  const [paymentMethod, setPaymentMethod] = useState(
    supplierToEdit?.terms?.[0]?.preferred_payment_method ?? supplierToEdit?.terms?.preferred_payment_method ?? 'transfer',
  );
  const [bankName, setBankName] = useState(
    supplierToEdit?.terms?.[0]?.bank_details?.bank_name ?? supplierToEdit?.terms?.bank_details?.bank_name ?? '',
  );
  const [bankAccount, setBankAccount] = useState(
    supplierToEdit?.terms?.[0]?.bank_details?.account_number ?? supplierToEdit?.terms?.bank_details?.account_number ?? '',
  );
  const [notes, setNotes] = useState(supplierToEdit?.notes ?? '');

  const isEditing = Boolean(supplierToEdit?.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre o razón social es requerido.');
      return;
    }

    setLoading(true);

    const payload = {
      name: name.trim(),
      code: code.trim() || null,
      tax_id: taxId.trim() || null,
      category,
      contact_name: contactName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      city: city.trim() || null,
      payment_terms_days: parseInt(String(paymentDays), 10) || 0,
      currency,
      credit_limit: parseFloat(String(creditLimit)) || 0,
      lead_time_days: parseInt(String(leadTime), 10) || 0,
      preferred_payment_method: paymentMethod,
      bank_details: {
        bank_name: bankName.trim(),
        account_number: bankAccount.trim(),
      },
      notes: notes.trim() || null,
    };

    try {
      const url = isEditing
        ? `/api/t/${slug}/warehouse/suppliers/${supplierToEdit.id}`
        : `/api/t/${slug}/warehouse/suppliers`;

      const res = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar proveedor.');
      }

      setOpen(false);
      if (!isEditing) {
        setName('');
        setCode('');
        setTaxId('');
        setContactName('');
        setEmail('');
        setPhone('');
        setAddress('');
        setCity('');
        setNotes('');
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button
            size="sm"
            className="rounded-xl text-white text-xs h-9"
            style={{ backgroundColor: secondaryColor }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nuevo proveedor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto rounded-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Truck className="h-5 w-5" style={{ color: secondaryColor }} />
              {isEditing ? 'Editar Proveedor' : 'Registrar Nuevo Proveedor'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Ingresa los datos generales, de contacto y condiciones comerciales del proveedor.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          <div className="grid gap-3 py-4 text-xs">
            {/* Fila 1: Nombre y Código */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="supName" className="font-semibold text-slate-700">
                  Razón Social / Nombre *
                </Label>
                <Input
                  id="supName"
                  placeholder="Ej. Distribuidora Los Andes C.A."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="supCode" className="font-semibold text-slate-700">
                  Código
                </Label>
                <Input
                  id="supCode"
                  placeholder="Ej. PROV-001"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Fila 2: RIF / Tax ID y Categoría */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="supTaxId" className="font-semibold text-slate-700">
                  RIF / Identificación Fiscal
                </Label>
                <Input
                  id="supTaxId"
                  placeholder="Ej. J-12345678-9"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="supCat" className="font-semibold text-slate-700">
                  Categoría
                </Label>
                <select
                  id="supCat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs shadow-xs"
                >
                  <option value="materia_prima">Materia Prima</option>
                  <option value="empaque">Material de Empaque</option>
                  <option value="insumo">Insumos y Repuestos</option>
                  <option value="servicios">Servicios / Logística</option>
                  <option value="general">General / Otro</option>
                </select>
              </div>
            </div>

            {/* Fila 3: Contacto, Email, Teléfono */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="supContact" className="font-semibold text-slate-700">
                  Persona de Contacto
                </Label>
                <Input
                  id="supContact"
                  placeholder="Ej. Carlos Mendoza"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="supEmail" className="font-semibold text-slate-700">
                  Correo Electrónico
                </Label>
                <Input
                  id="supEmail"
                  type="email"
                  placeholder="ventas@proveedor.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="supPhone" className="font-semibold text-slate-700">
                  Teléfono
                </Label>
                <Input
                  id="supPhone"
                  placeholder="+58 412 1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Fila 4: Dirección y Ciudad */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="supAddress" className="font-semibold text-slate-700">
                  Dirección
                </Label>
                <Input
                  id="supAddress"
                  placeholder="Zona Industrial Los Galpones, Galpón 4"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="supCity" className="font-semibold text-slate-700">
                  Ciudad
                </Label>
                <Input
                  id="supCity"
                  placeholder="Valencia / Caracas"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Separador de Términos Comerciales */}
            <div className="pt-2 border-t border-slate-100">
              <p className="font-bold text-[11px] uppercase tracking-wider text-slate-400 mb-2">
                Condiciones Comerciales y de Pago
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="supTerms" className="font-semibold text-slate-700">
                    Plazo de Pago (Días)
                  </Label>
                  <select
                    id="supTerms"
                    value={paymentDays}
                    onChange={(e) => setPaymentDays(e.target.value)}
                    className="w-full h-9 px-2 rounded-md border border-input bg-background text-xs shadow-xs"
                  >
                    <option value="0">Contado (0 días)</option>
                    <option value="7">7 días</option>
                    <option value="15">15 días</option>
                    <option value="30">30 días</option>
                    <option value="45">45 días</option>
                    <option value="60">60 días</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="supCur" className="font-semibold text-slate-700">
                    Moneda
                  </Label>
                  <select
                    id="supCur"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full h-9 px-2 rounded-md border border-input bg-background text-xs shadow-xs"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="VES">VES (Bs.)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="COP">COP ($)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="supCredit" className="font-semibold text-slate-700">
                    Límite Crédito
                  </Label>
                  <Input
                    id="supCredit"
                    type="number"
                    placeholder="Ej. 5000"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="supLead" className="font-semibold text-slate-700">
                    Entrega (Días)
                  </Label>
                  <Input
                    id="supLead"
                    type="number"
                    placeholder="Ej. 5"
                    value={leadTime}
                    onChange={(e) => setLeadTime(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Datos Bancarios */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="supMethod" className="font-semibold text-slate-700">
                  Método Preferido
                </Label>
                <select
                  id="supMethod"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full h-9 px-2 rounded-md border border-input bg-background text-xs shadow-xs"
                >
                  <option value="transfer">Transferencia Bancaria</option>
                  <option value="pago_movil">Pago Móvil</option>
                  <option value="zelle">Zelle / Dólares</option>
                  <option value="cash">Efectivo / Divisas</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="supBank" className="font-semibold text-slate-700">
                  Banco Destino
                </Label>
                <Input
                  id="supBank"
                  placeholder="Ej. Banesco / Mercantil"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="supAccount" className="font-semibold text-slate-700">
                  Cuenta / Teléfono
                </Label>
                <Input
                  id="supAccount"
                  placeholder="0134-XXXX-XXXX-XXXX"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Notas */}
            <div className="space-y-1">
              <Label htmlFor="supNotes" className="font-semibold text-slate-700">
                Observaciones Adicionales
              </Label>
              <Textarea
                id="supNotes"
                placeholder="Observaciones sobre facturación, pedidos mínimos, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="rounded-xl text-white text-xs"
              style={{ backgroundColor: secondaryColor }}
            >
              {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {isEditing ? 'Guardar Cambios' : 'Registrar Proveedor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
