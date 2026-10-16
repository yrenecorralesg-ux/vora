'use client';

import React, { useState } from 'react';
import {
  Search,
  ChevronDown,
  MoreVertical,
  RotateCw,
  Mail,
  TrendingUp,
  Heart,
  ShoppingBag,
  Store,
  MessageCircle,
  Globe,
  Phone,
  Calendar,
  CheckCircle2,
  Tag,
  Clock,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { CrmHeader } from '@/components/crm-header';

export interface CustomerData {
  id: string;
  initials: string;
  name: string;
  email: string;
  phone: string;
  avatarBg: string;
  origin: string;
  originType: 'feria' | 'shopify' | 'whatsapp' | 'web';
  purchases: number;
  total: string;
  action: string;
  actionType: 'reposicion' | 'contactar' | 'seguimiento' | 'bienvenida';
  actionColor: string;
  lastPurchase: string;
  favoriteProduct: string;
  notes: string;
  consent: boolean;
}

const INITIAL_CUSTOMERS: CustomerData[] = [
  {
    id: 'c1',
    initials: 'LM',
    name: 'Laura Méndez',
    email: 'laura.mendez@ejemplo.com',
    phone: '+57 310 456 7890',
    avatarBg: 'bg-indigo-100 text-indigo-700',
    origin: 'Feria Bogotá',
    originType: 'feria',
    purchases: 8,
    total: '$1.480.000',
    action: 'Reposición',
    actionType: 'reposicion',
    actionColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 hover:bg-emerald-100',
    lastPurchase: 'Difusor Home Fragrance + Vela Ámbar (Hace 8 semanas)',
    favoriteProduct: 'Difusor Bosque',
    notes: 'Cliente fiel en ferias presenciales. Prefiere aromas amaderados y florales.',
    consent: true,
  },
  {
    id: 'c2',
    initials: 'AP',
    name: 'Andrea Pérez',
    email: 'andrea.perez@ejemplo.com',
    phone: '+57 312 987 6543',
    avatarBg: 'bg-purple-100 text-purple-700',
    origin: 'Shopify + feria',
    originType: 'shopify',
    purchases: 6,
    total: '$2.320.000',
    action: 'Contactar',
    actionType: 'contactar',
    actionColor: 'bg-blue-50 text-blue-700 border-blue-200/60 hover:bg-blue-100',
    lastPurchase: 'Esencia Calma x 2 (Hace 6 semanas)',
    favoriteProduct: 'Esencia Calma',
    notes: 'Compró primero en feria y reordenó por Shopify. Preguntó por envíos a Medellín.',
    consent: true,
  },
  {
    id: 'c3',
    initials: 'CR',
    name: 'Carlos Rojas',
    email: 'carlos.rojas@ejemplo.com',
    phone: '+57 315 222 3344',
    avatarBg: 'bg-teal-100 text-teal-700',
    origin: 'WhatsApp',
    originType: 'whatsapp',
    purchases: 3,
    total: '$680.000',
    action: 'Seguimiento',
    actionType: 'seguimiento',
    actionColor: 'bg-purple-50 text-purple-700 border-purple-200/60 hover:bg-purple-100',
    lastPurchase: 'Vela Decorativa Cristal (Hace 10 semanas)',
    favoriteProduct: 'Vela Ámbar',
    notes: 'Atendido por asesora vía WhatsApp con cotización corporativa.',
    consent: true,
  },
  {
    id: 'c4',
    initials: 'JS',
    name: 'Julián Salazar',
    email: 'julian.salazar@ejemplo.com',
    phone: '+57 301 777 8899',
    avatarBg: 'bg-emerald-100 text-emerald-700',
    origin: 'Web',
    originType: 'web',
    purchases: 1,
    total: '$210.000',
    action: 'Bienvenida',
    actionType: 'bienvenida',
    actionColor: 'bg-pink-50 text-pink-700 border-pink-200/60 hover:bg-pink-100',
    lastPurchase: 'Set de Regalo Aromas (Hace 3 días)',
    favoriteProduct: 'Home Essence',
    notes: 'Primer registro a través del formulario de bienvenida en la tienda virtual.',
    consent: true,
  },
];

const ORIGIN_ICONS = {
  feria: Store,
  shopify: ShoppingBag,
  whatsapp: MessageCircle,
  web: Globe,
};

const ACTION_ICONS = {
  reposicion: RotateCw,
  contactar: Mail,
  seguimiento: TrendingUp,
  bienvenida: Heart,
};

export function CustomerView({
  tenantName,
  secondaryColor,
  ambientImage,
}: {
  tenantName: string;
  secondaryColor: string;
  ambientImage?: string | null;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [originFilter, setOriginFilter] = useState<'all' | 'feria' | 'shopify' | 'whatsapp' | 'web'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);

  const filteredCustomers = INITIAL_CUSTOMERS.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm);
    const matchesOrigin = originFilter === 'all' || c.originType === originFilter;
    return matchesSearch && matchesOrigin;
  });

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header with ambient photo blend & Asesora badge matching Mockup 1 */}
      <CrmHeader
        tenantName={tenantName}
        title="Base única de clientes"
        subtitle="Cada compra y conversación se suma a la ficha, sin duplicar clientes."
        ambientImageUrl={ambientImage}
        secondaryColor={secondaryColor}
      />

      {/* Filter / Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, teléfono o correo"
            className="rounded-xl border-slate-200 bg-white pl-10 text-sm shadow-xs focus-visible:ring-1"
          />
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs">
          <span className="text-xs text-slate-500">Origen:</span>
          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value as any)}
            className="bg-transparent text-xs font-semibold text-slate-800 outline-none cursor-pointer"
          >
            <option value="all">Todos los canales</option>
            <option value="feria">Feria Bogotá</option>
            <option value="shopify">Shopify</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="web">Web</option>
          </select>
        </div>
      </div>

      {/* Table matching Screenshot 1 */}
      <Card className="overflow-hidden rounded-2xl border-slate-100 bg-white shadow-xs">
        <CardContent className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-4">Cliente ↕</th>
                <th className="px-6 py-4">Origen ↕</th>
                <th className="px-6 py-4 text-center">Compras ↕</th>
                <th className="px-6 py-4">Total ↕</th>
                <th className="px-6 py-4">Siguiente acción ↕</th>
                <th className="px-4 py-4 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.map((c) => {
                const OriginIcon = ORIGIN_ICONS[c.originType] || Store;
                const ActionIcon = ACTION_ICONS[c.actionType] || Mail;

                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCustomer(c)}
                    className="cursor-pointer transition-colors hover:bg-slate-50/60"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${c.avatarBg}`}
                        >
                          {c.initials}
                        </div>
                        <span className="font-semibold text-slate-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        <OriginIcon className="h-4 w-4 text-purple-600" />
                        <span>{c.origin}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-slate-700">
                      {c.purchases}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {c.total}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCustomer(c);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${c.actionColor}`}
                      >
                        <ActionIcon className="h-3 w-3" />
                        <span>{c.action}</span>
                        <span>›</span>
                      </button>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCustomer(c);
                        }}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Customer Detail Drawer Sheet */}
      <Sheet open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedCustomer && (
            <div className="space-y-6 pt-2">
              <SheetHeader>
                <div className="flex items-center gap-3.5">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl text-base font-bold ${selectedCustomer.avatarBg}`}
                  >
                    {selectedCustomer.initials}
                  </div>
                  <div>
                    <SheetTitle className="text-lg font-bold">{selectedCustomer.name}</SheetTitle>
                    <SheetDescription className="text-xs">
                      Cliente registrado • {selectedCustomer.origin}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              {/* Quick stats pills */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-center">
                  <span className="text-[11px] text-slate-500 font-medium">Total Facturado</span>
                  <p className="text-lg font-bold text-slate-900">{selectedCustomer.total}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-center">
                  <span className="text-[11px] text-slate-500 font-medium">Compras Realizadas</span>
                  <p className="text-lg font-bold text-slate-900">{selectedCustomer.purchases} órdenes</p>
                </div>
              </div>

              {/* Contact info */}
              <div className="space-y-2 rounded-xl border border-slate-100 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Datos de contacto
                </p>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <span>{selectedCustomer.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span>{selectedCustomer.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs text-slate-600">Consentimiento de novedades activo</span>
                </div>
              </div>

              {/* Purchase History */}
              <div className="space-y-2 rounded-xl border border-slate-100 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Historial de compras
                </p>
                <div className="space-y-2">
                  <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">
                    <p className="font-semibold text-slate-800">Última compra</p>
                    <p className="text-slate-600 mt-0.5">{selectedCustomer.lastPurchase}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">
                    <p className="font-semibold text-slate-800">Producto predilecto</p>
                    <p className="text-slate-600 mt-0.5">{selectedCustomer.favoriteProduct}</p>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <Button className="w-full bg-[#5136db] hover:bg-[#432bc2] text-white">
                  Ejecutar acción: {selectedCustomer.action}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
