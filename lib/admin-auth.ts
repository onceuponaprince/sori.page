import type { User } from "@supabase/supabase-js";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((entry) => normalizeEmail(entry))
    .filter(Boolean);
}

export function getSuperAdminConfig() {
  const enabled = process.env.ENABLE_SUPER_ADMIN_BYPASS === "true";
  const email = process.env.SUPER_ADMIN_EMAIL
    ? normalizeEmail(process.env.SUPER_ADMIN_EMAIL)
    : "";
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "";
  return { enabled, email, password };
}

export function isSuperAdminBypassEnabled(): boolean {
  return getSuperAdminConfig().enabled;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }

  const normalized = normalizeEmail(email);
  if (parseAdminEmails().includes(normalized)) {
    return true;
  }

  const { enabled, email: superEmail } = getSuperAdminConfig();
  return enabled && Boolean(superEmail) && normalized === superEmail;
}

export function isAdminUser(user: User | null | undefined): boolean {
  if (!user) {
    return false;
  }

  if (user.app_metadata?.role === "admin") {
    return true;
  }

  if (user.user_metadata?.is_admin === true) {
    return true;
  }

  return isAdminEmail(user.email);
}

export function superAdminCredentialsMatch(
  email: string,
  password: string,
): boolean {
  const { enabled, email: superEmail, password: superPassword } =
    getSuperAdminConfig();

  if (!enabled || !superEmail || !superPassword) {
    return false;
  }

  return (
    normalizeEmail(email) === superEmail && password === superPassword
  );
}
