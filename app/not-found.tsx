import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">404</h2>
      <p className="mt-2 text-base text-slate-600">Página no encontrada.</p>
      <Button asChild className="mt-6 rounded-xl">
        <Link href="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
