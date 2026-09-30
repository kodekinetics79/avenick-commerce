// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_AuthPrincipal _$AuthPrincipalFromJson(Map<String, dynamic> json) =>
    _AuthPrincipal(
      id: json['id'] as String,
      email: json['email'] as String,
      firstName: json['firstName'] as String,
      lastName: json['lastName'] as String,
      role: $enumDecode(_$UserRoleEnumMap, json['role']),
      language: $enumDecode(_$LanguageEnumMap, json['language']),
    );

Map<String, dynamic> _$AuthPrincipalToJson(_AuthPrincipal instance) =>
    <String, dynamic>{
      'id': instance.id,
      'email': instance.email,
      'firstName': instance.firstName,
      'lastName': instance.lastName,
      'role': _$UserRoleEnumMap[instance.role]!,
      'language': _$LanguageEnumMap[instance.language]!,
    };

const _$UserRoleEnumMap = {
  UserRole.consumer: 'CONSUMER',
  UserRole.companyAdmin: 'COMPANY_ADMIN',
  UserRole.companyBuyer: 'COMPANY_BUYER',
  UserRole.companyApprover: 'COMPANY_APPROVER',
  UserRole.sellerOwner: 'SELLER_OWNER',
  UserRole.sellerStaff: 'SELLER_STAFF',
  UserRole.admin: 'ADMIN',
  UserRole.superAdmin: 'SUPER_ADMIN',
};

const _$LanguageEnumMap = {
  Language.ar: 'AR',
  Language.en: 'EN',
};

_TokenPair _$TokenPairFromJson(Map<String, dynamic> json) => _TokenPair(
      tokenType: $enumDecode(_$TokenTypeEnumMap, json['tokenType']),
      accessToken: json['accessToken'] as String,
      expiresIn: (json['expiresIn'] as num).toInt(),
      refreshToken: json['refreshToken'] as String,
      refreshExpiresIn: (json['refreshExpiresIn'] as num).toInt(),
      principal:
          AuthPrincipal.fromJson(json['principal'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$TokenPairToJson(_TokenPair instance) =>
    <String, dynamic>{
      'tokenType': _$TokenTypeEnumMap[instance.tokenType]!,
      'accessToken': instance.accessToken,
      'expiresIn': instance.expiresIn,
      'refreshToken': instance.refreshToken,
      'refreshExpiresIn': instance.refreshExpiresIn,
      'principal': instance.principal,
    };

const _$TokenTypeEnumMap = {
  TokenType.bearer: 'Bearer',
};

_OtpChallenge _$OtpChallengeFromJson(Map<String, dynamic> json) =>
    _OtpChallenge(
      challengeId: json['challengeId'] as String,
      codeLength: (json['codeLength'] as num).toInt(),
      expiresAt:
          const UtcDateTimeConverter().fromJson(json['expiresAt'] as String),
      resendAfter:
          const UtcDateTimeConverter().fromJson(json['resendAfter'] as String),
    );

Map<String, dynamic> _$OtpChallengeToJson(_OtpChallenge instance) =>
    <String, dynamic>{
      'challengeId': instance.challengeId,
      'codeLength': instance.codeLength,
      'expiresAt': const UtcDateTimeConverter().toJson(instance.expiresAt),
      'resendAfter': const UtcDateTimeConverter().toJson(instance.resendAfter),
    };

_Revocation _$RevocationFromJson(Map<String, dynamic> json) => _Revocation(
      revokedCount: (json['revokedCount'] as num).toInt(),
    );

Map<String, dynamic> _$RevocationToJson(_Revocation instance) =>
    <String, dynamic>{
      'revokedCount': instance.revokedCount,
    };
