'use client';

import React, { useState } from 'react';
import { Search, UserPlus, CheckCircle2, ArrowLeft, X, Edit2, ShieldCheck } from 'lucide-react';
import { usePos } from './pos-context';
import type { PosCustomer } from '@/lib/types';
import { posStore } from '@/lib/pos-service';

export function PosView05CustomerSelector() {
  const { customers, selectedCustomer, setSelectedCustomer, navigateTo, showNotification } = usePos();

  const [query, setQuery] = useState('');
  const [activeCust, setActiveCust] = useState<PosCustomer>(selectedCustomer ?? customers[0]);

  // Formulario nuevo cliente
  const [showNewForm, setShowNewForm] = useState(false);
  const [docType, setDocType] = useState<'V' | 'E' | 'J' | 'G' | 'P'>('V');
  const [docNumber, setDocNumber] = useState('');
  const [legalName, setLegalName] = useState('');
  const [phone, setPhone] = useState('0414-');
  const [email, setEmail] = useState('');
  const [fiscalAddress, setFiscalAddress] = useState('Caracas, Venezuela [mock]');

  const filtered = customers.filter(
    (c) =>
      c.legal_name.toLowerCase().includes(query.toLowerCase()) ||
      c.document_number.includes(query) ||
      (c.phone && c.phone.includes(query)) ||
      (c.email && c.email.toLowerCase().includes(query.toLowerCase())),
  );

  const handleSelectCustomer = (c: PosCustomer) => {
    setSelectedCustomer(c);
    showNotification(
      'Cliente seleccionado',
      `${c.legal_name} (${c.document_type}-${c.document_number}) vinculado a la venta actual [mock].`,
      'success',
    );
    navigateTo('POS-03-04');
  };

  const handleSelectConsumidorFinal = () => {
    const cf = customers.find((c) => c.customer_tier === 'consumidor_final') ?? customers[customers.length - 1];
    setSelectedCustomer(cf);
    showNotification('Consumidor final asignado', 'Operación asociada a Consumidor Final no fiscal [mock].', 'alert');
    navigateTo('POS-03-04');
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docNumber.trim() || !legalName.trim()) return;

    const created = posStore.addCustomer({
      document_type: docType,
      document_number: docNumber.trim(),
      legal_name: `${legalName.trim()} [mock]`,
      phone: phone.trim() || null,
      email: email.trim() || null,
      fiscal_address: fiscalAddress.trim() || null,
      customer_tier: 'nuevo',
    });

    setSelectedCustomer(created);
    setActiveCust(created);
    setShowNewForm(false);
    showNotification(
      'Cliente Creado',
      `${created.legal_name} registrado y asociado a la venta [mock].`,
      'success',
    );
    navigateTo('POS-03-04');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Tarjeta Contenedora Principal con Bordes Redondeados Suaves */}
      <div className="rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-xl">
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5E9E7]">
          <div>
            <h2 className="text-xl font-bold text-[#111827]">Seleccionar cliente</h2>
            <p className="mt-0.5 text-xs text-[#52635A]">
              Búsqueda por nombre, cédula/RIF, teléfono o correo electrónico.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigateTo('POS-03-04')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F6F5F0] text-[#52635A] hover:bg-[#DCE3DF]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Buscador Redondeado */}
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] p-2.5 shadow-xs">
          <Search className="ml-2 h-4 w-4 text-[#52635A]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, cédula, teléfono o email..."
            className="w-full bg-transparent p-1 text-xs text-[#111827] outline-none placeholder:text-[#52635A]"
          />
        </div>

        {/* Contenido en Dos Columnas como el Mockup del PDF */}
        <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-12">
          {/* Tabla / Lista de Clientes (7 cols) */}
          <div className="space-y-2 md:col-span-7">
            <div className="max-h-[360px] overflow-y-auto rounded-2xl border border-[#E5E9E7]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F6F5F0] text-[10px] font-bold uppercase text-[#52635A]">
                  <tr>
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Teléfono</th>
                    <th className="p-3">Tipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E9E7]">
                  {filtered.map((c) => {
                    const isSelected = activeCust?.id === c.id;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setActiveCust(c)}
                        className={`cursor-pointer transition hover:bg-[#F6F5F0] ${isSelected ? 'bg-[#DCFCE7]/40 font-semibold' : ''
                          }`}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1E6B4E] text-white text-[10px] font-bold">
                              {c.legal_name.charAt(0)}
                            </div>
                            <div>
                              <span className="text-[#111827] block font-medium">{c.legal_name}</span>
                              <span className="text-[10px] text-[#52635A]">
                                {c.document_type}-{c.document_number}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-[#52635A]">{c.phone ?? 'N/D'}</td>
                        <td className="p-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${c.customer_tier === 'frecuente'
                                ? 'bg-[#DCFCE7] text-[#14532D]'
                                : c.customer_tier === 'nuevo'
                                  ? 'bg-[#FEF3C7] text-[#92400E]'
                                  : 'bg-[#F6F5F0] text-[#52635A]'
                              }`}
                          >
                            {c.customer_tier === 'frecuente'
                              ? 'Frecuente'
                              : c.customer_tier === 'nuevo'
                                ? 'Nuevo'
                                : 'Consumidor'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSelectConsumidorFinal}
                className="w-full rounded-2xl border border-[#DCE3DF] bg-[#F6F5F0] py-2.5 text-center text-xs font-bold text-[#52635A] hover:bg-[#DCE3DF]"
              >
                Venta rápida a Consumidor Final (No Fiscal)
              </button>
            </div>
          </div>

          {/* Panel de Cliente Seleccionado (5 cols) */}
          <div className="flex flex-col justify-between rounded-3xl border border-[#E5E9E7] bg-[#F6F5F0] p-5 md:col-span-5">
            <div>
              <span className="text-xs font-bold text-[#52635A]">Cliente seleccionado</span>

              {activeCust ? (
                <div className="mt-4 flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1E6B4E] text-white text-xl font-bold shadow-md">
                    {activeCust.legal_name.charAt(0)}
                  </div>
                  <h3 className="mt-3 text-base font-bold text-[#111827]">
                    {activeCust.legal_name}
                  </h3>
                  <p className="text-xs text-[#52635A]">{activeCust.phone ?? 'Sin teléfono registrado'}</p>
                  <p className="text-xs text-[#52635A]">{activeCust.email ?? 'Sin correo'}</p>
                  <span className="mt-1 text-[11px] font-bold text-[#1E6B4E]">
                    {activeCust.document_type}-{activeCust.document_number}
                  </span>

                  {/* Historial de Compras */}
                  <div className="mt-6 w-full rounded-2xl bg-white p-4 text-left shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#52635A]">
                      Historial de compras
                    </span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-xs font-bold text-[#111827]">8 compras</span>
                      <span className="text-sm font-extrabold text-[#111827]">$1,250.00 USD</span>
                    </div>
                    <span className="mt-1 block text-[10px] text-[#52635A]">Última compra: 12 oct 2026</span>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-[#52635A]">
                  Seleccione un cliente de la lista
                </div>
              )}
            </div>

            {/* Botón de Asignación */}
            <div className="mt-6">
              <button
                type="button"
                disabled={!activeCust}
                onClick={() => activeCust && handleSelectCustomer(activeCust)}
                className="w-full rounded-2xl bg-[#144D37] py-3.5 text-center text-xs font-bold text-white shadow-md transition hover:bg-[#1E6B4E] disabled:opacity-40"
              >
                Usar este cliente
              </button>
            </div>
          </div>
        </div>

        {/* Barra de Acciones Inferior */}
        <div className="mt-6 flex justify-between border-t border-[#E5E9E7] pt-4">
          <button
            type="button"
            onClick={() => setShowNewForm(!showNewForm)}
            className="flex items-center gap-1.5 rounded-2xl border border-[#DCE3DF] bg-white px-5 py-2.5 text-xs font-bold text-[#111827] shadow-xs hover:bg-[#F6F5F0]"
          >
            <UserPlus className="h-4 w-4" />
            <span>+ Nuevo cliente</span>
          </button>
        </div>

        {/* Formulario Desplegable Nuevo Cliente */}
        {showNewForm && (
          <form onSubmit={handleCreateCustomer} className="mt-6 rounded-3xl border border-[#DCE3DF] bg-[#FDFDFD] p-5 shadow-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#111827]">
              Alta rápida de cliente en mostrador
            </h4>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-[10px] font-bold text-[#52635A]">Tipo doc.</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-[#DCE3DF] bg-white p-2 text-xs"
                >
                  <option value="V">V - Venezolano</option>
                  <option value="J">J - Jurídico</option>
                  <option value="E">E - Extranjero</option>
                  <option value="G">G - Gubernamental</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-[#52635A]">Número de Cédula / RIF</label>
                <input
                  type="text"
                  required
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  placeholder="Ej: 12345678"
                  className="mt-1 w-full rounded-xl border border-[#DCE3DF] bg-white p-2 text-xs"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="text-[10px] font-bold text-[#52635A]">Nombre o Razón Social</label>
                <input
                  type="text"
                  required
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Ej: Pedro Pérez"
                  className="mt-1 w-full rounded-xl border border-[#DCE3DF] bg-white p-2 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#52635A]">Teléfono</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#DCE3DF] bg-white p-2 text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-[#52635A]">Correo Electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cliente@ejemplo.com"
                  className="mt-1 w-full rounded-xl border border-[#DCE3DF] bg-white p-2 text-xs"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="rounded-xl border border-[#DCE3DF] bg-white px-4 py-2 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#1E6B4E] px-4 py-2 text-xs font-bold text-white hover:bg-[#16523B]"
              >
                Guardar y seleccionar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
