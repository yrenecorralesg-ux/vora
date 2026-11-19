/**
 * ============================================================================
 * CONTROLADORES DE HARDWARE Y PERIFÉRICOS POS (commerce.pos)
 * ============================================================================
 * - Impresión térmica ESC/POS 80mm / 58mm
 * - Apertura de gaveta de dinero por pulso RJ11 (ESC/POS pin 2 / pin 5)
 * - Lectura directa de báscula / balanza electrónica vía Web Serial API
 * ============================================================================
 */

export interface EscPosReceiptData {
  companyName: string;
  companyRif: string;
  branchName: string;
  branchAddress?: string;
  saleNumber: string;
  documentNumber?: string;
  dateStr: string;
  cashierName: string;
  customerName?: string;
  customerDoc?: string;
  lines: Array<{
    name: string;
    quantity: number;
    unitPriceUsd: number;
    totalUsd: number;
  }>;
  subtotalUsd: number;
  taxUsd: number;
  totalUsd: number;
  totalVes: number;
  exchangeRate: number;
  paymentMethods: string;
}

/**
 * Pulso estándar ESC/POS para apertura de gaveta de dinero conectada a la impresora (RJ11).
 * Comando: ESC p m t1 t2 (\x1B\x70\x00\x19\xFA)
 */
export function kickCashDrawer(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    // Si la impresora térmica está configurada con Web Serial o WebUSB
    const escPulse = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);

    // Crear un frame invisible de impresión si se usa driver genérico del OS
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    // Escribir payload con pulso
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(String.fromCharCode(...Array.from(escPulse)));
      doc.close();
    }

    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1500);

    return true;
  } catch (err) {
    console.warn('[hardware] No se pudo enviar el pulso directo a la gaveta RJ11:', err);
    return false;
  }
}

/**
 * Conexión directa a balanza electrónica por puerto serie USB/RS232 (Web Serial API).
 * Compatible con protocolos continuos estándar (Toledo, Torrey, Dibal, Systel) a 9600 baud.
 */
export async function connectScaleWebSerial(
  onWeightReceived: (weightKg: number) => void,
  onError?: (msg: string) => void,
): Promise<{ disconnect: () => void } | null> {
  if (typeof window === 'undefined') return null;

  const nav = navigator as any;
  if (!nav.serial) {
    if (onError) onError('Web Serial API no soportada en este navegador. Utilice Google Chrome, Edge o un navegador compatible.');
    return null;
  }

  try {
    const port = await nav.serial.requestPort();
    await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' });

    let isReading = true;
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();

    (async () => {
      let buffer = '';
      try {
        while (isReading) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            buffer += value;
            // Procesar líneas separadas por retorno de carro (\r o \n)
            const lines = buffer.split(/[\r\n]+/);
            buffer = lines.pop() || '';

            for (const line of lines) {
              // Extraer números decimales que representan el peso (ej: "ST,GS,  0.750kg")
              const match = line.match(/[-+]?\s*(\d+\.?\d*)/);
              if (match && match[1]) {
                const numericWeight = parseFloat(match[1]);
                if (!isNaN(numericWeight)) {
                  onWeightReceived(numericWeight);
                }
              }
            }
          }
        }
      } catch (err: any) {
        if (isReading && onError) onError(`Error en lectura serie: ${err.message}`);
      }
    })();

    return {
      disconnect: async () => {
        isReading = false;
        try {
          await reader.cancel();
          await readableStreamClosed.catch(() => {});
          await port.close();
        } catch {
          // Ignorar error al cerrar
        }
      },
    };
  } catch (err: any) {
    if (onError) onError(`No se seleccionó puerto serie o fue cancelado: ${err.message}`);
    return null;
  }
}
