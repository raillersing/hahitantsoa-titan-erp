from django.core.exceptions import ValidationError

BARE_RENTAL_LABEL = "Location nue"


def default_bare_rental_composition():
    return [
        {"label": "Salle", "quantity": 1},
        {"label": "Estrades", "quantity": 1},
        {"label": "Table mariés", "quantity": 1},
        {"label": "Table DJ", "quantity": 1},
        {"label": "Chaises pliables", "quantity": 10},
    ]


def validate_bare_rental_composition(value):
    if not isinstance(value, list) or not 1 <= len(value) <= 50:
        raise ValidationError("La composition doit contenir entre 1 et 50 lignes.")
    for row in value:
        if not isinstance(row, dict) or set(row) != {"label", "quantity"}:
            raise ValidationError("Chaque ligne doit contenir un libellé et une quantité.")
        label, quantity = row["label"], row["quantity"]
        if not isinstance(label, str) or not 1 <= len(label.strip()) <= 200:
            raise ValidationError("Le libellé doit contenir entre 1 et 200 caractères.")
        if type(quantity) is not int or not 1 <= quantity <= 9999:
            raise ValidationError("La quantité doit être un entier entre 1 et 9999.")
