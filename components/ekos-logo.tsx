// Compatibility export for older imports; the approved VORA asset is rendered.
import { VoraLogo } from '@/components/landing/vora-logo';
export function EkosLogo({
  className,
}: {
  className?: string;
  showText?: boolean;
  textClassName?: string;
}) {
  return <VoraLogo className={className} />;
}
