import type {
  ApplicationRole,
  BillingInvoice,
  Customer,
  CustomerCreatePayload,
  CustomerUpdatePayload,
  HahitantsoaDiscoveryResponse,
  InventoryItem,
  LogisticsEvent,
  LogisticsEventCompletePassationPayload,
  LogisticsEventCompletePassationResponse,
  LogisticsEventItemLine,
  LogisticsEventItemLineCreatePayload,
  LogisticsEventTransitionPayload,
  ReservationAvailabilitySummary,
  ReservationAvailableItemPreview,
  ReservationDraft,
  ReservationDraftCreatePayload,
  ReservationDraftUpdatePayload,
  ReservationItemAvailabilityPreview,
  RoleAssignmentQueryParams,
  RoleQueryParams,
  UserRoleAssignment,
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
  InventoryDamageLossSettlement,
  InventoryReturnOperation,
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

export type CustomerSearchParams = {
  name?: string;
  email?: string;
  phone?: string;
};

export function getCustomers(
  params?: CustomerSearchParams,
  signal?: AbortSignal,
): Promise<Customer[]> {
  let url = "/api/v1/customers/";
  if (params) {
    const qs = new URLSearchParams();
    if (params.name) qs.set("name", params.name);
    if (params.email) qs.set("email", params.email);
    if (params.phone) qs.set("phone", params.phone);
    const qsStr = qs.toString();
    if (qsStr) url += `?${qsStr}`;
  }
  return getAuthenticatedJson(url, signal);
}

export function getCustomer(
  id: string,
  signal?: AbortSignal,
): Promise<Customer> {
  return getAuthenticatedJson(`/api/v1/customers/${id}/`, signal);
}

export function createCustomer(
  payload: CustomerCreatePayload,
  signal?: AbortSignal,
): Promise<Customer> {
  return postAuthenticatedJson("/api/v1/customers/create/", payload, signal);
}

export function updateCustomer(
  id: string,
  payload: CustomerUpdatePayload,
  signal?: AbortSignal,
): Promise<Customer> {
  return postAuthenticatedJson(
    `/api/v1/customers/${id}/update/`,
    payload,
    signal,
  );
}

export async function deleteCustomer(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`/api/v1/customers/${id}/delete/`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: "{}",
    signal,
  });
  if (!response.ok) {
    const parsed = await parseErrorResponse(response);
    throw new ApiError(parsed.message, response.status, parsed.errors);
  }
}

export async function checkEndpointPermission(
  endpoint: string,
  method: string = "OPTIONS",
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const response = await fetch(endpoint, {
      method,
      credentials: "include",
      signal,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function checkCustomerWritePermission(
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const response = await fetch("/api/v1/customers/create/", {
      method: "OPTIONS",
      credentials: "include",
      signal,
    });
    return response.ok;
  } catch {
    return false;
  }
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

// ---- Hahitantsoa Event Draft Documents ----

export function getHahitantsoaEventDraftDocumentInstances(
  eventDraftId: string,
  signal?: AbortSignal,
): Promise<DocumentInstance[]> {
  return getAuthenticatedJson(
    `/api/v1/hahitantsoa/event-drafts/${eventDraftId}/documents/`,
    signal,
  );
}

export function createHahitantsoaEventDraftDocumentInstance(
  eventDraftId: string,
  payload: DocumentInstanceCreatePayload,
  signal?: AbortSignal,
): Promise<DocumentInstance> {
  return postAuthenticatedJson(
    `/api/v1/hahitantsoa/event-drafts/${eventDraftId}/documents/`,
    payload,
    signal,
  );
}

export function getHahitantsoaEventDraftDocumentInstance(
  eventDraftId: string,
  id: string,
  signal?: AbortSignal,
): Promise<DocumentInstance> {
  return getAuthenticatedJson(
    `/api/v1/hahitantsoa/event-drafts/${eventDraftId}/documents/${id}/`,
    signal,
  );
}

export function generateHahitantsoaEventDraftDocumentInstance(
  eventDraftId: string,
  id: string,
  signal?: AbortSignal,
): Promise<DocumentInstance> {
  return postAuthenticatedJson(
    `/api/v1/hahitantsoa/event-drafts/${eventDraftId}/documents/${id}/generate/`,
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
// ---- Logistics Events ----

export function getLogisticsEvents(
  signal?: AbortSignal,
): Promise<LogisticsEvent[]> {
  return getAuthenticatedJson('/api/v1/logistics/events/', signal);
}

export function transitionLogisticsEvent(
  id: string,
  payload: LogisticsEventTransitionPayload,
  signal?: AbortSignal,
): Promise<LogisticsEvent> {
  return postAuthenticatedJson(`/api/v1/logistics/events/${id}/transition/`, payload, signal);
}

export function getLogisticsEventItemLines(
  id: string,
  signal?: AbortSignal,
): Promise<LogisticsEventItemLine[]> {
  return getAuthenticatedJson(`/api/v1/logistics/events/${id}/lines/`, signal);
}

export function addLogisticsEventItemLine(
  id: string,
  payload: LogisticsEventItemLineCreatePayload,
  signal?: AbortSignal,
): Promise<LogisticsEventItemLine> {
  return postAuthenticatedJson(`/api/v1/logistics/events/${id}/lines/add/`, payload, signal);
}

export async function removeLogisticsEventItemLine(
  id: string,
  lineId: string,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`/api/v1/logistics/events/${id}/lines/${lineId}/remove/`, {
    method: "POST",
    credentials: "include",
    signal,
  });
  if (!response.ok) {
    const parsed = await parseErrorResponse(response);
    throw new ApiError(parsed.message, response.status, parsed.errors);
  }
}

export function completeLogisticsPassation(
  id: string,
  payload: LogisticsEventCompletePassationPayload,
  signal?: AbortSignal,
): Promise<LogisticsEventCompletePassationResponse> {
  return postAuthenticatedJson(`/api/v1/logistics/events/${id}/complete-passation/`, payload, signal);
}
// ---- Return Operations ----

export function getReturnOperations(
  signal?: AbortSignal,
): Promise<InventoryReturnOperation[]> {
  return getAuthenticatedJson('/api/v1/inventory/return-operations/', signal);
}

export function validateReturnOperation(
  id: string,
  signal?: AbortSignal,
): Promise<InventoryReturnOperation> {
  return postAuthenticatedJson(`/api/v1/inventory/return-operations/${id}/validate/`, {}, signal);
}
// ---- Damage & Loss Settlements ----

export function getDamageLossSettlements(
  signal?: AbortSignal,
): Promise<InventoryDamageLossSettlement[]> {
  return getAuthenticatedJson('/api/v1/inventory/damage-loss-settlements/', signal);
}

export function validateDamageLossSettlement(
  id: string,
  signal?: AbortSignal,
): Promise<InventoryDamageLossSettlement> {
  return postAuthenticatedJson(`/api/v1/inventory/damage-loss-settlements/${id}/validate/`, {}, signal);
}

// ---- Identity / Role Management ----

function buildRoleQuery(params?: RoleQueryParams): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  if (params.name) qs.set("name", params.name);
  if (params.is_system_managed !== undefined)
    qs.set("is_system_managed", String(params.is_system_managed));
  if (params.is_active !== undefined)
    qs.set("is_active", String(params.is_active));
  const qsStr = qs.toString();
  return qsStr ? `?${qsStr}` : "";
}

function buildRoleAssignmentQuery(params?: RoleAssignmentQueryParams): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  if (params.user_id) qs.set("user_id", params.user_id);
  if (params.role_id) qs.set("role_id", params.role_id);
  if (params.assigned_after) qs.set("assigned_after", params.assigned_after);
  if (params.assigned_before) qs.set("assigned_before", params.assigned_before);
  if (params.is_active !== undefined)
    qs.set("is_active", String(params.is_active));
  const qsStr = qs.toString();
  return qsStr ? `?${qsStr}` : "";
}

export function getRoles(
  params?: RoleQueryParams,
  signal?: AbortSignal,
): Promise<ApplicationRole[]> {
  return getAuthenticatedJson(
    `/api/v1/identity/roles/${buildRoleQuery(params)}`,
    signal,
  );
}

export function getRoleAssignments(
  params?: RoleAssignmentQueryParams,
  signal?: AbortSignal,
): Promise<UserRoleAssignment[]> {
  return getAuthenticatedJson(
    `/api/v1/identity/assignments/${buildRoleAssignmentQuery(params)}`,
    signal,
  );
}

export async function checkIdentityWritePermission(
  signal?: AbortSignal,
): Promise<boolean> {
  return checkEndpointPermission("/api/v1/identity/roles/", "OPTIONS", signal);
}

// ---- Permission helpers for FE-A gating ----

export async function checkReturnsWritePermission(
  signal?: AbortSignal,
): Promise<boolean> {
  return checkEndpointPermission("/api/v1/inventory/return-operations/", "OPTIONS", signal);
}

export async function checkDamageLossWritePermission(
  signal?: AbortSignal,
): Promise<boolean> {
  return checkEndpointPermission("/api/v1/inventory/damage-loss-settlements/", "OPTIONS", signal);
}

// ---- Auth ----

function getCsrfToken(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : "";
}

export async function login(
  username: string,
  password: string,
): Promise<void> {
  const params = new URLSearchParams({ username, password, next: "/" });
  const response = await fetch("/api-auth/login/", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-CSRFToken": getCsrfToken(),
    },
    body: params,
    redirect: "manual",
  });

  if (response.status < 200 || response.status >= 400) {
    throw new Error("Login failed. Please check your credentials.");
  }
}

export async function logout(): Promise<void> {
  await fetch("/api-auth/logout/?next=/", {
    credentials: "include",
    headers: {
      "X-CSRFToken": getCsrfToken(),
    },
    redirect: "manual",
  });
}

export async function checkAuth(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch("/api/v1/inventory/items/", {
      credentials: "include",
      signal,
    });
    return response.ok;
  } catch {
    return false;
  }
}
