"""Contratos del proxy de chat Benef AI."""

from django.conf import settings
from rest_framework import serializers


class BenefAIChatTurnSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=('user', 'assistant'))
    content = serializers.CharField(
        max_length=4000,
        allow_blank=False,
        trim_whitespace=True,
    )

    def validate_content(self, value):
        if len(value) > settings.BENEF_AI_MAX_MESSAGE_CHARS:
            raise serializers.ValidationError(
                f'Cada mensaje admite hasta {settings.BENEF_AI_MAX_MESSAGE_CHARS} caracteres.'
            )
        return value


class BenefAIChatSerializer(serializers.Serializer):
    message = serializers.CharField(
        max_length=4000,
        allow_blank=False,
        trim_whitespace=True,
    )
    history = BenefAIChatTurnSerializer(many=True, required=False, default=list)

    def validate_message(self, value):
        if len(value) > settings.BENEF_AI_MAX_MESSAGE_CHARS:
            raise serializers.ValidationError(
                f'El mensaje admite hasta {settings.BENEF_AI_MAX_MESSAGE_CHARS} caracteres.'
            )
        return value

    def validate_history(self, value):
        if len(value) > settings.BENEF_AI_MAX_HISTORY_TURNS:
            raise serializers.ValidationError(
                f'El historial admite hasta {settings.BENEF_AI_MAX_HISTORY_TURNS} mensajes.'
            )
        if sum(len(turn['content']) for turn in value) > settings.BENEF_AI_MAX_HISTORY_CHARS:
            raise serializers.ValidationError(
                'El historial supera el contexto permitido. Reinicia la conversación.'
            )
        return value
