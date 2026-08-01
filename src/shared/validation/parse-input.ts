import { z } from "zod";

import { ValidationError, type ValidationDetails } from "../errors/app-error";

function pathKey(path: PropertyKey[]) {
  return path.length === 0 ? "_root" : path.map(String).join(".");
}

function validationDetails(error: z.ZodError): ValidationDetails {
  return error.issues.reduce<ValidationDetails>((details, issue) => {
    const key = pathKey(issue.path);
    details[key] = [...(details[key] ?? []), issue.message];
    return details;
  }, {});
}

export function parseInput<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(validationDetails(result.error));
  }

  return result.data;
}
