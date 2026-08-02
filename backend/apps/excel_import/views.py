import csv
import io
import re
import unicodedata
from decimal import Decimal, InvalidOperation
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import BadZipFile, ZipFile

from django.db import transaction
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.excel_import.models import ImportJob
from apps.excel_import.serializers import (
    ImportJobMappingSerializer,
    ImportJobSerializer,
    ImportJobUploadSerializer,
)
from apps.inventory.models import (
    InventoryItem,
    InventoryStockMovement,
    InventoryStockMovementDirection,
    InventoryStockMovementType,
    InventoryStorageLocation,
)
from apps.inventory.scope import assert_titan_allowed_item_kind

IMPORT_FIELDS = {
    "name",
    "kind",
    "description",
    "code",
    "section",
    "unit",
    "storage_location",
    "reported_inventory_quantity",
    "initial_stock",
    "reported_damaged_quantity",
    "purchase_price",
    "rental_price",
    "breakage_price",
}
HEADER_ALIASES = {
    "designation": "name",
    "name": "name",
    "emplacement": "storage_location",
    "code": "code",
    "section": "section",
    "unite": "unit",
    "stock disponible": "initial_stock",
    "quantity": "initial_stock",
    "stock inventaire avril": "reported_inventory_quantity",
    "casses": "reported_damaged_quantity",
    "prix d achat ar": "purchase_price",
    "prix achat": "purchase_price",
    "prix de location": "rental_price",
    "prix location": "rental_price",
    "prix de casse": "breakage_price",
    "prix casse": "breakage_price",
    "kind": "kind",
    "description": "description",
}
XLSX_NAMESPACE = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"


def _normalise_header(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = re.sub(r"[’']", " ", value.casefold())
    value = re.sub(r"[\[\]]", "", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return " ".join(value.split())


def _parse_xlsx(uploaded_file) -> tuple[list[str], list[dict[str, str]]]:
    try:
        with ZipFile(uploaded_file) as archive:
            shared_strings: list[str] = []
            if "xl/sharedStrings.xml" in archive.namelist():
                root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
                for item in root.findall(f"{{{XLSX_NAMESPACE}}}si"):
                    shared_strings.append(
                        "".join(node.text or "" for node in item.iter(f"{{{XLSX_NAMESPACE}}}t"))
                    )
            worksheets = sorted(
                name
                for name in archive.namelist()
                if name.startswith("xl/worksheets/") and name.endswith(".xml")
            )
            if not worksheets:
                raise ValueError("The workbook does not contain a worksheet.")
            root = ET.fromstring(archive.read(worksheets[0]))
    except (BadZipFile, ET.ParseError, OSError, ValueError) as error:
        raise ValueError(f"Failed to parse XLSX file: {error}") from error

    parsed_rows: list[list[str]] = []
    for row in root.findall(f".//{{{XLSX_NAMESPACE}}}sheetData/{{{XLSX_NAMESPACE}}}row"):
        values: dict[int, str] = {}
        for cell in row.findall(f"{{{XLSX_NAMESPACE}}}c"):
            reference = cell.get("r", "A1")
            letters = re.match(r"([A-Z]+)", reference)
            if letters is None:
                continue
            index = 0
            for letter in letters.group(1):
                index = index * 26 + ord(letter) - ord("A") + 1
            raw = cell.findtext(f"{{{XLSX_NAMESPACE}}}v", default="")
            if cell.get("t") == "s" and raw:
                raw = shared_strings[int(raw)]
            elif cell.get("t") == "inlineStr":
                raw = "".join(node.text or "" for node in cell.iter(f"{{{XLSX_NAMESPACE}}}t"))
            values[index] = raw
        if values:
            parsed_rows.append([values.get(index, "") for index in range(1, max(values) + 1)])

    if not parsed_rows:
        return [], []
    headers = [value.strip() for value in parsed_rows[0]]
    rows = [
        {
            header: values[index] if index < len(values) else ""
            for index, header in enumerate(headers)
            if header
        }
        for values in parsed_rows[1:]
    ]
    return [header for header in headers if header], rows


def _parse_upload(uploaded_file) -> tuple[list[str], list[dict[str, str]]]:
    suffix = Path(uploaded_file.name).suffix.casefold()
    if suffix == ".xlsx":
        return _parse_xlsx(uploaded_file)
    if suffix not in {".csv", ".txt"}:
        raise ValueError("Only CSV (UTF-8) and XLSX files are supported.")
    try:
        content = uploaded_file.read().decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(content))
        return reader.fieldnames or [], list(reader)
    except (UnicodeDecodeError, csv.Error) as error:
        raise ValueError(f"Failed to parse CSV file: {error}") from error


def _automatic_mapping(headers: list[str]) -> dict[str, str]:
    return {header: HEADER_ALIASES.get(_normalise_header(header), "") for header in headers}


def _required_decimal(value: object, *, field: str) -> Decimal | None:
    text = str(value or "").strip().replace("\u00a0", "").replace(" ", "").replace(",", ".")
    if not text:
        return None
    try:
        amount = Decimal(text)
    except InvalidOperation as error:
        raise ValueError(f"{field} must be a number.") from error
    if amount < 0:
        raise ValueError(f"{field} cannot be negative.")
    return amount


def _required_quantity(value: object, *, field: str) -> int:
    text = str(value or "").strip()
    if not text:
        return 0
    try:
        quantity = Decimal(text.replace("\u00a0", "").replace(" ", "").replace(",", "."))
    except InvalidOperation as error:
        raise ValueError(f"{field} must be a whole number.") from error
    if quantity < 0 or quantity != quantity.to_integral_value():
        raise ValueError(f"{field} must be a non-negative whole number.")
    return int(quantity)


def _mapped_value(row: dict, mapping: dict, field: str, default: str = "") -> str:
    column = next((column for column, target in mapping.items() if target == field), None)
    return str(row.get(column, default) if column else default).strip()


class ImportJobListCreateAPIView(generics.ListCreateAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        return (
            ImportJobUploadSerializer
            if self.request.method.lower() == "post"
            else ImportJobSerializer
        )

    def get_queryset(self):
        return ImportJob.objects.all()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uploaded_file = serializer.validated_data["file"]
        try:
            headers, rows = _parse_upload(uploaded_file)
        except ValueError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        if not headers:
            return Response(
                {"detail": "The file must contain a header row."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        job = ImportJob.objects.create(
            created_by=request.user,
            filename=uploaded_file.name,
            status="mapping",
            target_model=serializer.validated_data.get("target_model", "inventory_item"),
            total_rows=len(rows),
            column_mapping=_automatic_mapping(headers),
            source_rows=rows,
        )
        return Response(ImportJobSerializer(job).data, status=status.HTTP_201_CREATED)


class ImportJobMappingUpdateAPIView(APIView):
    http_method_names = ["patch", "head", "options"]
    permission_classes = [IsAuthenticated]

    def patch(self, request, id):
        from django.shortcuts import get_object_or_404

        job = get_object_or_404(ImportJob, pk=id)
        serializer = ImportJobMappingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mapping = serializer.validated_data["column_mapping"]
        invalid_fields = set(mapping.values()) - {"", *IMPORT_FIELDS}
        duplicated_fields = {
            target
            for target in IMPORT_FIELDS
            if sum(value == target for value in mapping.values()) > 1
        }
        if invalid_fields or duplicated_fields:
            detail = []
            if invalid_fields:
                detail.append(f"Unsupported import fields: {', '.join(sorted(invalid_fields))}.")
            if duplicated_fields:
                detail.append(
                    f"Each import field may be mapped once: {', '.join(sorted(duplicated_fields))}."
                )
            return Response({"detail": " ".join(detail)}, status=status.HTTP_400_BAD_REQUEST)
        job.column_mapping = mapping
        job.status = "previewing"
        job.save(update_fields=["column_mapping", "status", "updated_at"])
        return Response(ImportJobSerializer(job).data)


class ImportJobValidateAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [IsAuthenticated]

    def post(self, request, id):
        from django.shortcuts import get_object_or_404

        job = get_object_or_404(ImportJob, pk=id)
        if job.target_model != "inventory_item":
            return Response(
                {"detail": "Only inventory_item imports are supported."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        mapping = job.column_mapping or {}
        if not any(target == "name" for target in mapping.values()):
            return Response(
                {"detail": "The import mapping must include a name column."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        mapped_targets = set(mapping.values())
        errors, prepared_rows = [], []
        for row_number, row in enumerate(job.source_rows or [], start=2):
            try:
                name = _mapped_value(row, mapping, "name")
                if not name:
                    raise ValueError("The name is required.")
                kind = _mapped_value(row, mapping, "kind", "material") or "material"
                prepared_rows.append(
                    {
                        "name": name,
                        "kind": assert_titan_allowed_item_kind(kind).value,
                        "description": _mapped_value(row, mapping, "description"),
                        "code": _mapped_value(row, mapping, "code"),
                        "section": _mapped_value(row, mapping, "section"),
                        "unit": _mapped_value(row, mapping, "unit"),
                        "storage_location": _mapped_value(row, mapping, "storage_location"),
                        "reported_inventory_quantity": _required_quantity(
                            _mapped_value(row, mapping, "reported_inventory_quantity"),
                            field="Reported inventory quantity",
                        ),
                        "initial_stock": _required_quantity(
                            _mapped_value(row, mapping, "initial_stock"), field="Initial stock"
                        ),
                        "reported_damaged_quantity": _required_quantity(
                            _mapped_value(row, mapping, "reported_damaged_quantity"),
                            field="Damaged quantity",
                        ),
                        "purchase_price": _required_decimal(
                            _mapped_value(row, mapping, "purchase_price"), field="Purchase price"
                        ),
                        "rental_price": _required_decimal(
                            _mapped_value(row, mapping, "rental_price"), field="Rental price"
                        ),
                        "breakage_price": _required_decimal(
                            _mapped_value(row, mapping, "breakage_price"), field="Breakage price"
                        ),
                    }
                )
            except ValueError as error:
                errors.append({"row": row_number, "error": str(error)})

        if not errors:
            try:
                with transaction.atomic():
                    for payload in prepared_rows:
                        code = payload["code"]
                        query = (
                            InventoryItem.objects.filter(code=code)
                            if code and code.casefold() != "n/a"
                            else InventoryItem.objects.filter(name=payload["name"])
                        )
                        item = query.select_for_update().first()
                        existing_stock = (
                            item is not None
                            and InventoryStockMovement.objects.filter(inventory_item=item).exists()
                        )
                        if existing_stock and payload["initial_stock"]:
                            raise ValueError(
                                f"Item '{payload['name']}' already has stock movements; "
                                "use a stock adjustment."
                            )
                        location = None
                        if payload["storage_location"]:
                            location, _ = InventoryStorageLocation.objects.get_or_create(
                                name=payload["storage_location"],
                                defaults={"created_by": request.user, "updated_by": request.user},
                            )
                        item_fields = {
                            field: value
                            for field, value in payload.items()
                            if field in mapped_targets | {"name", "kind"}
                            and field not in {"storage_location", "initial_stock"}
                        }
                        if item is None:
                            item = InventoryItem(
                                created_by=request.user, updated_by=request.user, **item_fields
                            )
                        else:
                            for field, value in item_fields.items():
                                setattr(item, field, value)
                            item.is_active = True
                            item.is_deleted = False
                            item.deleted_at = None
                            item.updated_by = request.user
                        item.full_clean()
                        item.save()
                        if payload["initial_stock"]:
                            InventoryStockMovement.objects.create(
                                inventory_item=item,
                                storage_location=location,
                                movement_type=InventoryStockMovementType.ADJUSTMENT_IN,
                                direction=InventoryStockMovementDirection.INBOUND,
                                quantity=payload["initial_stock"],
                                source_label="Initial inventory import",
                                notes=f"Imported from {job.filename} (job {job.id}).",
                                validated_by=request.user,
                                created_by=request.user,
                                updated_by=request.user,
                            )
            except ValueError as error:
                errors.append({"row": None, "error": str(error)})
        job.status = "completed" if not errors else "failed"
        job.valid_rows = len(prepared_rows)
        job.error_rows = len(errors)
        job.error_log = errors
        job.save(update_fields=["status", "valid_rows", "error_rows", "error_log", "updated_at"])
        return Response(ImportJobSerializer(job).data)
