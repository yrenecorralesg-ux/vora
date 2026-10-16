import Link from 'next/link';
import { CONTACT_EMAIL, CONTACT_MAILTO, landingModules } from './landing-data';
import { VoraLogo } from './vora-logo';

const footerLink = 'rounded text-[#DCE6D9] transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6F2E9]';

export function LandingFooter() {
  return (
    <footer className="bg-[#285C49] pb-10 pt-16 text-[#DCE6D9]">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <VoraLogo tone="cream" />
          <p className="mt-4 max-w-xs text-sm leading-6">VORA by Venesoft. Plataforma empresarial modular para vender, organizar y crecer.</p>
          <a href={CONTACT_MAILTO} className={`mt-4 inline-block font-semibold ${footerLink}`}>{CONTACT_EMAIL}</a>
        </div>
        <nav aria-label="Soluciones">
          <p className="font-jakarta text-sm font-bold text-white">Soluciones</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {landingModules.map((module) => (
              <li key={module.id}>
                <a href={`#modulo-${module.id}`} className={footerLink}>{module.name}</a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="VORA">
          <p className="font-jakarta text-sm font-bold text-white">VORA</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><a href="#beneficios" className={footerLink}>Beneficios</a></li>
            <li><a href="#precios" className={footerLink}>Precios</a></li>
            <li><a href="#simulador" className={footerLink}>Simulador comercial</a></li>
            <li><a href="#contacto" className={footerLink}>Contacto</a></li>
            <li><Link href="/login" className={footerLink}>Iniciar sesión</Link></li>
          </ul>
        </nav>
        <div>
          <p className="font-jakarta text-sm font-bold text-white">Legal</p>
          <p className="mt-4 text-sm leading-6">Términos y política de privacidad en preparación.</p>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col gap-3 border-t border-white/15 pt-6 text-xs text-[#C9D6C5] sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Venesoft. Todos los derechos reservados.</p>
        <p>Las imágenes con pantallas son conceptuales. Las funciones «Próximamente» o «En desarrollo» aún no están disponibles.</p>
        </div>
      </div>
    </footer>
  );
}
