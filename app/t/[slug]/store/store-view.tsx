'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  Truck,
  Sparkles,
  Gift,
  Search,
  ShoppingBag,
  User,
  Heart,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImagePlaceholder } from '@/components/image-placeholder';

export function StoreView({
  tenantName,
  secondaryColor,
  ambientImage,
  slug,
}: {
  tenantName: string;
  secondaryColor: string;
  ambientImage?: string | null;
  slug: string;
}) {
  const isSolee = slug === 'solee';
  const [cartCount, setCartCount] = useState(2);
  const [activeCategory, setActiveCategory] = useState<string>('todos');

  const categories = [
    {
      id: 'velas',
      title: 'Velas aromáticas',
      desc: 'Colección de velas de soja y cera vegetal',
      img: '/solee/cat_velas.webp',
    },
    {
      id: 'lamparas',
      title: 'Lámparas para velas',
      desc: 'Luz cálida y calor difusor sin humo',
      img: '/solee/cat_lamparas.webp',
    },
    {
      id: 'essence',
      title: 'Home Essence',
      desc: 'Difusores y mikados de alta duración',
      img: '/solee/cat_essence.webp',
    },
    {
      id: 'regalos',
      title: 'Sets de regalo',
      desc: 'Detalles seleccionados para momentos memorables',
      img: '/solee/cat_regalos.webp',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Store Header Bar matching Mockup */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-6 sm:px-8 py-3.5 sm:py-4 shadow-xs">
        <div className="flex items-center gap-8 lg:gap-12">
          {/* Established Text Logo */}
          {isSolee ? (
            <span className="font-serif text-xl sm:text-2xl font-medium tracking-[0.35em] text-slate-900 uppercase">
              SOLEÉ
            </span>
          ) : (
            <span className="font-serif text-xl font-bold tracking-[0.25em] text-slate-900 uppercase">
              {tenantName}
            </span>
          )}

          {/* Nav Categories */}
          <nav className="hidden gap-7 text-sm font-medium text-slate-700 md:flex lg:gap-9">
            <span
              onClick={() => setActiveCategory('velas')}
              className={`cursor-pointer transition-colors hover:text-slate-900 ${
                activeCategory === 'velas' ? 'text-slate-950 font-semibold' : ''
              }`}
            >
              Velas
            </span>
            <span
              onClick={() => setActiveCategory('aromas')}
              className={`cursor-pointer transition-colors hover:text-slate-900 ${
                activeCategory === 'aromas' ? 'text-slate-950 font-semibold' : ''
              }`}
            >
              Aromas para el hogar
            </span>
            <span
              onClick={() => setActiveCategory('lamparas')}
              className={`cursor-pointer transition-colors hover:text-slate-900 ${
                activeCategory === 'lamparas' ? 'text-slate-950 font-semibold' : ''
              }`}
            >
              Lámparas
            </span>
            <span
              onClick={() => setActiveCategory('regalos')}
              className={`cursor-pointer transition-colors hover:text-slate-900 ${
                activeCategory === 'regalos' ? 'text-slate-950 font-semibold' : ''
              }`}
            >
              Regalos
            </span>
          </nav>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-5 sm:gap-6">
          <button
            type="button"
            className="flex items-center justify-center text-slate-800 hover:text-[#5136db] transition-colors p-1"
            title="Buscar en catálogo"
          >
            <Search className="h-5 w-5 stroke-[1.8]" />
          </button>
          <button
            type="button"
            className="flex items-center justify-center text-slate-800 hover:text-[#5136db] transition-colors p-1"
            title="Mi cuenta"
          >
            <User className="h-5 w-5 stroke-[1.8]" />
          </button>
          <button
            type="button"
            onClick={() => setCartCount((c) => c + 1)}
            className="relative flex items-center justify-center text-slate-800 hover:text-[#5136db] transition-colors p-1 cursor-pointer"
            title="Carrito de compras"
          >
            <ShoppingBag className="h-5 w-5 stroke-[1.8]" />
            <span className="absolute -top-1 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#7c3aed] text-[10px] font-bold text-white shadow-xs leading-none">
              {cartCount}
            </span>
          </button>
        </div>
      </div>

      {/* Hero Banner matching Screenshot 5 */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-50/70 via-white to-pink-50/40 border border-purple-100/60 p-8 sm:p-12 shadow-xs">
        {/* Ambient right illustration / placeholder without aggressive cropping */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-[50%] max-w-[550px] hidden sm:block overflow-hidden">
          {ambientImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ambientImage}
              alt=""
              className="h-full w-full object-cover object-right"
              style={{
                maskImage:
                  'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.2) 20%, black 60%)',
                WebkitMaskImage:
                  'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.2) 20%, black 60%)',
              }}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center p-6 opacity-30">
              <ImagePlaceholder
                aspectRatio="aspect-auto"
                className="w-full h-full border-none bg-transparent"
                label="Foto de catálogo ambiental"
                sublabel="Sin recorte"
                objectFit="contain"
              />
            </div>
          )}
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-xl space-y-4">
          <span className="inline-block rounded-full bg-purple-100 px-3 py-1 text-[11px] font-bold tracking-wider text-[#5136db] uppercase">
            LA EXPERIENCIA {tenantName}
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
            Un aroma que hace sentir tu hogar.
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-md">
            Velas, fragancias y detalles para tus espacios.
          </p>
          <div className="pt-2">
            <Button className="h-11 rounded-xl bg-[#5136db] hover:bg-[#432bc2] text-white px-6 font-semibold text-sm shadow-md flex items-center gap-2">
              <span>Explorar productos</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {/* 3 feature badges matching mockup */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-purple-100/60">
            <div className="flex items-center gap-2.5">
              <Truck className="h-4 w-4 text-[#5136db] shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-800">Envíos a todo el país</p>
                <p className="text-[10px] text-slate-500">Rápido y seguro</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 text-[#5136db] shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-800">Fragancias exclusivas</p>
                <p className="text-[10px] text-slate-500">Diseños con propósito</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Gift className="h-4 w-4 text-[#5136db] shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-800">Regalos memorables</p>
                <p className="text-[10px] text-slate-500">Para cada ocasión</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Showcase matching Screenshot 5 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl font-bold text-slate-900">
              Descubre {tenantName}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Una selección para regalar, habitar y disfrutar.
            </p>
          </div>
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-semibold text-[#5136db] hover:underline"
          >
            <span>Ver todos los productos</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 4 Cards Grid with non-cropped image placeholders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {categories.map((c) => (
            <div
              key={c.id}
              className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white p-3 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
            >
              <div className="overflow-hidden rounded-xl bg-slate-50">
                <ImagePlaceholder
                  src={c.img}
                  alt={c.title}
                  aspectRatio="aspect-[4/3]"
                  className="w-full"
                  label={c.title}
                  sublabel="Espacio para tu imagen"
                  objectFit="contain"
                />
              </div>

              <div className="flex items-center justify-between pt-3 px-1">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm group-hover:text-[#5136db] transition-colors">
                    {c.title}
                  </h4>
                  <p className="text-[10.5px] text-slate-500 line-clamp-1">{c.desc}</p>
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors group-hover:bg-purple-50 group-hover:text-[#5136db]">
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
