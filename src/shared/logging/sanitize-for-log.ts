const redacted = "[REDACTED]";
const circular = "[CIRCULAR]";
const sensitiveKeys = new Set([
  "accesstoken",
  "apikey",
  "authorization",
  "clientsecret",
  "cookie",
  "password",
  "passwordhash",
  "refreshtoken",
  "secret",
  "sessiontoken",
  "setcookie",
  "token",
  "tokenhash",
]);

function normalizedKey(key: string) {
  return key.replaceAll(/[_-]/g, "").toLowerCase();
}

function isSensitiveKey(key: string) {
  return sensitiveKeys.has(normalizedKey(key));
}

function sanitize(value: unknown, seen: WeakSet<object>): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return { name: value.name, message: redacted };
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return circular;
    }
    seen.add(value);
    return value.map((entry) => sanitize(entry, seen));
  }

  if (value !== null && typeof value === "object") {
    if (seen.has(value)) {
      return circular;
    }
    seen.add(value);

    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        isSensitiveKey(key) ? redacted : sanitize(entry, seen),
      ]),
    );
  }

  return value;
}

export function sanitizeForLog(value: unknown) {
  return sanitize(value, new WeakSet());
}
