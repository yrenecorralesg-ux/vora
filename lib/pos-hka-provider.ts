/**
 * ============================================================================
 * ADAPTADOR FISCAL THE FACTORY HKA (FiscalProviderInterface)
 * ============================================================================
 * Implementación desacoplada y trazable para emisión y consulta de estatus fiscal
 * con el proveedor autorizado SENIAT The Factory HKA (Demo y Producción).
 * ============================================================================
 */

import type {
  PosSale,
  PosFiscalIntegration,
  PosFiscalStatus,
  FiscalProviderInterface,
} from './types';

export interface HkaAuthResponse {
  token?: string;
  expiracion?: string;
  empresa?: {
    nombre?: string;
    rif?: string;
    direccion?: string;
  };
  codigo?: string;
  mensaje?: string;
}

export interface HkaEmisionResponse {
  codigo?: string;
  mensaje?: string;
  validaciones?: string[];
  numeroDocumento?: string;
  numeroControl?: string;
  transaccionId?: string;
  fechaEmision?: string;
  horaEmision?: string;
  qr?: string;
}

export class TheFactoryHkaProvider implements FiscalProviderInterface {
  private integration: PosFiscalIntegration;
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  // Credenciales por defecto
  private defaultUser = 'ffxzpgyllzib_tfhka';
  private defaultSecret = 'W5sKX?&l0,xI';

  constructor(integration: PosFiscalIntegration) {
    this.integration = integration;
  }

  private getBaseUrl(): string {
    return this.integration.environment === 'production'
      ? 'https://emisionv2.thefactoryhka.com.ve/api'
      : 'https://demoemisionv2.thefactoryhka.com.ve/api';
  }

  /**
   * Autenticación contra el servicio The Factory HKA
   */
  async authenticate(): Promise<{ ok: boolean; token?: string; error?: string; empresa?: any }> {
    try {
      if (this.cachedToken && Date.now() < this.tokenExpiresAt - 60000) {
        return { ok: true, token: this.cachedToken };
      }

      const res = await fetch(`${this.getBaseUrl()}/Autenticacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: this.defaultUser,
          clave: this.defaultSecret,
        }),
      });

      const data: HkaAuthResponse = await res.json();

      if (res.ok && data.token) {
        this.cachedToken = data.token;
        // Guardar expiración (aprox 12 horas o fecha dada)
        this.tokenExpiresAt = Date.now() + 12 * 60 * 60 * 1000;
        return { ok: true, token: data.token, empresa: data.empresa };
      }

      return {
        ok: false,
        error: data.mensaje || 'Error al autenticar en The Factory HKA',
      };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Error de red con pasarela HKA' };
    }
  }

  /**
   * Valida la conexión con The Factory HKA
   */
  async validateConfiguration(
    config: PosFiscalIntegration,
  ): Promise<{ valid: boolean; message: string; data?: any }> {
    if (!config.enabled) {
      return {
        valid: false,
        message: 'Integración The Factory HKA deshabilitada por configuración de la empresa.',
      };
    }

    const auth = await this.authenticate();
    if (!auth.ok || !auth.token) {
      return {
        valid: false,
        message: `Fallo de autenticación con The Factory HKA (${config.environment.toUpperCase()}): ${auth.error}`,
      };
    }

    const empresaDesc = auth.empresa
      ? `${auth.empresa.nombre} (${auth.empresa.rif})`
      : 'Empresa autorizada';

    return {
      valid: true,
      message: `Conexión verificada exitosamente con The Factory HKA (${config.environment.toUpperCase()}). Emisor: ${empresaDesc}.`,
      data: auth.empresa,
    };
  }

  /**
   * Emisión de Documento Fiscal (Factura 01 o Nota de Crédito 02)
   */
  async issueDocument(
    sale: PosSale,
    idempotencyKey: string,
  ): Promise<{
    success: boolean;
    fiscalInvoiceNumber?: string;
    fiscalControlNumber?: string;
    providerReference?: string;
    status: PosFiscalStatus;
    errorCode?: string;
    message: string;
    rawResponse?: any;
  }> {
    if (!this.integration.enabled) {
      return {
        success: false,
        status: 'no_solicitado',
        errorCode: 'PROVIDER_DISABLED',
        message: 'Emisión fiscal rechazada: conector The Factory HKA inactivo.',
      };
    }

    // Validación de normativa SENIAT de cliente
    if (!sale.customer || sale.customer.customer_tier === 'consumidor_final' || !sale.customer.document_number) {
      return {
        success: false,
        status: 'rechazado',
        errorCode: 'CUSTOMER_TAX_DATA_REQUIRED',
        message: 'La normativa SENIAT exige tipo/cédula/RIF y razón social del cliente para facturación fiscal nominativa.',
      };
    }

    // Idempotencia: si ya fue emitida, recuperar datos previos
    if (sale.fiscal_request && sale.fiscal_request.status === 'emitido' && sale.fiscal_request.fiscal_invoice_number) {
      return {
        success: true,
        fiscalInvoiceNumber: sale.fiscal_request.fiscal_invoice_number,
        fiscalControlNumber: sale.fiscal_request.fiscal_control_number ?? undefined,
        providerReference: sale.fiscal_request.provider_reference ?? undefined,
        status: 'emitido',
        message: 'Factura previamente emitida en proveedor HKA recuperada por idempotencia.',
      };
    }

    // Autenticar
    const auth = await this.authenticate();
    if (!auth.ok || !auth.token) {
      return {
        success: false,
        status: 'error',
        errorCode: 'AUTH_FAILED',
        message: `Error al autenticar en The Factory HKA: ${auth.error}`,
      };
    }

    // Formateo de fecha y hora según especificación SENIAT/HKA
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const dateFormatted = `${d}/${m}/${y}`; // DD/MM/YYYY

    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeFormatted = `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`; // hh:mm:ss a

    const invoiceNumber = (sale.sale_number || `1`).replace(/\D/g, '') || '1';

    // Totales y Base Imponible
    const subtotalUsd = sale.subtotal_usd;
    const taxUsd = sale.tax_total_usd;
    const totalUsd = sale.total_usd;
    const exchangeRate = sale.exchange_rate_snapshot || 36.5;
    const totalVes = Number((totalUsd * exchangeRate).toFixed(2));
    const subtotalVes = Number((subtotalUsd * exchangeRate).toFixed(2));
    const taxVes = Number((taxUsd * exchangeRate).toFixed(2));

    // Determinar formas de pago
    const formasPago = (sale.payments && sale.payments.length > 0)
      ? sale.payments.map((p) => ({
        Descripcion: p.method === 'efectivo' ? 'Efectivo' : p.method === 'pago_movil' ? 'Pago Movil' : p.method === 'tarjeta' ? 'Tarjeta' : 'Cashea',
        Fecha: dateFormatted,
        Forma: p.method === 'efectivo' ? '01' : p.method === 'pago_movil' ? '02' : '03',
        Monto: p.amount_applied.toFixed(2),
        Moneda: p.currency,
        TipoCambio: p.currency === 'USD' ? '1.0000' : exchangeRate.toFixed(4),
      }))
      : [
        {
          Descripcion: 'Efectivo',
          Fecha: dateFormatted,
          Forma: '01',
          Monto: totalUsd.toFixed(2),
          Moneda: 'USD',
          TipoCambio: '1.0000',
        },
      ];

    // Detalle de ítems
    const lines = sale.lines || [];
    const items = lines.map((line, idx) => ({
      NumeroLinea: String(idx + 1),
      CodigoCIIU: '0',
      CodigoPLU: line.sku_snapshot || `ITEM-${idx + 1}`,
      IndicadorBienoServicio: line.is_service ? '2' : '1',
      Descripcion: line.name_snapshot,
      Cantidad: String(line.quantity),
      UnidadMedida: '5A',
      PrecioUnitario: line.unit_price_usd.toFixed(2),
      DescuentoMonto: line.discount_amount_usd.toFixed(2),
      RecargoMonto: '0',
      PrecioItem: line.line_subtotal_usd.toFixed(2),
      PrecioAntesDescuento: (line.unit_price_usd * line.quantity).toFixed(2),
      CodigoImpuesto: 'G',
      TasaIVA: '16',
      ValorIVA: line.tax_amount_usd.toFixed(2),
      ValorTotalItem: line.line_total_usd.toFixed(2),
      InfoAdicionalItem: [],
    }));

    // Construcción del DocumentoElectronico oficial HKA
    const documentoElectronico = {
      DocumentoElectronico: {
        Encabezado: {
          IdentificacionDocumento: {
            TipoDocumento: '01',
            TipoTransaccion: '01',
            NumeroDocumento: invoiceNumber,
            FechaEmision: dateFormatted,
            FechaVencimiento: dateFormatted,
            HoraEmision: timeFormatted,
            TipoDePago: 'Inmediato',
            Serie: '',
            Sucursal: '0001',
            TipoDeVenta: 'Interna',
            Moneda: 'USD',
          },
          Vendedor: {
            Codigo: '001',
            Nombre: 'Cajero VORA',
            NumCajero: '001',
          },
          Comprador: {
            TipoIdentificacion: sale.customer.document_type || 'V',
            NumeroIdentificacion: sale.customer.document_number,
            RazonSocial: sale.customer.legal_name,
            Direccion: sale.customer.fiscal_address || 'Caracas Venezuela',
            Pais: 'VE',
            Notificar: 'No',
            Telefono: [sale.customer.phone || '04140000000'],
            Correo: [sale.customer.email || 'cliente@vora.com'],
          },
          Totales: {
            NroItems: String(items.length),
            MontoGravadoTotal: subtotalUsd.toFixed(2),
            MontoExentoTotal: '0.00',
            MontoPercibidoTotal: '0.00',
            SubtotalAntesDescuento: subtotalUsd.toFixed(2),
            Subtotal: subtotalUsd.toFixed(2),
            TotalIVA: taxUsd.toFixed(2),
            MontoTotalConIVA: totalUsd.toFixed(2),
            TotalAPagar: totalUsd.toFixed(2),
            MontoEnLetras: `${totalUsd.toFixed(2)} DOLARES`,
            ImpuestosSubtotal: [
              {
                CodigoTotalImp: 'G',
                AlicuotaImp: '16.00',
                BaseImponibleImp: subtotalUsd.toFixed(2),
                ValorTotalImp: taxUsd.toFixed(2),
              },
            ],
            FormasPago: formasPago,
          },
          TotalesRetencion: null,
          TotalesOtraMoneda: {
            Moneda: 'VES',
            TipoCambio: exchangeRate.toFixed(4),
            MontoGravadoTotal: subtotalVes.toFixed(2),
            MontoPercibidoTotal: '0.00',
            MontoExentoTotal: '0.00',
            Subtotal: subtotalVes.toFixed(2),
            TotalAPagar: totalVes.toFixed(2),
            TotalIVA: taxVes.toFixed(2),
            MontoTotalConIVA: totalVes.toFixed(2),
            MontoEnLetras: `${totalVes.toFixed(2)} BOLIVARES`,
            SubtotalAntesDescuento: subtotalVes.toFixed(2),
            ImpuestosSubtotal: [
              {
                CodigoTotalImp: 'G',
                AlicuotaImp: '16.00',
                BaseImponibleImp: subtotalVes.toFixed(2),
                ValorTotalImp: taxVes.toFixed(2),
              },
            ],
          },
        },
        DetallesItems: items,
        InfoAdicional: [
          {
            Campo: 'IdempotencyKey',
            Valor: idempotencyKey,
          },
          {
            Campo: 'Origen',
            Valor: 'VORA POS v2.0',
          },
        ],
      },
    };

    try {
      const res = await fetch(`${this.getBaseUrl()}/Emision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify(documentoElectronico),
      });

      const data: HkaEmisionResponse = await res.json();

      // Si HKA procesó exitosamente el documento
      if (res.ok && data.codigo === '200') {
        return {
          success: true,
          fiscalInvoiceNumber: data.numeroDocumento || `FACT-${invoiceNumber.padStart(7, '0')}`,
          fiscalControlNumber: data.numeroControl || `00-${invoiceNumber.padStart(8, '0')}`,
          providerReference: data.transaccionId || `HKA-${Date.now()}`,
          status: 'emitido',
          message: 'Documento fiscal emitido y autorizado formalmente por The Factory HKA (SENIAT).',
          rawResponse: data,
        };
      }

      // Si HKA devolvió validaciones específicas de control/numeración
      const validacionMsg = data.validaciones?.join('. ') || data.mensaje || 'Error no especificado por pasarela fiscal';

      return {
        success: false,
        status: 'rechazado',
        errorCode: data.codigo || 'HKA_REJECTION',
        message: `The Factory HKA rechazó la emisión: ${validacionMsg}`,
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'por_revisar',
        errorCode: 'NETWORK_TIMEOUT_HKA',
        message: `Error de comunicación o timeout con The Factory HKA: ${err.message}. Queda en estado por revisar.`,
      };
    }
  }

  /**
   * Consulta de estado de documento previamente emitido
   */
  async getDocumentStatus(
    saleId: string,
    idempotencyKey: string,
    docNumber?: string,
  ): Promise<{
    status: PosFiscalStatus;
    fiscalInvoiceNumber?: string;
    fiscalControlNumber?: string;
    providerReference?: string;
    message: string;
    rawResponse?: any;
  }> {
    const auth = await this.authenticate();
    if (!auth.ok || !auth.token) {
      return {
        status: 'por_revisar',
        message: `No fue posible conectar con HKA para consultar estado: ${auth.error}`,
      };
    }

    try {
      const res = await fetch(`${this.getBaseUrl()}/EstadoDocumento`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          serie: '',
          tipoDocumento: '01',
          numeroDocumento: docNumber || '1',
        }),
      });

      const data = await res.json();
      if (res.ok && data.codigo === '200') {
        return {
          status: 'emitido',
          fiscalInvoiceNumber: data.numeroDocumento,
          fiscalControlNumber: data.numeroControl,
          providerReference: data.transaccionId,
          message: 'Documento fiscal verificado exitosamente en The Factory HKA.',
          rawResponse: data,
        };
      }

      return {
        status: 'rechazado',
        message: data.mensaje || data.validaciones?.join(', ') || 'Documento no registrado en HKA.',
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        status: 'por_revisar',
        message: `Excepción de red al consultar estado: ${err.message}`,
      };
    }
  }

  /**
   * Anulación fiscal de documento
   */
  async cancelDocument(
    docNumber: string,
    motivo: string = 'Anulación solicitada en mostrador POS',
  ): Promise<{
    success: boolean;
    message: string;
    rawResponse?: any;
  }> {
    const auth = await this.authenticate();
    if (!auth.ok || !auth.token) {
      return { success: false, message: `Fallo de autenticación: ${auth.error}` };
    }

    try {
      const res = await fetch(`${this.getBaseUrl()}/Anular`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          serie: '',
          tipoDocumento: '01',
          numeroDocumento: docNumber,
          motivoAnulacion: motivo,
        }),
      });

      const data = await res.json();
      return {
        success: res.ok && data.codigo === '200',
        message: data.mensaje || 'Respuesta de anulación recibida de HKA',
        rawResponse: data,
      };
    } catch (err: any) {
      return { success: false, message: `Error de red al anular documento: ${err.message}` };
    }
  }

  async simulateTimeout(): Promise<{
    success: boolean;
    status: PosFiscalStatus;
    errorCode: string;
    message: string;
  }> {
    return {
      success: false,
      status: 'por_revisar',
      errorCode: 'NETWORK_TIMEOUT_HKA',
      message: 'Tiempo de espera agotado con la pasarela The Factory HKA. Estado marcado como por revisar.',
    };
  }
}
