/**
 * ============================================================================
 * SERVICIO CENTRAL VORA POS (commerce.pos)
 * ============================================================================
 * Orquestador transaccional con compatibilidad dual:
 * - Modo conectado con Supabase mediante RPCs SECURITY DEFINER
 * - Modo reactivo en memoria / demo cuando la conexión del tenant es 'not_configured'
 * ============================================================================
 */

import {
  MOCK_TENANT_ID,
  MOCK_EXCHANGE_RATE,
  MOCK_BRANCHES,
  MOCK_REGISTERS,
  MOCK_USERS,
  MOCK_CUSTOMERS,
  MOCK_PRODUCTS,
  MOCK_SETTINGS,
  MOCK_FISCAL_INTEGRATION,
  MOCK_ACTIVE_SHIFT,
  MOCK_SHIFTS_HISTORY,
  MOCK_CASH_MOVEMENTS,
  MOCK_SALES_HISTORY,
  MOCK_RETURNS_HISTORY,
  MOCK_AUDIT_EVENTS,
  MOCK_SALES_REPS,
  MOCK_PROMOTIONS,
  MOCK_DISPATCH_ORDERS,
  type PosMockUser,
} from './pos-demo-data';
import type {
  PosBranch,
  PosRegister,
  PosShift,
  PosProduct,
  PosCustomer,
  PosSale,
  PosSaleLine,
  PosSalePayment,
  PosSettings,
  PosFiscalIntegration,
  PosCashMovement,
  PosSaleReturn,
  PosReturnLine,
  PosCommercialDocument,
  PosFiscalRequest,
  PosAuditEvent,
  PosPromotion,
  PosSalesRep,
  PosDispatchOrder,
  PosDispatchStatus,
} from './types';
import { TheFactoryHkaProvider } from './pos-hka-provider';
import { casheaProvider, CasheaPosProvider } from './pos-cashea-provider';

// Estado global en memoria para reactividad completa en modo demo / preview
class PosInMemoryStore {
  branches: PosBranch[] = [...MOCK_BRANCHES];
  registers: PosRegister[] = [...MOCK_REGISTERS];
  customers: PosCustomer[] = [...MOCK_CUSTOMERS];
  products: PosProduct[] = [...MOCK_PRODUCTS];
  shifts: PosShift[] = MOCK_SHIFTS_HISTORY.map((s) => ({ ...s }));
  cashMovements: PosCashMovement[] = [...MOCK_CASH_MOVEMENTS];
  sales: PosSale[] = [...MOCK_SALES_HISTORY];
  returns: PosSaleReturn[] = [...MOCK_RETURNS_HISTORY];
  settings: PosSettings = { ...MOCK_SETTINGS };
  fiscalIntegration: PosFiscalIntegration = { ...MOCK_FISCAL_INTEGRATION };
  auditEvents: PosAuditEvent[] = [...MOCK_AUDIT_EVENTS];
  salesReps: PosSalesRep[] = [...MOCK_SALES_REPS];
  promotions: PosPromotion[] = [...MOCK_PROMOTIONS];
  users: PosMockUser[] = [...MOCK_USERS];
  dispatchOrders: PosDispatchOrder[] = [...MOCK_DISPATCH_ORDERS];

  // Métodos de Despacho y Almacén (pos_order_dispatch_kds)
  updateDispatchStatus(orderId: string, status: PosDispatchStatus, preparedBy?: string): boolean {
    const order = this.dispatchOrders.find((o) => o.id === orderId);
    if (!order) return false;
    order.status = status;
    if (preparedBy) order.prepared_by = preparedBy;
    if (status === 'listo' || status === 'entregado') {
      order.completed_at = new Date().toISOString();
    }
    return true;
  }

  toggleDispatchItem(orderId: string, itemSku: string): boolean {
    const order = this.dispatchOrders.find((o) => o.id === orderId);
    if (!order) return false;
    const item = order.items.find((i) => i.sku === itemSku);
    if (!item) return false;
    item.completed = !item.completed;
    return true;
  }

  // Exportación Contable SENIAT (pos_accounting_export)
  generateAccountingSalesBookCsv(params?: { startDate?: string; endDate?: string }): string {
    const headers = [
      'Nro_Operacion',
      'Fecha_Comprobante',
      'Nro_Factura_Comprobante',
      'Nro_Control_Fiscal',
      'Tipo_Transaccion',
      'Tipo_Documento_Cliente',
      'RIF_Cedula_Cliente',
      'Nombre_Razon_Social_Comprador',
      'Total_Ventas_USD',
      'Tipo_Cambio_BCV',
      'Total_Ventas_VES_Con_IVA',
      'Ventas_Exentas_VES',
      'Base_Imponible_16_VES',
      'IVA_16_VES',
      'Base_Imponible_IGTF_USD',
      'IGTF_3_USD',
      'Metodos_Pago',
      'Estado_Comercial',
    ];

    let filteredSales = this.sales;
    if (params?.startDate) {
      filteredSales = filteredSales.filter((s) => s.created_at >= params.startDate!);
    }
    if (params?.endDate) {
      filteredSales = filteredSales.filter((s) => s.created_at <= params.endDate!);
    }

    const rows = filteredSales.map((s, idx) => {
      const docNum = s.fiscal_request?.fiscal_invoice_number || s.document?.internal_number || s.sale_number;
      const controlNum = s.fiscal_request?.fiscal_control_number || 'N/A';
      const clientDocType = s.customer?.document_type || 'V';
      const clientDocNum = s.customer?.document_number || '00000000';
      const clientName = (s.customer?.legal_name || 'Consumidor Final').replace(/;/g, ',');
      const rate = s.exchange_rate_snapshot || this.settings.active_exchange_rate;

      const totalVes = s.total_ves;
      const taxVes = Number((s.tax_total_usd * rate).toFixed(2));
      const baseVes = Number((s.subtotal_usd * rate).toFixed(2));
      const exemptVes = 0.0;

      const payments = s.payments || [];
      const cashUsdPayment = payments.find((p) => p.method === 'efectivo' && p.currency === 'USD');
      const baseIgtfUsd = cashUsdPayment ? cashUsdPayment.amount_applied : 0;
      const igtfUsd = Number((baseIgtfUsd * 0.03).toFixed(2));

      const paymentMethods = payments
        .map((p) => `${p.method.toUpperCase()}(${p.amount_applied}${p.currency})`)
        .join(' + ');

      return [
        idx + 1,
        new Date(s.confirmed_at || s.created_at).toLocaleDateString('es-VE'),
        `"${docNum}"`,
        `"${controlNum}"`,
        '01-REG',
        clientDocType,
        clientDocNum,
        `"${clientName}"`,
        s.total_usd.toFixed(2),
        rate.toFixed(2),
        totalVes.toFixed(2),
        exemptVes.toFixed(2),
        baseVes.toFixed(2),
        taxVes.toFixed(2),
        baseIgtfUsd.toFixed(2),
        igtfUsd.toFixed(2),
        `"${paymentMethods}"`,
        s.commercial_status.toUpperCase(),
      ].join(';');
    });

    return '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  }

  // Métodos de Supervisión y Control de Roles
  updateSupervisorConfig(params: {
    supervisorPin?: string;
    maxCashierDiscountPercent?: number;
    requirePinForReturns?: boolean;
    requirePinForWithdrawals?: boolean;
    requirePinForCancel?: boolean;
    enforceBlindCount?: boolean;
  }) {
    if (params.supervisorPin !== undefined) this.settings.supervisor_pin = params.supervisorPin;
    if (params.maxCashierDiscountPercent !== undefined) {
      this.settings.max_cashier_discount_percent = params.maxCashierDiscountPercent;
    }
    if (params.requirePinForReturns !== undefined) this.settings.require_pin_for_returns = params.requirePinForReturns;
    if (params.requirePinForWithdrawals !== undefined) {
      this.settings.require_pin_for_withdrawals = params.requirePinForWithdrawals;
    }
    if (params.requirePinForCancel !== undefined) this.settings.require_pin_for_cancel = params.requirePinForCancel;
    if (params.enforceBlindCount !== undefined) this.settings.enforce_blind_count = params.enforceBlindCount;
    return this.settings;
  }

  validateSupervisorPin(inputPin: string): boolean {
    const cleanPin = inputPin.trim();
    if (!cleanPin) return false;
    const supervisorPin = this.settings.supervisor_pin || '9999';
    if (cleanPin === supervisorPin) return true;
    const supervisorUser = this.users.find(
      (u) =>
        (u.role === 'pos_supervisor' || u.role === 'pos_store_admin') &&
        u.pin === cleanPin &&
        u.is_active !== false,
    );
    return Boolean(supervisorUser);
  }

  addStaffUser(user: Omit<PosMockUser, 'id'>): PosMockUser {
    return this.createUser(user);
  }

  createUser(userData: Omit<PosMockUser, 'id'>): PosMockUser {
    const newUser: PosMockUser = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...userData,
      is_active: userData.is_active !== undefined ? userData.is_active : true,
    };
    this.users.push(newUser);
    return newUser;
  }

  updateUser(id: string, updates: Partial<PosMockUser>): PosMockUser | null {
    const user = this.users.find((u) => u.id === id);
    if (!user) return null;
    if (updates.name !== undefined) user.name = updates.name.trim();
    if (updates.email !== undefined) user.email = updates.email.trim();
    if (updates.role !== undefined) user.role = updates.role;
    if (updates.pin !== undefined) user.pin = updates.pin.trim();
    if (updates.assignedRegisterId !== undefined) user.assignedRegisterId = updates.assignedRegisterId;
    if (updates.assignedBranchId !== undefined) user.assignedBranchId = updates.assignedBranchId;
    if (updates.commission_rate_percent !== undefined) user.commission_rate_percent = updates.commission_rate_percent;
    if (updates.is_active !== undefined) user.is_active = updates.is_active;
    return user;
  }

  deleteUser(id: string): { ok: boolean; error?: string } {
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) {
      return { ok: false, error: 'Usuario no encontrado.' };
    }
    const hasOpenShift = this.shifts.some((s) => s.cashier_user_id === id && s.status === 'abierto');
    if (hasOpenShift) {
      return {
        ok: false,
        error: 'No se puede eliminar un usuario con un turno de caja abierto. Cierre el turno primero.',
      };
    }
    this.users.splice(index, 1);
    return { ok: true };
  }

  toggleStaffUser(id: string): boolean {
    const user = this.users.find((u) => u.id === id);
    if (!user) return false;
    user.is_active = user.is_active === false ? true : false;
    return true;
  }

  updateStaffPin(id: string, newPin: string): boolean {
    const user = this.users.find((u) => u.id === id);
    if (!user) return false;
    user.pin = newPin.trim();
    return true;
  }

  // Métodos de Turno
  getOpenShift(registerId: string): PosShift | undefined {
    return this.shifts.find((s) => s.register_id === registerId && s.status === 'abierto');
  }

  openShift(params: {
    branchId: string;
    registerId: string;
    cashierUserId: string;
    cashierName: string;
    openingUsd: number;
    openingVes: number;
    notes?: string;
  }): { ok: boolean; shift?: PosShift; error?: string } {
    const existing = this.getOpenShift(params.registerId);
    if (existing) {
      return {
        ok: false,
        error: 'La caja seleccionada ya posee un turno abierto por otro operador. No se permiten dos turnos simultáneos en la misma caja.',
      };
    }

    const newShift: PosShift = {
      id: `sh-${Date.now()}`,
      tenant_id: MOCK_TENANT_ID,
      branch_id: params.branchId,
      register_id: params.registerId,
      cashier_user_id: params.cashierUserId,
      cashier_name_snapshot: params.cashierName,
      status: 'abierto',
      opened_at: new Date().toISOString(),
      closed_at: null,
      opening_amount_usd: params.openingUsd,
      opening_amount_ves: params.openingVes,
      expected_totals: {
        efectivo_usd: params.openingUsd,
        efectivo_ves: params.openingVes,
        pago_movil_ves: 0,
        tarjeta_ves: 0,
        cashea_usd: 0,
      },
      declared_totals: {},
      differences_totals: {},
      opening_notes: params.notes ?? null,
      closing_justification: null,
      closed_by: null,
      created_at: new Date().toISOString(),
    };

    this.shifts.unshift(newShift);

    this.addAudit({
      branch_id: params.branchId,
      shift_id: newShift.id,
      actor_id: params.cashierUserId,
      event_type: 'apertura_turno',
      entity_type: 'pos_shifts',
      entity_id: newShift.id,
      description: `Apertura confirmada de turno para ${params.cashierName} [mock]`,
      metadata: { openingUsd: params.openingUsd, openingVes: params.openingVes },
    });

    return { ok: true, shift: newShift };
  }

  addCashMovement(params: {
    branchId: string;
    shiftId: string;
    movementType: 'ingreso_efectivo' | 'retiro_efectivo' | 'ajuste_caja' | 'cambio_saldo_inicial';
    currency: 'USD' | 'VES';
    amount: number;
    reason: string;
    performedBy: string;
  }): { ok: boolean; movement?: PosCashMovement; error?: string } {
    const shift = this.shifts.find((s) => s.id === params.shiftId);
    if (!shift || shift.status !== 'abierto') {
      return { ok: false, error: 'El turno no existe o se encuentra cerrado.' };
    }

    const movement: PosCashMovement = {
      id: `mov-${Date.now()}`,
      tenant_id: MOCK_TENANT_ID,
      branch_id: params.branchId,
      shift_id: params.shiftId,
      movement_type: params.movementType,
      currency: params.currency,
      amount: params.amount,
      reason: params.reason,
      performed_by: params.performedBy,
      authorization_id: null,
      created_at: new Date().toISOString(),
    };

    this.cashMovements.unshift(movement);

    // Ajuste de saldos esperados
    const delta = params.movementType === 'retiro_efectivo' ? -params.amount : params.amount;
    const key = params.currency === 'USD' ? 'efectivo_usd' : 'efectivo_ves';
    shift.expected_totals[key] = (shift.expected_totals[key] ?? 0) + delta;

    this.addAudit({
      branch_id: params.branchId,
      shift_id: params.shiftId,
      actor_id: params.performedBy,
      event_type: 'movimiento_caja',
      entity_type: 'pos_cash_movements',
      entity_id: movement.id,
      description: `${params.movementType} de ${params.amount} ${params.currency}: ${params.reason} [mock]`,
      metadata: params,
    });

    return { ok: true, movement };
  }

  closeShift(params: {
    shiftId: string;
    declared: Record<string, number>;
    justification?: string;
    closedBy: string;
  }): { ok: boolean; shift?: PosShift; error?: string } {
    const shift = this.shifts.find((s) => s.id === params.shiftId);
    if (!shift) {
      return { ok: false, error: 'El turno de caja especificado no existe.' };
    }
    if (shift.status === 'cerrado') {
      return { ok: false, error: 'El turno ya se encuentra cerrado e inmutable.' };
    }

    // Calcular diferencias
    const differences: Record<string, number> = {};
    let hasDiff = false;
    for (const key of ['efectivo_usd', 'efectivo_ves', 'pago_movil_ves', 'tarjeta_ves', 'cashea_usd']) {
      const exp = shift.expected_totals[key] ?? 0;
      const dec = params.declared[key] ?? 0;
      const diff = Number((dec - exp).toFixed(2));
      differences[key] = diff;
      if (diff !== 0) {
        hasDiff = true;
      }
    }

    if (hasDiff && (!params.justification || params.justification.trim().length < 5)) {
      return {
        ok: false,
        error: 'Diferencia detectada en arqueo. Exige ingresar justificación detallada de al menos 5 caracteres.',
      };
    }

    shift.status = 'cerrado';
    shift.closed_at = new Date().toISOString();
    shift.closed_by = params.closedBy;
    shift.declared_totals = params.declared;
    shift.differences_totals = differences;
    shift.closing_justification = params.justification ?? null;

    this.addAudit({
      branch_id: shift.branch_id,
      shift_id: shift.id,
      actor_id: params.closedBy,
      event_type: 'cierre_turno',
      entity_type: 'pos_shifts',
      entity_id: shift.id,
      description: `Cierre definitivo de turno en caja con arqueo sellado [mock]`,
      metadata: { expected: shift.expected_totals, declared: params.declared, diff: differences },
    });

    return { ok: true, shift };
  }

  // Métodos de Venta
  confirmSale(params: {
    branchId: string;
    shiftId: string;
    registerId: string;
    cashierUserId: string;
    customerId?: string;
    idempotencyKey: string;
    correlationId: string;
    lines: Array<{
      productId?: string;
      sku: string;
      name: string;
      isService: boolean;
      quantity: number;
      unitPriceUsd: number;
      discountPercent: number;
      discountAmountUsd: number;
      taxRatePercent: number;
      taxAmountUsd: number;
      lineSubtotalUsd: number;
      lineTotalUsd: number;
    }>;
    payments: Array<{
      method: 'efectivo' | 'pago_movil' | 'tarjeta' | 'cashea';
      currency: 'USD' | 'VES';
      amountReceived: number;
      amountApplied: number;
      changeAmount: number;
      changeCurrency?: 'USD' | 'VES';
      referenceNumber?: string;
      bankCode?: string;
      bankName?: string;
      payerPhone?: string;
      payerDocument?: string;
      terminalId?: string;
      cardLast4?: string;
      approvalCode?: string;
      casheaOperationId?: string;
      casheaMerchantAmount?: number;
      providerStatus: 'registrado' | 'pendiente_verificacion' | 'verificado';
    }>;
    notes?: string;
    discountAuthorizationId?: string;
    salesRepId?: string;
    salesRepName?: string;
    walletChangeDepositedUsd?: number;
    walletUsedUsd?: number;
    appliedPromotionTitle?: string;
  }): { ok: boolean; sale?: PosSale; idempotentReplay?: boolean; error?: string } {
    // Idempotencia
    const existing = this.sales.find((s) => s.idempotency_key === params.idempotencyKey);
    if (existing) {
      return { ok: true, sale: existing, idempotentReplay: true };
    }

    const shift = this.shifts.find((s) => s.id === params.shiftId);
    if (!shift || shift.status !== 'abierto') {
      return { ok: false, error: 'El turno de caja especificado no existe o se encuentra cerrado.' };
    }

    // Validar existencias
    for (const line of params.lines) {
      if (!line.isService && line.productId) {
        const prod = this.products.find((p) => p.id === line.productId);
        if (!prod) {
          return { ok: false, error: `Producto no encontrado en inventario: ${line.sku}` };
        }
        if (prod.stock_quantity < line.quantity) {
          return {
            ok: false,
            error: `Existencia insuficiente en almacén para SKU ${prod.sku}: solicitado ${line.quantity}, disponible ${prod.stock_quantity}`,
          };
        }
      }
    }

    // Descontar inventario
    for (const line of params.lines) {
      if (!line.isService && line.productId) {
        const prod = this.products.find((p) => p.id === line.productId)!;
        prod.stock_quantity -= line.quantity;
        prod.status = prod.stock_quantity <= 0 ? 'agotado' : 'disponible';
      }
    }

    // Generar correlativo de venta y comprobante
    const saleSeq = this.settings.next_sale_seq++;
    const docSeq = this.settings.next_internal_seq++;
    const saleNum = `VTA-${String(saleSeq).padStart(7, '0')}`;
    const docNum = `${this.settings.internal_doc_prefix}${String(docSeq).padStart(6, '0')}`;

    let subtotalUsd = 0;
    let discountTotalUsd = 0;
    let taxTotalUsd = 0;
    let totalUsd = 0;

    for (const line of params.lines) {
      subtotalUsd += line.lineSubtotalUsd;
      discountTotalUsd += line.discountAmountUsd;
      taxTotalUsd += line.taxAmountUsd;
      totalUsd += line.lineTotalUsd;
    }

    const totalVes = Number((totalUsd * this.settings.active_exchange_rate).toFixed(2));
    let paidUsd = 0;
    let paidVes = 0;

    const salePayments: PosSalePayment[] = params.payments.map((p, idx) => {
      if (p.currency === 'USD') {
        paidUsd += p.amountApplied;
        paidVes += p.amountApplied * this.settings.active_exchange_rate;
      } else {
        paidVes += p.amountApplied;
        paidUsd += p.amountApplied / this.settings.active_exchange_rate;
      }

      // Actualizar cubetas del turno
      if (p.method === 'efectivo') {
        const key = p.currency === 'USD' ? 'efectivo_usd' : 'efectivo_ves';
        shift.expected_totals[key] = (shift.expected_totals[key] ?? 0) + (p.amountApplied - p.changeAmount);
      } else if (p.method === 'pago_movil') {
        shift.expected_totals['pago_movil_ves'] = (shift.expected_totals['pago_movil_ves'] ?? 0) + p.amountApplied;
      } else if (p.method === 'tarjeta') {
        shift.expected_totals['tarjeta_ves'] = (shift.expected_totals['tarjeta_ves'] ?? 0) + p.amountApplied;
      } else if (p.method === 'cashea') {
        shift.expected_totals['cashea_usd'] = (shift.expected_totals['cashea_usd'] ?? 0) + (p.amountApplied / this.settings.active_exchange_rate);
      }

      return {
        id: `pay-${Date.now()}-${idx}`,
        tenant_id: MOCK_TENANT_ID,
        branch_id: params.branchId,
        sale_id: `sale-${Date.now()}`,
        shift_id: params.shiftId,
        method: p.method,
        currency: p.currency,
        amount_received: p.amountReceived,
        amount_applied: p.amountApplied,
        change_amount: p.changeAmount,
        change_currency: p.changeCurrency ?? null,
        exchange_rate_snapshot: this.settings.active_exchange_rate,
        reference_number: p.referenceNumber ?? null,
        bank_code: p.bankCode ?? null,
        bank_name: p.bankName ?? null,
        payer_phone: p.payerPhone ?? null,
        payer_document: p.payerDocument ?? null,
        terminal_id: p.terminalId ?? null,
        card_last4: p.cardLast4 ?? null,
        approval_code: p.approvalCode ?? null,
        cashea_operation_id: p.casheaOperationId ?? null,
        cashea_merchant_amount: p.casheaMerchantAmount ?? null,
        provider_status: p.providerStatus,
        verified_by: p.providerStatus === 'verificado' ? params.cashierUserId : null,
        verified_at: p.providerStatus === 'verificado' ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
      };
    });

    const balanceUsd = Math.max(0, Number((totalUsd - paidUsd).toFixed(2)));
    const balanceVes = Math.max(0, Number((totalVes - paidVes).toFixed(2)));
    const paymentStatus = balanceUsd <= 0 ? 'pagada' : paidUsd > 0 ? 'parcial' : 'pendiente';

    const customer = params.customerId ? this.customers.find((c) => c.id === params.customerId) : null;
    if (customer) {
      customer.total_purchases_count++;
      customer.total_purchases_usd += totalUsd;
      customer.last_purchase_at = new Date().toISOString();
      if (params.walletChangeDepositedUsd && params.walletChangeDepositedUsd > 0) {
        customer.wallet_balance_usd = Number(((customer.wallet_balance_usd ?? 0) + params.walletChangeDepositedUsd).toFixed(2));
      }
      if (params.walletUsedUsd && params.walletUsedUsd > 0) {
        customer.wallet_balance_usd = Math.max(0, Number(((customer.wallet_balance_usd ?? 0) - params.walletUsedUsd).toFixed(2)));
      }
    }

    const saleId = `sale-${Date.now()}`;
    const saleLines: PosSaleLine[] = params.lines.map((l, idx) => ({
      id: `line-${saleId}-${idx}`,
      tenant_id: MOCK_TENANT_ID,
      sale_id: saleId,
      product_id: l.productId ?? null,
      sku_snapshot: l.sku,
      name_snapshot: l.name,
      is_service: l.isService,
      quantity: l.quantity,
      returned_quantity: 0,
      unit_price_usd: l.unitPriceUsd,
      discount_percent: l.discountPercent,
      discount_amount_usd: l.discountAmountUsd,
      tax_rate_percent: l.taxRatePercent,
      tax_amount_usd: l.taxAmountUsd,
      line_subtotal_usd: l.lineSubtotalUsd,
      line_total_usd: l.lineTotalUsd,
      created_at: new Date().toISOString(),
    }));

    const doc: PosCommercialDocument = {
      id: `doc-${saleId}`,
      tenant_id: MOCK_TENANT_ID,
      sale_id: saleId,
      document_kind: 'comprobante_interno',
      internal_number: docNum,
      pdf_path: `/api/t/test1/pos/documents/${saleId}`,
      status: 'generado',
      created_at: new Date().toISOString(),
    };

    const newSale: PosSale = {
      id: saleId,
      tenant_id: MOCK_TENANT_ID,
      branch_id: params.branchId,
      shift_id: params.shiftId,
      register_id: params.registerId,
      cashier_user_id: params.cashierUserId,
      customer_id: params.customerId ?? null,
      sale_number: saleNum,
      commercial_status: 'confirmada',
      payment_status: paymentStatus,
      currency: 'USD',
      exchange_rate_snapshot: this.settings.active_exchange_rate,
      subtotal_usd: Number(subtotalUsd.toFixed(2)),
      discount_total_usd: Number(discountTotalUsd.toFixed(2)),
      tax_total_usd: Number(taxTotalUsd.toFixed(2)),
      total_usd: Number(totalUsd.toFixed(2)),
      total_ves: totalVes,
      paid_total_usd: Number(paidUsd.toFixed(2)),
      paid_total_ves: Number(paidVes.toFixed(2)),
      balance_due_usd: balanceUsd,
      balance_due_ves: balanceVes,
      notes: params.notes ?? null,
      discount_authorization_id: params.discountAuthorizationId ?? null,
      idempotency_key: params.idempotencyKey,
      correlation_id: params.correlationId,
      confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      lines: saleLines,
      payments: salePayments,
      customer: customer ?? null,
      sales_rep_id: params.salesRepId ?? null,
      sales_rep_name: params.salesRepName ?? null,
      wallet_change_deposited_usd: params.walletChangeDepositedUsd ?? 0,
      wallet_used_usd: params.walletUsedUsd ?? 0,
      applied_promotion_title: params.appliedPromotionTitle ?? null,
      document: doc,
    };

    this.sales.unshift(newSale);

    // Encolar comanda de despacho / almacén KDS si hay productos físicos (pos_order_dispatch_kds)
    const physicalItems = params.lines.filter((l) => !l.isService);
    if (physicalItems.length > 0) {
      const dispatchId = `dsp-${Date.now()}`;
      const dispatchOrder: PosDispatchOrder = {
        id: dispatchId,
        order_number: `DSP-${String(this.dispatchOrders.length + 101).padStart(3, '0')}`,
        sale_id: newSale.id,
        sale_number: newSale.sale_number,
        branch_id: params.branchId,
        customer_name: customer?.legal_name || 'Consumidor Final',
        created_at: new Date().toISOString(),
        status: 'pendiente',
        station: 'almacen',
        items: physicalItems.map((pi) => ({
          sku: pi.sku,
          name: pi.name,
          quantity: pi.quantity,
          completed: false,
        })),
      };
      this.dispatchOrders.unshift(dispatchOrder);
    }

    this.addAudit({
      branch_id: params.branchId,
      shift_id: params.shiftId,
      actor_id: params.cashierUserId,
      event_type: 'venta_confirmada',
      entity_type: 'pos_sales',
      entity_id: newSale.id,
      description: `Venta ${saleNum} confirmada. Comprobante Interno ${docNum} [mock]`,
      metadata: { totalUsd, totalVes, paymentsCount: salePayments.length },
      correlation_id: params.correlationId,
    });

    return { ok: true, sale: newSale };
  }

  // Devolución / Reverso
  processReturn(params: {
    branchId: string;
    shiftId: string;
    originalSaleId: string;
    returnType: 'anulacion_total' | 'devolucion_parcial' | 'devolucion_total';
    reason: string;
    notes?: string;
    refundMethod: 'efectivo_usd' | 'efectivo_ves' | 'reverso_electronico' | 'nota_credito_interna';
    requestedBy: string;
    approvedBy: string;
    lines: Array<{
      saleLineId: string;
      quantityReturned: number;
    }>;
  }): { ok: boolean; returnRecord?: PosSaleReturn; error?: string } {
    const sale = this.sales.find((s) => s.id === params.originalSaleId);
    if (!sale) {
      return { ok: false, error: 'Venta de referencia no encontrada.' };
    }
    if (sale.commercial_status === 'anulada' || sale.commercial_status === 'devuelta') {
      return { ok: false, error: 'La venta ya se encuentra completamente anulada o devuelta.' };
    }

    const returnId = `ret-${Date.now()}`;
    const returnNumber = `DEV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    let totalRefundUsd = 0;
    const returnLines: PosReturnLine[] = [];

    for (const reqLine of params.lines) {
      const saleLine = sale.lines?.find((l) => l.id === reqLine.saleLineId);
      if (!saleLine) {
        return { ok: false, error: `Línea de venta ${reqLine.saleLineId} no encontrada.` };
      }

      if (saleLine.returned_quantity + reqLine.quantityReturned > saleLine.quantity) {
        return {
          ok: false,
          error: `La cantidad solicitada para devolver (${reqLine.quantityReturned}) excede el remanente disponible.`,
        };
      }

      saleLine.returned_quantity += reqLine.quantityReturned;
      const refundLineUsd = Number((reqLine.quantityReturned * saleLine.unit_price_usd).toFixed(2));
      totalRefundUsd += refundLineUsd;

      // Devolver existencias físicas al stock si no es servicio
      if (!saleLine.is_service && saleLine.product_id) {
        const prod = this.products.find((p) => p.id === saleLine.product_id);
        if (prod) {
          prod.stock_quantity += reqLine.quantityReturned;
          prod.status = 'disponible';
        }
      }

      returnLines.push({
        id: `ret-line-${Date.now()}-${reqLine.saleLineId}`,
        tenant_id: MOCK_TENANT_ID,
        return_id: returnId,
        sale_line_id: reqLine.saleLineId,
        product_id: saleLine.product_id,
        quantity_returned: reqLine.quantityReturned,
        refund_amount_usd: refundLineUsd,
        refund_amount_ves: Number((refundLineUsd * sale.exchange_rate_snapshot).toFixed(2)),
        created_at: new Date().toISOString(),
      });
    }

    const totalRefundVes = Number((totalRefundUsd * sale.exchange_rate_snapshot).toFixed(2));

    // Evaluar remanente de la venta
    const hasPendingItems = sale.lines?.some((l) => l.returned_quantity < l.quantity);
    if (params.returnType === 'anulacion_total' || !hasPendingItems) {
      sale.commercial_status = params.returnType === 'anulacion_total' ? 'anulada' : 'devuelta';
    } else {
      sale.commercial_status = 'parcialmente_devuelta';
    }

    // Impactar cubetas de efectivo si el reembolso fue en efectivo
    const shift = this.shifts.find((s) => s.id === params.shiftId);
    if (shift && shift.status === 'abierto') {
      if (params.refundMethod === 'efectivo_usd') {
        shift.expected_totals['efectivo_usd'] = Math.max(0, (shift.expected_totals['efectivo_usd'] ?? 0) - totalRefundUsd);
      } else if (params.refundMethod === 'efectivo_ves') {
        shift.expected_totals['efectivo_ves'] = Math.max(0, (shift.expected_totals['efectivo_ves'] ?? 0) - totalRefundVes);
      }
    }

    const returnRecord: PosSaleReturn = {
      id: returnId,
      tenant_id: MOCK_TENANT_ID,
      branch_id: params.branchId,
      original_sale_id: params.originalSaleId,
      shift_id: params.shiftId,
      return_number: returnNumber,
      return_type: params.returnType,
      reason: params.reason,
      notes: params.notes ?? null,
      requested_by: params.requestedBy,
      approved_by: params.approvedBy,
      authorization_id: null,
      refund_method: params.refundMethod,
      total_refunded_usd: totalRefundUsd,
      total_refunded_ves: totalRefundVes,
      stock_reversal_reference: `KARDEX-REV-${returnNumber}`,
      financial_reversal_reference: `CAJA-REV-${returnNumber}`,
      created_at: new Date().toISOString(),
      lines: returnLines,
    };

    this.returns.unshift(returnRecord);

    this.addAudit({
      branch_id: params.branchId,
      shift_id: params.shiftId,
      actor_id: params.approvedBy,
      event_type: 'devolucion_reverso',
      entity_type: 'pos_sale_returns',
      entity_id: returnRecord.id,
      description: `Devolución ${returnNumber} procesada para venta ${sale.sale_number} [mock]`,
      metadata: { totalRefundUsd, totalRefundVes, method: params.refundMethod },
    });

    return { ok: true, returnRecord };
  }

  // Clientes
  addCustomer(customer: Omit<PosCustomer, 'id' | 'tenant_id' | 'total_purchases_count' | 'total_purchases_usd' | 'last_purchase_at' | 'created_at' | 'updated_at'>): PosCustomer {
    const newCust: PosCustomer = {
      ...customer,
      id: `c-${Date.now()}`,
      tenant_id: MOCK_TENANT_ID,
      total_purchases_count: 0,
      total_purchases_usd: 0,
      last_purchase_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.customers.unshift(newCust);
    return newCust;
  }

  // Cobro de Cuentas por Cobrar / Abono a Venta a Crédito
  recordDebtPayment(params: {
    saleId: string;
    shiftId: string;
    amountUsd: number;
    amountVes: number;
    paymentMethod: 'efectivo' | 'pago_movil' | 'tarjeta';
    reference?: string;
    notes?: string;
    performedBy: string;
  }): { ok: boolean; sale?: PosSale; error?: string } {
    const sale = this.sales.find((s) => s.id === params.saleId);
    if (!sale) return { ok: false, error: 'Venta no encontrada' };

    const remainingUsd = sale.balance_due_usd;
    if (remainingUsd <= 0) return { ok: false, error: 'Esta venta ya se encuentra totalmente saldada' };

    const appliedUsd = Math.min(params.amountUsd, remainingUsd);
    const appliedVes = Math.min(params.amountVes, sale.balance_due_ves);

    sale.paid_total_usd = Number((sale.paid_total_usd + appliedUsd).toFixed(2));
    sale.paid_total_ves = Number((sale.paid_total_ves + appliedVes).toFixed(2));
    sale.balance_due_usd = Math.max(0, Number((sale.total_usd - sale.paid_total_usd).toFixed(2)));
    sale.balance_due_ves = Math.max(0, Number((sale.total_ves - sale.paid_total_ves).toFixed(2)));

    if (sale.balance_due_usd <= 0) {
      sale.payment_status = 'pagada';
    } else {
      sale.payment_status = 'parcial';
    }

    const paymentId = `pay-${Date.now()}`;
    const newPayment: PosSalePayment = {
      id: paymentId,
      tenant_id: MOCK_TENANT_ID,
      branch_id: sale.branch_id,
      sale_id: sale.id,
      shift_id: params.shiftId,
      method: params.paymentMethod,
      currency: params.amountVes > 0 ? 'VES' : 'USD',
      amount_received: params.amountUsd,
      amount_applied: appliedUsd,
      change_amount: 0,
      change_currency: null,
      exchange_rate_snapshot: sale.exchange_rate_snapshot,
      reference_number: params.reference ?? paymentId,
      bank_code: null,
      bank_name: null,
      payer_phone: null,
      payer_document: null,
      terminal_id: null,
      card_last4: null,
      approval_code: null,
      cashea_operation_id: null,
      cashea_merchant_amount: null,
      provider_status: 'verificado',
      verified_by: params.performedBy,
      verified_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    sale.payments = sale.payments || [];
    sale.payments.push(newPayment);

    // Impactar cubetas de efectivo en el turno activo si el pago fue en efectivo
    const shift = this.shifts.find((s) => s.id === params.shiftId);
    if (shift && shift.status === 'abierto') {
      if (params.paymentMethod === 'efectivo') {
        if (params.amountVes > 0) {
          shift.expected_totals['efectivo_ves'] = (shift.expected_totals['efectivo_ves'] ?? 0) + appliedVes;
        } else {
          shift.expected_totals['efectivo_usd'] = (shift.expected_totals['efectivo_usd'] ?? 0) + appliedUsd;
        }
      }
    }

    this.addAudit({
      branch_id: sale.branch_id,
      shift_id: params.shiftId,
      actor_id: params.performedBy,
      event_type: 'abono_cxc',
      entity_type: 'pos_sales',
      entity_id: sale.id,
      description: `Abono a cuenta por cobrar registrado por $${appliedUsd.toFixed(2)} USD en venta ${sale.sale_number} [mock]`,
      metadata: { appliedUsd, remainingDueUsd: sale.balance_due_usd, method: params.paymentMethod },
    });

    return { ok: true, sale };
  }

  // Auditoría auxiliar
  addAudit(event: Omit<PosAuditEvent, 'id' | 'tenant_id' | 'created_at'>): PosAuditEvent {
    const newEvent: PosAuditEvent = {
      ...event,
      id: `ae-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tenant_id: MOCK_TENANT_ID,
      correlation_id: event.correlation_id ?? null,
      created_at: new Date().toISOString(),
    };
    this.auditEvents.unshift(newEvent);
    return newEvent;
  }
}

// Instancia única (Singleton) en memoria
export const posStore = new PosInMemoryStore();
export const hkaProvider = new TheFactoryHkaProvider(posStore.fiscalIntegration);
export { casheaProvider, CasheaPosProvider };

