// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'account.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_CompanyMembership _$CompanyMembershipFromJson(Map<String, dynamic> json) =>
    _CompanyMembership(
      companyId: json['companyId'] as String,
      nameEn: json['nameEn'] as String,
      nameAr: json['nameAr'] as String?,
      country: $enumDecode(_$CountryEnumMap, json['country']),
      status: $enumDecode(_$CompanyStatusEnumMap, json['status']),
      role: $enumDecode(_$UserRoleEnumMap, json['role']),
    );

Map<String, dynamic> _$CompanyMembershipToJson(_CompanyMembership instance) =>
    <String, dynamic>{
      'companyId': instance.companyId,
      'nameEn': instance.nameEn,
      'nameAr': instance.nameAr,
      'country': _$CountryEnumMap[instance.country]!,
      'status': _$CompanyStatusEnumMap[instance.status]!,
      'role': _$UserRoleEnumMap[instance.role]!,
    };

const _$CountryEnumMap = {
  Country.ae: 'AE',
  Country.sa: 'SA',
  Country.qa: 'QA',
  Country.kw: 'KW',
  Country.om: 'OM',
  Country.bh: 'BH',
};

const _$CompanyStatusEnumMap = {
  CompanyStatus.pendingVerification: 'PENDING_VERIFICATION',
  CompanyStatus.active: 'ACTIVE',
  CompanyStatus.suspended: 'SUSPENDED',
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

_Me _$MeFromJson(Map<String, dynamic> json) => _Me(
      id: json['id'] as String,
      email: json['email'] as String,
      phone: json['phone'] as String?,
      firstName: json['firstName'] as String,
      lastName: json['lastName'] as String,
      firstNameAr: json['firstNameAr'] as String?,
      lastNameAr: json['lastNameAr'] as String?,
      avatar: json['avatar'] == null
          ? null
          : ImageRef.fromJson(json['avatar'] as Map<String, dynamic>),
      role: $enumDecode(_$UserRoleEnumMap, json['role']),
      status: $enumDecode(_$UserStatusEnumMap, json['status']),
      language: $enumDecode(_$LanguageEnumMap, json['language']),
      emailVerified: json['emailVerified'] as bool,
      phoneVerified: json['phoneVerified'] as bool,
      company: json['company'] == null
          ? null
          : CompanyMembership.fromJson(json['company'] as Map<String, dynamic>),
      createdAt:
          const UtcDateTimeConverter().fromJson(json['createdAt'] as String),
    );

Map<String, dynamic> _$MeToJson(_Me instance) => <String, dynamic>{
      'id': instance.id,
      'email': instance.email,
      'phone': instance.phone,
      'firstName': instance.firstName,
      'lastName': instance.lastName,
      'firstNameAr': instance.firstNameAr,
      'lastNameAr': instance.lastNameAr,
      'avatar': instance.avatar,
      'role': _$UserRoleEnumMap[instance.role]!,
      'status': _$UserStatusEnumMap[instance.status]!,
      'language': _$LanguageEnumMap[instance.language]!,
      'emailVerified': instance.emailVerified,
      'phoneVerified': instance.phoneVerified,
      'company': instance.company,
      'createdAt': const UtcDateTimeConverter().toJson(instance.createdAt),
    };

const _$UserStatusEnumMap = {
  UserStatus.pending: 'PENDING',
  UserStatus.active: 'ACTIVE',
  UserStatus.suspended: 'SUSPENDED',
  UserStatus.banned: 'BANNED',
};

const _$LanguageEnumMap = {
  Language.ar: 'AR',
  Language.en: 'EN',
};

_AccountDeletion _$AccountDeletionFromJson(Map<String, dynamic> json) =>
    _AccountDeletion(
      status: $enumDecode(_$AccountDeletionStatusEnumMap, json['status']),
      requestedAt:
          const UtcDateTimeConverter().fromJson(json['requestedAt'] as String),
      erasesAt:
          const UtcDateTimeConverter().fromJson(json['erasesAt'] as String),
    );

Map<String, dynamic> _$AccountDeletionToJson(_AccountDeletion instance) =>
    <String, dynamic>{
      'status': _$AccountDeletionStatusEnumMap[instance.status]!,
      'requestedAt': const UtcDateTimeConverter().toJson(instance.requestedAt),
      'erasesAt': const UtcDateTimeConverter().toJson(instance.erasesAt),
    };

const _$AccountDeletionStatusEnumMap = {
  AccountDeletionStatus.scheduled: 'scheduled',
};

_Address _$AddressFromJson(Map<String, dynamic> json) => _Address(
      id: json['id'] as String,
      label: json['label'] as String,
      line1: json['line1'] as String,
      line2: json['line2'] as String?,
      city: json['city'] as String,
      country: $enumDecode(_$CountryEnumMap, json['country']),
      postalCode: json['postalCode'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      isDefault: json['isDefault'] as bool,
    );

Map<String, dynamic> _$AddressToJson(_Address instance) => <String, dynamic>{
      'id': instance.id,
      'label': instance.label,
      'line1': instance.line1,
      'line2': instance.line2,
      'city': instance.city,
      'country': _$CountryEnumMap[instance.country]!,
      'postalCode': instance.postalCode,
      'latitude': instance.latitude,
      'longitude': instance.longitude,
      'isDefault': instance.isDefault,
    };

_AddressDeleted _$AddressDeletedFromJson(Map<String, dynamic> json) =>
    _AddressDeleted(
      id: json['id'] as String,
      deleted: json['deleted'] as bool,
    );

Map<String, dynamic> _$AddressDeletedToJson(_AddressDeleted instance) =>
    <String, dynamic>{
      'id': instance.id,
      'deleted': instance.deleted,
    };

_Device _$DeviceFromJson(Map<String, dynamic> json) => _Device(
      id: json['id'] as String,
      deviceId: json['deviceId'] as String,
      platform: $enumDecode(_$DevicePlatformEnumMap, json['platform']),
      appVersion: json['appVersion'] as String,
      language: $enumDecode(_$LanguageEnumMap, json['language']),
      registeredAt:
          const UtcDateTimeConverter().fromJson(json['registeredAt'] as String),
      lastSeenAt:
          const UtcDateTimeConverter().fromJson(json['lastSeenAt'] as String),
    );

Map<String, dynamic> _$DeviceToJson(_Device instance) => <String, dynamic>{
      'id': instance.id,
      'deviceId': instance.deviceId,
      'platform': _$DevicePlatformEnumMap[instance.platform]!,
      'appVersion': instance.appVersion,
      'language': _$LanguageEnumMap[instance.language]!,
      'registeredAt':
          const UtcDateTimeConverter().toJson(instance.registeredAt),
      'lastSeenAt': const UtcDateTimeConverter().toJson(instance.lastSeenAt),
    };

const _$DevicePlatformEnumMap = {
  DevicePlatform.ios: 'ios',
  DevicePlatform.android: 'android',
};

_DeviceDeleted _$DeviceDeletedFromJson(Map<String, dynamic> json) =>
    _DeviceDeleted(
      deviceId: json['deviceId'] as String,
      deleted: json['deleted'] as bool,
    );

Map<String, dynamic> _$DeviceDeletedToJson(_DeviceDeleted instance) =>
    <String, dynamic>{
      'deviceId': instance.deviceId,
      'deleted': instance.deleted,
    };
