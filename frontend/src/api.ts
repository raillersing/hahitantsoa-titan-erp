import type {
  HahitantsoaDiscoveryResponse,
  InventoryItem,
  ReservationAvailabilitySummary,
  ReservationAvailableItemPreview,
} from "./types";

async function getAuthenticatedJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    throw new Error("The requested data could not be loaded.");
  }

  return (await response.json()) as T;
}

function buildReservationPeriodQuery(startAt: string, endAt: string): string {
  return new URLSearchParams({
    start_at: startAt,
    end_at: endAt,
  }).toString();
}

export function getInventoryItems(signal?: AbortSignal): Promise<InventoryItem[]> {
  return getAuthenticatedJson("/api/v1/inventory/items/", signal);
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
  return getAuthenticatedJson(`/api/v1/reservations/availability-summary/?${query}`);
}

export function getReservationAvailableItemPreviews(
  startAt: string,
  endAt: string,
): Promise<ReservationAvailableItemPreview[]> {
  const query = buildReservationPeriodQuery(startAt, endAt);
  return getAuthenticatedJson(`/api/v1/reservations/available-item-previews/?${query}`);
}
