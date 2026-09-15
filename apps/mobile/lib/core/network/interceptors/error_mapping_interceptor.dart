import 'package:dio/dio.dart';

import '../../error/failure_mapper.dart';
import '../../error/failures.dart';

/// Turns every [DioException] into an [ApiFailure] and rejects with it.
///
/// This must be the LAST interceptor in the chain. Dio walks the error chain
/// in list order, so anything that wants to look at the raw exception — the
/// auth interceptor deciding whether a 401 is worth a refresh — has to run
/// before the exception is rewritten.
///
/// The failure is attached to `DioException.error` rather than thrown
/// directly, because Dio will wrap anything thrown here in another
/// [DioException] anyway. `ApiClient` unwraps it at the call site, so endpoint
/// clients see a bare [ApiFailure] and never a Dio type: nothing above this
/// layer should have to import `package:dio`.
class ErrorMappingInterceptor extends Interceptor {
  const ErrorMappingInterceptor();

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.error is ApiFailure) {
      handler.next(err);
      return;
    }
    final failure = FailureMapper.fromDioException(err);
    handler.next(err.copyWith(error: failure));
  }
}
