import { POST as saveSetup } from '../setup/route';
export async function POST(req: Request, context: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const replacement = new Request(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify({ ...body, section: 'database', mode: 'dedicated' }),
  });
  return saveSetup(replacement, context);
}
