export type AppRole = "member" | "admin";

export type SessionUser = {
  id: string;
  email: string | null;
  role: AppRole;
};

export type AuthErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFIGURATION_ERROR";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode) {
    super(code);
    this.name = "AuthError";
    this.code = code;
  }
}
