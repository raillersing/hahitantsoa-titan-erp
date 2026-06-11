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
  notes?: string;
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
