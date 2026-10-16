import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth-provider';

export const metadata: Metadata = {
  title: 'VORA — Plataforma empresarial modular de Venesoft',
  description: 'VORA conecta tu operacion comercial con una plataforma modular que se adapta a tu empresa y a tu marca. Cada cliente, cada venta y cada seguimiento, en un solo lugar.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="font-poppins font-sans antialiased text-slate-800">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

