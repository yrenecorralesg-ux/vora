import { ListTodo, Plus, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { requireTenantFeature } from '@/lib/tenant-access';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CrmHeader } from '@/components/crm-header';
import { demoTasks, taskStatusLabel, taskTypeLabel } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

const estadoBadge: Record<string, string> = {
  pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
  en_progreso: 'bg-blue-50 text-blue-700 border-blue-200',
  completada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  vencida: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default async function TasksPage({
  params,
}: {
  params: { slug: string };
}) {
  await requireTenantFeature(params.slug, 'crm.tasks');

  const supabase = getSupabaseServerClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, commercial_name, slug')
    .eq('slug', params.slug)
    .maybeSingle();

  const { data: branding } = await supabase
    .from('tenant_branding')
    .select('secondary_color, banner_url')
    .eq('tenant_id', tenant?.id ?? '')
    .maybeSingle();

  let headerBannerUrl: string | null = null;
  if (branding?.banner_url) {
    try {
      const parsed = JSON.parse(branding.banner_url);
      headerBannerUrl = parsed.header || null;
    } catch {
      headerBannerUrl = branding.banner_url;
    }
  }

  const isSolee = params.slug === 'solee';
  const tenantName = tenant?.commercial_name ?? (isSolee ? 'SOLEÉ' : 'CRM');
  const secondaryColor = branding?.secondary_color ?? (isSolee ? '#7c3aed' : '#63DCE5');

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <CrmHeader
        tenantName={tenantName}
        title="Seguimiento y tareas"
        subtitle="Actividades asignadas al equipo comercial para contacto, recompra y cierre."
        ambientImageUrl={headerBannerUrl}
        secondaryColor={secondaryColor}
        action={
          <Button size="sm" className="rounded-xl bg-[#5136db] hover:bg-[#432bc2] text-white text-xs h-9">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nueva tarea
          </Button>
        }
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Card className="rounded-2xl border-slate-100 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Pendientes</p>
              <p className="text-xl font-bold text-slate-900">
                {demoTasks.filter((t) => t.estado === 'pendiente').length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-100 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <ListTodo className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">En Progreso</p>
              <p className="text-xl font-bold text-slate-900">
                {demoTasks.filter((t) => t.estado === 'en_progreso').length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-100 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Completadas</p>
              <p className="text-xl font-bold text-slate-900">
                {demoTasks.filter((t) => t.estado === 'completada').length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card className="overflow-hidden rounded-2xl border-slate-100 bg-white shadow-xs">
        <CardContent className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-4">Tarea</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Asignada a</th>
                <th className="px-6 py-4">Vencimiento</th>
                <th className="px-6 py-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {demoTasks.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="px-6 py-4 font-semibold text-slate-900">
                    {t.titulo}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-slate-600 capitalize">
                      {taskTypeLabel[t.tipo] || t.tipo}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-700">
                    {t.cliente}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {t.responsable}
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-600">
                    {t.fechaVencimiento}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className={`text-xs font-semibold capitalize ${estadoBadge[t.estado] || ''}`}>
                      {taskStatusLabel[t.estado] || t.estado}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
