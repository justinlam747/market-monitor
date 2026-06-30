import type { Response } from "express";
import { createLogger } from "./logger.js";

const log = createLogger("http");

// Stable, ambiguous error codes. The client only ever sees a code + a generic
// message (+ a reference id for internal errors) — never implementation detail.
export const ErrorCode = {
  VALIDATION: "ERR_VALIDATION",
  NOT_FOUND: "ERR_NOT_FOUND",
  UNAVAILABLE: "ERR_UNAVAILABLE",
  CONFLICT: "ERR_CONFLICT",
  INTERNAL: "ERR_INTERNAL",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// A safe, expected error with a client-facing message. Anything NOT an AppError
// is treated as an internal error: logged with full detail, returned ambiguous.
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly publicMessage: string;
  constructor(code: ErrorCode, httpStatus: number, publicMessage: string) {
    super(publicMessage);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.publicMessage = publicMessage;
  }
}

export const badRequest = (msg: string) =>
  new AppError(ErrorCode.VALIDATION, 400, msg);
export const notFound = (msg = "Not found.") =>
  new AppError(ErrorCode.NOT_FOUND, 404, msg);
export const unavailable = (msg = "Service temporarily unavailable.") =>
  new AppError(ErrorCode.UNAVAILABLE, 503, msg);
export const conflict = (msg: string) =>
  new AppError(ErrorCode.CONFLICT, 409, msg);

// Turns any thrown value into a safe JSON response. Internal errors are logged
// with their real detail and only a reference id is exposed.
export function sendError(res: Response, err: unknown, context: string): void {
  if (err instanceof AppError) {
    res
      .status(err.httpStatus)
      .json({ error: err.publicMessage, code: err.code });
    return;
  }
  const reference = log.error(`${context} failed`, err, ErrorCode.INTERNAL);
  res.status(500).json({
    error: "Something went wrong. Please try again.",
    code: ErrorCode.INTERNAL,
    reference,
  });
}
