from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.models import SystemNotification
from apps.notifications.serializers import (
    SystemNotificationMarkReadSerializer,
    SystemNotificationSerializer,
)


class SystemNotificationListAPIView(generics.ListAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]
    serializer_class = SystemNotificationSerializer

    def get_queryset(self):
        qs = SystemNotification.objects.all()
        unread_only = self.request.query_params.get("unread_only")
        if unread_only == "true":
            qs = qs.filter(is_read=False)
        return qs


class SystemNotificationMarkReadAPIView(APIView):
    http_method_names = ["patch", "head", "options"]
    permission_classes = [IsAuthenticated]

    def patch(self, request, id):
        from django.shortcuts import get_object_or_404

        notification = get_object_or_404(SystemNotification, pk=id)
        serializer = SystemNotificationMarkReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        notification.is_read = serializer.validated_data["is_read"]
        notification.save(update_fields=["is_read", "updated_at"])
        return Response(SystemNotificationSerializer(notification).data)


class SystemNotificationMarkAllReadAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        count = SystemNotification.objects.filter(is_read=False).update(is_read=True)
        return Response({"marked_read": count}, status=status.HTTP_200_OK)
