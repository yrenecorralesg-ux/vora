import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FULL_ACCESS_ROLES, resolveRolePermissions, type WarehouseContext } from '@/lib/warehouse/access';
import { loadKardex, loadRotation, loadStock } from '@/lib/warehouse/queries';
import { fmtMoney, fmtQty } from '@/lib/warehouse/format';
import { sendVoraMail } from '@/lib/resend-mail';

/** Reportes programados de Warehouse (WH-11). */

export const REPORT_LABELS: Record<string, string> = {
  stock: 'Existencias y alertas',
  valuation: 'Valorización del inventario',
  rotation: 'Rotación por artículo',
  kardex: 'Movimientos del período',
};
export const FREQUENCY_LABELS: Record<string, string> = { daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual' };
export const WEEKDAYS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export interface ReportSchedule {
  id: string;
  tenant_id: string;
  report: 'stock' | 'valuation' | 'rotation' | 'kardex';
  frequency: 'daily' | 'weekly' | 'monthly';
  weekday: number | null;
  month_day: number | null;
  recipients: string[];
  warehouse_id: string | null;
  active: boolean;
  last_run_at: string | null;
}

/** Fecha de Caracas (YYYY-MM-DD), día de la semana ISO (1 = lunes) y día del mes. */
function caracasParts(d: Date) {
  const day = d.toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
  const weekdayName = d.toLocaleDateString('en-US', { timeZone: 'America/Caracas', weekday: 'short' });
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekdayName) + 1;
  return { day, weekday, monthDay: Number(day.slice(8, 10)) };
}

/** ¿Toca enviarlo hoy y aún no se envió hoy? */
export function isDue(s: ReportSchedule, now = new Date()): boolean {
  if (!s.active) return false;
  const today = caracasParts(now);
  if (s.last_run_at && caracasParts(new Date(s.last_run_at)).day === today.day) return false;
  if (s.frequency === 'weekly') return s.weekday === today.weekday;
  if (s.frequency === 'monthly') return s.month_day === today.monthDay;
  return true;
}

/** Ventana de datos según la frecuencia (para movimientos y rotación). */
function windowDays(s: ReportSchedule) {
  return s.frequency === 'daily' ? 1 : s.frequency === 'weekly' ? 7 : 30;
}

/** Arma el resumen del reporte. Los importes solo aparecen si el destinatario puede ver costos. */
async function summary(ctx: WarehouseContext, s: ReportSchedule, withCost: boolean): Promise<string[]> {
  const lines: string[] = [];
  if (s.report === 'stock' || s.report === 'valuation') {
    const stock = await loadStock(ctx, { warehouseId: s.warehouse_id });
    const out = stock.filter((r) => r.alert === 'Sin stock');
    const low = stock.filter((r) => r.alert === 'Stock bajo');
    lines.push(`Líneas de stock: ${fmtQty(stock.length)}`, `Agotados: ${fmtQty(out.length)}`, `Bajo el mínimo: ${fmtQty(low.length)}`);
    if (s.report === 'valuation' && withCost) {
      lines.push(`Valor del inventario: ${fmtMoney(stock.reduce((a, r) => a + r.value, 0))}`);
      const top = [...stock].sort((a, b) => b.value - a.value).slice(0, 5);
      if (top.length) lines.push('', 'Mayor valor:', ...top.map((r) => `  · ${r.sku} ${r.name} (${r.warehouse_code}): ${fmtMoney(r.value)}`));
    }
    if (s.report === 'stock' && out.length + low.length > 0)
      lines.push('', 'Alertas:', ...[...out, ...low].slice(0, 15).map((r) => `  · ${r.sku} ${r.name} (${r.warehouse_code}): disponible ${fmtQty(r.available)}, mínimo ${fmtQty(r.min_stock)}`));
  }
  if (s.report === 'rotation') {
    const rows = await loadRotation(ctx, windowDays(s) === 1 ? 7 : windowDays(s));
    lines.push(`Artículos con salidas: ${fmtQty(rows.filter((r) => r.outflow > 0).length)}`, '', 'Más vendidos / consumidos:');
    lines.push(...rows.slice(0, 10).map((r) => `  · ${r.sku} ${r.name}: ${fmtQty(r.outflow)} salidas, existencia ${fmtQty(r.on_hand)}`));
  }
  if (s.report === 'kardex') {
    const since = new Date(Date.now() - windowDays(s) * 86_400_000).toISOString().slice(0, 10);
    const moves = await loadKardex(ctx, { warehouseId: s.warehouse_id, from: since }, 5000);
    const inUnits = moves.filter((m) => m.quantity > 0).reduce((a, m) => a + m.quantity, 0);
    const outUnits = -moves.filter((m) => m.quantity < 0).reduce((a, m) => a + m.quantity, 0);
    lines.push(`Movimientos: ${fmtQty(moves.length)}`, `Unidades que entraron: ${fmtQty(inUnits)}`, `Unidades que salieron: ${fmtQty(outUnits)}`);
  }
  return lines;
}

/** Ejecuta los reportes que tocan hoy. Devuelve cuántos se enviaron y cuántos fallaron. */
export async function runDueSchedules(service: SupabaseClient, appUrl: string, now = new Date()) {
  const { data: schedules } = await service.from('warehouse_report_schedules').select('*').eq('active', true).limit(1000);
  let sent = 0;
  let failed = 0;
  for (const s of (schedules ?? []) as ReportSchedule[]) {
    if (!isDue(s, now)) continue;
    const { data: tenant } = await service.from('tenants').select('slug, commercial_name, commercial_status').eq('id', s.tenant_id).maybeSingle();
    if (!tenant || ['suspended', 'cancelled'].includes(tenant.commercial_status)) continue;
    const ctx = { service, tenantId: s.tenant_id } as unknown as WarehouseContext;
    const link = `${appUrl}/t/${tenant.slug}/warehouse/reports`;
    const statuses: string[] = [];

    for (const userId of s.recipients) {
      // Solo miembros activos que todavía pueden ver reportes.
      const { data: member } = await service
        .from('tenant_memberships')
        .select('role')
        .eq('tenant_id', s.tenant_id)
        .eq('auth_user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
      if (!member) continue;
      const perms = FULL_ACCESS_ROLES.includes(member.role) ? null : await resolveRolePermissions(service, s.tenant_id, member.role);
      if (perms && !perms.has('report.view')) continue;
      const { data } = await service.auth.admin.getUserById(userId);
      const email = data?.user?.email;
      if (!email) continue;
      const body = await summary(ctx, s, !perms || perms.has('cost.view'));
      const text = [
        `${REPORT_LABELS[s.report]} · ${tenant.commercial_name}`,
        `Envío ${FREQUENCY_LABELS[s.frequency].toLowerCase()} de VORA Warehouse.`,
        '',
        ...body,
        '',
        `Detalle y descarga (requiere iniciar sesión): ${link}`,
      ].join('\n');
      const day = now.toISOString().slice(0, 10);
      const result = await sendVoraMail(email, `VORA · ${REPORT_LABELS[s.report]} · ${tenant.commercial_name}`, text, `wh-report-${s.id}-${userId}-${day}`);
      statuses.push(result);
      if (result === 'accepted') sent++;
      else failed++;
    }
    await service
      .from('warehouse_report_schedules')
      .update({ last_run_at: now.toISOString(), last_status: statuses.length ? statuses.join(',') : 'sin destinatarios válidos' })
      .eq('id', s.id);
  }
  return { sent, failed };
}
