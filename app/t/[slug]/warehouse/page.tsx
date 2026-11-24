import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  Boxes,
  ClipboardCheck,
  DollarSign,
  FileSpreadsheet,
  LayoutDashboard,
  Package,
  PackageCheck,
  ScanBarcode,
} from 'lucide-react';
import { requireWarehousePage } from '@/lib/warehouse/access';
import { loadDashboard } from '@/lib/warehouse/queries';
import { MOVEMENT_TYPES } from '@/lib/warehouse/catalog';
import { fmtDate, fmtMoney, fmtQty, signed } from '@/lib/warehouse/format';
import { DataTable, EmptyState, Kpi, KpiGrid, Panel, Pill, PrimaryLink, SecondaryLink, TextLink, WhHeader, btn } from '@/components/warehouse/wh-ui';
import { MovementsChart } from '@/components/warehouse/wh-charts';

export const dynamic = 'force-dynamic';

function trend(today: number, yesterday: number) {
  if (!yesterday) return today ? 'Sin registros ayer' : 'Sin cambios';
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  return `${pct > 0 ? '▲' : pct < 0 ? '▼' : '='} ${Math.abs(pct)}% vs. ayer`;
}

/** WH-01 · Dashboard de inventario */
export default async function WarehouseDashboard({ params }: { params: { slug: string } }) {
  const ctx = await requireWarehousePage(params.slug);
  const d = await loadDashboard(ctx);
  const base = `/t/${params.slug}/warehouse`;
  const quick = [
    { show: ctx.can('stock.receive'), href: `${base}/receipts`, label: 'Registrar entrada', icon: ArrowDownToLine },
    { show: ctx.can('stock.issue'), href: `${base}/issues`, label: 'Registrar salida', icon: ArrowUpFromLine },
    { show: ctx.can('stock.adjust.request'), href: `${base}/adjustments`, label: 'Solicitar ajuste', icon: ClipboardCheck },
    { show: ctx.can('stock.receive') && ctx.functions.wh_scanner, href: `${base}/scan`, label: 'Escanear', icon: ScanBarcode },
    { show: ctx.can('import.validate') && ctx.functions.wh_imports, href: `${base}/imports`, label: 'Importar', icon: FileSpreadsheet },
  ].filter((q) => q.show);

  return (
    <div className="space-y-5">
      <WhHeader code="WH-01" icon={LayoutDashboard} title="Dashboard de inventario" subtitle="Indicadores, movimientos y alertas">
        <SecondaryLink href={`${base}/stock?alert=1`}>
          <AlertTriangle className="h-4 w-4" /> Ver alertas
        </SecondaryLink>
        {ctx.can('stock.receive') && (
          <PrimaryLink href={`${base}/receipts`}>
            <ArrowDownToLine className="h-4 w-4" /> Nueva entrada
          </PrimaryLink>
        )}
      </WhHeader>

      <KpiGrid>
        <Kpi icon={Package} label="Artículos activos" value={fmtQty(d.items)} hint={`${fmtQty(d.warehouses)} almacenes activos`} href={`${base}/catalog`} />
        <Kpi
          icon={AlertTriangle}
          label="Alertas de stock"
          value={fmtQty(d.alerts)}
          tone={d.alerts ? 'warn' : 'good'}
          hint={d.alerts ? 'Agotados o bajo el mínimo' : 'Todo en orden'}
          href={`${base}/stock?alert=1`}
        />
        <Kpi icon={ArrowRightLeft} label="Movimientos hoy" value={fmtQty(d.movesToday)} hint={trend(d.movesToday, d.movesYesterday)} href={`${base}/kardex`} />
        {ctx.can('cost.view') ? (
          <Kpi icon={DollarSign} label="Valor del inventario" value={fmtMoney(d.value)} hint="A costo promedio ponderado" href={`${base}/reports`} />
        ) : (
          <Kpi
            icon={ClipboardCheck}
            label="Ajustes pendientes"
            value={fmtQty(d.pending)}
            tone={d.pending ? 'warn' : 'default'}
            hint={d.pending ? 'Esperan aprobación' : 'Nada pendiente'}
            href={`${base}/adjustments`}
          />
        )}
      </KpiGrid>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Entradas y salidas" description="Unidades del stock vendible, últimos 14 días" className="lg:col-span-2">
          <MovementsChart data={d.series} />
        </Panel>

        <Panel title="Accesos rápidos">
          <div className="grid gap-2">
            {quick.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-3 rounded-xl border border-[#EFEBE2] px-3 py-2.5 text-[13px] font-medium text-[#1B3D2F] transition hover:border-[var(--crm-primary,#285C49)]/30 hover:bg-[#F8F6F1]"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--crm-primary,#285C49)]/10 text-[var(--crm-primary,#285C49)] transition group-hover:bg-[var(--crm-primary,#285C49)] group-hover:text-white">
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </Link>
            ))}
            {d.pending > 0 && ctx.can('stock.adjust.approve') && (
              <Link href={`${base}/adjustments`} className="mt-1 flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2.5 text-[12px] font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
                {fmtQty(d.pending)} ajuste(s) esperan tu aprobación
                <span aria-hidden>→</span>
              </Link>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Alertas de stock" actions={<TextLink href={`${base}/stock?alert=1`}>Ver todas</TextLink>}>
          <DataTable
            head={['Artículo', 'Almacén', 'Disponible', 'Mínimo', 'Estado']}
            empty={<EmptyState icon={PackageCheck} title="Sin alertas" description="Ningún artículo está agotado ni por debajo de su mínimo." />}
          >
            {d.topAlerts.map((a) => (
              <tr key={`${a.item_id}-${a.warehouse_id}`}>
                <td>
                  <Link href={`${base}/catalog/${a.item_id}`} className="font-medium hover:text-[var(--crm-primary,#285C49)] hover:underline">{a.name}</Link>
                  <p className="font-mono text-[11px] text-slate-500">{a.sku}</p>
                </td>
                <td className="text-slate-600">{a.warehouse_code}</td>
                <td className="tabular-nums font-semibold">{fmtQty(a.available)}</td>
                <td className="tabular-nums text-slate-600">{fmtQty(a.min_stock)}</td>
                <td>{a.alert === 'Sin stock' ? <Pill tone="red">Agotado</Pill> : <Pill tone="amber">Bajo</Pill>}</td>
              </tr>
            ))}
          </DataTable>
        </Panel>

        {ctx.can('cost.view') ? (
          <Panel title="Mayor valor en existencia" actions={<TextLink href={`${base}/reports`}>Reportes</TextLink>}>
            {d.topValue.length === 0 ? (
              <EmptyState icon={Boxes} title="Sin existencias valorizadas" description="Registra entradas con su costo para ver el valor del inventario." />
            ) : (
              <ul className="space-y-3">
                {d.topValue.map((v) => {
                  const pct = d.value > 0 ? (v.value / d.value) * 100 : 0;
                  return (
                    <li key={v.sku}>
                      <div className="flex items-baseline justify-between gap-2 text-[13px]">
                        <span className="truncate font-medium text-[#1B3D2F]">
                          {v.name} <span className="font-mono text-[11px] text-slate-500">{v.sku}</span>
                        </span>
                        <span className="shrink-0 tabular-nums font-semibold text-[#1B3D2F]">{fmtMoney(v.value)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F1EDE5]">
                        <div className="h-full rounded-full bg-[#1E7A55]" style={{ width: `${Math.max(2, pct)}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        ) : (
          <Panel title="Ajustes pendientes" actions={<TextLink href={`${base}/adjustments`}>Ver ajustes</TextLink>}>
            <EmptyState
              icon={ClipboardCheck}
              title={d.pending ? `${fmtQty(d.pending)} ajuste(s) pendientes` : 'Nada pendiente'}
              description={d.pending ? 'Un supervisor de almacén debe aprobarlos.' : 'No hay ajustes esperando aprobación.'}
            />
          </Panel>
        )}
      </div>

      <Panel title="Últimos movimientos" actions={<TextLink href={`${base}/kardex`}>Ver kardex</TextLink>}>
        <DataTable
          head={['Fecha', 'Artículo', 'Movimiento', 'Cantidad', 'Saldo']}
          empty={
            <EmptyState
              icon={ArrowRightLeft}
              title="Aún no hay movimientos"
              description="Registra una entrada o importa el stock inicial para empezar."
              action={ctx.can('stock.receive') ? <Link href={`${base}/receipts`} className={btn.primary}>Registrar entrada</Link> : undefined}
            />
          }
        >
          {d.recent.map((m) => (
            <tr key={m.id}>
              <td className="whitespace-nowrap text-slate-600">{fmtDate(m.created_at)}</td>
              <td>
                <span className="font-medium">{m.item_name}</span>
                <p className="font-mono text-[11px] text-slate-500">{m.sku}</p>
              </td>
              <td>
                <Pill tone={m.quantity > 0 ? 'green' : 'amber'}>{MOVEMENT_TYPES[m.movement_type] ?? m.movement_type}</Pill>
              </td>
              <td className={`tabular-nums font-semibold ${m.quantity > 0 ? 'text-emerald-700' : 'text-[#9A4B2E]'}`}>{signed(m.quantity)}</td>
              <td className="tabular-nums text-slate-600">{fmtQty(m.on_hand_after)}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </div>
  );
}
