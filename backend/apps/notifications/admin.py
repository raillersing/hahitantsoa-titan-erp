from django.contrib import admin

from apps.notifications.models import BugReport


@admin.register(BugReport)
class BugReportAdmin(admin.ModelAdmin):
    list_display = ("title", "severity", "status", "reporter", "created_at")
    list_filter = ("severity", "status")
    search_fields = ("title", "description", "correlation_id", "reporter__username")
