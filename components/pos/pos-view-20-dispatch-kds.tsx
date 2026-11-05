'use client';

import React, { useState } from 'react';
import {
  Boxes,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Filter,
  CheckSquare,
  Square,
  ChefHat,
  PackageCheck,
  Truck,
  RotateCcw,
} from 'lucide-react';
import { usePos } from './pos-context';
import type { PosDispatchOrder, PosDispatchStatus } from '@/lib/types';

export function PosView20DispatchKds() {
  const {
    dispatchOrders,
    updateDispatchStatus,
    toggleDispatchItem,
    activeBranch,
    activeUser,
    navigateTo,
    showNotification,
    isFuncActive,
  } = usePos();

  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');

  const filteredOrders = dispatchOrders.filter((order) => {
    const matchesStation = selectedStation === 'all' || order.station === selectedStation;
    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'active'
        ? order.status !== 'entregado'
        : order.status === filterStatus;
    return matchesStation && matchesStatus;
  });

  const pendingOrders = filteredOrders.filter((o) => o.status === 'pendiente');
  const inPrepOrders = filteredOrders.filter((o) => o.status === 'en_preparacion');
  const readyOrders = filteredOrders.filter((o) => o.status === 'listo');
  const deliveredOrders = filteredOrders.filter((o) => o.status === 'entregado');

  const getElapsedTimeText = (createdAt: string) => {
    const elapsedMinutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60));
    if (elapsedMinutes < 1) return 'Hace un momento';
    if (elapsedMinutes === 1) return 'Hace 1 min';
    return `Hace ${elapsedMinutes} min`;
  };

  const getElapsedBadgeColor = (createdAt: string) => {
    const elapsedMinutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60));
    if (elapsedMinutes > 15) return 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]';
    if (elapsedMinutes > 8) return 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]';
    return 'bg-[#DCFCE7] text-[#14532D] border-[#86EFAC]';
  };

  const handlePopOut = () => {
    window.open(
      `/pos/dispatch-kds?branch=${activeBranch.id}`,
      'VoraKdsDisplay',
      'width=1280,height=800,menubar=no,toolbar=no,location=no',
    );
  };

  return (
    <div className="space-y-6">
      {/* Cabecera Principal KDS */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#DCFCE7] text-[#1E6B4E]">
            <Boxes className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[#111827]">
                Comandas de Despacho y Almacén (KDS)
              </h1>
              <span className="rounded-full bg-[#1E6B4E] px-2.5 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                En Vivo
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#52635A]">
              Trazabilidad en tiempo real para bodega, cocina y mostrador de empaque en {activeBranch.name}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePopOut}
            title="Abrir en pantalla completa para monitor de cocina o bodega"
            className="flex items-center gap-1.5 rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] px-3.5 py-2 text-xs font-bold text-[#111827] hover:bg-[#DCE3DF] transition"
          >
            <ExternalLink className="h-4 w-4" />
            <span>Extender Monitor KDS</span>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('POS-01')}
            className="rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] px-4 py-2 text-xs font-bold text-[#111827] hover:bg-[#DCE3DF] transition"
          >
            Volver a caja
          </button>
        </div>
      </div>

      {/* Barra de Filtros por Estación y Estado */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DCE3DF] bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[#52635A] mr-1">Estación de trabajo:</span>
          {[
            { id: 'all', label: 'Todas las estaciones' },
            { id: 'almacen', label: 'Bodega / Almacén' },
            { id: 'empaque', label: 'Empaque Mostrador' },
            { id: 'cocina', label: 'Cocina / Preparación' },
          ].map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setSelectedStation(st.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                selectedStation === st.id
                  ? 'bg-[#1E6B4E] text-white shadow-2xs'
                  : 'bg-[#F6F5F0] text-[#52635A] hover:bg-[#DCE3DF]'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#52635A]">Ver:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-[#DCE3DF] bg-[#F6F5F0] px-3 py-1.5 text-xs font-semibold text-[#111827] outline-none"
          >
            <option value="active">Órdenes activas (no entregadas)</option>
            <option value="pendiente">Solo pendientes</option>
            <option value="en_preparacion">Solo en preparación</option>
            <option value="listo">Solo listas para entrega</option>
            <option value="entregado">Histórico entregadas</option>
            <option value="all">Ver todas las comandas</option>
          </select>
        </div>
      </div>

      {/* Tablero Kanban KDS (3 Columnas de Despacho) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Columna 1: Pendientes de Preparación */}
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-[#FDE68A] bg-[#FEF3C7] p-3.5 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-[#D97706] animate-pulse" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#92400E]">
                1. Pendientes por Preparar ({pendingOrders.length})
              </h2>
            </div>
          </div>

          <div className="space-y-3">
            {pendingOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#DCE3DF] bg-white p-8 text-center text-xs text-[#52635A]">
                Sin comandas pendientes en esta estación.
              </div>
            ) : (
              pendingOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-3xl border border-[#FDE68A] bg-white p-5 shadow-sm space-y-3.5 transition hover:shadow-md"
                >
                  <div className="flex items-center justify-between border-b border-[#E5E9E7] pb-2.5">
                    <div>
                      <span className="text-sm font-black text-[#111827]">{order.order_number}</span>
                      <p className="text-[11px] text-[#52635A]">Venta: {order.sale_number}</p>
                    </div>
                    <span
                      className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${getElapsedBadgeColor(
                        order.created_at,
                      )}`}
                    >
                      <Clock className="h-3 w-3" />
                      <span>{getElapsedTimeText(order.created_at)}</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-[#111827] block truncate">
                      Cliente: {order.customer_name}
                    </span>
                    <span className="rounded-md bg-[#F6F5F0] px-2 py-0.5 text-[10px] font-semibold text-[#52635A] uppercase">
                      Estación: {order.station}
                    </span>
                  </div>

                  {/* Lista de Artículos a Empacar */}
                  <div className="rounded-2xl border border-[#E5E9E7] bg-[#F6F5F0] p-3 text-xs space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#52635A]">
                      Artículos ({order.items.reduce((s, i) => s + i.quantity, 0)})
                    </span>
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-2 border-t border-[#E5E9E7] pt-1.5">
                        <div>
                          <span className="font-bold text-[#111827]">{item.name}</span>
                          {item.notes && <p className="text-[10px] text-[#1E6B4E] italic font-semibold">{item.notes}</p>}
                        </div>
                        <span className="rounded-lg bg-white px-2 py-0.5 text-xs font-black text-[#111827] shrink-0 border border-[#DCE3DF]">
                          ×{item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => updateDispatchStatus(order.id, 'en_preparacion', activeUser.name)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-2xl bg-[#D97706] py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-[#B45309] transition"
                  >
                    <span>Iniciar Preparación / Empaque</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Columna 2: En Preparación / Empacando */}
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-[#BFDBFE] bg-[#DBEAFE] p-3.5 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-[#2563EB] animate-pulse" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#1E40AF]">
                2. En Preparación ({inPrepOrders.length})
              </h2>
            </div>
          </div>

          <div className="space-y-3">
            {inPrepOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#DCE3DF] bg-white p-8 text-center text-xs text-[#52635A]">
                Sin comandas en proceso de empaque actualmente.
              </div>
            ) : (
              inPrepOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-3xl border border-[#93C5FD] bg-white p-5 shadow-sm space-y-3.5 transition hover:shadow-md"
                >
                  <div className="flex items-center justify-between border-b border-[#E5E9E7] pb-2.5">
                    <div>
                      <span className="text-sm font-black text-[#111827]">{order.order_number}</span>
                      <p className="text-[11px] text-[#52635A]">Venta: {order.sale_number}</p>
                    </div>
                    <span
                      className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${getElapsedBadgeColor(
                        order.created_at,
                      )}`}
                    >
                      <Clock className="h-3 w-3" />
                      <span>{getElapsedTimeText(order.created_at)}</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-[#111827] block truncate">
                      Cliente: {order.customer_name}
                    </span>
                    <p className="text-[11px] text-[#2563EB] font-semibold">
                      Preparado por: {order.prepared_by || activeUser.name}
                    </p>
                  </div>

                  {/* Checklist Interactivo de Productos */}
                  <div className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-3 text-xs space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E40AF]">
                      Marcar productos empacados
                    </span>
                    {order.items.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => toggleDispatchItem(order.id, item.sku)}
                        className="flex items-start justify-between gap-2 border-t border-[#DBEAFE] pt-2 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          {item.completed ? (
                            <CheckSquare className="h-4 w-4 text-[#2563EB] shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-[#94A3B8] shrink-0" />
                          )}
                          <span className={`font-semibold ${item.completed ? 'line-through text-[#64748B]' : 'text-[#111827]'}`}>
                            {item.name}
                          </span>
                        </div>
                        <span className="rounded-lg bg-white px-2 py-0.5 text-xs font-black text-[#1E40AF] shrink-0 border border-[#BFDBFE]">
                          ×{item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => updateDispatchStatus(order.id, 'listo', activeUser.name)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-2xl bg-[#2563EB] py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-[#1D4ED8] transition"
                  >
                    <span>Marcar Listo para Entrega</span>
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Columna 3: Listos para Entrega en Mostrador */}
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-[#86EFAC] bg-[#DCFCE7] p-3.5 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-[#16A34A]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#14532D]">
                3. Listos en Mostrador ({readyOrders.length})
              </h2>
            </div>
          </div>

          <div className="space-y-3">
            {readyOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#DCE3DF] bg-white p-8 text-center text-xs text-[#52635A]">
                Sin pedidos en espera de retiro en mostrador.
              </div>
            ) : (
              readyOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-3xl border border-[#86EFAC] bg-white p-5 shadow-sm space-y-3.5 transition hover:shadow-md"
                >
                  <div className="flex items-center justify-between border-b border-[#E5E9E7] pb-2.5">
                    <div>
                      <span className="text-sm font-black text-[#111827]">{order.order_number}</span>
                      <p className="text-[11px] text-[#52635A]">Venta: {order.sale_number}</p>
                    </div>
                    <span className="rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-[10px] font-bold text-[#14532D]">
                      ✓ Empacado
                    </span>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-[#111827] block truncate">
                      Cliente: {order.customer_name}
                    </span>
                    <p className="text-[10px] text-[#52635A]">
                      Listo a las: {new Date(order.completed_at || order.created_at).toLocaleTimeString('es-VE')}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#86EFAC] bg-[#F0FDF4] p-3 text-xs space-y-1">
                    <p className="text-[#14532D] font-bold text-[11px]">
                      {order.items.length} productos empacados y verificados.
                    </p>
                    <p className="text-[10px] text-[#15803D]">
                      Llamar al cliente al mostrador de despacho.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateDispatchStatus(order.id, 'entregado', activeUser.name)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-2xl bg-[#1E6B4E] py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-[#16523B] transition"
                  >
                    <PackageCheck className="h-4 w-4" />
                    <span>Confirmar Entrega al Cliente</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

