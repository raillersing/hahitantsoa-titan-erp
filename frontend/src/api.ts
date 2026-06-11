import type {
  Customer,
  HahitantsoaDiscoveryResponse,
  InventoryItem,
  ReservationAvailabilitySummary,
  ReservationAvailableItemPreview,
  ReservationDraft,
  ReservationDraftCreatePayload,
  ReservationItemAvailabilityPreview,
} from "./types";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error("The requested data could not be loaded.");
  }

  return (await response.json()) as T;
}

async function getAuthenticatedJson<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    signal,
  });

  return parseJsonResponse<T>(response);
}

async function postAuthenticatedJson<T>(
  url: string,
  payload: object,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });

  return parseJsonResponse<T>(response);
}

function buildReservationPeriodQuery(startAt: string, endAt: string): string {
  return new URLSearchParams({
    start_at: startAt,
    end_at: endAt,
  }).toString();
}

export function getInventoryItems(
  signal?: AbortSignal,
): Promise<InventoryItem[]> {
  return getAuthenticatedJson("/api/v1/inventory/items/", signal);
}

export function getCustomers(signal?: AbortSignal): Promise<Customer[]> {
  return getAuthenticatedJson("/api/v1/customers/", signal);
}

export function getHahitantsoaDiscoveryItems(
  signal?: AbortSignal,
): Promise<HahitantsoaDiscoveryResponse> {
  return getAuthenticatedJson("/api/v1/hahitantsoa/discovery-items/", signal);
}

export function getReservationAvailabilitySummary(
  startAt: string,
  endAt: string,
): Promise<ReservationAvailabilitySummary> {
  const query = buildReservationPeriodQuery(startAt, endAt);
  return getAuthenticatedJson(
    `/api/v1/reservations/availability-summary/?${query}`,
  );
}

export function getReservationAvailableItemPreviews(
  startAt: string,
  endAt: string,
): Promise<ReservationAvailableItemPreview[]> {
  const query = buildReservationPeriodQuery(startAt, endAt);
  return getAuthenticatedJson(
    `/api/v1/reservations/available-item-previews/?${query}`,
  );
}

export function getReservationItemAvailabilityPreview(
  inventoryItemId: string,
  startAt: string,
  endAt: string,
): Promise<ReservationItemAvailabilityPreview> {
  const query = buildReservationPeriodQuery(startAt, endAt);
  return getAuthenticatedJson(
    `/api/v1/reservations/items/${inventoryItemId}/availability-preview/?${query}`,
  );
}

export function getReservationDrafts(
  signal?: AbortSignal,
): Promise<ReservationDraft[]> {
  return getAuthenticatedJson("/api/v1/reservations/drafts/", signal);
}

export function getReservationDraft(
  draftId: string,
  signal?: AbortSignal,
): Promise<ReservationDraft> {
  return getAuthenticatedJson(`/api/v1/reservations/drafts/${draftId}/`, signal);
}

export function createReservationDraft(
  payload: ReservationDraftCreatePayload,
): Promise<ReservationDraft> {
  return postAuthenticatedJson("/api/v1/reservations/drafts/", payload);
}
