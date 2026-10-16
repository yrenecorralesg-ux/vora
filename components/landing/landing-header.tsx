'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { navLinks } from './landing-data';
import { focusRing } from './landing-ui';
import { VoraLogo } from './vora-logo';

export function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b transition-colors duration-300',
        scrolled || menuOpen ? 'border-[#285C49]/10 bg-[#F6F2E9]/95 shadow-[0_8px_30px_-20px_rgba(37,51,45,0.45)] backdrop-blur-md' : 'border-transparent bg-[#F6F2E9]/80 backdrop-blur-sm',
      )}
    >
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" aria-label="VORA by Venesoft, inicio" className={cn('rounded-lg', focusRing)}>
          <VoraLogo />
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-8 lg:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className={cn('rounded text-sm font-semibold text-[#25332D] transition hover:text-[#285C49]', focusRing)}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <Link href="/login" className={cn('rounded-full px-4 py-2.5 text-sm font-semibold text-[#285C49] transition hover:bg-[#E6EBDF]', focusRing)}>
            Iniciar sesión
          </Link>
          <a
            href="#contacto"
            className={cn('inline-flex items-center gap-2 rounded-full bg-[#285C49] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1F4A3A]', focusRing)}
          >
            Solicitar demostración <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>

        <button
          type="button"
          className={cn('rounded-xl p-2 text-[#285C49] transition hover:bg-[#E6EBDF] lg:hidden', focusRing)}
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
          aria-controls="menu-movil"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
        </button>
      </div>

      {menuOpen && (
        <nav id="menu-movil" aria-label="Menú móvil" className="border-t border-[#285C49]/10 bg-[#F6F2E9] px-5 pb-6 pt-4 lg:hidden">
          <ul className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn('block rounded-xl px-3 py-3 text-base font-semibold text-[#25332D] hover:bg-[#E6EBDF]', focusRing)}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-3 sm:hidden">
            <Link href="/login" className={cn('rounded-full border border-[#285C49] px-5 py-3 text-center font-semibold text-[#285C49]', focusRing)}>
              Iniciar sesión
            </Link>
            <a href="#contacto" onClick={() => setMenuOpen(false)} className={cn('rounded-full bg-[#285C49] px-5 py-3 text-center font-semibold text-white', focusRing)}>
              Solicitar demostración
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}
