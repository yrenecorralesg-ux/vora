import Image from 'next/image';
import { cn } from '@/lib/utils';

/** Official VORA logo files (transparent, generated from "Logotipo VORA con esencia natural tecnológica"). */
const LOGOS = {
  wordmark: { src: '/brand/vora-wordmark.webp', width: 393, height: 160, alt: 'VORA' },
  lockup: { src: '/brand/vora-logo.webp', width: 550, height: 260, alt: 'VORA by Venesoft' },
  tagline: { src: '/brand/vora-logo-tagline.webp', width: 589, height: 320, alt: 'VORA by Venesoft. Tu negocio, sin límites' },
} as const;

interface VoraLogoProps {
  className?: string;
  /** 'cream' is for dark backgrounds: the logo sits on a cream plate so its official colors stay intact. */
  tone?: 'forest' | 'cream';
  /** Shows "by Venesoft" next to the wordmark (the lockup variants already include it). */
  showByline?: boolean;
  variant?: keyof typeof LOGOS;
  /** Rendered height of the logo image in px. */
  height?: number;
  priority?: boolean;
}

/** VORA by Venesoft logo. */
export function VoraLogo({ className, tone = 'forest', showByline = true, variant = 'wordmark', height = 32, priority = false }: VoraLogoProps) {
  const logo = LOGOS[variant];
  const width = Math.round((logo.width / logo.height) * height);
  const isCream = tone === 'cream';
  const image = (
    <Image src={logo.src} alt={logo.alt} width={width} height={height} priority={priority} style={{ width, height }} />
  );
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      {isCream ? <span className="inline-flex rounded-xl bg-[#F6F2E9] px-2.5 py-1.5 shadow-sm">{image}</span> : image}
      {showByline && variant === 'wordmark' && (
        <span className={cn('font-jakarta text-[11px] font-semibold tracking-wide', isCream ? 'text-[#DCE6D9]' : 'text-[#52675A]')}>by Venesoft</span>
      )}
    </span>
  );
}
