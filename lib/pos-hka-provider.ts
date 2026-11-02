/**
 * ============================================================================
 * ADAPTADOR FISCAL THE FACTORY HKA (FiscalProviderInterface)
 * ============================================================================
 * Implementación desacoplada y trazable para emisión y consulta de estatus fiscal
 * con el proveedor The Factory HKA en ambiente Sandbox [mock].
 * ============================================================================
 */

import type {
  PosSale,
  PosFiscalIntegration,
  PosFiscalStatus,
  FiscalProviderInterface,
} from './types';

export class TheFactoryHkaProvider implements FiscalProviderInterface {
  private integration: PosFiscalIntegration;

  constructor(integration: PosFiscalIntegration) {
    this.integration = integration;
  }

  async validateConfiguration(
    config: PosFiscalIntegration,
  ): Promise<{ valid: boolean; message: string }> {
    if (!config.enabled) {
      return {
        valid: false,
        message: 'Integración The Factory HKA deshabilitada por configuración de la empresa [mock].',
      };
    }

    if (!config.company_rif || !config.company_legal_name) {
      return {
        valid: false,
        message: 'Faltan datos fiscales requeridos (RIF o Razón Social de la empresa) [mock].',
      };
    }

    if (!config.secret_reference) {
      return {
        valid: false,
        message: 'No se ha configurado la referencia de credencial segura para el conector HKA [mock].',
      };
    }

    return {
      valid: true,
      message: 'Conexión validada exitosamente con el servicio Sandbox The Factory HKA [mock].',
    };
  }

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
  }> {
    if (this.integration.legal_status === 'sin_configurar' || !this.integration.enabled) {
      return {
        success: false,
        status: 'no_solicitado',
        errorCode: 'PROVIDER_NOT_CONFIGURED',
        message: 'Emisión fiscal rechazada: conector The Factory HKA no configurado o inactivo [mock].',
      };
    }

    // Validación de RIF y datos fiscales del cliente
    if (!sale.customer || sale.customer.customer_tier === 'consumidor_final' || !sale.customer.document_number) {
      return {
        success: false,
        status: 'rechazado',
        errorCode: 'CUSTOMER_TAX_DATA_REQUIRED',
        message: 'La normativa fiscal exige RIF o Cédula y Razón Social válida del cliente receptor [mock].',
      };
    }

    // Verificación de idempotencia
    if (sale.fiscal_request && sale.fiscal_request.status === 'emitido') {
      return {
        success: true,
        fiscalInvoiceNumber: sale.fiscal_request.fiscal_invoice_number ?? undefined,
        fiscalControlNumber: sale.fiscal_request.fiscal_control_number ?? undefined,
        providerReference: sale.fiscal_request.provider_reference ?? undefined,
        status: 'emitido',
        message: 'Factura previamente emitida en proveedor HKA recuperada por llave de idempotencia [mock].',
      };
    }

    // Generación de numeración fiscal emitida por The Factory HKA
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const invoiceNum = `FACT-${String(randomSeq).padStart(7, '0')}`;
    const controlNum = `00-${String(Math.floor(10000 + Math.random() * 90000))}`;
    const providerRef = `HKA-SBX-${Math.floor(100000 + Math.random() * 900000)}`;

    return {
      success: true,
      fiscalInvoiceNumber: invoiceNum,
      fiscalControlNumber: controlNum,
      providerReference: providerRef,
      status: 'emitido',
      message: 'Documento fiscal emitido y autorizado formalmente por The Factory HKA [mock].',
    };
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
      message: 'Tiempo de espera agotado con la pasarela The Factory HKA. Estado marcado como por revisar [mock].',
    };
  }

  async getDocumentStatus(
    saleId: string,
    idempotencyKey: string,
  ): Promise<{
    status: PosFiscalStatus;
    fiscalInvoiceNumber?: string;
    fiscalControlNumber?: string;
    providerReference?: string;
    message: string;
  }> {
    return {
      status: 'emitido',
      fiscalInvoiceNumber: 'FACT-0000841',
      fiscalControlNumber: '00-0019482',
      providerReference: 'HKA-SBX-00192',
      message: 'Consulta de estado exitosa: comprobante autorizado en The Factory HKA [mock].',
    };
  }
}

