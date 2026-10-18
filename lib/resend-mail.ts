export async function sendVoraMail(to: string, subject: string, text: string, key: string, replyTo?: string) {
  const apiKey = process.env.RESEND_API_KEY, from = process.env.DEMO_REQUEST_FROM;
  if (!apiKey || !from) return 'not_configured' as const;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: controller.signal, cache: 'no-store',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify({ from, to: [to], subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    if (!response.ok) return 'failed' as const;
    const result = await response.json();
    return typeof result.id === 'string' && result.id.length > 0 ? 'accepted' as const : 'failed' as const;
  } catch { return 'failed' as const; }
  finally { clearTimeout(timeout); }
}
