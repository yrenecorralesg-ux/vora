'use client';

import React, { useState } from 'react';
import {
  Zap,
  ArrowRight,
  User,
  MapPin,
  Package,
  CreditCard,
  DollarSign,
  ShoppingBag,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CrmHeader } from '@/components/crm-header';
import { ImagePlaceholder } from '@/components/image-placeholder';

export function CaptureView({
  tenantName,
  secondaryColor,
  ambientImage,
  slug,
}: {
  tenantName: string;
  secondaryColor: string;
  ambientImage?: string | null;
  slug: string;
}) {
  const [formData, setFormData] = useState({
    cliente: 'Laura Méndez',
    origen: 'Feria de Bogotá • Stand 12',
    producto: 'Difusor Home Fragrance + Vela Decorativa',
    valor: '$620.000',
    medioPago: 'Tarjeta',
  });

  const [submitted, setSubmitted] = useState(false);
  const isSolee = slug === 'solee';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
    }, 4000);
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header matching Screenshot 2 */}
      <CrmHeader
        tenantName={tenantName}
        title="Registro en feria"
        subtitle="El cliente escanea el QR mientras el equipo empaca su compra."
        ambientImageUrl={ambientImage}
        secondaryColor={secondaryColor}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Card: Escanea y deja tus datos */}
        <Card className="relative flex flex-col justify-between overflow-hidden rounded-2xl border-slate-100 bg-white p-6 sm:p-8 shadow-xs">
          <div className="relative z-10">
            <CardTitle className="text-center text-xl font-bold text-slate-900">
              Escanea y deja tus datos
            </CardTitle>

            {/* Stylized QR with focus brackets matching mockup */}
            <div className="relative mx-auto my-5 flex w-fit items-center justify-center rounded-2xl border-2 border-purple-200/50 bg-white/95 p-4 shadow-sm backdrop-blur-xs">
              {/* Corner brackets */}
              <div className="absolute -top-1.5 -left-1.5 h-5 w-5 rounded-tl-md border-t-3 border-l-3 border-[#5136db]" />
              <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-tr-md border-t-3 border-r-3 border-[#5136db]" />
              <div className="absolute -bottom-1.5 -left-1.5 h-5 w-5 rounded-bl-md border-b-3 border-l-3 border-[#5136db]" />
              <div className="absolute -bottom-1.5 -right-1.5 h-5 w-5 rounded-br-md border-b-3 border-r-3 border-[#5136db]" />

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  isSolee
                    ? '/solee/qr_feria.webp'
                    : `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=https://ekoscrm.app/t/${slug}/registro`
                }
                alt="QR Feria"
                className="h-40 w-40 rounded-lg object-contain"
              />
            </div>

            <div className="space-y-1.5 text-center">
              <p className="text-base font-bold text-slate-900">
                Nombre, celular y correo
              </p>
              <p className="text-xs text-slate-500">
                Consentimiento para novedades
              </p>
              <div className="mx-auto mt-2 flex w-fit items-center gap-1.5 rounded-full border border-purple-100/60 bg-white/90 px-3.5 py-1 text-xs font-semibold text-[#5136db] shadow-xs backdrop-blur-xs">
                <Zap className="h-3.5 w-3.5" />
                Alta inmediata en el CRM
              </div>
            </div>
          </div>

          {/* Background Image / Placeholder */}
          {isSolee ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 sm:h-72 overflow-hidden flex items-end justify-center select-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/solee/products_qr.png"
                alt="Productos SOLEÉ"
                className="w-full h-full object-cover object-bottom select-none"
                style={{
                  maskImage:
                    'linear-gradient(to top, black 50%, rgba(0,0,0,0.3) 80%, transparent 100%)',
                  WebkitMaskImage:
                    'linear-gradient(to top, black 50%, rgba(0,0,0,0.3) 80%, transparent 100%)',
                }}
              />
            </div>
          ) : (
            <div className="-mx-6 -mb-6 sm:-mx-8 sm:-mb-8 mt-6 overflow-hidden rounded-b-2xl flex items-end justify-center">
              <div className="p-6 sm:p-8 w-full">
                <ImagePlaceholder
                  aspectRatio="aspect-[16/7]"
                  label="Foto de productos en exhibición"
                  sublabel="Espacio para tu imagen (sin recorte forzado)"
                  objectFit="contain"
                />
              </div>
            </div>
          )}
        </Card>

        {/* Right Card: Registro de la venta por el equipo */}
        <Card className="flex flex-col justify-between rounded-2xl border-slate-100 bg-white p-6 sm:p-8 shadow-xs">
          <div>
            <CardTitle className="text-xl font-bold text-slate-900 mb-6">
              Registro de la venta por el equipo
            </CardTitle>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Cliente */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">
                  Cliente
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 h-4 w-4 text-purple-600" />
                  <Input
                    required
                    value={formData.cliente}
                    onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                    className="h-11 rounded-xl border-slate-200 bg-slate-50/40 pl-10 text-sm font-medium text-slate-900"
                    placeholder="Nombre del cliente"
                  />
                </div>
              </div>

              {/* Origen */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">
                  Origen
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-purple-600" />
                  <Input
                    required
                    value={formData.origen}
                    onChange={(e) => setFormData({ ...formData, origen: e.target.value })}
                    className="h-11 rounded-xl border-slate-200 bg-slate-50/40 pl-10 text-sm font-medium text-slate-900"
                    placeholder="Stand o canal"
                  />
                </div>
              </div>

              {/* Producto */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">
                  Producto
                </label>
                <div className="relative">
                  <Package className="absolute left-3.5 top-3.5 h-4 w-4 text-purple-600" />
                  <Input
                    required
                    value={formData.producto}
                    onChange={(e) => setFormData({ ...formData, producto: e.target.value })}
                    className="h-11 rounded-xl border-slate-200 bg-slate-50/40 pl-10 text-sm font-medium text-slate-900"
                    placeholder="Nombre del producto o pack"
                  />
                </div>
              </div>

              {/* Valor de la compra */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">
                  Valor de la compra
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3.5 top-3.5 h-4 w-4 text-purple-600" />
                  <Input
                    required
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                    className="h-11 rounded-xl border-slate-200 bg-slate-50/40 pl-10 text-sm font-bold text-slate-900"
                    placeholder="$0"
                  />
                </div>
              </div>

              {/* Medio de pago */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">
                  Medio de pago
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3.5 top-3.5 h-4 w-4 text-purple-600" />
                  <Input
                    required
                    value={formData.medioPago}
                    onChange={(e) => setFormData({ ...formData, medioPago: e.target.value })}
                    className="h-11 rounded-xl border-slate-200 bg-slate-50/40 pl-10 text-sm font-medium text-slate-900"
                    placeholder="Tarjeta, Efectivo o Transferencia"
                  />
                </div>
              </div>

              {/* Feedback toast message */}
              {submitted && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Venta de {formData.valor} vinculada con éxito a {formData.cliente} en el CRM.</span>
                </div>
              )}

              {/* Submit CTA */}
              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl bg-[#5136db] hover:bg-[#432bc2] text-white font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>Vincular compra al cliente</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
