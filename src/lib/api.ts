import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession, type SessionUser } from "./auth";
import { runForRestaurant } from "./db";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Stop the request with a friendly message shown to the user. */
export function fail(message: string, status = 400): never {
  throw new ApiError(status, message);
}

export function unauthorized() {
  return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "Only the owner / manager can do this." }, { status: 403 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message = "Something went wrong. Please try again.") {
  return NextResponse.json({ error: message }, { status: 500 });
}

export function handleError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const field = issue?.path.join(".");
    return badRequest(issue ? (field ? `${field}: ${issue.message}` : issue.message) : "Invalid details");
  }
  if (error instanceof SyntaxError) {
    return badRequest("Invalid request");
  }
  console.error(error);
  return serverError();
}

export function isAdmin(user: SessionUser | null | undefined) {
  return user?.role === "admin";
}

export async function withAuth<T>(
  handler: (user: SessionUser) => Promise<T>,
  opts: { admin?: boolean } = {}
): Promise<T | NextResponse> {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (opts.admin && !isAdmin(session)) return forbidden();
    // Everything the handler reads or writes is limited to this person's restaurant.
    return await runForRestaurant(session.restaurantId, () => handler(session));
  } catch (error) {
    return handleError(error);
  }
}

export function withAdmin<T>(handler: (user: SessionUser) => Promise<T>) {
  return withAuth(handler, { admin: true });
}

export function csvResponse(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  const escape = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = rows.map((r) => r.map(escape).join(",")).join("\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
