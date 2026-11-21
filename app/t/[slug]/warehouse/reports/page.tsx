import { BarChart3, Boxes, CalendarClock, DollarSign, Download, History, RefreshCw, Warehouse } from 'lucide-react';
import { FULL_ACCESS_ROLES, requireWarehousePage, resolveRolePermissions } from '@/lib/warehouse/access';
import { loadRotation, loadStock } from '@/lib/warehouse/queries';
import { fmtDate, fmtMoney, fmtQty } from '@/lib/warehouse/format';
import { FREQUENCY_LABELS, REPORT_LABELS, WEEKDAYS } from '@/lib/warehouse/report-schedules';
import { DataTable, DownloadLink, EmptyState, FilterBar, Kpi, KpiGrid, Panel, WhHeader } from '@/components/warehouse/wh-ui';
import { ReportScheduleForm, ScheduleList } from '@/components/warehouse/report-schedules';

export const dynamic = 'force-dynamic';

/** WH-11 · Reportes Warehouse: valorización, rotación, movimientos y envíos programados. */
export default async function ReportsPage({ params, searchParams }: { params: { slug: string }; searchParams: { days?: string } }) {
  const ctx = await requireWarehousePage(params.slug, { permission: 'report.view', fn: 'wh_reports' });
  const days = [7, 30, 90, 180, 365].includes(Number(searchParams.days)) ? Number(searchParams.days) : 30;
  const cost = ctx.can('cost.view');
  const [stock, rotation, { data: schedules }, { data: members }, { data: warehouses }] = await Promise.all([
    loadStock(ctx, {}),
    loadRotation(ctx, days),
    ctx.service.from('warehouse_report_schedules').select('*').eq('tenant_id', ctx.tenantId).order('created_at', { ascending: false }),
    ctx.service.from('tenant_memberships').select('auth_user_id, role').eq('tenant_id', ctx.tenantId).eq('status', 'active'),
    ctx.service.from('warehouse_warehouses').select('id, code, name').eq('tenant_id', ctx.tenantId).eq('status', 'active').order('code'),
  ]);

  const byWarehouse = new Map<string, { qty: number; value: number }>();
  for (const r of stock) {
    const w = byWarehouse.get(r.warehouse_code) ?? { qty: 0, value: 0 };
    w.qty += r.on_hand;
    w.value += r.value;
    byWarehouse.set(r.warehouse_code, w);
  }
  const totalValue = stock.reduce((s, r) => s + r.value, 0);

  // Posibles destinatarios: miembros activos que pueden ver reportes.
  const names = new Map<string, string>();
  const eligible: { id: string; label: string }[] = [];
  // En paralelo: antes eran 2 consultas por miembro, una tras otra.
  const resolved = await Promise.all(
    (members ?? []).map(async (m) => {
      const [perms, { data }] = await Promise.all([
        FULL_ACCESS_ROLES.includes(m.role) ? Promise.resolve(null) : resolveRolePermissions(ctx.service, ctx.tenantId, m.role),
        ctx.service.auth.admin.getUserById(m.auth_user_id),
      ]);
      const label = (data?.user?.user_metadata?.full_name as string) || data?.user?.email || 'Usuario';
      return { id: m.auth_user_id as string, label, canSee: !perms || perms.has('report.view') };
    }),
  );
  for (const r of resolved) {
    names.set(r.id, r.label);
    if (r.canSee) eligible.push({ id: r.id, label: r.label });
  }

  const api = `/api/t/${params.slug}/warehouse/export`;
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const reportOptions = Object.entries(REPORT_LABELS)
    .filter(([k]) => k !== 'valuation' || cost)
    .map(([id, label]) => ({ id, label }));
  const reportCards = [
    ...(cost ? [{ icon: DollarSign, title: 'Valorización', text: 'Valor del inventario a costo promedio ponderado, por artículo y almacén.', period: 'Al día de hoy', href: `${api}?kind=valuation` }] : []),
    { icon: RefreshCw, title: 'Rotación', text: 'Salidas del período frente a la existencia actual y días de inventario.', period: `Últimos ${days} días`, href: `${api}?kind=rotation&days=${days}` },
    { icon: History, title: 'Movimientos', text: 'Kardex completo del período con origen, saldo y motivo.', period: `Últimos ${days} días`, href: `${api}?kind=kardex&from=${from}&to=${today}` },
    { icon: Boxes, title: 'Existencias y alertas', text: 'Físico, reservado, disponible, dañado y alertas por almacén.', period: 'Al día de hoy', href: `${api}?kind=stock` },
  ];

  return (
    <div className="space-y-5">
      <WhHeader code="WH-11" icon={BarChart3} title="Reportes Warehouse" subtitle="Valorización, rotación, movimientos y envíos programados" />

      {cost && (
        <KpiGrid>
          <Kpi icon={DollarSign} label="Valor total del inventario" value={fmtMoney(totalValue)} hint="Costo promedio ponderado" />
          {Array.from(byWarehouse.entries())
            .sort((a, b) => b[1].value - a[1].value)
            .slice(0, 3)
            .map(([code, w]) => (
              <Kpi key={code} icon={Warehouse} label={`Almacén ${code}`} value={fmtMoney(w.value)} hint={`${fmtQty(w.qty)} unidades · ${totalValue ? Math.round((w.value / totalValue) * 100) : 0}%`} />
            ))}
        </KpiGrid>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {reportCards.map(({ icon: Icon, title, text, period, href }) => (
          <div key={title} className="flex flex-col rounded-2xl border border-[#E7E2D7] bg-white p-4 shadow-[0_1px_2px_rgba(27,61,47,0.04)]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#285C49]/10 text-[#285C49]">
              <Icon className="h-4 w-4" />
            </span>
            <p className="mt-3 text-[14px] font-semibold text-[#1B3D2F]">{title}</p>
            <p className="mt-1 flex-1 text-[12px] text-slate-500">{text}</p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">{period}</span>
              <DownloadLink href={href}>
                <Download className="h-4 w-4" /> CSV
              </DownloadLink>
            </div>
          </div>
        ))}
      </div>

      <Panel
        title={`Rotación · últimos ${days} días`}
        description="Salidas = salidas manuales, ventas POS y ajustes negativos. Rotación = salidas ÷ existencia actual."
        actions={
          <FilterBar>
            <select name="days" defaultValue={String(days)} aria-label="Período">
              {[7, 30, 90, 180, 365].map((d) => (
                <option key={d} value={d}>{d} días</option>
              ))}
            </select>
          </FilterBar>
        }
      >
        <DataTable head={['Artículo', 'Salidas', 'Existencia', 'Rotación', 'Días de inventario']} empty={<EmptyState icon={RefreshCw} title="Sin artículos con existencias" />}>
          {rotation.slice(0, 50).map((r) => (
            <tr key={r.item_id}>
              <td>
                <span className="font-medium">{r.name}</span>
                <p className="font-mono text-[11px] text-slate-500">{r.sku}</p>
              </td>
              <td className="tabular-nums font-semibold">{fmtQty(r.outflow)}</td>
              <td className="tabular-nums text-slate-600">{fmtQty(r.on_hand)}</td>
              <td className="tabular-nums">{r.rotation ?? '—'}</td>
              <td className="tabular-nums text-slate-600">{r.days_of_stock ?? '—'}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Programar envío por correo" description="Resumen con enlace al detalle (requiere iniciar sesión). Se envía a las 7:00 a. m., hora de Caracas.">
          <ReportScheduleForm
            slug={params.slug}
            reports={reportOptions}
            members={eligible}
            warehouses={(warehouses ?? []).filter((w) => ctx.canUseWarehouse(w.id)).map((w) => ({ id: w.id, label: `${w.code} · ${w.name}` }))}
          />
        </Panel>
        <Panel title="Envíos programados" actions={<CalendarClock className="h-4 w-4 text-slate-400" />}>
          <ScheduleList
            slug={params.slug}
            rows={(schedules ?? []).map((s) => ({
              id: s.id,
              report: REPORT_LABELS[s.report] ?? s.report,
              frequency: FREQUENCY_LABELS[s.frequency] ?? s.frequency,
              when: s.frequency === 'weekly' ? `cada ${WEEKDAYS[s.weekday] ?? ''}` : s.frequency === 'monthly' ? `día ${s.month_day}` : 'todos los días',
              recipients: (s.recipients as string[]).map((id) => names.get(id) ?? 'usuario').join(', '),
              active: s.active,
              last: s.last_run_at ? `${fmtDate(s.last_run_at)} (${s.last_status ?? '—'})` : 'aún no se ha enviado',
              canEdit: s.created_by === ctx.userId || FULL_ACCESS_ROLES.includes(ctx.role),
            }))}
          />
        </Panel>
      </div>
    </div>
  );
}
