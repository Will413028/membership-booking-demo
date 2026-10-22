export type AppRole = "member" | "admin";

export type SessionUser = {
  id: string;
  email: string | null;
  role: AppRole;
};
