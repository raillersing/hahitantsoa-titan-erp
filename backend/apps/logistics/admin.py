from django.contrib import admin

from .models import TitanClosedDay


@admin.register(TitanClosedDay)
class TitanClosedDayAdmin(admin.ModelAdmin):
    list_display = ("date", "label", "is_active")
    list_filter = ("is_active",)
    search_fields = ("label",)
    ordering = ("date",)
