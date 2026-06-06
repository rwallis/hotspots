import { Prisma } from "@prisma/client";

const DB_PUSH_HINT =
  "Run: node node_modules/prisma/build/index.js db push (from the hotspots project folder)";

export function formatServiceError(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021" || error.code === "P2022") {
      return `Database schema is out of date (${error.code}). ${DB_PUSH_HINT}`;
    }
    const column = error.meta?.column;
    if (typeof column === "string") {
      return `Database column "${column}" is missing. ${DB_PUSH_HINT}`;
    }
    return `${error.message.split("\n")[0] ?? error.message}. ${DB_PUSH_HINT}`;
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    const text = error.message;
    const unknownArg = text.match(/Unknown arg `([^`]+)`/);
    if (unknownArg) {
      return `Database schema is out of date (missing field "${unknownArg[1]}"). ${DB_PUSH_HINT}`;
    }
    const invalidValue = text.match(/Invalid value for argument `([^`]+)`/);
    if (invalidValue) {
      return `Invalid value for "${invalidValue[1]}". Check flight IDs and cached data types.`;
    }
    const invocation = text.match(/Invalid `[^`]+` invocation[^\n]*/);
    if (invocation) {
      return `${invocation[0]}. ${DB_PUSH_HINT}`;
    }
    return text.split("\n")[0] ?? "Database validation error";
  }

  if (error instanceof Error) {
    const firstLine = error.message.split("\n").find((line) => line.trim());
    if (firstLine?.includes("Invalid `prisma.")) {
      return `${firstLine}. ${DB_PUSH_HINT}`;
    }
    return firstLine ?? error.message;
  }

  return "Request failed";
}
