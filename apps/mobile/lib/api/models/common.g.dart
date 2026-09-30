// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'common.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_ImageRef _$ImageRefFromJson(Map<String, dynamic> json) => _ImageRef(
      url: json['url'] as String,
      width: (json['width'] as num?)?.toInt(),
      height: (json['height'] as num?)?.toInt(),
      blurhash: json['blurhash'] as String?,
      alt: json['alt'] as String?,
    );

Map<String, dynamic> _$ImageRefToJson(_ImageRef instance) => <String, dynamic>{
      'url': instance.url,
      'width': instance.width,
      'height': instance.height,
      'blurhash': instance.blurhash,
      'alt': instance.alt,
    };

_PageMeta _$PageMetaFromJson(Map<String, dynamic> json) => _PageMeta(
      cursor: json['cursor'] as String?,
      hasMore: json['hasMore'] as bool,
    );

Map<String, dynamic> _$PageMetaToJson(_PageMeta instance) => <String, dynamic>{
      'cursor': instance.cursor,
      'hasMore': instance.hasMore,
    };

_ApiError _$ApiErrorFromJson(Map<String, dynamic> json) => _ApiError(
      code: $enumDecode(_$ApiErrorCodeEnumMap, json['code']),
      message: json['message'] as String,
      requestId: json['requestId'] as String,
      fieldErrors: (json['fieldErrors'] as Map<String, dynamic>?)?.map(
        (k, e) =>
            MapEntry(k, (e as List<dynamic>).map((e) => e as String).toList()),
      ),
    );

Map<String, dynamic> _$ApiErrorToJson(_ApiError instance) => <String, dynamic>{
      'code': _$ApiErrorCodeEnumMap[instance.code]!,
      'message': instance.message,
      'requestId': instance.requestId,
      'fieldErrors': instance.fieldErrors,
    };

const _$ApiErrorCodeEnumMap = {
  ApiErrorCode.unauthenticated: 'unauthenticated',
  ApiErrorCode.forbidden: 'forbidden',
  ApiErrorCode.notFound: 'not_found',
  ApiErrorCode.validationFailed: 'validation_failed',
  ApiErrorCode.rateLimited: 'rate_limited',
  ApiErrorCode.conflict: 'conflict',
  ApiErrorCode.paymentRequired: 'payment_required',
  ApiErrorCode.upstreamUnavailable: 'upstream_unavailable',
  ApiErrorCode.internal: 'internal',
};

_ErrorEnvelope _$ErrorEnvelopeFromJson(Map<String, dynamic> json) =>
    _ErrorEnvelope(
      error: ApiError.fromJson(json['error'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$ErrorEnvelopeToJson(_ErrorEnvelope instance) =>
    <String, dynamic>{
      'error': instance.error,
    };
