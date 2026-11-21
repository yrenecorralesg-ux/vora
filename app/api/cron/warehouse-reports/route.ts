import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { runDueSchedules } from '@/lib/warehouse/report-schedules';

export const dynamic = 'force-dynamic';

/**
 * Tarea diaria (Vercel Cron, ver vercel.json): envía los reportes programados
 * de Warehouse que tocan hoy. Exige Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET no configurado.' }, { status: 503 });
  const got = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (got.length !== expected.length || !timingSafeEqual(got, expected))
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, '');
  const result = await runDueSchedules(getSupabaseServiceClient(), appUrl);
  return NextResponse.json({ ok: true, ...result });
}
