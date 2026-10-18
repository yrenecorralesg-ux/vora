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
  const key = process.env.RESEND_API_KEY;
  const from = process.env.DEMO_REQUEST_FROM;
  if (!key || !from) return 'not_configured' as const;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `demo-request/${id}`,
      },
      body: JSON.stringify({
        from,
        to: ['info@venesoftca.com'],
        reply_to: data.email,
        ...demoRequestMessage(data, id),
      }),
      cache: 'no-store',
    });
    if (!response.ok) return 'failed' as const;
    const result = await response.json();
    return typeof result.id === 'string' && result.id.length > 0 ? 'accepted' as const : 'failed' as const;
  } catch {
    // Never log credentials, submitted personal data, or provider error bodies.
    return 'failed' as const;
  } finally {
    clearTimeout(timeout);
  }
}
