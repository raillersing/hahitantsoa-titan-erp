from __future__ import annotations

import base64
import binascii
from urllib.parse import urlparse

MAX_CATALOG_IMAGE_BYTES = 10 * 1024 * 1024
ALLOWED_CATALOG_IMAGE_MEDIA_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/svg+xml",
}


def validate_catalog_image_url(value: str) -> str:
    """Allow the catalogue image forms already supported by the frontend."""
    if not value:
        return value
    if value.startswith("/") and not value.startswith("//"):
        return value

    parsed = urlparse(value)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return value

    header, separator, encoded = value.partition(",")
    if not separator or not header.endswith(";base64"):
        raise ValueError(
            "L'image doit être une URL HTTP(S), un chemin interne ou une image locale valide."
        )

    media_type = header.removeprefix("data:").removesuffix(";base64")
    if media_type not in ALLOWED_CATALOG_IMAGE_MEDIA_TYPES:
        raise ValueError("Le format d'image doit être JPEG, PNG, WebP ou SVG.")

    max_encoded_length = ((MAX_CATALOG_IMAGE_BYTES + 2) // 3) * 4
    if len(encoded) > max_encoded_length:
        raise ValueError("L'image locale ne peut pas dépasser 10 Mo.")
    try:
        decoded = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as error:
        raise ValueError("L'image locale encodée est invalide.") from error
    if len(decoded) > MAX_CATALOG_IMAGE_BYTES:
        raise ValueError("L'image locale ne peut pas dépasser 10 Mo.")
    return value
