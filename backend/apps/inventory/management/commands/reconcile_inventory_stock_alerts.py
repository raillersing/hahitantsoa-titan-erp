"""Explicit reconciliation entrypoint for scheduled stock-alert maintenance."""

import time

from django.core.management.base import BaseCommand, CommandError

from apps.inventory.models import InventoryItem
from apps.inventory.stock_alerts import reconcile_inventory_stock_alerts
from apps.inventory.stock_selectors import inventory_stock_summaries


class Command(BaseCommand):
    help = (
        "Dry-run by default; --apply reconciles episodes. Schedule periodically "
        "for future movements and new recipients."
    )

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true")
        parser.add_argument("--watch", action="store_true")
        parser.add_argument("--interval", type=int, default=60)

    def handle(self, *args, **options):
        if options["interval"] < 5:
            raise CommandError("Interval must be at least 5 seconds.")
        if options["watch"] and not options["apply"]:
            raise CommandError("--watch requires --apply.")
        while True:
            if options["apply"]:
                summaries = reconcile_inventory_stock_alerts()
            else:
                summaries = inventory_stock_summaries(InventoryItem.objects.order_by("id"))
            for item_id, summary in summaries.items():
                if summary["stock_anomalies"]:
                    self.stdout.write(
                        f"Anomalie {item_id}: {', '.join(summary['stock_anomalies'])}"
                    )
            count = sum(
                summary["physical_status"] in {"out_of_stock", "low"}
                for summary in summaries.values()
            )
            self.stdout.write(
                f"{'Applied' if options['apply'] else 'Dry run'}: "
                f"{count} item(s) currently require a stock alert."
            )
            if not options["watch"]:
                return
            try:
                time.sleep(options["interval"])
            except KeyboardInterrupt:
                return
