import re
import uuid

from django.db import migrations, models


DEFAULT_VENUE_KEY = "hahitantsoa-default-space"


def _key(value):
    return re.sub(r"\s+", " ", (value or "").strip()).casefold() or DEFAULT_VENUE_KEY


def populate_venue_keys(apps, schema_editor):
    EventDraft = apps.get_model("hahitantsoa", "HahitantsoaEventDraft")
    for draft in EventDraft.objects.all().only("id", "venue_name"):
        EventDraft.objects.filter(pk=draft.pk).update(venue_key=_key(draft.venue_name))


class Migration(migrations.Migration):
    dependencies = [("hahitantsoa", "0014_hahitantsoaeventcloseout")]

    operations = [
        migrations.AddField(
            model_name="hahitantsoaeventdraft",
            name="venue_key",
            field=models.CharField(db_index=True, default=DEFAULT_VENUE_KEY, max_length=255),
        ),
        migrations.CreateModel(
            name="HahitantsoaVenueOccupancyLock",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("venue_key", models.CharField(max_length=255, unique=True)),
            ],
        ),
        migrations.RunPython(populate_venue_keys, migrations.RunPython.noop),
    ]
