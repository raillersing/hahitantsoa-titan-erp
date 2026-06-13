# F137B Frontend Document Artifact Preview

## Objective

Integrate a controlled frontend preview surface for generated HTML document artifacts
without introducing any new backend endpoint, public URL, PDF generation path or
storage-path exposure.

## Approved Backend Contract Used

F137B uses only:

- `GET /api/v1/documents/instances/{id}/artifact/`

The frontend treats the response as private HTML content returned by the authenticated
backend endpoint.

## Frontend Behavior Added

- Titan now exposes a dedicated private document artifact preview panel.
- The user explicitly enters a document instance identifier before loading the preview.
- The preview is rendered inside a sandboxed iframe with `srcDoc`.
- The UI covers:
  - loading;
  - success;
  - `401` and `403` authenticated-access failure;
  - `404` artifact-not-found;
  - generic fetch failure.

## Security And Scope Notes

- No `storage_path` is displayed or stored in frontend state.
- No public URL is created.
- No PDF generation or download workflow is introduced.
- No backend mutation is added.
- No reservation confirmation, payment, invoice or contract workflow is expanded.

## Important Limitation

The current frontend surfaces on `origin/main` do not expose an approved backend link from
reservation drafts to document instance identifiers.

Because inventing that linkage would violate the task constraints, F137B implements a
controlled manual-ID preview entry point instead of pretending a draft already knows its
document instance.

## Validation Focus

- private endpoint called with session credentials only;
- preview remains frontend-only and controlled;
- `401`, `403`, `404` and generic errors are visible;
- no `storage_path`, public URL or PDF affordance appears in the UI.
