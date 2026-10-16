import Image from 'next/image';
import { ArrowRight, CalendarCheck2, CheckCircle2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { focusRing } from './landing-ui';

const heroTiles = [
  { src: '/landing/hero-people.webp', alt: 'Persona consultando sus solicitudes de vacaciones en el portal de VORA', width: 344, height: 492, className: 'mt-10 sm:mt-14' },
  { src: '/landing/hero-commerce.webp', alt: 'Cajera atendiendo con un lector de códigos en un comercio', width: 310, height: 488, className: '' },
  { src: '/landing/hero-warehouse.webp', alt: 'Empleado de almacén revisando existencias de VORA en una tablet', width: 334, height: 512, className: 'mt-6 sm:mt-8' },
];

export function HeroSection() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-40 h-[28rem] w-[28rem] rounded-full bg-[#A9BEA5]/35 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-24 h-[24rem] w-[24rem] rounded-full bg-[#E9DCC8]/70 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10 lg:pb-28 lg:pt-16">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-[#DDE8D8] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#285C49]">
            <Sparkles className="h-4 w-4" aria-hidden="true" /> Tecnología con propósito
          </p>
          <h1 id="hero-title" className="mt-6 font-jakarta text-[2.6rem] font-extrabold leading-[1.05] tracking-[-0.035em] text-[#285C49] sm:text-6xl lg:text-[4.1rem]">
            Tu negocio tiene grandes ideas. <span className="text-[#B5653F]">VORA las ayuda a crecer.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#52675A]">
            Ventas, inventario, distribución, empleados, finanzas e inteligencia empresarial. Todo conectado en una plataforma que crece contigo.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href="#soluciones" className={cn('inline-flex items-center justify-center gap-2 rounded-full bg-[#285C49] px-7 py-4 font-semibold text-white shadow-lg shadow-[#285C49]/20 transition hover:bg-[#1F4A3A]', focusRing)}>
              Conoce VORA <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </a>
            <a href="#precios" className={cn('inline-flex items-center justify-center rounded-full border-2 border-[#285C49] px-7 py-[14px] font-semibold text-[#285C49] transition hover:bg-[#E6EBDF]', focusRing)}>
              Ver planes
            </a>
            <a href="#contacto" className={cn('inline-flex items-center justify-center gap-2 rounded-full px-5 py-4 font-semibold text-[#8A4528] underline-offset-4 transition hover:underline', focusRing)}>
              <CalendarCheck2 className="h-5 w-5" aria-hidden="true" /> Solicitar demostración
            </a>
          </div>

          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[#52675A]">
            {['Módulos que se activan por etapas', 'Para emprendimientos y grandes empresas'].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#285C49]" aria-hidden="true" /> {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="grid grid-cols-3 items-start gap-3 sm:gap-4">
            {heroTiles.map((tile, index) => (
              <div key={tile.src} className={cn('overflow-hidden rounded-[1.6rem] bg-[#E9DCC8] shadow-xl shadow-[#25332D]/10 ring-1 ring-[#25332D]/5', tile.className)}>
                <Image
                  src={tile.src}
                  alt={tile.alt}
                  width={tile.width}
                  height={tile.height}
                  priority={index === 1}
                  sizes="(min-width: 1024px) 200px, 30vw"
                  className="aspect-[3/4.6] h-full w-full object-cover"
                />
              </div>
            ))}
          </div>

          <div className="absolute -bottom-8 left-1/2 w-max max-w-[15rem] -translate-x-1/2 rounded-2xl border border-[#E9DCC8] bg-white/95 px-5 py-4 shadow-xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#A4573A]">Una sola plataforma</p>
            <p className="mt-1 font-jakarta text-lg font-extrabold leading-snug text-[#285C49]">Tu empresa, conectada.</p>
          </div>
          <p className="absolute -top-7 right-1 rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-[#52675A] shadow-sm">
            Imágenes conceptuales · pantallas ilustrativas
          </p>
        </div>
      </div>
    </section>
  );
}
