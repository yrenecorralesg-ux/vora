'use client';

import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ImagePlaceholderProps {
  src?: string | null;
  alt?: string;
  className?: string;
  aspectRatio?: string; // e.g. "aspect-[16/9]", "aspect-square", "aspect-[4/3]"
  label?: string;
  sublabel?: string;
  objectFit?: 'contain' | 'cover';
  fallbackText?: string;
}

export function ImagePlaceholder({
  src,
  alt = 'Placeholder de imagen',
  className,
  aspectRatio = 'aspect-square',
  label = 'Imagen',
  sublabel = 'Haz clic para reemplazar',
  objectFit = 'contain',
}: ImagePlaceholderProps) {
  const [hasError, setHasError] = React.useState(false);

  if (src && !hasError) {
    return (
      <div
        className={cn(
          'relative overflow-hidden rounded-xl bg-slate-100/80 flex items-center justify-center',
          aspectRatio,
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          onError={() => setHasError(true)}
          className={cn(
            'w-full h-full transition-transform duration-300',
            objectFit === 'contain' ? 'object-contain p-1' : 'object-cover',
          )}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-3 text-center transition-colors hover:border-purple-300 hover:bg-purple-50/30',
        aspectRatio,
        className,
      )}
      title="Espacio reservado para imagen (sin recorte forzado)"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-xs text-slate-400 group-hover:text-purple-600 transition-colors">
        <ImageIcon className="h-4 w-4" />
      </div>
      {label && (
        <span className="mt-1.5 text-[11px] font-semibold text-slate-700 truncate max-w-full px-1">
          {label}
        </span>
      )}
      {sublabel && (
        <span className="text-[9.5px] text-slate-400 truncate max-w-full px-1">
          {sublabel}
        </span>
      )}
    </div>
  );
}
