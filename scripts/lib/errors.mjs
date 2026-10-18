export class AppError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [extra]
   */
  constructor(code, message, extra = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.extra = extra;
  }
}

/** @param {unknown} err */
export function toPayload(err) {
  if (err instanceof AppError) {
    return {
      ok: false,
      code: err.code,
      message: err.message,
      ...err.extra,
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return {
    ok: false,
    code: "INTERNAL",
    message,
  };
}
