export type InventoryItemKind = "material" | "article" | "material_pack";

export type InventoryItem = {
  id: string;
  name: string;
  kind: InventoryItemKind;
  description: string;
};

export type Customer = {
  id: string;
  display_name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
};

export type CustomerCreatePayload = {
  display_name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  is_active?: boolean;
};

export type CustomerUpdatePayload = {
  display_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  is_active?: boolean;
};

export type HahitantsoaDiscoveryConcept =
  | "event"
  | "venue"
  | "local"
  | "room"
  | "hall"
  | "material"
  | "article"
  | "furniture"
  | "service";

export type HahitantsoaDiscoveryItem = {
  concept: HahitantsoaDiscoveryConcept;
  label: string;
};

export type HahitantsoaDiscoveryResponse = {
  items: HahitantsoaDiscoveryItem[];
  count: number;
};

export type ReservationAvailabilitySummary = {
  start_at: string;
  end_at: string;
  available_item_count: number;
  available_preview_count: number;
  available_item_kinds: InventoryItemKind[];
};

export type ReservationAvailableItemPreview = {
  inventory_item_id: string;
  inventory_item_name: string;
  inventory_item_kind: InventoryItemKind;
  start_at: string;
  end_at: string;
  status: "available";
};

export type ReservationItemAvailabilityStatus =
  | "available"
  | "unavailable"
  | "invalid";

export type ReservationItemAvailabilityPreview = {
  inventory_item_id: string;
  inventory_item_name: string;
  inventory_item_kind: InventoryItemKind;
  start_at: string;
  end_at: string;
  status: ReservationItemAvailabilityStatus;
  conflict_count: number;
};

export type ReservationDraftLineInput = {
  inventory_item_id: string;
  quantity: number;
  notes?: string;
};

export type ReservationDraftCreatePayload = {
  customer_id: string;
  start_at: string;
  end_at: string;
  notes?: string;
  lines: ReservationDraftLineInput[];
};

export type ReservationDraftUpdatePayload = {
  customer_id?: string;
  start_at?: string;
  end_at?: string;
  notes?: string;
  lines?: ReservationDraftLineInput[];
};

export type ReservationDraftLine = {
  id: string;
  inventory_item_id: string;
  inventory_item_name: string;
  inventory_item_kind: InventoryItemKind;
  quantity: number;
  notes: string;
};

export type ReservationDraft = {
  id: string;
  public_reference: string;
  status: "draft" | "confirmed" | "cancelled";
  customer_id: string;
  customer_display_name: string;
  start_at: string;
  end_at: string;
  notes: string;
  contract_signed_at: string | null;
  contract_signed_by_id: string | null;
  required_deposit_received_at: string | null;
  required_deposit_received_by_id: string | null;
  confirmed_at: string | null;
  confirmed_by_id: string | null;
  cancelled_at: string | null;
  cancelled_by_id: string | null;
  lines: ReservationDraftLine[];
  created_at: string;
  updated_at: string;
};

export type ReservationDraftMutationResult = {
  status: ReservationDraft["status"];
  public_reference: string;
  reservation_draft: ReservationDraft;
};

export type ReservationDraftConfirmResult = ReservationDraftMutationResult & {
  blocked_item_count: number;
};

export type HahitantsoaEventDraftLineInput = {
  inventory_item_id: string;
  quantity: number;
  notes?: string;
};

export type HahitantsoaEventDraftCreatePayload = {
  customer_id: string;
  event_name: string;
  venue_name?: string;
  location_details?: string;
  service_notes?: string;
  start_at: string;
  end_at: string;
  notes?: string;
  lines: HahitantsoaEventDraftLineInput[];
};

export type HahitantsoaEventDraftUpdatePayload = {
  customer_id?: string;
  event_name?: string;
  venue_name?: string;
  location_details?: string;
  service_notes?: string;
  start_at?: string;
  end_at?: string;
  notes?: string;
  lines?: HahitantsoaEventDraftLineInput[];
};

export type HahitantsoaEventDraftLine = {
  id: string;
  inventory_item_id: string;
  inventory_item_name: string;
  inventory_item_kind: InventoryItemKind;
  quantity: number;
  notes: string;
};

export type HahitantsoaEventDraft = {
  id: string;
  public_reference: string;
  status: "draft" | "confirmed";
  customer_id: string;
  customer_display_name: string;
  event_name: string;
  venue_name: string;
  location_details: string;
  service_notes: string;
  start_at: string;
  end_at: string;
  notes: string;
  lines: HahitantsoaEventDraftLine[];
  created_at: string;
  updated_at: string;
};

export type HahitantsoaEventDraftAvailabilityLinePreview = {
  event_draft_line_id: string;
  quantity: number;
  inventory_item_id: string;
  inventory_item_name: string;
  inventory_item_kind: InventoryItemKind;
  status: "available" | "unavailable";
  conflict_count: number;
};

export type HahitantsoaEventDraftAvailabilityPreview = {
  event_draft_id: string;
  public_reference: string;
  start_at: string;
  end_at: string;
  line_count: number;
  available_line_count: number;
  unavailable_line_count: number;
  lines: HahitantsoaEventDraftAvailabilityLinePreview[];
};

export type HahitantsoaEventDraftConfirmationPreflight = {
  event_draft_id: string;
  public_reference: string;
  status: string;
  can_confirm: boolean;
  blockers: string[];
  active_line_count: number;
  unavailable_line_count: number;
};

export type HahitantsoaEventDraftAmendmentPreflight = {
  event_draft_id: string;
  public_reference: string;
  status: string;
  can_amend: boolean;
  blockers: string[];
  active_line_count: number;
};

export type HahitantsoaEventDraftConfirmationResult = {
  status: string;
  public_reference: string;
  blocked_item_count: number;
  event_draft: HahitantsoaEventDraft;
};

export type HahitantsoaEventDraftAmendmentRequestLine = {
  id: string;
  inventory_item_id: string;
  inventory_item_name: string;
  inventory_item_kind: InventoryItemKind;
  quantity: number;
  notes: string;
};

export type HahitantsoaEventDraftAmendmentRequest = {
  id: string;
  event_draft_id: string;
  status: "draft";
  reason: string;
  notes: string;
  lines: HahitantsoaEventDraftAmendmentRequestLine[];
  created_at: string;
  updated_at: string;
};

export type HahitantsoaEventDraftAmendmentRequestCreatePayload = {
  reason?: string;
  notes?: string;
};

export type HahitantsoaEventDraftAmendmentRequestUpdatePayload = {
  reason?: string;
  notes?: string;
};

export type HahitantsoaEventDraftAmendmentRequestLineCreatePayload = {
  inventory_item_id: string;
  quantity: number;
  notes?: string;
};

export type HahitantsoaEventDraftAmendmentRequestLineUpdatePayload = {
  inventory_item_id?: string;
  quantity?: number;
  notes?: string;
};

export type HahitantsoaEventDraftAmendmentRequestAvailabilityLinePreview = {
  amendment_request_line_id: string;
  quantity: number;
  inventory_item_id: string;
  inventory_item_name: string;
  inventory_item_kind: InventoryItemKind;
  status: "available" | "unavailable";
  conflict_count: number;
};

export type HahitantsoaEventDraftAmendmentRequestAvailabilityPreview = {
  amendment_request_id: string;
  event_draft_id: string;
  public_reference: string;
  status: string;
  start_at: string;
  end_at: string;
  line_count: number;
  available_line_count: number;
  unavailable_line_count: number;
  lines: HahitantsoaEventDraftAmendmentRequestAvailabilityLinePreview[];
};

export type DocumentTemplateDefinition = {
  key: string;
  business_scope: "titan" | "hahitantsoa" | "shared";
  document_type: string;
  label: string;
  version: string;
  status: string;
  source_kind: string;
  source_reference: string;
  template_path: string;
  preview_path: string;
  validated_by_client: boolean;
  notes: string;
};

export type DocumentInstance = {
  id: string;
  reservation_draft: string | null;
  hahitantsoa_event_draft?: string | null;
  customer: string;
  template_key: string;
  template_version: string;
  template_label: string;
  business_scope: string;
  document_type: string;
  template_status: string;
  template_source_kind: string;
  template_source_reference: string;
  template_path: string;
  template_preview_path: string;
  template_validated_by_client: boolean;
  template_notes: string;
  reservation_public_reference: string;
  reservation_status: string;
  customer_display_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  status: "prepared" | "generated" | "voided";
  prepared_at: string;
  prepared_by: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string;
  content_checksum: string;
  storage_path: string;
  generated_content_size_bytes: number;
  pdf_storage_path?: string | null;
  pdf_generated_at?: string | null;
  pdf_content_checksum?: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type DocumentInstanceCreatePayload = {
  template_key: string;
  notes?: string;
};

export type DocumentInstancePdfGenerationResult = {
  id: string;
  status: string;
  pdf_storage_path: string;
  pdf_generated_at: string;
  pdf_content_checksum: string;
};



// ---- Payments ----

export type PaymentKind =
  | 'deposit'
  | 'balance'
  | 'caution'
  | 'owner_injection'
  | 'investor_injection'
  | 'date_reservation'
  | 'other';

export type PaymentMethod = 'cash' | 'bank_transfer' | 'mobile_money' | 'cheque' | 'other';

export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled' | 'reconciled';

export type Payment = {
  id: string;
  reservation_draft: string | null;
  receipt_document: DocumentInstance | null;
  payment_kind: PaymentKind;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  amount: string;
  paid_at: string | null;
  external_reference: string;
  source_label: string;
  notes: string;
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentCreatePayload = {
  reservation_draft?: string | null;
  payment_kind: PaymentKind;
  payment_method: PaymentMethod;
  payment_status?: PaymentStatus;
  amount: string;
  external_reference?: string;
  source_label?: string;
  notes?: string;
};

export type PaymentConfirmPayload = {
  paid_at?: string;
  external_reference?: string;
  notes?: string;
};

// ---- Logistics & Delivery ----

export type LogisticsEventType = 'delivery' | 'pickup' | 'preparation' | 'handover';

export type LogisticsEventStatus = 'planned' | 'dispatched' | 'completed' | 'cancelled';

export type LogisticsEventItemLine = {
  id: string;
  logistics_event: string;
  inventory_item: string;
  inventory_item_name: string;
  inventory_item_kind: InventoryItemKind;
  quantity: number;
  notes: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type LogisticsEvent = {
  id: string;
  reservation_draft: string;
  event_type: LogisticsEventType;
  status: LogisticsEventStatus;
  scheduled_at: string | null;
  executed_at: string | null;
  address: string;
  contact_name: string;
  contact_phone: string;
  notes: string;
  signature_required: boolean;
  signature_received: boolean;
  signed_by: string | null;
  signed_at: string | null;
  item_lines: LogisticsEventItemLine[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type LogisticsEventTransitionPayload = {
  new_status: LogisticsEventStatus;
  executed_at?: string | null;
  notes?: string;
};

export type LogisticsEventItemLineCreatePayload = {
  inventory_item_id: string;
  quantity: number;
  notes?: string;
};

export type LogisticsEventCompletePassationPayload = {
  signed_at?: string | null;
  notes?: string;
};

export type LogisticsEventCompletePassationResponse = {
  event: LogisticsEvent;
  document_instance_id: string;
};

// ---- Returns Handling ----

export type ReturnOperationStatus = 'draft' | 'validated';

export type InventoryReturnOperationLine = {
  id: string;
  inventory_item: string;
  expected_quantity: number;
  returned_quantity: number;
  damaged_quantity: number;
  missing_quantity: number;
  condition_status: 'intact' | 'damaged' | 'missing' | 'mixed';
  notes: string;
  intact_quantity: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type InventoryReturnOperation = {
  id: string;
  reservation_draft: string | null;
  document_instance: string | null;
  status: ReturnOperationStatus;
  notes: string;
  validated_at: string | null;
  validated_by: string | null;
  lines: InventoryReturnOperationLine[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

// ---- Damage & Loss ----

export type SettlementStatus = 'draft' | 'validated' | 'cancelled';

export type SettlementLineKind = 'damage' | 'loss' | 'repair' | 'non_inventory_damage' | 'other';

export type SettlementAmountSource = 'manual' | 'inventory_default' | 'pricing_table' | 'override';

export type InventoryDamageLossSettlementLine = {
  id: string;
  return_operation_line: string | null;
  manual_label: string;
  settlement_line_kind: SettlementLineKind;
  quantity: number;
  unit_amount: number;
  amount_source: SettlementAmountSource;
  total_amount: number;
  notes: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type InventoryDamageLossSettlement = {
  id: string;
  return_operation: string;
  document_instance: string | null;
  settlement_status: SettlementStatus;
  damage_loss_total: number;
  caution_available: number;
  caution_applied: number;
  refund_due: number;
  excess_due: number;
  notes: string;
  validated_at: string | null;
  validated_by: string | null;
  lines: InventoryDamageLossSettlementLine[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

// ---- Inventory Stock Movements (live backend — /api/v1/inventory/stock-movements/) ----

export type InventoryStockMovementType =
  | 'outbound_delivery'
  | 'inbound_return'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'damage'
  | 'loss'
  | 'other';

export type InventoryStockMovementDirection = 'inbound' | 'outbound';

export type InventoryStockMovement = {
  id: string;
  inventory_item: string;
  reservation_draft: string | null;
  movement_type: InventoryStockMovementType;
  direction: InventoryStockMovementDirection;
  quantity: number;
  source_label: string;
  notes: string;
  effective_at: string;
  validated_at: string;
  validated_by: string | null;
  created_at: string;
  updated_at: string;
};

// ---- Billing Invoices (live backend — /api/v1/billing/invoices/) ----

export type BillingInvoiceStatus = 'open' | 'settled' | 'cancelled';

export type BillingInvoiceSettlement = {
  id: string;
  payment: Payment;
  amount: string;
  settled_at: string;
  settled_by: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type BillingInvoice = {
  id: string;
  excess_receivable: string | null;
  document_instance: DocumentInstance | null;
  reservation_draft: string | null;
  source_kind: string;
  invoice_status: BillingInvoiceStatus;
  amount: string;
  issued_at: string;
  settled_at: string | null;
  settled_by: string | null;
  notes: string;
  settlement: BillingInvoiceSettlement | null;
  refund_obligation: BillingRefundObligation | null;
  installments: BillingInvoiceInstallment[];
  credit_notes?: BillingCreditNote[];
  installment_lifecycle: string;
  suggested_due_dates: { j30: string; j10: string } | null;
  closeout_status: string;
  amount_settled: string;
  amount_refunded: string;
  remaining_balance: string;
  created_at: string;
  updated_at: string;
};

export type BillingInstallmentStatus = 'unpaid' | 'partially_paid' | 'paid';

export type BillingInstallmentAllocation = {
  id: string;
  payment: Payment;
  amount: string;
  allocated_at: string;
  allocated_by: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type BillingInvoiceInstallment = {
  id: string;
  invoice: string;
  amount: string;
  paid_amount: string;
  due_at: string;
  status: BillingInstallmentStatus;
  notes: string;
  allocations: BillingInstallmentAllocation[];
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
};

export type BillingRefundObligationStatus = 'pending' | 'executed';

export type BillingRefundObligation = {
  id: string;
  invoice: string;
  refund_amount: string;
  document_instance: DocumentInstance | null;
  refund_payment: Payment | null;
  status: BillingRefundObligationStatus;
  executed_at: string | null;
  executed_by: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type BillingCreditNoteStatus = 'issued' | 'applied' | 'cancelled';

export type BillingCreditNote = {
  id: string;
  invoice: string;
  invoice_detail: BillingInvoice | null;
  amount: string;
  reason: string;
  status: BillingCreditNoteStatus;
  issued_at: string;
  applied_at: string | null;
  applied_by: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type BillingInvoiceSettlePayload = {
  payment: string;
  notes?: string;
};

export type BillingInvoiceInstallmentScheduleCreatePayload = {
  installments: Array<{ amount: string; due_at: string }>;
  notes?: string;
};

export type BillingInstallmentAllocatePayload = {
  payment: string;
  notes?: string;
};

export type BillingInvoiceCorrectPayload = {
  notes?: string;
};

export type BillingRefundObligationExecutePayload = {
  notes?: string;
};

export type BillingCreditNoteIssuePayload = {
  amount: string;
  reason: string;
  notes?: string;
};

// ---- Cashbox ----

export type CashboxMovementDirection = "cash_in" | "cash_out";

export type CashboxMovement = {
  id: string;
  session: string;
  direction: CashboxMovementDirection;
  amount: string;
  payment: Payment | null;
  billing_invoice: BillingInvoice | null;
  billing_refund_obligation: BillingRefundObligation | null;
  moved_at: string;
  moved_by: string | null;
  note: string;
  created_at: string;
  updated_at: string;
};

export type CashboxSession = {
  id: string;
  operator: string;
  opened_at: string;
  opened_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
  opening_note: string;
  closing_note: string;
  net_amount: string;
  movements: CashboxMovement[];
  created_at: string;
  updated_at: string;
};

export type CashboxSessionOpenPayload = {
  operator: string;
  opening_note?: string;
};

export type CashboxSessionClosePayload = {
  closing_note?: string;
};

export type CashboxMovementCreatePayload = {
  direction: CashboxMovementDirection;
  amount: string;
  payment?: string | null;
  billing_invoice?: string | null;
  billing_refund_obligation?: string | null;
  note?: string;
};

// ---- Identity / Role Management (live backend — /api/v1/identity/) ----

export type ApplicationRole = {
  id: string;
  name: string;
  slug: string;
  description: string;
  is_system_managed: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type UserRoleAssignment = {
  id: string;
  user_id: string;
  role: ApplicationRole;
  assigned_by_id: string | null;
  assigned_at: string;
  revoked_at: string | null;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type RoleQueryParams = {
  name?: string;
  is_system_managed?: boolean;
  is_active?: boolean;
};

export type RoleAssignmentQueryParams = {
  user_id?: string;
  role_id?: string;
  assigned_after?: string;
  assigned_before?: string;
  is_active?: boolean;
};

export type AssignRolePayload = {
  user_id: string;
  role_id: string;
  notes?: string;
};

export type RevokeRolePayload = {
  notes?: string;
};

// ---- Audit Events (live backend — /api/v1/audit/) ----

export type AuditEvent = {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, string | number | boolean | null | Record<string, unknown> | unknown[]>;
  created_at: string;
};

export type AuditEventQueryParams = {
  action?: string;
  target_type?: string;
  target_id?: string;
  actor_id?: string;
  created_after?: string;
  created_before?: string;
};

export type StockMovementCreatePayload = {
  inventory_item: string;
  reservation_draft?: string | null;
  movement_type: InventoryStockMovementType;
  direction: InventoryStockMovementDirection;
  quantity: number;
  source_label?: string;
  notes?: string;
  effective_at?: string;
};
