/* eslint-disable @typescript-eslint/no-explicit-any */

export function getErrorText(err: any): string {
  if (err instanceof Array) {
    err = err[0];
  }
  if (typeof err === "string") {
    return err;
  }
  const { error } = err;
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object") {
    const { message } = error;
    if (message) {
      return message;
    }
    if (error.error) {
      if (error.error.message) return error.error.message;
    }
  }
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "object") {
    const { detail } = err;
    if (detail) {
      return detail;
    }
  }
  return "Unexcept error";
}
