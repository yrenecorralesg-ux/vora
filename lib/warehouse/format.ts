// Formato para pantallas de Warehouse (cliente y servidor).
const qtyFmt = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 3 });
const moneyFmt = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const costFmt = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 });
const dateFmt = new Intl.DateTimeFormat('es-VE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Caracas' });

export const fmtQty = (n: number | string | null | undefined) => qtyFmt.format(Number(n ?? 0));
export const fmtMoney = (n: number | string | null | undefined) => moneyFmt.format(Number(n ?? 0));
export const fmtCost = (n: number | string | null | undefined) => costFmt.format(Number(n ?? 0));
export const fmtDate = (s: string | null | undefined) => (s ? dateFmt.format(new Date(s)) : '—');
export const signed = (n: number) => (n > 0 ? `+${fmtQty(n)}` : fmtQty(n));
