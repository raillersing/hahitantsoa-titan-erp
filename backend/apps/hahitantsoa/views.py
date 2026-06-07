from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.hahitantsoa.selectors import list_hahitantsoa_discovery_items
from apps.hahitantsoa.serializers import HahitantsoaDiscoveryItemSerializer


class HahitantsoaDiscoveryItemsAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses=inline_serializer(
            name="HahitantsoaDiscoveryItemsResponse",
            fields={
                "items": HahitantsoaDiscoveryItemSerializer(many=True),
                "count": serializers.IntegerField(),
            },
        )
    )
    def get(self, request):
        items = list_hahitantsoa_discovery_items()
        serialized_items = HahitantsoaDiscoveryItemSerializer(items, many=True).data

        return Response(
            {
                "items": serialized_items,
                "count": len(serialized_items),
            }
        )
