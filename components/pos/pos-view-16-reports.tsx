'use client';

import React, { useState, useMemo } from 'react';
import {
  Calendar,
  ChevronDown,
  Download,
  TrendingUp,
  ArrowUpRight,
  Filter,
  DollarSign,
  Package,
  Users,
  Store,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Printer,
  Eye,
  X,
} from 'lucide-react';
import { usePos } from './pos-context';
import { posStore } from '@/lib/pos-service';
import type { PosShift } from '@/lib/types';

export function PosView16Reports() {
  const { sales, branches, activeBranchId, exchangeRate, showNotification, shifts, cashMovements, registers } = usePos();

  // Pestaña activa (Diagrama §8: Ventas, Turnos/Cierres, Cajeros/Cajas)
  const [reportTab, setReportTab] = useState<'ventas' | 'turnos' | 'cajeros'>('ventas');
  const [selectedShiftForDetail, setSelectedShiftForDetail] = useState<PosShift | null>(null);
  const [shiftStatusFilter, setShiftStatusFilter] = useState<'all' | 'abierto' | 'cerrado'>('all');
  const [shiftRegisterFilter, setShiftRegisterFilter] = useState<string>('all');

  // Filtros de Sede y Rango
  const [selectedBranchId, setSelectedBranchId] = useState<string>(activeBranchId || 'all');
  const [dateRangePreset, setDateRangePreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [currencyMode, setCurrencyMode] = useState<'USD' | 'VES'>('USD');
  const [selectedPoint, setSelectedPoint] = useState<number | null>(4); // Default 16:00
  const [activeSegment, setActiveSegment] = useState<string | null>(null);

  // Filtrado de Ventas
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const matchesBranch = selectedBranchId === 'all' || s.branch_id === selectedBranchId;
      const isConfirmed = s.commercial_status === 'confirmada' || s.commercial_status === 'parcialmente_devuelta';
      return matchesBranch && isConfirmed;
    });
  }, [sales, selectedBranchId]);

  // Cálculos de Métricas
  const totalSalesUsd = useMemo(() => {
    const raw = filteredSales.reduce((sum, s) => sum + s.total_usd, 0);
    return raw > 0 ? raw : 1250.0; // Fallback con datos demo realistas del mockup ($ 1.250.000 COP/VES equivalent)
  }, [filteredSales]);

  const totalSalesVes = totalSalesUsd * exchangeRate;
  const salesCount = filteredSales.length > 0 ? filteredSales.length : 12;
  const averageTicketUsd = totalSalesUsd / salesCount;
  const averageTicketVes = averageTicketUsd * exchangeRate;

  const totalUnitsSold = useMemo(() => {
    const units = filteredSales
      .flatMap((s) => s.lines ?? [])
      .filter((l) => !l.is_service)
      .reduce((sum, l) => sum + (l.quantity - l.returned_quantity), 0);
    return units > 0 ? units : 34;
  }, [filteredSales]);

  // Datos para Gráfica de Ventas por Hora
  const hourlyData = useMemo(() => {
    return [
      { hour: '8:00', amountUsd: 65.0, count: 2 },
      { hour: '10:00', amountUsd: 125.0, count: 4 },
      { hour: '12:00', amountUsd: 155.0, count: 5 },
      { hour: '14:00', amountUsd: 230.0, count: 7 },
      { hour: '16:00', amountUsd: 295.0, count: 9 }, // Pico de ventas
      { hour: '18:00', amountUsd: 240.0, count: 6 },
      { hour: '20:00', amountUsd: 110.0, count: 3 },
    ];
  }, []);

  // Coordenadas para el SVG de curva suave
  const chartWidth = 520;
  const chartHeight = 180;
  const paddingX = 40;
  const paddingY = 25;
  const maxAmount = 350.0;

  const points = useMemo(() => {
    const stepX = (chartWidth - paddingX * 2) / (hourlyData.length - 1);
    return hourlyData.map((d, index) => {
      const x = paddingX + index * stepX;
      const y = chartHeight - paddingY - (d.amountUsd / maxAmount) * (chartHeight - paddingY * 2);
      return { ...d, x, y };
    });
  }, [hourlyData]);

  // Generador de curva Bézier cúbica suave
  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1.y;
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    return d;
  }, [points]);

  const areaD = useMemo(() => {
    if (points.length === 0) return '';
    const bottomY = chartHeight - paddingY;
    return `${pathD} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`;
  }, [pathD, points]);

  // Datos para Gráfica de Métodos de Pago (Torta / Donut)
  const paymentMethodsData = useMemo(() => {
    return [
      { id: 'pago_movil', label: 'Pago Móvil', percentage: 50, color: '#144D37', amountUsd: totalSalesUsd * 0.50 },
      { id: 'efectivo', label: 'Efectivo', percentage: 28, color: '#607D3B', amountUsd: totalSalesUsd * 0.28 },
      { id: 'tarjeta', label: 'Tarjeta', percentage: 16, color: '#C97857', amountUsd: totalSalesUsd * 0.16 },
      { id: 'transferencia', label: 'Transferencia', percentage: 6, color: '#73A580', amountUsd: totalSalesUsd * 0.06 },
    ];
  }, [totalSalesUsd]);

  // Parámetros Donut SVG (radio 48, circunferencia 301.59)
  const radius = 48;
  const circumference = 2 * Math.PI * radius;

  // Top Productos Vendidos (Métrica útil)
  const topProducts = [
    { name: 'Camiseta Básica CMB-001', sku: 'CMB-001', units: 14, revenueUsd: 210.0, category: 'Ropa' },
    { name: 'Pantalón Jean JE-032', sku: 'JE-032', units: 9, revenueUsd: 342.0, category: 'Ropa' },
    { name: 'Gorra Urbana GOR-001', sku: 'GOR-001', units: 7, revenueUsd: 105.0, category: 'Accesorios' },
    { name: 'Zapatos Deportivos ZAP-012', sku: 'ZAP-012', units: 4, revenueUsd: 220.0, category: 'Calzado' },
  ];

  // Exportación
  const handleExport = (format: 'csv' | 'json') => {
    if (format === 'json') {
      const data = {
        tenant: 'test1 [mock]',
        fecha_corte: new Date().toISOString(),
        sede: selectedBranchId === 'all' ? 'Todas las sedes' : branches.find((b) => b.id === selectedBranchId)?.name,
        resumen: {
          ventas_totales_usd: totalSalesUsd,
          ventas_totales_ves: totalSalesVes,
          total_operaciones: salesCount,
          ticket_promedio_usd: averageTicketUsd,
          unidades_vendidas: totalUnitsSold,
        },
        metodos_pago: paymentMethodsData,
        ventas_por_hora: hourlyData,
        top_productos: topProducts,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-ventas-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    } else {
      let csv = 'Métrica,Valor USD,Valor VES\n';
      csv += `Ventas Totales,${totalSalesUsd.toFixed(2)},${totalSalesVes.toFixed(2)}\n`;
      csv += `Operaciones,${salesCount},-\n`;
      csv += `Ticket Promedio,${averageTicketUsd.toFixed(2)},${averageTicketVes.toFixed(2)}\n`;
      csv += `Unidades Vendidas,${totalUnitsSold},-\n\n`;
      csv += 'Método de Pago,Porcentaje,Monto USD\n';
      paymentMethodsData.forEach((m) => {
        csv += `${m.label},${m.percentage}%,${m.amountUsd.toFixed(2)}\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-ventas-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    }
    showNotification('Reporte descargado', `Archivo ${format.toUpperCase()} generado correctamente [mock].`, 'success');
  };

  const formatCurrency = (amountUsd: number) => {
    if (currencyMode === 'VES') {
      const amountVes = amountUsd * exchangeRate;
      return `Bs. ${amountVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$ ${amountUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-4">
      {/* Cabecera Estilo Mockup PDF: Título y Controles */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#111827]">
            {reportTab === 'ventas'
              ? 'Ventas'
              : reportTab === 'turnos'
              ? 'Control de Turnos y Arqueos'
              : 'Rendimiento por Cajero y Sede'}
          </h1>
          <p className="text-xs font-medium text-[#52635A]">
            {reportTab === 'ventas'
              ? 'Reporte financiero y distribución de cobros en tiempo real'
              : reportTab === 'turnos'
              ? 'Auditoría a ciegas, aperturas, cierres y arqueos de caja (Diagrama §8)'
              : 'Comparativo de desempeño de ventas y consistencia de caja (Diagrama §8)'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Selector de Rango / Fecha con icono de calendario */}
          <div className="relative">
            <div className="flex items-center gap-2 rounded-2xl border border-[#DCE3DF] bg-white px-3.5 py-2 text-xs font-semibold text-[#111827] shadow-2xs hover:border-[#1E6B4E] transition">
              <Calendar className="h-4 w-4 text-[#52635A]" />
              <select
                aria-label="Seleccionar rango de fecha"
                value={dateRangePreset}
                onChange={(e) => setDateRangePreset(e.target.value as any)}
                className="bg-transparent pr-4 outline-none cursor-pointer"
              >
                <option value="today">12/10/2026 (Hoy)</option>
                <option value="yesterday">Ayer</option>
                <option value="week">Últimos 7 días</option>
                <option value="month">Este mes</option>
              </select>
            </div>
          </div>

          {/* Selector de Sede Operativa */}
          <div className="relative">
            <div className="flex items-center gap-2 rounded-2xl border border-[#DCE3DF] bg-white px-3.5 py-2 text-xs font-semibold text-[#111827] shadow-2xs hover:border-[#1E6B4E] transition">
              <Store className="h-4 w-4 text-[#52635A]" />
              <select
                aria-label="Filtrar por sede"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent pr-4 outline-none cursor-pointer"
              >
                <option value="all">Todas las sedes</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Toggle de Moneda USD / VES */}
          <div className="flex items-center rounded-2xl border border-[#DCE3DF] bg-white p-1 text-xs font-bold shadow-2xs">
            <button
              type="button"
              onClick={() => setCurrencyMode('USD')}
              className={`rounded-xl px-2.5 py-1 transition ${
                currencyMode === 'USD' ? 'bg-[#1E6B4E] text-white shadow-xs' : 'text-[#52635A] hover:text-[#111827]'
              }`}
            >
              USD ($)
            </button>
            <button
              type="button"
              onClick={() => setCurrencyMode('VES')}
              className={`rounded-xl px-2.5 py-1 transition ${
                currencyMode === 'VES' ? 'bg-[#1E6B4E] text-white shadow-xs' : 'text-[#52635A] hover:text-[#111827]'
              }`}
            >
              VES (Bs.)
            </button>
          </div>

          {/* Botón Exportar */}
          <div className="relative group">
            <button
              type="button"
              onClick={() => handleExport('csv')}
              className="flex items-center gap-2 rounded-2xl border border-[#DCE3DF] bg-white px-4 py-2 text-xs font-bold text-[#111827] shadow-2xs transition hover:bg-[#F6F5F0] hover:border-[#1E6B4E]"
            >
              <Download className="h-4 w-4 text-[#1E6B4E]" />
              <span>Exportar</span>
              <ChevronDown className="h-3.5 w-3.5 text-[#52635A]" />
            </button>
            <div className="absolute right-0 top-full mt-1.5 hidden w-36 rounded-2xl border border-[#DCE3DF] bg-white p-1.5 shadow-lg group-hover:block z-20">
              <button
                type="button"
                onClick={() => handleExport('csv')}
                className="w-full rounded-xl px-3 py-1.5 text-left text-xs font-semibold text-[#111827] hover:bg-[#F6F5F0]"
              >
                Exportar CSV
              </button>
              <button
                type="button"
                onClick={() => handleExport('json')}
                className="w-full rounded-xl px-3 py-1.5 text-left text-xs font-semibold text-[#111827] hover:bg-[#F6F5F0]"
              >
                Exportar JSON
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Selector de Sub-pestañas de Reportes y Control (Diagrama §8) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E5E9E7] pb-3">
        <button
          type="button"
          onClick={() => setReportTab('ventas')}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition ${
            reportTab === 'ventas'
              ? 'bg-[#144D37] text-white shadow-xs'
              : 'border border-[#DCE3DF] bg-white text-[#52635A] hover:bg-[#F6F5F0]'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          <span>Ventas Generales</span>
        </button>

        <button
          type="button"
          onClick={() => setReportTab('turnos')}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition ${
            reportTab === 'turnos'
              ? 'bg-[#144D37] text-white shadow-xs'
              : 'border border-[#DCE3DF] bg-white text-[#52635A] hover:bg-[#F6F5F0]'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Reporte de Turnos y Arqueos</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              reportTab === 'turnos' ? 'bg-white/20 text-white' : 'bg-[#E5E9E7] text-[#111827]'
            }`}
          >
            {shifts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setReportTab('cajeros')}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition ${
            reportTab === 'cajeros'
              ? 'bg-[#144D37] text-white shadow-xs'
              : 'border border-[#DCE3DF] bg-white text-[#52635A] hover:bg-[#F6F5F0]'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Rendimiento por Cajero y Caja</span>
        </button>
      </div>

      {reportTab === 'ventas' && (
        <>

      {/* 4 Tarjetas de Métricas Clave (Idénticas al Mockup del PDF) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* 1. Ventas Totales */}
        <div className="rounded-3xl border border-[#E5E9E7] bg-white p-6 shadow-xs">
          <span className="text-xs font-semibold text-[#52635A]">Ventas totales</span>
          <p className="mt-2 text-2xl font-black text-[#111827]">
            {formatCurrency(totalSalesUsd)}
          </p>
          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-[#1E6B4E]">
            <span>↑ +12% vs. ayer</span>
          </div>
        </div>

        {/* 2. # de Ventas */}
        <div className="rounded-3xl border border-[#E5E9E7] bg-white p-6 shadow-xs">
          <span className="text-xs font-semibold text-[#52635A]"># de ventas</span>
          <p className="mt-2 text-2xl font-black text-[#111827]">
            {salesCount}
          </p>
          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-[#1E6B4E]">
            <span>↑ +4%</span>
          </div>
        </div>

        {/* 3. Ticket Promedio */}
        <div className="rounded-3xl border border-[#E5E9E7] bg-white p-6 shadow-xs">
          <span className="text-xs font-semibold text-[#52635A]">Ticket promedio</span>
          <p className="mt-2 text-2xl font-black text-[#111827]">
            {formatCurrency(averageTicketUsd)}
          </p>
          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-[#52635A]">
            <span>↑ +0%</span>
          </div>
        </div>

        {/* 4. Productos Vendidos */}
        <div className="rounded-3xl border border-[#E5E9E7] bg-white p-6 shadow-xs">
          <span className="text-xs font-semibold text-[#52635A]">Productos vendidos</span>
          <p className="mt-2 text-2xl font-black text-[#111827]">
            {totalUnitsSold}
          </p>
          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-[#1E6B4E]">
            <span>↑ +10%</span>
          </div>
        </div>
      </div>

      {/* Grilla de 2 Gráficas Principales: Ventas por Hora + Métodos de Pago */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* GRÁFICA 1: Ventas por Hora (Área/Curva Suave - 7 cols) */}
        <div className="rounded-3xl border border-[#E5E9E7] bg-white p-6 shadow-xs lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#111827]">Ventas por hora</h2>
              {selectedPoint !== null && (
                <span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-bold text-[#14532D]">
                  {points[selectedPoint].hour} · {formatCurrency(points[selectedPoint].amountUsd)} ({points[selectedPoint].count} ventas)
                </span>
              )}
            </div>

            {/* Contenedor SVG de la Gráfica */}
            <div className="mt-4 relative w-full overflow-hidden">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-auto overflow-visible select-none"
              >
                <defs>
                  {/* Gradiente Verde Bosque a Transparente */}
                  <linearGradient id="voraGreenGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1E6B4E" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#1E6B4E" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* Líneas Guía Horizontales */}
                {[0, 100, 200, 300].map((val) => {
                  const y = chartHeight - paddingY - (val / maxAmount) * (chartHeight - paddingY * 2);
                  return (
                    <g key={val}>
                      <line
                        x1={paddingX}
                        y1={y}
                        x2={chartWidth - paddingX}
                        y2={y}
                        stroke="#E5E9E7"
                        strokeWidth="1"
                      />
                      <text
                        x={paddingX - 10}
                        y={y + 3}
                        textAnchor="end"
                        className="text-[10px] fill-[#8F9B94] font-medium"
                      >
                        {val === 0 ? '0' : `${val}k`}
                      </text>
                    </g>
                  );
                })}

                {/* Área bajo la Curva */}
                <path d={areaD} fill="url(#voraGreenGradient)" />

                {/* Línea Principal de la Curva */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="#144D37"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Puntos de Datos Interactivos */}
                {points.map((pt, idx) => {
                  const isSelected = selectedPoint === idx;
                  return (
                    <g
                      key={pt.hour}
                      className="cursor-pointer transition-transform duration-150"
                      onClick={() => setSelectedPoint(idx)}
                      onMouseEnter={() => setSelectedPoint(idx)}
                    >
                      {/* Círculo Exterior de Selección */}
                      {isSelected && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="9"
                          fill="#1E6B4E"
                          fillOpacity="0.2"
                        />
                      )}
                      {/* Punto Central */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? '5' : '4'}
                        fill="#144D37"
                        stroke="#FFFFFF"
                        strokeWidth="2"
                      />
                      {/* Etiqueta del Eje X */}
                      <text
                        x={pt.x}
                        y={chartHeight - 6}
                        textAnchor="middle"
                        className={`text-[10px] font-medium ${
                          isSelected ? 'fill-[#144D37] font-bold' : 'fill-[#8F9B94]'
                        }`}
                      >
                        {pt.hour}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F0F2F1] flex items-center justify-between text-[11px] text-[#52635A]">
            <span>Pico máximo: <strong>16:00 hrs</strong> (9 operaciones)</span>
            <span>Rango horario: <strong>08:00 - 20:00</strong></span>
          </div>
        </div>

        {/* GRÁFICA 2: Métodos de Pago (Torta / Donut - 5 cols) */}
        <div className="rounded-3xl border border-[#E5E9E7] bg-white p-6 shadow-xs lg:col-span-5 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-[#111827]">Métodos de pago</h2>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-6">
              {/* Gráfico Donut SVG */}
              <div className="relative flex items-center justify-center shrink-0">
                <svg width="140" height="140" viewBox="0 0 120 120" className="rotate-[-90deg]">
                  {/* Círculo Base Fondo */}
                  <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="transparent"
                    stroke="#F6F5F0"
                    strokeWidth="22"
                  />
                  {/* Segmentos del Donut */}
                  {(() => {
                    let accumulatedOffset = 0;
                    return paymentMethodsData.map((m) => {
                      const strokeDash = (m.percentage / 100) * circumference;
                      const strokeOffset = -accumulatedOffset;
                      accumulatedOffset += strokeDash;
                      const isHovered = activeSegment === m.id;

                      return (
                        <circle
                          key={m.id}
                          cx="60"
                          cy="60"
                          r={radius}
                          fill="transparent"
                          stroke={m.color}
                          strokeWidth={isHovered ? '24' : '20'}
                          strokeDasharray={`${strokeDash} ${circumference}`}
                          strokeDashoffset={strokeOffset}
                          className="transition-all duration-200 cursor-pointer"
                          onMouseEnter={() => setActiveSegment(m.id)}
                          onMouseLeave={() => setActiveSegment(null)}
                        />
                      );
                    });
                  })()}
                </svg>

                {/* Centro del Donut */}
                <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-[10px] font-bold text-[#52635A] uppercase">Total</span>
                  <span className="text-xs font-black text-[#111827]">100%</span>
                </div>
              </div>

              {/* Leyenda Detallada Estilo Mockup PDF */}
              <div className="flex-1 space-y-3 w-full">
                {paymentMethodsData.map((m) => {
                  const isHovered = activeSegment === m.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 transition cursor-pointer ${
                        isHovered ? 'bg-[#F6F5F0]' : ''
                      }`}
                      onMouseEnter={() => setActiveSegment(m.id)}
                      onMouseLeave={() => setActiveSegment(null)}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: m.color }}
                        />
                        <span className="text-xs font-semibold text-[#111827]">
                          {m.label}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-extrabold text-[#111827]">
                          {m.percentage}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F0F2F1] text-[11px] text-[#52635A] flex justify-between items-center">
            <span>Método predominante: <strong className="text-[#144D37]">Pago Móvil (50%)</strong></span>
            <span>Bimoneda: <strong>USD/VES</strong></span>
          </div>
        </div>
      </div>

      {/* Métricas Adicionales Útiles: Top Productos Vendidos y Desglose por Turno */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Tabla: Top Productos con Mayor Demanda (7 cols) */}
        <div className="rounded-3xl border border-[#E5E9E7] bg-white p-6 shadow-xs lg:col-span-7">
          <div className="flex items-center justify-between pb-3 border-b border-[#F0F2F1]">
            <div>
              <h3 className="text-base font-bold text-[#111827]">Top productos más vendidos</h3>
              <p className="text-xs text-[#52635A]">Artículos con mayor volumen de facturación</p>
            </div>
            <span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-bold text-[#14532D]">
              {totalUnitsSold} unidades totales
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E5E9E7] text-[10px] font-bold uppercase tracking-wider text-[#52635A]">
                  <th className="py-2.5">Producto</th>
                  <th className="py-2.5">Categoría</th>
                  <th className="py-2.5 text-center">Unidades</th>
                  <th className="py-2.5 text-right">Facturación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F2F1]">
                {topProducts.map((p) => (
                  <tr key={p.sku} className="hover:bg-[#F6F5F0]/60 transition">
                    <td className="py-3">
                      <span className="font-bold text-[#111827] block">{p.name}</span>
                      <span className="text-[10px] text-[#52635A]">SKU: {p.sku}</span>
                    </td>
                    <td className="py-3 text-[#52635A]">{p.category}</td>
                    <td className="py-3 text-center font-extrabold text-[#111827]">{p.units}</td>
                    <td className="py-3 text-right font-black text-[#111827]">
                      {formatCurrency(p.revenueUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resumen Operativo de Turnos y Auditoría de Caja (5 cols) */}
        <div className="rounded-3xl border border-[#E5E9E7] bg-white p-6 shadow-xs lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#F0F2F1]">
              <h3 className="text-base font-bold text-[#111827]">Resumen operativo de caja</h3>
              <span className="text-xs text-[#52635A]">Auditoría ciega</span>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div className="flex items-center justify-between rounded-2xl bg-[#F6F5F0] p-3">
                <span className="font-semibold text-[#52635A]">Cajero activo:</span>
                <span className="font-bold text-[#111827]">María C. [mock] (Caja 01)</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-[#F6F5F0] p-3">
                <span className="font-semibold text-[#52635A]">Apertura de turno:</span>
                <span className="font-bold text-[#111827]">$50.00 USD (Base en caja)</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-[#DCFCE7] p-3 text-[#14532D]">
                <span className="font-semibold">Ventas brutas acumuladas:</span>
                <span className="font-black">${totalSalesUsd.toFixed(2)} USD</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-[#FEF2F2] p-3 text-[#B91C1C]">
                <span className="font-semibold">Devoluciones / Reversos:</span>
                <span className="font-bold">$0.00 USD (0 incidencias)</span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[#F5CBA7] bg-[#FDF2E2] p-4 text-[#111827]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#92400E]">Total proyectado en caja</span>
              <span className="text-lg font-black text-[#111827]">
                ${(totalSalesUsd + 50.0).toFixed(2)} USD
              </span>
            </div>
            <p className="mt-1 text-[10px] text-[#92400E]">
              Equivalente: {((totalSalesUsd + 50.0) * exchangeRate).toLocaleString('es-VE')} VES
            </p>
          </div>
        </div>
      </div>
      </>
      )}

      {/* 2. REPORTE DE TURNOS Y ARQUEOS (Diagrama §8 / DOCX §16) */}
      {reportTab === 'turnos' && (
        <div className="space-y-4">
          {/* Métricas de Turnos */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-3xl border border-[#E5E9E7] bg-white p-5 shadow-xs">
              <span className="text-xs font-semibold text-[#52635A]">Turnos registrados</span>
              <p className="mt-2 text-2xl font-black text-[#111827]">{shifts.length}</p>
              <span className="mt-1 block text-[10px] text-[#52635A]">Historial completo en sede</span>
            </div>

            <div className="rounded-3xl border border-[#E5E9E7] bg-white p-5 shadow-xs">
              <span className="text-xs font-semibold text-[#52635A]">Turnos activos ahora</span>
              <div className="mt-2 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-2xl font-black text-[#144D37]">
                  {shifts.filter((s) => s.status === 'abierto').length}
                </p>
              </div>
              <span className="mt-1 block text-[10px] text-emerald-700">En operación mostrador</span>
            </div>

            <div className="rounded-3xl border border-[#E5E9E7] bg-white p-5 shadow-xs">
              <span className="text-xs font-semibold text-[#52635A]">Turnos cerrados conciliados</span>
              <p className="mt-2 text-2xl font-black text-[#111827]">
                {shifts.filter((s) => s.status === 'cerrado').length}
              </p>
              <span className="mt-1 block text-[10px] text-[#52635A]">Con arqueo ciego sellado</span>
            </div>

            <div className="rounded-3xl border border-[#E5E9E7] bg-white p-5 shadow-xs">
              <span className="text-xs font-semibold text-[#52635A]">Diferencias netas caja</span>
              <p className="mt-2 text-2xl font-black text-emerald-700">$0.00 USD</p>
              <span className="mt-1 block text-[10px] text-emerald-700">Arqueos cuadrados</span>
            </div>
          </div>

          {/* Filtros de Turnos */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DCE3DF] bg-white p-4 shadow-xs">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-[#52635A]">Filtrar por caja</label>
                <select
                  value={shiftRegisterFilter}
                  onChange={(e) => setShiftRegisterFilter(e.target.value)}
                  className="mt-0.5 rounded-xl border border-[#DCE3DF] bg-[#F6F5F0] px-3 py-1.5 font-semibold text-[#111827] outline-none"
                >
                  <option value="all">Todas las cajas físicas</option>
                  {registers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#52635A]">Estado del turno</label>
                <select
                  value={shiftStatusFilter}
                  onChange={(e) => setShiftStatusFilter(e.target.value as any)}
                  className="mt-0.5 rounded-xl border border-[#DCE3DF] bg-[#F6F5F0] px-3 py-1.5 font-semibold text-[#111827] outline-none"
                >
                  <option value="all">Todos (Abiertos y Cerrados)</option>
                  <option value="abierto">Solo turnos abiertos</option>
                  <option value="cerrado">Solo turnos cerrados</option>
                </select>
              </div>
            </div>

            <span className="text-xs font-bold text-[#52635A]">
              Mostrando {shifts.filter((s) => (shiftStatusFilter === 'all' || s.status === shiftStatusFilter) && (shiftRegisterFilter === 'all' || s.register_id === shiftRegisterFilter)).length} de {shifts.length} turnos
            </span>
          </div>

          {/* Tabla de Turnos y Arqueos */}
          <div className="overflow-x-auto rounded-3xl border border-[#E5E9E7] bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E5E9E7] bg-[#F6F5F0] text-[10px] font-bold uppercase tracking-wider text-[#52635A]">
                  <th className="py-3 px-4">Turno / ID</th>
                  <th className="py-3 px-4">Caja & Sede</th>
                  <th className="py-3 px-4">Cajero</th>
                  <th className="py-3 px-4">Apertura → Cierre</th>
                  <th className="py-3 px-4 text-right">Fondo Apertura</th>
                  <th className="py-3 px-4 text-right">Total Esperado</th>
                  <th className="py-3 px-4 text-right">Total Declarado</th>
                  <th className="py-3 px-4 text-center">Diferencia</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F2F1]">
                {shifts
                  .filter((s) => (shiftStatusFilter === 'all' || s.status === shiftStatusFilter) && (shiftRegisterFilter === 'all' || s.register_id === shiftRegisterFilter))
                  .map((shift) => {
                    const reg = registers.find((r) => r.id === shift.register_id);
                    const isClosed = shift.status === 'cerrado';
                    const diffUsd = Number(shift.differences_totals?.['efectivo_usd'] ?? 0);
                    const expectedUsd = Number(shift.expected_totals?.['efectivo_usd'] ?? 0);
                    const declaredUsd = Number(shift.declared_totals?.['efectivo_usd'] ?? expectedUsd);

                    return (
                      <tr key={shift.id} className="hover:bg-[#F6F5F0]/60 transition">
                        <td className="py-3 px-4">
                          <span className="font-bold text-[#111827] block">
                            #{shift.id.slice(0, 10)}...
                          </span>
                          <span className="text-[10px] text-[#52635A]">
                            {new Date(shift.opened_at).toLocaleDateString('es-VE')}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-[#111827] block">
                            {reg ? reg.name : 'Caja 01'}
                          </span>
                          <span className="text-[10px] text-[#52635A]">
                            {branches.find((b) => b.id === shift.branch_id)?.name ?? 'Principal'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-[#111827]">
                            {shift.cashier_name_snapshot ?? 'Cajero'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[#111827] block">
                            {new Date(shift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {shift.closed_at
                              ? ` → ${new Date(shift.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              : ' (En curso)'}
                          </span>
                          <span className="text-[10px] text-[#52635A]">
                            {shift.closed_at ? 'Turno finalizado' : 'Turno abierto activo'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-[#111827]">
                          ${shift.opening_amount_usd.toFixed(2)} USD
                          <span className="block text-[10px] text-[#52635A]">
                            {shift.opening_amount_ves.toFixed(2)} VES
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-[#111827]">
                          ${expectedUsd.toFixed(2)} USD
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-[#111827]">
                          {isClosed ? `$${declaredUsd.toFixed(2)} USD` : 'Pendiente arqueo'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isClosed ? (
                            diffUsd === 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                <CheckCircle2 className="h-3 w-3" /> $0.00
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
                                <AlertTriangle className="h-3 w-3" /> ${diffUsd.toFixed(2)}
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] text-[#52635A]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {shift.status === 'abierto' ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[10px] font-extrabold text-[#14532D]">
                              <span className="h-2 w-2 rounded-full bg-[#16A34A] animate-pulse" />
                              Abierto
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[10px] font-bold text-[#4B5563]">
                              <ShieldCheck className="h-3 w-3 text-[#52635A]" />
                              Cerrado
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedShiftForDetail(shift)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[#DCE3DF] bg-[#F6F5F0] px-3 py-1.5 text-xs font-bold text-[#144D37] hover:bg-[#DCE3DF]"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Ver Arqueo</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. REPORTE POR CAJERO Y CAJA (Diagrama §8) */}
      {reportTab === 'cajeros' && (
        <div className="space-y-6">
          {/* Tarjetas por Cajero */}
          <div>
            <h3 className="text-base font-bold text-[#111827] mb-3">
              Rendimiento y Auditoría por Usuario Operativo (Diagrama §8)
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                {
                  id: 'u0000000-0000-0000-0000-000000000001',
                  name: 'María C. [mock]',
                  role: 'Cajera Principal',
                  salesCount: 8,
                  revenueUsd: 780.0,
                  discrepanciesUsd: 0.0,
                  badgeColor: 'bg-emerald-50 border-emerald-200 text-emerald-800',
                },
                {
                  id: 'u0000000-0000-0000-0000-000000000002',
                  name: 'Carlos R. [mock]',
                  role: 'Cajero / Supervisor',
                  salesCount: 4,
                  revenueUsd: 470.0,
                  discrepanciesUsd: 0.0,
                  badgeColor: 'bg-blue-50 border-blue-200 text-blue-800',
                },
                {
                  id: 'u0000000-0000-0000-0000-000000000003',
                  name: 'Admin General [mock]',
                  role: 'Administrador de Sede',
                  salesCount: 0,
                  revenueUsd: 0.0,
                  discrepanciesUsd: 0.0,
                  badgeColor: 'bg-purple-50 border-purple-200 text-purple-800',
                },
              ].map((c) => (
                <div key={c.id} className="rounded-3xl border border-[#E5E9E7] bg-white p-6 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-[#111827]">{c.name}</h4>
                      <p className="text-[10px] text-[#52635A]">{c.role}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${c.badgeColor}`}>
                      Activo
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-t border-[#F0F2F1] pt-3 text-xs">
                    <div>
                      <span className="text-[10px] text-[#52635A]">Ventas procesadas</span>
                      <p className="font-bold text-[#111827]">{c.salesCount} tickets</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#52635A]">Volumen facturado</span>
                      <p className="font-bold text-[#111827]">${c.revenueUsd.toFixed(2)} USD</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#52635A]">Ticket promedio</span>
                      <p className="font-bold text-[#111827]">
                        ${c.salesCount > 0 ? (c.revenueUsd / c.salesCount).toFixed(2) : '0.00'} USD
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#52635A]">Diferencia de caja</span>
                      <p className="font-bold text-emerald-700">✓ $0.00 Cuadrado</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comparativo entre Cajas Físicas */}
          <div>
            <h3 className="text-base font-bold text-[#111827] mb-3">
              Comparativo entre Cajas de la Sede (Diagrama §8)
            </h3>
            <div className="overflow-x-auto rounded-3xl border border-[#E5E9E7] bg-white shadow-xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E5E9E7] bg-[#F6F5F0] text-[10px] font-bold uppercase tracking-wider text-[#52635A]">
                    <th className="py-3 px-4">Caja Física</th>
                    <th className="py-3 px-4">Código / Tipo</th>
                    <th className="py-3 px-4 text-center">Turnos Atendidos</th>
                    <th className="py-3 px-4 text-center">Operaciones</th>
                    <th className="py-3 px-4 text-right">Total Facturado (USD)</th>
                    <th className="py-3 px-4 text-right">Total Facturado (VES)</th>
                    <th className="py-3 px-4 text-center">Estado Técnico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F2F1]">
                  {registers.map((r) => {
                    const isReg1 = r.code === 'REG-01';
                    const amountUsd = isReg1 ? totalSalesUsd : 0;
                    return (
                      <tr key={r.id} className="hover:bg-[#F6F5F0]/60 transition">
                        <td className="py-3 px-4 font-bold text-[#111827]">{r.name}</td>
                        <td className="py-3 px-4 text-[#52635A]">{r.code} - Mostrador físico</td>
                        <td className="py-3 px-4 text-center font-bold text-[#111827]">
                          {shifts.filter((s) => s.register_id === r.id).length}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-[#111827]">
                          {isReg1 ? salesCount : 0}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-[#111827]">
                          ${amountUsd.toFixed(2)} USD
                        </td>
                        <td className="py-3 px-4 text-right font-black text-[#111827]">
                          {(amountUsd * exchangeRate).toLocaleString('es-VE')} VES
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            En línea
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle de Arqueo y Movimientos de Turno */}
      {selectedShiftForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[#DCE3DF] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E5E9E7] pb-4">
              <div>
                <h3 className="text-base font-bold text-[#111827]">
                  Detalle de Arqueo y Conciliación de Turno
                </h3>
                <p className="text-xs text-[#52635A]">
                  Turno #{selectedShiftForDetail.id} | Cajero: {selectedShiftForDetail.cashier_name_snapshot}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedShiftForDetail(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F6F5F0] text-[#52635A] hover:bg-[#DCE3DF]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* Información General */}
              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-[#F6F5F0] p-4 sm:grid-cols-4">
                <div>
                  <span className="text-[10px] text-[#52635A]">Apertura</span>
                  <p className="font-bold text-[#111827]">
                    {new Date(selectedShiftForDetail.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-[#52635A]">Cierre</span>
                  <p className="font-bold text-[#111827]">
                    {selectedShiftForDetail.closed_at
                      ? new Date(selectedShiftForDetail.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'En curso'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-[#52635A]">Fondo USD</span>
                  <p className="font-bold text-[#111827]">${selectedShiftForDetail.opening_amount_usd.toFixed(2)} USD</p>
                </div>
                <div>
                  <span className="text-[10px] text-[#52635A]">Fondo VES</span>
                  <p className="font-bold text-[#111827]">{selectedShiftForDetail.opening_amount_ves.toFixed(2)} VES</p>
                </div>
              </div>

              {/* Comparativo de Arqueo Ciego */}
              <div>
                <h4 className="font-bold text-[#111827] mb-2">Desglose de Arqueo por Método de Pago</h4>
                <div className="overflow-x-auto rounded-2xl border border-[#E5E9E7]">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#F6F5F0] text-[10px] font-bold uppercase text-[#52635A]">
                        <th className="p-2.5">Cubeta / Método</th>
                        <th className="p-2.5 text-right">Esperado Sistema</th>
                        <th className="p-2.5 text-right">Declarado Ciego</th>
                        <th className="p-2.5 text-center">Diferencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F2F1]">
                      {Object.entries(selectedShiftForDetail.expected_totals ?? {}).map(([key, val]) => {
                        const declared = selectedShiftForDetail.declared_totals?.[key] ?? val;
                        const diff = selectedShiftForDetail.differences_totals?.[key] ?? 0;
                        const isVes = key.includes('ves');
                        return (
                          <tr key={key}>
                            <td className="p-2.5 font-bold uppercase text-[#111827]">
                              {key.replace(/_/g, ' ')}
                            </td>
                            <td className="p-2.5 text-right font-medium text-[#111827]">
                              {isVes ? `Bs. ${Number(val).toLocaleString('es-VE')}` : `$${Number(val).toFixed(2)}`}
                            </td>
                            <td className="p-2.5 text-right font-medium text-[#111827]">
                              {selectedShiftForDetail.status === 'cerrado'
                                ? isVes ? `Bs. ${Number(declared).toLocaleString('es-VE')}` : `$${Number(declared).toFixed(2)}`
                                : 'Pendiente'}
                            </td>
                            <td className="p-2.5 text-center">
                              {selectedShiftForDetail.status === 'cerrado' ? (
                                diff === 0 ? (
                                  <span className="text-emerald-700 font-bold">✓ $0.00</span>
                                ) : (
                                  <span className="text-red-700 font-bold">${Number(diff).toFixed(2)}</span>
                                )
                              ) : (
                                '-'
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Movimientos de Caja durante el Turno */}
              <div>
                <h4 className="font-bold text-[#111827] mb-2">Movimientos de Efectivo Registrados</h4>
                <div className="space-y-2">
                  {cashMovements
                    .filter((m) => m.shift_id === selectedShiftForDetail.id)
                    .map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded-xl border border-[#E5E9E7] bg-white p-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                m.movement_type === 'ingreso_efectivo'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {m.movement_type === 'ingreso_efectivo' ? 'Ingreso' : 'Retiro'}
                            </span>
                            <span className="font-bold text-[#111827]">${m.amount.toFixed(2)} {m.currency}</span>
                          </div>
                          <p className="mt-0.5 text-[10px] text-[#52635A]">{m.reason}</p>
                        </div>
                        <span className="text-[10px] text-[#52635A]">
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  {cashMovements.filter((m) => m.shift_id === selectedShiftForDetail.id).length === 0 && (
                    <p className="py-2 text-center text-xs text-[#52635A]">
                      No se registraron movimientos extraordinarios de efectivo en este turno.
                    </p>
                  )}
                </div>
              </div>

              {/* Justificación de Auditoría */}
              {selectedShiftForDetail.closing_justification && (
                <div className="rounded-2xl border border-[#FDE68A] bg-[#FEF3C7] p-3">
                  <span className="font-bold text-[#92400E]">Justificación de cierre / auditoría:</span>
                  <p className="mt-1 text-[11px] text-[#92400E]">
                    {selectedShiftForDetail.closing_justification}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-[#E5E9E7] pt-4">
              <button
                type="button"
                onClick={() => setSelectedShiftForDetail(null)}
                className="rounded-xl border border-[#DCE3DF] bg-white px-4 py-2 text-xs font-bold text-[#111827]"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  showNotification('Impresión de arqueo', `Comprobante de turno #${selectedShiftForDetail.id.slice(0, 8)} enviado a impresora [mock].`, 'success');
                }}
                className="flex items-center gap-1.5 rounded-xl bg-[#144D37] px-4 py-2 text-xs font-bold text-white hover:bg-[#1E6B4E]"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir arqueo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
