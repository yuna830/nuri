const String _configuredApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
);

final String baseUrl = _requiredUrl(
  _configuredApiBaseUrl,
  'API_BASE_URL',
);

String _requiredUrl(String value, String name) {
  final normalized = value.trim().replaceFirst(RegExp(r'/$'), '');
  if (normalized.isEmpty) {
    throw StateError('$name must be provided with --dart-define.');
  }
  return normalized;
}

