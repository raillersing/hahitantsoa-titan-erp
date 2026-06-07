from rest_framework import serializers


class HahitantsoaDiscoveryItemSerializer(serializers.Serializer):
    concept = serializers.CharField()
    label = serializers.CharField()
