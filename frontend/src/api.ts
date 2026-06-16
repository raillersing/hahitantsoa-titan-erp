import type {
  Customer,
  HahitantsoaDiscoveryResponse,
  InventoryItem,
  ReservationAvailabilitySummary,
  ReservationAvailableItemPreview,
  ReservationDraft,
  ReservationDraftCreatePayload,
  ReservationDraftUpdatePayload,
  ReservationItemAvailabilityPreview,
  HahitantsoaEventDraft,
  HahitantsoaEventDraftCreatePayload,
  HahitantsoaEventDraftUpdatePayload,
  HahitantsoaEventDraftAvailabilityPreview,
  HahitantsoaEventDraftConfirmationPreflight,
  HahitantsoaEventDraftAmendmentPreflight,
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

async function patchAuthenticatedJson<T>(
  url: string,
  payload: object,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    method: "PATCH",
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
  return getAuthenticatedJson(
    `/api/v1/reservations/drafts/${draftId}/`,
    signal,
  );
}

export function createReservationDraft(
  payload: ReservationDraftCreatePayload,
): Promise<ReservationDraft> {
  return postAuthenticatedJson("/api/v1/reservations/drafts/", payload);
}

export function updateReservationDraft(
  draftId: string,
  payload: ReservationDraftUpdatePayload,
): Promise<ReservationDraft> {
  return patchAuthenticatedJson(
    `/api/v1/reservations/drafts/${draftId}/`,
    payload,
  );
}

export async function getDocumentArtifactHtml(
  documentInstanceId: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(
    `/api/v1/documents/instances/${documentInstanceId}/artifact/`,
    {
      credentials: "include",
      signal,
    },
  );

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "The private artifact preview requires an authenticated session with document access.",
    );
  }

  if (response.status === 404) {
    throw new Error(
      "No generated HTML artifact was found for this document instance.",
    );
  }

  if (!response.ok) {
    throw new Error("The requested document artifact could not be loaded.");
  }

  return response.text();
}

export function getHahitantsoaEventDrafts(
  signal?: AbortSignal,
): Promise<HahitantsoaEventDraft[]> {
  return getAuthenticatedJson("/api/v1/hahitantsoa/event-drafts/", signal);
}

export function getHahitantsoaEventDraft(
  draftId: string,
  signal?: AbortSignal,
): Promise<HahitantsoaEventDraft> {
  return getAuthenticatedJson(
    `/api/v1/hahitantsoa/event-drafts/${draftId}/`,
    signal,
  );
}

export function createHahitantsoaEventDraft(
  payload: HahitantsoaEventDraftCreatePayload,
): Promise<HahitantsoaEventDraft> {
  return postAuthenticatedJson("/api/v1/hahitantsoa/event-drafts/", payload);
}

export function updateHahitantsoaEventDraft(
  draftId: string,
  payload: HahitantsoaEventDraftUpdatePayload,
): Promise<HahitantsoaEventDraft> {
  return patchAuthenticatedJson(
    `/api/v1/hahitantsoa/event-drafts/${draftId}/`,
    payload,
  );
}

export async function deleteHahitantsoaEventDraft(
  draftId: string,
): Promise<void> {
  const response = await fetch(`/api/v1/hahitantsoa/event-drafts/${draftId}/`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("The event draft could not be deleted.");
  }
}

export function getHahitantsoaEventDraftAvailabilityPreview(
  draftId: string,
  signal?: AbortSignal,
): Promise<HahitantsoaEventDraftAvailabilityPreview> {
  return getAuthenticatedJson(
    `/api/v1/hahitantsoa/event-drafts/${draftId}/availability-preview/`,
    signal,
  );
}

export function getHahitantsoaEventDraftConfirmationPreflight(
  draftId: string,
  signal?: AbortSignal,
): Promise<HahitantsoaEventDraftConfirmationPreflight> {
  return getAuthenticatedJson(
    `/api/v1/hahitantsoa/event-drafts/${draftId}/confirmation-preflight/`,
    signal,
  );
}

export function getHahitantsoaEventDraftAmendmentPreflight(
  draftId: string,
  signal?: AbortSignal,
): Promise<HahitantsoaEventDraftAmendmentPreflight> {
  return getAuthenticatedJson(
    `/api/v1/hahitantsoa/event-drafts/${draftId}/amendment-preflight/`,
    signal,
  );
}

export function confirmHahitantsoaEventDraft(
  draftId: string,
  signal?: AbortSignal,
): Promise<{ status: string; public_reference: string; blocked_item_count: number; event_draft: HahitantsoaEventDraft }> {
  return postAuthenticatedJson(
    `/api/v1/hahitantsoa/event-drafts/${draftId}/confirm/`,
    {},
    signal,
  );
}


