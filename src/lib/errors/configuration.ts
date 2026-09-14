import { AuthError } from "@/lib/auth/types";

export function isConfigurationError(error: unknown): boolean {
  if (error instanceof AuthError) {
    return error.code === "CONFIGURATION_ERROR";
  }
  return (
    !!error &&
    typeof error === "object" &&
    (("code" in error && error.code === "CONFIGURATION_ERROR") ||
      ("message" in error && error.message === "CONFIGURATION_ERROR"))
  );
}
