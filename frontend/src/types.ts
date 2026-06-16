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
  status: "draft";
  customer_id: string;
  customer_display_name: string;
  start_at: string;
  end_at: string;
  notes: string;
  lines: ReservationDraftLine[];
  created_at: string;
  updated_at: string;
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


