import type {
  ApplicationRole,
  BillingInvoice,
  BillingInvoiceCorrectPayload,
  BillingInvoiceInstallment,
  BillingInvoiceInstallmentScheduleCreatePayload,
  BillingInvoiceSettlePayload,
  BillingCreditNote,
  BillingCreditNoteIssuePayload,
  BillingInstallmentAllocatePayload,
  BillingRefundObligation,
  BillingRefundObligationExecutePayload,
  CashboxMovement,
  CashboxMovementCreatePayload,
  CashboxSession,
  CashboxSessionClosePayload,
  CashboxSessionOpenPayload,
  Customer,
  CustomerCreatePayload,
  CustomerUpdatePayload,
  HahitantsoaDiscoveryResponse,
  InventoryItem,
  LogisticsEvent,
  LogisticsEventCompletePassationPayload,
  LogisticsEventCompletePassationResponse,
  LogisticsEventCreatePayload,
  LogisticsEventItemLine,
  LogisticsEventItemLineCreatePayload,
  LogisticsEventTransitionPayload,
  LogisticsEventUpdatePayload,
  MaterialPackage,
  MaterialPackageCreatePayload,
  MaterialPackageUpdatePayload,
  ReservationAvailabilitySummary,
  ReservationAvailableItemPreview,
  ReservationDraftConfirmResult,
  ReservationDraft,
  ReservationDraftCreatePayload,
  ReservationDraftMutationResult,
  ReservationDraftUpdatePayload,
  ReservationItemAvailabilityPreview,
  RoleAssignmentQueryParams,
  RoleQueryParams,
  UserRoleAssignment,
  User,
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
  DocumentTemplateCreatePayload,
  DocumentTemplateVersion,
  DocumentTemplateVersionCreatePayload,
  DocumentInstance,
  DocumentInstanceCreatePayload,
  DocumentInstancePdfGenerationResult,
  AuditEvent,
  AuditEventQueryParams,
  Payment,
  PaymentActionPayload,
  PaymentCreatePayload,
  PaymentConfirmPayload,
  HahitantsoaVenue,
  HahitantsoaService,
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

export const SESSION_REVALIDATION_EVENT = "erp:session-revalidation-required";

function requestSessionRevalidation(status: number): void {
  if ((status === 401 || status === 403) && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_REVALIDATION_EVENT, { detail: { status } }));
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
    requestSessionRevalidation(response.status);
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

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function getCsrfTokenForWrite(signal?: AbortSignal): Promise<string> {
  const existingToken = getCsrfToken();
  if (existingToken) {
    return existingToken;
  }

  await getSession(signal);
  const bootstrappedToken = getCsrfToken();
  if (!bootstrappedToken) {
    throw new Error("La protection CSRF n'a pas pu être initialisée.");
  }
  return bootstrappedToken;
}

async function unsafeAuthenticatedRequest(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<Response> {
  const csrfToken = await getCsrfTokenForWrite(signal);
  const headers = new Headers(init.headers);
  headers.set("X-CSRFToken", csrfToken);

  return fetch(url, {
    ...init,
    credentials: "include",
    headers,
    signal,
  });
}

async function postAuthenticatedJson<T>(
  url: string,
  payload: object,
  signal?: AbortSignal,
): Promise<T> {
  const response = await unsafeAuthenticatedRequest(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }, signal);

  return parseJsonResponse<T>(response);
}

async function patchAuthenticatedJson<T>(
  url: string,
  payload: object,
  signal?: AbortSignal,
): Promise<T> {
  const response = await unsafeAuthenticatedRequest(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }, signal);

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

export function getInventoryItem(
  id: string,
  signal?: AbortSignal,
): Promise<InventoryItem> {
  return getAuthenticatedJson(`/api/v1/inventory/items/${id}/`, signal);
}

export type CashboxSessionQueryParams = {
  operator_id?: string;
  status?: "open" | "closed";
};

export type CashboxMovementQueryParams = {
  session_id?: string;
  direction?: "cash_in" | "cash_out";
};

function buildQuery(params?: Record<string, string | undefined>): string {
  if (!params) {
    return "";
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }

  const search = query.toString();
  return search ? `?${search}` : "";
}

export function getCashboxSessions(
  params?: CashboxSessionQueryParams,
  signal?: AbortSignal,
): Promise<CashboxSession[]> {
  return getAuthenticatedJson(`/api/v1/cashbox/sessions/${buildQuery(params)}`, signal);
}

export function getCashboxSession(
  id: string,
  signal?: AbortSignal,
): Promise<CashboxSession> {
  return getAuthenticatedJson(`/api/v1/cashbox/sessions/${id}/`, signal);
}

export function openCashboxSession(
  payload: CashboxSessionOpenPayload,
  signal?: AbortSignal,
): Promise<CashboxSession> {
  return postAuthenticatedJson("/api/v1/cashbox/sessions/open/", payload, signal);
}

export function closeCashboxSession(
  id: string,
  payload: CashboxSessionClosePayload,
  signal?: AbortSignal,
): Promise<CashboxSession> {
  return postAuthenticatedJson(`/api/v1/cashbox/sessions/${id}/close/`, payload, signal);
}

export function getCashboxMovements(
  params?: CashboxMovementQueryParams,
  signal?: AbortSignal,
): Promise<CashboxMovement[]> {
  return getAuthenticatedJson(`/api/v1/cashbox/movements/${buildQuery(params)}`, signal);
}

export function createCashboxMovement(
  sessionId: string,
  payload: CashboxMovementCreatePayload,
  signal?: AbortSignal,
): Promise<CashboxMovement> {
  return postAuthenticatedJson(`/api/v1/cashbox/sessions/${sessionId}/movements/`, payload, signal);
}

export type CustomerSearchParams = {
  name?: string;
  email?: string;
  phone?: string;
  lifecycle_status?: "prospect" | "client";
  party_type?: "individual" | "company";
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
    if (params.lifecycle_status) qs.set("lifecycle_status", params.lifecycle_status);
    if (params.party_type) qs.set("party_type", params.party_type);
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
  const response = await unsafeAuthenticatedRequest(`/api/v1/customers/${id}/delete/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: "{}",
  }, signal);
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
  customerId?: string,
  signal?: AbortSignal,
): Promise<ReservationDraft[]> {
  let url = "/api/v1/reservations/drafts/";
  if (customerId) {
    url += `?customer_id=${encodeURIComponent(customerId)}`;
  }
  return getAuthenticatedJson(url, signal);
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

export function markReservationDraftContractSigned(
  draftId: string,
  signal?: AbortSignal,
): Promise<ReservationDraftMutationResult> {
  return postAuthenticatedJson(
    `/api/v1/reservations/drafts/${draftId}/contract-signed/`,
    {},
    signal,
  );
}

export function markReservationDraftRequiredDepositReceived(
  draftId: string,
  signal?: AbortSignal,
): Promise<ReservationDraftMutationResult> {
  return postAuthenticatedJson(
    `/api/v1/reservations/drafts/${draftId}/required-deposit-received/`,
    {},
    signal,
  );
}

export function confirmReservationDraft(
  draftId: string,
  signal?: AbortSignal,
): Promise<ReservationDraftConfirmResult> {
  return postAuthenticatedJson(
    `/api/v1/reservations/drafts/${draftId}/confirm/`,
    {},
    signal,
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

export async function getDocumentInstancePdfBlob(
  documentInstanceId: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetch(
    `/api/v1/documents/instances/${documentInstanceId}/pdf/`,
    {
      credentials: "include",
      signal,
    },
  );

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "The PDF preview requires an authenticated session with document access.",
    );
  }

  if (response.status === 404) {
    throw new Error("No generated PDF artifact was found for this document instance.");
  }

  if (!response.ok) {
    throw new Error("The requested PDF artifact could not be loaded.");
  }

  return response.blob();
}

export function getHahitantsoaEventDrafts(
  customerId?: string,
  signal?: AbortSignal,
): Promise<HahitantsoaEventDraft[]> {
  let url = "/api/v1/hahitantsoa/event-drafts/";
  if (customerId) {
    url += `?customer=${encodeURIComponent(customerId)}`;
  }
  return getAuthenticatedJson(url, signal);
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
  const response = await unsafeAuthenticatedRequest(`/api/v1/hahitantsoa/event-drafts/${draftId}/`, {
    method: "DELETE",
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
  const response = await unsafeAuthenticatedRequest(
    `/api/v1/hahitantsoa/event-drafts/${draftId}/amendment-requests/${amendmentRequestId}/lines/${lineId}/`,
    {
      method: "DELETE",
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

export function createDocumentTemplate(
  payload: DocumentTemplateCreatePayload,
  signal?: AbortSignal,
): Promise<DocumentTemplateDefinition> {
  return postAuthenticatedJson("/api/v1/documents/document-templates/", payload, signal);
}

export function deleteDocumentTemplate(
  templateId: string,
  signal?: AbortSignal,
): Promise<void> {
  return unsafeAuthenticatedRequest(`/api/v1/documents/document-templates/${encodeURIComponent(templateId)}/`, {
    method: "DELETE",
  }, signal).then((response) => {
    if (!response.ok) {
      throw new Error(`Suppression échouée (${response.status})`);
    }
  });
}

export function getDocumentTemplateVersions(
  templateId?: string,
  signal?: AbortSignal,
): Promise<DocumentTemplateVersion[]> {
  const url = templateId
    ? `/api/v1/documents/document-template-versions/?template=${encodeURIComponent(templateId)}`
    : "/api/v1/documents/document-template-versions/";
  return getAuthenticatedJson(url, signal);
}

export function createDocumentTemplateVersion(
  payload: DocumentTemplateVersionCreatePayload,
  signal?: AbortSignal,
): Promise<DocumentTemplateVersion> {
  return postAuthenticatedJson("/api/v1/documents/document-template-versions/", payload, signal);
}

export function activateDocumentTemplateVersion(
  id: string,
  signal?: AbortSignal,
): Promise<DocumentTemplateVersion> {
  return postAuthenticatedJson(`/api/v1/documents/document-template-versions/${id}/activate/`, {}, signal);
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

export function generateReservationDraftDocumentInstancePdf(
  reservationDraftId: string,
  id: string,
  signal?: AbortSignal,
): Promise<DocumentInstancePdfGenerationResult> {
  return postAuthenticatedJson(
    `/api/v1/documents/reservation-drafts/${reservationDraftId}/instances/${id}/generate-pdf/`,
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

export function generateHahitantsoaEventDraftDocumentInstancePdf(
  eventDraftId: string,
  id: string,
  signal?: AbortSignal,
): Promise<DocumentInstancePdfGenerationResult> {
  return postAuthenticatedJson(
    `/api/v1/hahitantsoa/event-drafts/${eventDraftId}/documents/${id}/generate-pdf/`,
    {},
    signal,
  );
}

// ---- Payments ----
export function getPayments(
  reservationDraftIdOrSignal?: string | AbortSignal,
  signal?: AbortSignal,
): Promise<Payment[]> {
  if (typeof reservationDraftIdOrSignal === "string") {
    return getAuthenticatedJson(
      `/api/v1/payments/?reservation_draft_id=${encodeURIComponent(reservationDraftIdOrSignal)}`,
      signal,
    );
  }
  return getAuthenticatedJson("/api/v1/payments/", reservationDraftIdOrSignal);
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

export function cancelPayment(
  id: string,
  payload: PaymentActionPayload = {},
  signal?: AbortSignal,
): Promise<Payment> {
  return postAuthenticatedJson(`/api/v1/payments/${id}/cancel/`, payload, signal);
}

export function reconcilePayment(
  id: string,
  payload: PaymentActionPayload = {},
  signal?: AbortSignal,
): Promise<Payment> {
  return postAuthenticatedJson(`/api/v1/payments/${id}/reconcile/`, payload, signal);
}
// ---- Billing Invoices ----

export function getBillingInvoices(
  reservationDraftIdOrSignal?: string | AbortSignal,
  signal?: AbortSignal,
): Promise<BillingInvoice[]> {
  if (typeof reservationDraftIdOrSignal === "string") {
    return getAuthenticatedJson(
      `/api/v1/billing/invoices/?reservation_draft_id=${encodeURIComponent(reservationDraftIdOrSignal)}`,
      signal,
    );
  }
  return getAuthenticatedJson("/api/v1/billing/invoices/", reservationDraftIdOrSignal);
}

export function getBillingInvoice(id: string, signal?: AbortSignal): Promise<BillingInvoice> {
  return getAuthenticatedJson(`/api/v1/billing/invoices/${id}/`, signal);
}

export function settleBillingInvoice(
  id: string,
  payload: BillingInvoiceSettlePayload,
  signal?: AbortSignal,
): Promise<BillingInvoice> {
  return postAuthenticatedJson(`/api/v1/billing/invoices/${id}/settle/`, payload, signal);
}

export function cancelBillingInvoice(
  id: string,
  notes: string = "",
  signal?: AbortSignal,
): Promise<BillingInvoice> {
  return postAuthenticatedJson(`/api/v1/billing/invoices/${id}/cancel/`, { notes }, signal);
}

export function createBillingInvoiceInstallments(
  id: string,
  payload: BillingInvoiceInstallmentScheduleCreatePayload,
  signal?: AbortSignal,
): Promise<BillingInvoiceInstallment[]> {
  return postAuthenticatedJson(`/api/v1/billing/invoices/${id}/installments/`, payload, signal);
}

export function allocateBillingInstallment(
  id: string,
  payload: BillingInstallmentAllocatePayload,
  signal?: AbortSignal,
): Promise<BillingInvoiceInstallment> {
  return postAuthenticatedJson(`/api/v1/billing/installments/${id}/allocate/`, payload, signal);
}

export function correctBillingInvoice(
  id: string,
  payload: BillingInvoiceCorrectPayload,
  signal?: AbortSignal,
): Promise<BillingRefundObligation> {
  return postAuthenticatedJson(`/api/v1/billing/invoices/${id}/correct/`, payload, signal);
}

export function executeBillingRefundObligation(
  id: string,
  payload: BillingRefundObligationExecutePayload,
  signal?: AbortSignal,
): Promise<BillingRefundObligation> {
  return postAuthenticatedJson(`/api/v1/billing/refund-obligations/${id}/execute/`, payload, signal);
}

export function getBillingCreditNotes(
  invoiceId: string,
  signal?: AbortSignal,
): Promise<BillingCreditNote[]> {
  return getAuthenticatedJson(`/api/v1/billing/invoices/${invoiceId}/credit-notes/`, signal);
}

export function issueBillingCreditNote(
  invoiceId: string,
  payload: BillingCreditNoteIssuePayload,
  signal?: AbortSignal,
): Promise<BillingCreditNote> {
  return postAuthenticatedJson(`/api/v1/billing/invoices/${invoiceId}/credit-notes/`, payload, signal);
}

export function getBillingCreditNote(
  invoiceId: string,
  creditNoteId: string,
  signal?: AbortSignal,
): Promise<BillingCreditNote> {
  return getAuthenticatedJson(`/api/v1/billing/invoices/${invoiceId}/credit-notes/${creditNoteId}/`, signal);
}

export function cancelBillingCreditNote(
  invoiceId: string,
  creditNoteId: string,
  notes: string = "",
  signal?: AbortSignal,
): Promise<BillingCreditNote> {
  return postAuthenticatedJson(
    `/api/v1/billing/invoices/${invoiceId}/credit-notes/${creditNoteId}/cancel/`,
    { notes },
    signal,
  );
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
  reservationDraftIdOrSignal?: string | AbortSignal,
  signal?: AbortSignal,
): Promise<LogisticsEvent[]> {
  if (typeof reservationDraftIdOrSignal === "string") {
    return getAuthenticatedJson(
      `/api/v1/logistics/events/?reservation_draft_id=${encodeURIComponent(reservationDraftIdOrSignal)}`,
      signal,
    );
  }
  return getAuthenticatedJson("/api/v1/logistics/events/", reservationDraftIdOrSignal);
}

export function transitionLogisticsEvent(
  id: string,
  payload: LogisticsEventTransitionPayload,
  signal?: AbortSignal,
): Promise<LogisticsEvent> {
  return postAuthenticatedJson(`/api/v1/logistics/events/${id}/transition/`, payload, signal);
}

export function createLogisticsEvent(
  payload: LogisticsEventCreatePayload,
  signal?: AbortSignal,
): Promise<LogisticsEvent> {
  return postAuthenticatedJson("/api/v1/logistics/events/create/", payload, signal);
}

export function updateLogisticsEvent(
  id: string,
  payload: LogisticsEventUpdatePayload,
  signal?: AbortSignal,
): Promise<LogisticsEvent> {
  return postAuthenticatedJson(`/api/v1/logistics/events/${id}/update/`, payload, signal);
}

export function getLogisticsEvent(
  id: string,
  signal?: AbortSignal,
): Promise<LogisticsEvent> {
  return getAuthenticatedJson(`/api/v1/logistics/events/${id}/`, signal);
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
  const response = await unsafeAuthenticatedRequest(`/api/v1/logistics/events/${id}/lines/${lineId}/remove/`, {
    method: "POST",
  }, signal);
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

export function getUsers(
  search?: string,
  signal?: AbortSignal,
): Promise<User[]> {
  let url = "/api/v1/identity/users/";
  if (search) {
    url += `?search=${encodeURIComponent(search)}`;
  }
  return getAuthenticatedJson(url, signal);
}

export function getApplicationRoles(
  signal?: AbortSignal,
): Promise<ApplicationRole[]> {
  return getRoles(undefined, signal);
}

function buildAuditQuery(params?: AuditEventQueryParams): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  if (params.action) qs.set("action", params.action);
  if (params.target_type) qs.set("target_type", params.target_type);
  if (params.target_id) qs.set("target_id", params.target_id);
  if (params.actor_id) qs.set("actor_id", params.actor_id);
  if (params.created_after) qs.set("created_after", params.created_after);
  if (params.created_before) qs.set("created_before", params.created_before);
  const qsStr = qs.toString();
  return qsStr ? `?${qsStr}` : "";
}

export function getAuditEvents(
  params?: AuditEventQueryParams,
  signal?: AbortSignal,
): Promise<AuditEvent[]> {
  return getAuthenticatedJson(`/api/v1/audit/events/${buildAuditQuery(params)}`, signal);
}

export function getAuditEvent(id: string, signal?: AbortSignal): Promise<AuditEvent> {
  return getAuthenticatedJson(`/api/v1/audit/events/${id}/`, signal);
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

export type SessionUser = {
  id: string;
  username: string;
  display_name: string;
  is_staff: boolean;
  roles: string[];
};

export type SessionStateResponse =
  | { authenticated: false; user: null }
  | { authenticated: true; user: SessionUser };

export function getSession(signal?: AbortSignal): Promise<SessionStateResponse> {
  return getAuthenticatedJson("/api/v1/auth/session/", signal);
}

export async function login(
  username: string,
  password: string,
  signal?: AbortSignal,
): Promise<SessionStateResponse> {
  const response = await unsafeAuthenticatedRequest("/api/v1/auth/login/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  }, signal);

  return parseJsonResponse<SessionStateResponse>(response);
}

export async function logout(signal?: AbortSignal): Promise<void> {
  const response = await unsafeAuthenticatedRequest("/api/v1/auth/logout/", {
    method: "POST",
  }, signal);
  if (!response.ok) {
    const parsed = await parseErrorResponse(response);
    throw new ApiError(parsed.message, response.status, parsed.errors);
  }
}

export async function checkAuth(signal?: AbortSignal): Promise<SessionStateResponse> {
  return getSession(signal);
}

export function getHahitantsoaVenues(signal?: AbortSignal): Promise<HahitantsoaVenue[]> {
  return getAuthenticatedJson("/api/v1/hahitantsoa/venues/", signal);
}

export function createHahitantsoaVenue(
  payload: Partial<HahitantsoaVenue>,
  signal?: AbortSignal,
): Promise<HahitantsoaVenue> {
  return postAuthenticatedJson("/api/v1/hahitantsoa/venues/", payload, signal);
}

export function updateHahitantsoaVenue(
  id: string,
  payload: Partial<HahitantsoaVenue>,
  signal?: AbortSignal,
): Promise<HahitantsoaVenue> {
  return patchAuthenticatedJson(`/api/v1/hahitantsoa/venues/${id}/`, payload, signal);
}

export function getHahitantsoaServices(signal?: AbortSignal): Promise<HahitantsoaService[]> {
  return getAuthenticatedJson("/api/v1/hahitantsoa/services/", signal);
}

export function createHahitantsoaService(
  payload: Partial<HahitantsoaService>,
  signal?: AbortSignal,
): Promise<HahitantsoaService> {
  return postAuthenticatedJson("/api/v1/hahitantsoa/services/", payload, signal);
}

export function updateHahitantsoaService(
  id: string,
  payload: Partial<HahitantsoaService>,
  signal?: AbortSignal,
): Promise<HahitantsoaService> {
  return patchAuthenticatedJson(`/api/v1/hahitantsoa/services/${id}/`, payload, signal);
}

// ---- Notifications ----

import type { SystemNotification } from "./types";

export function getNotifications(
  unreadOnly?: boolean,
  signal?: AbortSignal,
): Promise<SystemNotification[]> {
  const query = unreadOnly ? "?unread_only=true" : "";
  return getAuthenticatedJson(`/api/v1/notifications/${query}`, signal);
}

export function markNotificationRead(
  id: string,
  isRead: boolean,
  signal?: AbortSignal,
): Promise<SystemNotification> {
  return patchAuthenticatedJson(`/api/v1/notifications/${id}/read/`, { is_read: isRead }, signal);
}

export function markAllNotificationsRead(
  signal?: AbortSignal,
): Promise<{ marked_read: number }> {
  return postAuthenticatedJson("/api/v1/notifications/mark-all-read/", {}, signal);
}

// ---- Import Excel ----

import type { ImportJob } from "./types";

export async function uploadImportFile(
  file: File,
  targetModel: string = "inventory_item",
  signal?: AbortSignal,
): Promise<ImportJob> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("target_model", targetModel);

  const csrfToken = getCsrfToken();
  const response = await fetch("/api/v1/import/", {
    method: "POST",
    credentials: "include",
    headers: {
      "X-CSRFToken": csrfToken,
    },
    body: formData,
    signal,
  });

  return parseJsonResponse<ImportJob>(response);
}

export function getImportJobs(
  signal?: AbortSignal,
): Promise<ImportJob[]> {
  return getAuthenticatedJson("/api/v1/import/", signal);
}

export function updateImportMapping(
  id: string,
  columnMapping: Record<string, string>,
  signal?: AbortSignal,
): Promise<ImportJob> {
  return patchAuthenticatedJson(`/api/v1/import/${id}/mapping/`, { column_mapping: columnMapping }, signal);
}

export function validateImport(
  id: string,
  signal?: AbortSignal,
): Promise<ImportJob> {
  return postAuthenticatedJson(`/api/v1/import/${id}/validate/`, {}, signal);
}

// ---- Blacklist (/api/v1/blacklist/) ----

export type BlacklistedIntervenant = {
  id: string;
  name: string;
  note: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function getBlacklistedIntervenants(
  signal?: AbortSignal,
): Promise<BlacklistedIntervenant[]> {
  return getAuthenticatedJson("/api/v1/blacklist/", signal);
}

export function createBlacklistedIntervenant(
  payload: { name: string; note?: string },
  signal?: AbortSignal,
): Promise<BlacklistedIntervenant> {
  return postAuthenticatedJson("/api/v1/blacklist/", payload, signal);
}

export function updateBlacklistedIntervenant(
  id: string,
  payload: Partial<{ name: string; note: string; is_active: boolean }>,
  signal?: AbortSignal,
): Promise<BlacklistedIntervenant> {
  return patchAuthenticatedJson(`/api/v1/blacklist/${id}/`, payload, signal);
}

export function deleteBlacklistedIntervenant(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  return unsafeAuthenticatedRequest(`/api/v1/blacklist/${id}/`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }, signal).then(() => undefined);
}

// ---- Material Packages (/api/v1/material-packages/) ----

export function getMaterialPackages(
  signal?: AbortSignal,
): Promise<MaterialPackage[]> {
  return getAuthenticatedJson("/api/v1/material-packages/", signal);
}

export function getMaterialPackage(
  id: string,
  signal?: AbortSignal,
): Promise<MaterialPackage> {
  return getAuthenticatedJson(`/api/v1/material-packages/${id}/`, signal);
}

export function createMaterialPackage(
  payload: MaterialPackageCreatePayload,
  signal?: AbortSignal,
): Promise<MaterialPackage> {
  return postAuthenticatedJson("/api/v1/material-packages/", payload, signal);
}

export function updateMaterialPackage(
  id: string,
  payload: MaterialPackageUpdatePayload,
  signal?: AbortSignal,
): Promise<MaterialPackage> {
  return patchAuthenticatedJson(`/api/v1/material-packages/${id}/`, payload, signal);
}

export function deleteMaterialPackage(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  return unsafeAuthenticatedRequest(`/api/v1/material-packages/${id}/`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }, signal).then(() => undefined);
}

// ---- HR & Payroll (/api/v1/hr/) ----

import type {
  Employee,
  EmployeeCreatePayload,
  PaySlip,
  PaySlipCreatePayload,
  AdvanceRequest,
  AdvanceRequestCreatePayload,
  LeaveRequest,
  LeaveRequestCreatePayload,
} from "./types";

export function getEmployees(
  params?: { status?: string; role?: string; assignment?: string },
  signal?: AbortSignal,
): Promise<Employee[]> {
  let url = "/api/v1/hr/employees/";
  if (params) {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.role) qs.set("role", params.role);
    if (params.assignment) qs.set("assignment", params.assignment);
    const qsStr = qs.toString();
    if (qsStr) url += `?${qsStr}`;
  }
  return getAuthenticatedJson(url, signal);
}

export function getEmployee(
  id: string,
  signal?: AbortSignal,
): Promise<Employee> {
  return getAuthenticatedJson(`/api/v1/hr/employees/${id}/`, signal);
}

export function createEmployee(
  payload: EmployeeCreatePayload,
  signal?: AbortSignal,
): Promise<Employee> {
  return postAuthenticatedJson("/api/v1/hr/employees/", payload, signal);
}

export function updateEmployee(
  id: string,
  payload: Partial<EmployeeCreatePayload>,
  signal?: AbortSignal,
): Promise<Employee> {
  return patchAuthenticatedJson(`/api/v1/hr/employees/${id}/`, payload, signal);
}

export async function deleteEmployee(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await unsafeAuthenticatedRequest(`/api/v1/hr/employees/${id}/`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }, signal);
}

export function getPaySlips(
  params?: { employee?: string; period?: string },
  signal?: AbortSignal,
): Promise<PaySlip[]> {
  let url = "/api/v1/hr/payslips/";
  if (params) {
    const qs = new URLSearchParams();
    if (params.employee) qs.set("employee", params.employee);
    if (params.period) qs.set("period", params.period);
    const qsStr = qs.toString();
    if (qsStr) url += `?${qsStr}`;
  }
  return getAuthenticatedJson(url, signal);
}

export function createPaySlip(
  payload: PaySlipCreatePayload,
  signal?: AbortSignal,
): Promise<PaySlip> {
  return postAuthenticatedJson("/api/v1/hr/payslips/", payload, signal);
}

export function getAdvanceRequests(
  params?: { employee?: string; status?: string },
  signal?: AbortSignal,
): Promise<AdvanceRequest[]> {
  let url = "/api/v1/hr/advances/";
  if (params) {
    const qs = new URLSearchParams();
    if (params.employee) qs.set("employee", params.employee);
    if (params.status) qs.set("status", params.status);
    const qsStr = qs.toString();
    if (qsStr) url += `?${qsStr}`;
  }
  return getAuthenticatedJson(url, signal);
}

export function createAdvanceRequest(
  payload: AdvanceRequestCreatePayload,
  signal?: AbortSignal,
): Promise<AdvanceRequest> {
  return postAuthenticatedJson("/api/v1/hr/advances/", payload, signal);
}

export function getLeaveRequests(
  params?: { employee?: string; status?: string },
  signal?: AbortSignal,
): Promise<LeaveRequest[]> {
  let url = "/api/v1/hr/leaves/";
  if (params) {
    const qs = new URLSearchParams();
    if (params.employee) qs.set("employee", params.employee);
    if (params.status) qs.set("status", params.status);
    const qsStr = qs.toString();
    if (qsStr) url += `?${qsStr}`;
  }
  return getAuthenticatedJson(url, signal);
}

export function createLeaveRequest(
  payload: LeaveRequestCreatePayload,
  signal?: AbortSignal,
): Promise<LeaveRequest> {
  return postAuthenticatedJson("/api/v1/hr/leaves/", payload, signal);
}

// ---- Procurement (/api/v1/procurement/) ----

import type {
  PurchaseOrder,
  PurchaseOrderCreatePayload,
  QuickExpense,
  QuickExpenseCreatePayload,
} from "./types";

export function getPurchaseOrders(
  params?: { status?: string },
  signal?: AbortSignal,
): Promise<PurchaseOrder[]> {
  let url = "/api/v1/procurement/purchase-orders/";
  if (params?.status) {
    url += `?status=${encodeURIComponent(params.status)}`;
  }
  return getAuthenticatedJson(url, signal);
}

export function getPurchaseOrder(
  id: string,
  signal?: AbortSignal,
): Promise<PurchaseOrder> {
  return getAuthenticatedJson(`/api/v1/procurement/purchase-orders/${id}/`, signal);
}

export function createPurchaseOrder(
  payload: PurchaseOrderCreatePayload,
  signal?: AbortSignal,
): Promise<PurchaseOrder> {
  return postAuthenticatedJson("/api/v1/procurement/purchase-orders/", payload, signal);
}

export function updatePurchaseOrder(
  id: string,
  payload: Partial<PurchaseOrderCreatePayload>,
  signal?: AbortSignal,
): Promise<PurchaseOrder> {
  return patchAuthenticatedJson(`/api/v1/procurement/purchase-orders/${id}/`, payload, signal);
}

export async function deletePurchaseOrder(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await unsafeAuthenticatedRequest(`/api/v1/procurement/purchase-orders/${id}/`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }, signal);
}

export function getExpenses(
  params?: { category?: string },
  signal?: AbortSignal,
): Promise<QuickExpense[]> {
  let url = "/api/v1/procurement/expenses/";
  if (params?.category) {
    url += `?category=${encodeURIComponent(params.category)}`;
  }
  return getAuthenticatedJson(url, signal);
}

export function getExpense(
  id: string,
  signal?: AbortSignal,
): Promise<QuickExpense> {
  return getAuthenticatedJson(`/api/v1/procurement/expenses/${id}/`, signal);
}

export function createExpense(
  payload: QuickExpenseCreatePayload,
  signal?: AbortSignal,
): Promise<QuickExpense> {
  return postAuthenticatedJson("/api/v1/procurement/expenses/", payload, signal);
}

export async function deleteExpense(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await unsafeAuthenticatedRequest(`/api/v1/procurement/expenses/${id}/`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }, signal);
}
