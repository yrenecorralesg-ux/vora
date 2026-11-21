import type { PosDispatchOrder, PosDispatchStatus, PosSale } from '@/lib/types';

/** Usuario real de la empresa visto desde el POS (tenant_memberships + Auth). */
export interface PosStaffUser {
  id: string;
  name: string;
  email: string | null;
  role: string;
  is_active: boolean;
  has_pin: boolean;
  created_at?: string;
}

export interface PosMe {
  id: string;
  name: string;
  email: string | null;
  role: string;
  has_pin: boolean;
  can_approve: boolean;
  permissions: Record<string, boolean>;
}

export interface PosSupervisor {
  id: string;
  name: string;
  role: string;
  permissions: string[];
}

/** Libro de ventas (formato SENIAT, separador ;) a partir de las ventas guardadas. */
export function buildSalesBookCsv(sales: PosSale[], params?: { startDate?: string; endDate?: string }): string {
  const headers = [
    'Nro_Operacion', 'Fecha_Comprobante', 'Nro_Factura_Comprobante', 'Nro_Control_Fiscal', 'Tipo_Transaccion',
    'Tipo_Documento_Cliente', 'RIF_Cedula_Cliente', 'Nombre_Razon_Social_Comprador', 'Total_Ventas_USD',
    'Tipo_Cambio_BCV', 'Total_Ventas_VES_Con_IVA', 'Ventas_Exentas_VES', 'Base_Imponible_16_VES', 'IVA_16_VES',
    'Base_Imponible_IGTF_USD', 'IGTF_3_USD', 'Metodos_Pago', 'Estado_Comercial',
  ];
  let filtered = sales;
  if (params?.startDate) filtered = filtered.filter((s) => s.created_at >= params.startDate!);
  if (params?.endDate) filtered = filtered.filter((s) => s.created_at <= params.endDate!);
  const cell = (v: string) => `"${v.replace(/"/g, '""').replace(/;/g, ',')}"`;

  const rows = filtered.map((s, idx) => {
    const docNum = s.fiscal_request?.fiscal_invoice_number || s.document?.internal_number || s.sale_number;
    const controlNum = s.fiscal_request?.fiscal_control_number || 'N/A';
    const rate = s.exchange_rate_snapshot;
    const payments = s.payments ?? [];
    const cashUsd = payments
      .filter((p) => p.method === 'efectivo' && p.currency === 'USD')
      .reduce((sum, p) => sum + p.amount_applied, 0);
    return [
      idx + 1,
      new Date(s.confirmed_at || s.created_at).toLocaleDateString('es-VE'),
      cell(docNum),
      cell(controlNum),
      '01-REG',
      s.customer?.document_type || 'V',
      s.customer?.document_number || '00000000',
      cell(s.customer?.legal_name || 'Consumidor Final'),
      s.total_usd.toFixed(2),
      rate.toFixed(2),
      s.total_ves.toFixed(2),
      '0.00',
      (s.subtotal_usd * rate).toFixed(2),
      (s.tax_total_usd * rate).toFixed(2),
      cashUsd.toFixed(2),
      (cashUsd * 0.03).toFixed(2),
      cell(payments.map((p) => `${p.method.toUpperCase()}(${p.amount_applied}${p.currency})`).join(' + ')),
      s.commercial_status.toUpperCase(),
    ].join(';');
  });
  return '﻿' + [headers.join(';'), ...rows].join('\r\n');
}

/** Comandas de despacho (POS-20) a partir de las ventas con productos físicos. */
export function deriveDispatchOrders(sales: PosSale[]): PosDispatchOrder[] {
  return sales
    .filter((s) => s.commercial_status !== 'anulada' && (s.lines ?? []).some((l) => !l.is_service))
    .map((s) => {
      const meta = ((s as unknown as { metadata?: Record<string, any> }).metadata ?? {}) as Record<string, any>;
      const dispatch = (meta.dispatch ?? {}) as {
        status?: PosDispatchStatus;
        completed_skus?: string[];
        prepared_by?: string;
        completed_at?: string;
      };
      const done = new Set(dispatch.completed_skus ?? []);
      return {
        id: s.id,
        order_number: `DSP-${s.sale_number.replace(/^VTA-0*/, '')}`,
        sale_id: s.id,
        sale_number: s.sale_number,
        branch_id: s.branch_id,
        customer_name: s.customer?.legal_name || 'Consumidor Final',
        created_at: s.created_at,
        status: dispatch.status ?? 'pendiente',
        station: 'almacen' as const,
        items: (s.lines ?? [])
          .filter((l) => !l.is_service)
          .map((l) => ({ sku: l.sku_snapshot, name: l.name_snapshot, quantity: l.quantity, completed: done.has(l.sku_snapshot) })),
        prepared_by: dispatch.prepared_by,
        completed_at: dispatch.completed_at,
      };
    });
}

/** Mensaje de error de una respuesta de la API del POS. */
export async function apiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data?.error || fallback;
  } catch {
    return fallback;
  }
}
