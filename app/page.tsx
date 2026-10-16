import type { Metadata } from 'next';
import { DifferentiatorsSection, PricingSection } from '@/components/landing/benefits-pricing';
import { DemoRequestSection } from '@/components/landing/demo-request-section';
import { DiagnosticSection } from '@/components/landing/diagnostic-section';
import { GrowthSimulator } from '@/components/landing/growth-simulator';
import { HeroSection } from '@/components/landing/hero-section';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LandingHeader } from '@/components/landing/landing-header';
import { ModulesSection } from '@/components/landing/modules-section';

const description =
  'VORA by Venesoft conecta ventas, inventario, distribución, empleados, finanzas e inteligencia empresarial en una plataforma modular que crece con tu negocio.';

export const metadata: Metadata = {
  title: 'VORA by Venesoft | Plataforma empresarial modular',
  description,
  openGraph: {
    title: 'VORA by Venesoft',
    description,
    type: 'website',
    locale: 'es_VE',
    siteName: 'VORA by Venesoft',
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F6F2E9] font-inter text-[#25332D] antialiased">
      <a
        href="#contenido"
        className="sr-only z-[60] rounded-full bg-[#285C49] px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>
      <LandingHeader />
      <main id="contenido">
        <HeroSection />
        <DiagnosticSection />
        <ModulesSection />
        <DifferentiatorsSection />
        <PricingSection />
        <GrowthSimulator />
        <DemoRequestSection />
      </main>
      <LandingFooter />
    </div>
  );
}
