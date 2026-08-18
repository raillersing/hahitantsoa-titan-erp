---
name: erp-pdf-to-html
description: |
  Replicate an approved PDF document (invoice, proforma, receipt, contract) into a
  pixel-perfect HTML/CSS Jinja/Django template. Uses pdf2htmlEX for fidelity and a
  post-processor to inject template variables. Companion to erp-replicate-from-source
  for document-level replication.
---

# ERP PDF → HTML Replication Skill

## Purpose

Convert an authoritative PDF source into an editable HTML template that renders
identically to the original. This skill is the **technical implementation** of the
`erp-replicate-from-source` philosophy for printed / PDF documents.

## When to use

- You need to generate an HTML/PDF document that must match an approved paper design.
- The source is a PDF created by an external tool (Word, InDesign, accounting software).
- Fidelity requirements: typography, spacing, logos, tables, signatures, and variable
  placement must be preserved pixel-for-pixel.

## When NOT to use

- The source is already an HTML/CSS design system — use `erp-replicate-from-source` directly.
- You need a responsive web page — pdf2htmlEX output is fixed-layout.
- The document has no approved visual source — design it first, then replicate.

## Prerequisites

1. **pdf2htmlEX** installed by the project installer:
   ```bash
   bash scripts/dev/erp-install-pdf2htmlex
   ```
   The installer tries, in order: apt package → AppImage binary → Docker image.

2. **BeautifulSoup4** (optional but recommended):
   ```bash
   .venv/bin/pip install beautifulsoup4
   ```

## Workflow

### Step 1 — Convert the PDF to raw HTML

```bash
bash scripts/dev/erp-pdf2html \
  --input "docs/references/source/templates/Hahitantsoa/Proforma/20240109 PROFORMA HAHITANTSOA 003-24 ANDRIAMAMPIANINA Ranto.pdf" \
  --output "docs/references/source/templates/Hahitantsoa/Proforma/pdf2html_output"
```

This produces one self-contained HTML file per PDF page. Open it in a browser and
verify that it looks **identical** to the PDF. If not, check that the correct fonts
are installed on the system (Century Gothic, Open Sans).

### Step 2 — Build the variable mapping

Create a JSON file that maps exact text fragments to Jinja variables:

```json
{
  "003/24": "{{ proforma_number }}",
  "ANDRIAMAMPIANINA Ranto Nandrianina": "{{ client_name }}",
  "034 89 282 04 /": "{{ client_contact }}",
  "28/12/2024": "{{ event_date }}",
  "09/01/2024": "{{ date }}",
  "8 188 000,00": "{{ total }}",
  "8 188 000,00 Ar": "{{ total_a_payer }} Ar",
  "huit millions cent quatre-vingt-huit mille Ariary": "{{ total_words }}",
  "0,00": "{{ remise }}"
}
```

Save it as `proforma_mapping.json`.

### Step 3 — Post-process into a template

```bash
python3 scripts/dev/erp-pdf2html-postprocess \
  --input "docs/references/source/templates/Hahitantsoa/Proforma/pdf2html_output/20240109 PROFORMA HAHITANTSOA 003-24 ANDRIAMAMPIANINA Ranto-001.html" \
  --output "reports/proforma_template.html" \
  --mapping proforma_mapping.json \
  --extract-css \
  --save-mapping detected_mapping.json
```

The post-processor:
- Auto-detects common placeholders (dates, amounts, proforma numbers).
- Applies your explicit mapping on top.
- Extracts inline CSS into a separate `.css` file for readability.
- Saves the final mapping so you can reuse it for similar documents.

### Step 4 — Validate fidelity

1. Open `reports/proforma_template.html` in a browser.
2. Compare side-by-side with the original PDF.
3. Check that text is selectable, fonts render correctly, and images are crisp.
4. Adjust the mapping JSON and re-run Step 3 until satisfied.

### Step 5 — Integrate into the application

Move the template and CSS into the project's template directory:

```bash
cp reports/proforma_template.html backend/apps/documents/templates/documents/hahitantsoa_proforma.html
cp reports/proforma_template.css backend/apps/documents/static/documents/css/hahitantsoa_proforma.css
```

Update CSS paths in the template to use Django `{% static %}` tags.

## Key flags used by the wrapper

| Flag | Value | Why |
|------|-------|-----|
| `--zoom` | `1.3` | Avoids browser rounding errors on font sizes |
| `--font-size-multiplier` | `1` | Preserves exact PDF font sizes |
| `--single-html` | `1` | Embeds fonts + images as base64 (no external files) |
| `--bg-format` | `svg` | Vector background = smaller and sharper than PNG |
| `--process-outline` | `0` | Disables table of contents (not needed for templates) |

## Limitations

- **Fixed layout only**: the output is not responsive. If you need a mobile view,
  design it separately and do not call it a "replica".
- **Font dependency**: the HTML embeds subsetted fonts, but the host system must have
  the base font installed for crisp rendering. If Century Gothic or Open Sans are
  missing, the browser will substitute Arial.
- **Text editability**: pdf2htmlEX positions each word independently. The
  post-processor groups them into logical blocks, but complex multi-line paragraphs
  may need manual adjustment.
- **WASM/JS limitations**: pdf2htmlEX is a C++ tool. It works natively on WSL2
  (Ubuntu) but not on Windows without WSL.

## Stop conditions

Stop and report when:
- The PDF source is missing, unreadable, or has no embedded fonts.
- The rendered HTML is visibly different from the PDF after two retry loops.
- The required fonts are not available and cannot be legally embedded.
- The output would require redesigning the approved layout (not replication).

## See also

- `erp-replicate-from-source` — the design philosophy behind this skill.
- `erp-install-pdf2htmlex` — the installer used in Step 1.
- `erp-pdf2html` — the conversion wrapper.
- `erp-pdf2html-postprocess` — the post-processor used in Step 3.
- `docs/ai-agents/tooling/ponytail.md` — anti-overengineering rules.
