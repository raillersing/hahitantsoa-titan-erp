import type {
  BillingInvoice,
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
  HahitantsoaEventDraftAmendmentRequest,
  HahitantsoaEventDraftAmendmentRequestCreatePayload,
  HahitantsoaEventDraftAmendmentRequestUpdatePayload,
  HahitantsoaEventDraftAmendmentRequestLine,
  HahitantsoaEventDraftAmendmentRequestLineCreatePayload,
  HahitantsoaEventDraftAmendmentRequestLineUpdatePayload,
  HahitantsoaEventDraftAmendmentRequestAvailabilityPreview,
  DocumentTemplateDefinition,
  DocumentInstance,
  DocumentInstanceCreatePayload,
  Payment,
  PaymentCreatePayload,
  PaymentConfirmPayload,
} from "./types";


export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;

  constructor(message: string, status: number, errors: Record<string, string[]> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

async function parseErrorResponse(
  response: Response,
): Promise<{ message: string; errors: Record<string, string[]> }> {
  let message = "The requested data could not be loaded.";
  let errors: Record<string, string[]> = {};
  try {
    const errorData = await response.json();
    if (errorData && typeof errorData === "object") {
      if (typeof errorData.detail === "string") {
        message = errorData.detail;
      } else {
        const parts: string[] = [];
        for (const [key, value] of Object.entries(errorData)) {
          if (Array.isArray(value)) {
            const strArray = value.map(String);
            errors[key] = strArray;
            parts.push(`${key}: ${strArray.join(", ")}`);
          } else if (typeof value === "string") {
            errors[key] = [value];
            parts.push(`${key}: ${value}`);
          }
        }
        if (parts.length > 0) {
          message = parts.join("; ");
        }
      }
    }
  } catch {
    if (response.statusText) {
      message = `${response.statusText} (${response.status})`;
    }
  }
  return { message, errors };
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const parsed = await parseErrorResponse(response);
    throw new ApiError(parsed.message, response.status, parsed.errors);
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
    const parsed = await parseErrorResponse(response);
    throw new ApiError(parsed.message, response.status, parsed.errors);
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

export function getHahitantsoaEventDraftAmendmentRequests(
  draftId: string,
  signal?: AbortSignal,
): Promise<HahitantsoaEventDraftAmendmentRequest[]> {
  return getAuthenticatedJson(
    `/api/v1/hahitantsoa/event-drafts/${draftId}/amendment-requests/`,
    signal,
  );
}

export function createHahitantsoaEventDraftAmendmentRequest(
  draftId: string,
  payload: HahitantsoaEventDraftAmendmentRequestCreatePayload,
  signal?: AbortSignal,
): Promise<{ amendment_request: HahitantsoaEventDraftAmendmentRequest }> {
  return postAuthenticatedJson(
    `/api/v1/hahitantsoa/event-drafts/${draftId}/amendment-requests/`,
    payload,
    signal,
  );
}

export function updateHahitantsoaEventDraftAmendmentRequest(
  draftId: string,
  amendmentRequestId: string,
  payload: HahitantsoaEventDraftAmendmentRequestUpdatePayload,
  signal?: AbortSignal,
): Promise<HahitantsoaEventDraftAmendmentRequest> {
  return patchAuthenticatedJson(
    `/api/v1/hahitantsoa/event-drafts/${draftId}/amendment-requests/${amendmentRequestId}/`,
    payload,
    signal,
  );
}

export function getHahitantsoaEventDraftAmendmentRequest(
  draftId: string,
  amendmentRequestId: string,
  signal?: AbortSignal,
): Promise<HahitantsoaEventDraftAmendmentRequest> {
  return getAuthenticatedJson(
    `/api/v1/hahitantsoa/event-drafts/${draftId}/amendment-requests/${amendmentRequestId}/`,
    signal,
  );
}

export function getHahitantsoaEventDraftAmendmentRequestLines(
  draftId: string,
  amendmentRequestId: string,
  signal?: AbortSignal,
): Promise<HahitantsoaEventDraftAmendmentRequestLine[]> {
  return getAuthenticatedJson(
    `/api/v1/hahitantsoa/event-drafts/${draftId}/amendment-requests/${amendmentRequestId}/lines/`,
    signal,
  );
}

export function createHahitantsoaEventDraftAmendmentRequestLine(
  draftId: string,
  amendmentRequestId: string,
  payload: HahitantsoaEventDraftAmendmentRequestLineCreatePayload,
  signal?: AbortSignal,
): Promise<HahitantsoaEventDraftAmendmentRequestLine> {
  return postAuthenticatedJson(
    `/api/v1/hahitantsoa/event-drafts/${draftId}/amendment-requests/${amendmentRequestId}/lines/`,
    payload,
    signal,
  );
}

export function updateHahitantsoaEventDraftAmendmentRequestLine(
  draftId: string,
  amendmentRequestId: string,
  lineId: string,
  payload: HahitantsoaEventDraftAmendmentRequestLineUpdatePayload,
  signal?: AbortSignal,
): Promise<HahitantsoaEventDraftAmendmentRequestLine> {
  return patchAuthenticatedJson(
    `/api/v1/hahitantsoa/event-drafts/${draftId}/amendment-requests/${amendmentRequestId}/lines/${lineId}/`,
    payload,
    signal,
  );
}

export async function deleteHahitantsoaEventDraftAmendmentRequestLine(
  draftId: string,
  amendmentRequestId: string,
  lineId: string,
): Promise<void> {
  const response = await fetch(
    `/api/v1/hahitantsoa/event-drafts/${draftId}/amendment-requests/${amendmentRequestId}/lines/${lineId}/`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );
  if (!response.ok) {
    const parsed = await parseErrorResponse(response);
    throw new ApiError(parsed.message, response.status, parsed.errors);
  }
}

export function getHahitantsoaEventDraftAmendmentRequestAvailabilityPreflight(
  draftId: string,
  amendmentRequestId: string,
  signal?: AbortSignal,
): Promise<HahitantsoaEventDraftAmendmentRequestAvailabilityPreview> {
  return getAuthenticatedJson(
    `/api/v1/hahitantsoa/event-drafts/${draftId}/amendment-requests/${amendmentRequestId}/availability-preflight/`,
    signal,
  );
}

export function getDocumentTemplates(
  signal?: AbortSignal,
): Promise<DocumentTemplateDefinition[]> {
  return getAuthenticatedJson("/api/v1/documents/templates/", signal);
}

export function getReservationDraftDocumentInstances(
  reservationDraftId: string,
  signal?: AbortSignal,
): Promise<DocumentInstance[]> {
  return getAuthenticatedJson(
    `/api/v1/documents/reservation-drafts/${reservationDraftId}/instances/`,
    signal,
  );
}

export function createReservationDraftDocumentInstance(
  reservationDraftId: string,
  payload: DocumentInstanceCreatePayload,
  signal?: AbortSignal,
): Promise<DocumentInstance> {
  return postAuthenticatedJson(
    `/api/v1/documents/reservation-drafts/${reservationDraftId}/instances/`,
    payload,
    signal,
  );
}

export function getReservationDraftDocumentInstance(
  reservationDraftId: string,
  id: string,
  signal?: AbortSignal,
): Promise<DocumentInstance> {
  return getAuthenticatedJson(
    `/api/v1/documents/reservation-drafts/${reservationDraftId}/instances/${id}/`,
    signal,
  );
}

export function generateReservationDraftDocumentInstance(
  reservationDraftId: string,
  id: string,
  signal?: AbortSignal,
): Promise<DocumentInstance> {
  return postAuthenticatedJson(
    `/api/v1/documents/reservation-drafts/${reservationDraftId}/instances/${id}/generate/`,
    {},
    signal,
  );
}


// ---- Payments ----

export function getPayments(
  signal?: AbortSignal,
): Promise<Payment[]> {
  return getAuthenticatedJson('/api/v1/payments/', signal);
}

export function createPayment(
  payload: PaymentCreatePayload,
  signal?: AbortSignal,
): Promise<Payment> {
  return postAuthenticatedJson('/api/v1/payments/', payload, signal);
}

export function getPayment(
  id: string,
  signal?: AbortSignal,
): Promise<Payment> {
  return getAuthenticatedJson(`/api/v1/payments/${id}/`, signal);
}

export function confirmPayment(
  id: string,
  payload: PaymentConfirmPayload,
  signal?: AbortSignal,
): Promise<Payment> {
  return postAuthenticatedJson(`/api/v1/payments/${id}/confirm/`, payload, signal);
}
// ---- Billing Invoices ----

export function getBillingInvoices(
  signal?: AbortSignal,
): Promise<BillingInvoice[]> {
  return getAuthenticatedJson('/api/v1/billing/invoices/', signal);
}
// ---- Inventory Stock Movements ----

export function getStockMovements(
  signal?: AbortSignal,
): Promise<import('./types').InventoryStockMovement[]> {
  return getAuthenticatedJson('/api/v1/inventory/stock-movements/', signal);
}

export function createStockMovement(
  payload: import('./types').StockMovementCreatePayload,
  signal?: AbortSignal,
): Promise<import('./types').InventoryStockMovement> {
  return postAuthenticatedJson('/api/v1/inventory/stock-movements/', payload, signal);
}
