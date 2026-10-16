'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  Clock,
  Mail,
  Store,
  Package,
  Star,
  Users,
  MessageSquare,
  ShoppingCart,
  Send,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CrmHeader } from '@/components/crm-header';
import { ImagePlaceholder } from '@/components/image-placeholder';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export interface RepurchaseOpportunity {
  id: string;
  initials: string;
  avatarBg: string;
  name: string;
  img?: string;
  product: string;
  time: string;
  price: string;
  channel: string;
}

const OPPORTUNITIES: RepurchaseOpportunity[] = [
  {
    id: 'op1',
    initials: 'LM',
    avatarBg: 'bg-indigo-100 text-indigo-700',
    name: 'Laura Méndez',
    img: '/solee/prod_difusor.webp',
    product: 'Difusor Bosque',
    time: 'Hace 8 semanas',
    price: '$620.000',
    channel: 'Feria Bogotá',
  },
  {
    id: 'op2',
    initials: 'AP',
    avatarBg: 'bg-purple-100 text-purple-700',
    name: 'Andrea Pérez',
    img: '/solee/prod_esencia.webp',
    product: 'Esencia Calma',
    time: 'Hace 6 semanas',
    price: '$540.000',
    channel: 'Shopify',
  },
  {
    id: 'op3',
    initials: 'CR',
    avatarBg: 'bg-teal-100 text-teal-700',
    name: 'Carlos Rojas',
    img: '/solee/prod_vela.webp',
    product: 'Vela Ámbar',
    time: 'Hace 10 semanas',
    price: '$510.000',
    channel: 'WhatsApp',
  },
];

export function SegmentsView({
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
  const [activeFilter, setActiveFilter] = useState<'recompra' | 'todos'>('recompra');
  const [contactTarget, setContactTarget] = useState<RepurchaseOpportunity | null>(null);
  const [messageSent, setMessageSent] = useState(false);

  function handleSendMessage() {
    setMessageSent(true);
    setTimeout(() => {
      setMessageSent(false);
      setContactTarget(null);
    }, 1500);
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header matching Screenshot 3 */}
      <CrmHeader
        tenantName={tenantName}
        title="¿A quién contactar primero?"
        subtitle="Criterios por valor, producto, canal y fecha de última compra."
        ambientImageUrl={ambientImage}
        secondaryColor={secondaryColor}
      />

      {/* Filter pills row matching mockup */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs cursor-pointer hover:bg-slate-50">
          <span>💳 Compra ≥ $500.000</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs cursor-pointer hover:bg-slate-50">
          <Store className="h-3.5 w-3.5 text-[#5136db]" />
          <span>Canal: Feria</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs cursor-pointer hover:bg-slate-50">
          <Package className="h-3.5 w-3.5 text-[#5136db]" />
          <span>Producto: Difusor</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </div>

        <div
          onClick={() => setActiveFilter(activeFilter === 'recompra' ? 'todos' : 'recompra')}
          className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold shadow-xs cursor-pointer transition-all ${
            activeFilter === 'recompra'
              ? 'border-purple-300 bg-purple-50 text-[#5136db]'
              : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          <Star className={`h-3.5 w-3.5 ${activeFilter === 'recompra' ? 'text-[#5136db] fill-[#5136db]' : 'text-slate-400'}`} />
          <span>Recompra probable</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </div>
      </div>

      {/* 3 Mini KPI cards with charts matching mockup */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Card 1: Clientes encontrados */}
        <Card className="rounded-2xl border-slate-100 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-[#5136db]">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Clientes encontrados</p>
                <p className="text-2xl font-black text-slate-900">28</p>
              </div>
            </div>
            {/* Sparkline bars */}
            <div className="flex items-end gap-1 h-8">
              <div className="w-1.5 h-3 bg-purple-200 rounded-xs" />
              <div className="w-1.5 h-5 bg-purple-300 rounded-xs" />
              <div className="w-1.5 h-4 bg-purple-400 rounded-xs" />
              <div className="w-1.5 h-7 bg-[#5136db] rounded-xs" />
              <div className="w-1.5 h-8 bg-[#7d64f6] rounded-xs" />
            </div>
          </div>
        </Card>

        {/* Card 2: Sin contacto reciente */}
        <Card className="rounded-2xl border-slate-100 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-[#5136db]">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Sin contacto reciente</p>
                <p className="text-2xl font-black text-slate-900">6</p>
              </div>
            </div>
            {/* Sparkline bars */}
            <div className="flex items-end gap-1 h-8">
              <div className="w-1.5 h-2 bg-purple-200 rounded-xs" />
              <div className="w-1.5 h-3 bg-purple-300 rounded-xs" />
              <div className="w-1.5 h-5 bg-purple-400 rounded-xs" />
              <div className="w-1.5 h-6 bg-[#5136db] rounded-xs" />
            </div>
          </div>
        </Card>

        {/* Card 3: Posible reposición */}
        <Card className="rounded-2xl border-slate-100 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-[#5136db]">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Posible reposición</p>
                <p className="text-2xl font-black text-slate-900">9</p>
              </div>
            </div>
            {/* Sparkline wave */}
            <svg className="w-20 h-8 text-[#5136db]" viewBox="0 0 100 40" fill="none">
              <path
                d="M0 30 Q 25 35, 50 15 T 100 10"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M0 30 Q 25 35, 50 15 T 100 10 L 100 40 L 0 40 Z"
                fill="currentColor"
                fillOpacity="0.12"
              />
            </svg>
          </div>
        </Card>
      </div>

      {/* Repurchase Opportunities List matching mockup */}
      <Card className="rounded-2xl border-slate-100 bg-white shadow-xs p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">
          Oportunidades de recompra
        </h3>

        <div className="divide-y divide-slate-100">
          {OPPORTUNITIES.map((op) => (
            <div
              key={op.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 transition-colors hover:bg-slate-50/50 rounded-xl px-2"
            >
              {/* Left customer & product thumbnail */}
              <div className="flex items-center gap-4 min-w-[280px]">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${op.avatarBg}`}
                >
                  {op.initials}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{op.name}</p>
                  <p className="text-xs text-slate-500">{op.channel}</p>
                </div>
              </div>

              {/* Product with non-cropped placeholder */}
              <div className="flex items-center gap-3 min-w-[200px]">
                <ImagePlaceholder
                  src={op.img}
                  alt={op.product}
                  aspectRatio="aspect-square"
                  className="h-10 w-10 shrink-0 rounded-lg"
                  label=""
                  sublabel=""
                  objectFit="contain"
                />
                <span className="text-sm font-medium text-slate-800">{op.product}</span>
              </div>

              {/* Time ago */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 min-w-[130px]">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>{op.time}</span>
              </div>

              {/* Price total */}
              <div className="min-w-[100px] text-sm font-bold text-slate-900">
                {op.price}
              </div>

              {/* Contact Button */}
              <div>
                <Button
                  size="sm"
                  onClick={() => setContactTarget(op)}
                  className="rounded-xl bg-purple-50 text-[#5136db] hover:bg-purple-100 border border-purple-200/60 font-semibold text-xs px-3.5"
                >
                  <Mail className="h-3 w-3 mr-1.5" />
                  Contactar
                  <span className="ml-1">›</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Quick Contact Modal */}
      <Dialog open={!!contactTarget} onOpenChange={(open) => !open && setContactTarget(null)}>
        <DialogContent className="sm:max-w-md">
          {contactTarget && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold">
                  Contactar a {contactTarget.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Última compra de {contactTarget.product} ({contactTarget.time}) por {contactTarget.price}.
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2 text-xs text-slate-700">
                <p className="font-semibold text-slate-900">Mensaje sugerido:</p>
                <p className="italic text-slate-600">
                  &ldquo;Hola {contactTarget.name}, esperamos que estés disfrutando de tu {contactTarget.product}. Nos encantaría saber cómo va tu aroma y contarte sobre nuestras novedades de la temporada.&rdquo;
                </p>
              </div>

              {messageSent ? (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Mensaje enviado correctamente. Se creó la tarea de seguimiento en CRM.</span>
                </div>
              ) : (
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleSendMessage}
                    className="flex-1 bg-[#5136db] hover:bg-[#432bc2] text-white"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Enviar mensaje de recompra
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
