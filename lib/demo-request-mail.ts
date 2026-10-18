import nodemailer from 'nodemailer';

type DemoRequest = {
  full_name: string;
  email: string;
  company?: string;
  phone?: string;
  interest?: string;
};

export function demoRequestMessage(data: DemoRequest, id: string) {
  return {
    subject: 'VORA · Nueva solicitud de demostración',
    text: [
      'Nueva solicitud de demostración desde VORA',
      `Referencia: ${id}`,
      `Nombre: ${data.full_name}`,
      `Correo: ${data.email}`,
      `Empresa: ${data.company || 'No indicada'}`,
      `Teléfono: ${data.phone || 'No indicado'}`,
      '',
      'Interés:',
      data.interest || 'No indicado',
      '',
      'La persona aceptó ser contactada por Venesoft sobre VORA.',
    ].join('\n'),
  };
}

export async function notifyDemoRequest(data: DemoRequest, id: string) {
  const user = process.env.GMAIL_SMTP_USER;
  const pass = process.env.GMAIL_SMTP_APP_PASSWORD?.replace(/\s/g, '');
  if (!user || !pass) return 'not_configured' as const;

  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    tls: { minVersion: 'TLSv1.2' },
  });
  try {
    const result = await transport.sendMail({
      from: { name: 'VORA · Venesoft', address: user },
      to: 'info@venesoftca.com',
      replyTo: { name: data.full_name, address: data.email },
      ...demoRequestMessage(data, id),
      // A fixed sender and destination prevent the public form becoming an open relay.
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    return result.accepted.length > 0 ? 'accepted' as const : 'failed' as const;
  } catch {
    // Never log SMTP credentials, submitted personal data, or provider error bodies.
    return 'failed' as const;
  } finally {
    transport.close();
  }
}
