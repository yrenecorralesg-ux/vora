'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth-provider';

export function AdminLogout({ className }: { className?: string }) {
  const router = useRouter();
  const { signOut } = useAuth();

  async function handleLogout() {
    await signOut();
    router.push('/login');
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      className={cn('justify-start gap-2 px-3 text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground', className)}
    >
      <LogOut className="h-4 w-4" />
      <span>Cerrar sesión</span>
    </Button>
  );
}
