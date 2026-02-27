import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function handleApiError(error: unknown) {
  console.error("API Error:", error);

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: error.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      },
      { status: 400 }
    );
  }

  if (error instanceof Error) {
    if (error.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "A record with this value already exists" },
        { status: 409 }
      );
    }
    if (
      error.message.includes("Record to update not found") ||
      error.message.includes("Record to delete does not exist")
    ) {
      return NextResponse.json(
        { error: "Record not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { error: "An unexpected error occurred" },
    { status: 500 }
  );
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function notFound(resource = "Resource") {
  return NextResponse.json(
    { error: `${resource} not found` },
    { status: 404 }
  );
}
