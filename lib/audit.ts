type AuditPayload = Record<string, unknown>;

export function logAudit(event: string, payload: AuditPayload) {
  // JSON logs are easier to index and query in production log pipelines.
  console.info(
    JSON.stringify({
      level: "info",
      type: "audit",
      event,
      at: new Date().toISOString(),
      ...payload,
    }),
  );
}
