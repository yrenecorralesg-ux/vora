import { ScanBarcode } from 'lucide-react';
import { requireWarehousePage } from '@/lib/warehouse/access';
import { loadFormOptions } from '@/lib/warehouse/queries';
import { Scanner } from '@/components/warehouse/scanner';
import { Panel, WhHeader } from '@/components/warehouse/wh-ui';

export const dynamic = 'force-dynamic';

/** WH-23 · Escaneo de códigos: ScanGun, lector USB o entrada manual. */
export default async function ScanPage({ params }: { params: { slug: string } }) {
  const ctx = await requireWarehousePage(params.slug, { permission: 'stock.receive', fn: 'wh_scanner' });
  const opts = await loadFormOptions(ctx);
  return (
    <div className="space-y-4">
      <WhHeader code="WH-23" icon={ScanBarcode} title="Escaneo de códigos" subtitle="ScanGun, lector USB o entrada manual" />
      <Panel>
        <Scanner slug={params.slug} warehouses={opts.warehouses} defaultWarehouseId={opts.settings?.default_warehouse_id ?? null} />
      </Panel>
      <p className="text-[12px] text-slate-500">
        Compatible con lectores USB o Bluetooth que funcionan como teclado. La cámara y los seriales individuales (WH-24) quedan para la extensión temprana.
      </p>
    </div>
  );
}
