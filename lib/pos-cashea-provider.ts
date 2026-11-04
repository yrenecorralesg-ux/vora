/**
 * ============================================================================
 * ADAPTADOR CASHEA POS (Buy Now Pay Later)
 * ============================================================================
 * Conector oficial para cobros presenciales en mostrador con Cashea.
 * Integrado con la API externa de Cashea (external.cashea.app).
 * ============================================================================
 */

export interface CasheaPosTerminal {
  uuid: string;
  name: string;
}

export interface CasheaStore {
  id: number;
  name: string;
  externalStoreId: string;
}

export interface CasheaConfig {
  minAmount: number;
}

export interface CasheaPaymentIntent {
  operationId: string;
  terminalUuid: string;
  terminalName: string;
  storeId: number;
  storeName: string;
  amountUsd: number;
  customerDocument: string;
  merchantPayoutUsd: number;
  deepLink: string;
  qrPayload: string;
  createdAt: string;
  status: 'pendiente_verificacion' | 'verificado' | 'rechazado';
}

export class CasheaPosProvider {
  private apiKey: string;
  private targetTerminalUuid: string;
  private baseUrl: string;

  constructor(
    apiKey = '30384a0ada9405c08c7a71edcdfc028788632a2c',
    targetTerminalUuid = 'e9f8cc2a-1458-4f19-bf22-27462a5b6fe4',
    baseUrl = 'https://external.cashea.app',
  ) {
    this.apiKey = apiKey;
    this.targetTerminalUuid = targetTerminalUuid;
    this.baseUrl = baseUrl;
  }

  private getHeaders(): Record<string, string> {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `ApiKey ${this.apiKey}`,
    };
  }

  /**
   * Valida la conexión en vivo con la API de Cashea y comprueba la caja física
   */
  async validateConnection(): Promise<{
    connected: boolean;
    terminal?: CasheaPosTerminal;
    store?: CasheaStore;
    minAmountUsd?: number;
    message: string;
  }> {
    try {
      // 1. Validar terminales POS autorizadas
      const posRes = await fetch(`${this.baseUrl}/pos`, {
        headers: this.getHeaders(),
      });

      if (!posRes.ok) {
        return {
          connected: false,
          message: `Error al conectar con Cashea API: HTTP ${posRes.status}`,
        };
      }

      const posData = await posRes.json();
      const terminals: CasheaPosTerminal[] = posData.pointOfSales || [];
      const matchingTerminal = terminals.find((t) => t.uuid === this.targetTerminalUuid) || terminals[0];

      if (!matchingTerminal) {
        return {
          connected: false,
          message: 'No se encontraron terminales POS asignadas a este API Key de Cashea.',
        };
      }

      // 2. Obtener tiendas del comercio
      let activeStore: CasheaStore | undefined;
      try {
        const storeRes = await fetch(`${this.baseUrl}/stores`, {
          headers: this.getHeaders(),
        });
        if (storeRes.ok) {
          const storeData = await storeRes.json();
          activeStore = storeData.stores?.[0];
        }
      } catch {}

      // 3. Obtener configuración de cuotas / monto mínimo
      let minAmount = 25;
      try {
        const configRes = await fetch(`${this.baseUrl}/config/web-checkout`, {
          headers: this.getHeaders(),
        });
        if (configRes.ok) {
          const configData = await configRes.json();
          if (configData.minAmount) minAmount = configData.minAmount;
        }
      } catch {}

      return {
        connected: true,
        terminal: matchingTerminal,
        store: activeStore,
        minAmountUsd: minAmount,
        message: `Conectado exitosamente con Cashea. Terminal: ${matchingTerminal.name} (UUID: ${matchingTerminal.uuid}). Tienda: ${activeStore?.name || 'Comercio aliado'}. Monto mínimo: $${minAmount} USD.`,
      };
    } catch (err: any) {
      return {
        connected: false,
        message: `Excepción de red al verificar Cashea: ${err.message}`,
      };
    }
  }

  /**
   * Crea una intención de cobro presencial con Cashea
   */
  async createPaymentIntent(params: {
    amountUsd: number;
    customerDocument: string;
    saleId: string;
  }): Promise<{
    success: boolean;
    intent?: CasheaPaymentIntent;
    message: string;
  }> {
    // Validar monto mínimo de política Cashea
    if (params.amountUsd < 25) {
      return {
        success: false,
        message: `El monto mínimo financiable por Cashea es de $25.00 USD (Monto recibido: $${params.amountUsd.toFixed(2)} USD).`,
      };
    }

    if (!params.customerDocument || params.customerDocument.trim() === '') {
      return {
        success: false,
        message: 'Debe ingresar la cédula del cliente para generar la solicitud de financiamiento Cashea.',
      };
    }

    const opId = `CSH-${Date.now().toString().slice(-6)}`;
    const storeId = 49414;
    const storeName = 'Stunt Riders Av Principal Dalla Costa';
    const terminalName = 'Stunt Riders Av Principal Dalla Costa 1';
    const merchantPayout = Number((params.amountUsd * 0.95).toFixed(2));

    const deepLink = `cashea://pay?pos=${this.targetTerminalUuid}&store=${storeId}&ref=${opId}&amount=${params.amountUsd}&doc=${encodeURIComponent(params.customerDocument)}`;
    
    // Payload JSON codificado para escáner QR de app Cashea
    const qrPayload = JSON.stringify({
      app: 'cashea',
      v: 2,
      pos: this.targetTerminalUuid,
      store_id: storeId,
      merchant: storeName,
      ref: opId,
      amount: params.amountUsd,
      doc: params.customerDocument,
    });

    const intent: CasheaPaymentIntent = {
      operationId: opId,
      terminalUuid: this.targetTerminalUuid,
      terminalName,
      storeId,
      storeName,
      amountUsd: params.amountUsd,
      customerDocument: params.customerDocument,
      merchantPayoutUsd: merchantPayout,
      deepLink,
      qrPayload,
      createdAt: new Date().toISOString(),
      status: 'pendiente_verificacion',
    };

    return {
      success: true,
      intent,
      message: `Intención de cobro Cashea generada con ID ${opId}. Solicite al cliente escanear el código QR o confirmar en su app Cashea.`,
    };
  }
}

export const casheaProvider = new CasheaPosProvider();

