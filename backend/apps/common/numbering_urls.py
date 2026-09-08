from django.urls import path

from apps.common.views_numbering import (
    NumberingSequenceListConfigureAPIView,
    NumberingSequencePreviewNextAPIView,
)

urlpatterns = [
    path(
        "sequences/",
        NumberingSequenceListConfigureAPIView.as_view(),
        name="numbering-sequence-list-configure",
    ),
    path(
        "sequences/preview-next/",
        NumberingSequencePreviewNextAPIView.as_view(),
        name="numbering-sequence-preview-next",
    ),
]
