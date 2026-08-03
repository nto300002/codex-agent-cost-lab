import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AuthenticationError } from "../../../shared/errors/app-error";
import { sessionCookieName } from "../http/auth-handlers";
import { authService } from "../infrastructure/auth-service";

export async function getOptionalSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  try {
    return await authService.getCurrentUser(token);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return null;
    }

    throw error;
  }
}

export async function requireSessionUser() {
  const user = await getOptionalSessionUser();

  if (user === null) {
    redirect("/login");
  }

  return user;
}
