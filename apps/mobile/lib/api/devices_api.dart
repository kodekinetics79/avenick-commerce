import '../core/network/api_client.dart';
import 'models/account.dart';
import 'models/requests.dart';

/// `/v1/devices` — push registration.
///
/// The push token goes UP and is never echoed back: [Device] has no field for
/// it. That is correct and worth not "fixing" — a token in a response body is
/// a token in a log.
class DevicesApi {
  const DevicesApi(this._client);

  final ApiClient _client;

  static const String devicesPath = '/v1/devices';

  /// `POST /v1/devices` — register or refresh this installation.
  ///
  /// Idempotent on `deviceId`: call it on every launch and after every APNs or
  /// FCM token rotation. A token that rotates without this call is a device
  /// that silently stops receiving notifications, which nobody reports as a
  /// bug because nothing visibly fails.
  Future<Device> register(RegisterDeviceRequest request) =>
      _client.post<Device>(
        devicesPath,
        decoder: Device.fromJson,
        body: request.toJson(),
      );

  /// `DELETE /v1/devices?deviceId=…` — stop notifications for this handset.
  ///
  /// Note the id travels in the QUERY, not the path, and not a body.
  Future<DeviceDeleted> unregister(String deviceId) =>
      _client.delete<DeviceDeleted>(
        devicesPath,
        decoder: DeviceDeleted.fromJson,
        query: <String, Object?>{'deviceId': deviceId},
      );
}
