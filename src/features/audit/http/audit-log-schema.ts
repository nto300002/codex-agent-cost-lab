import { z } from "zod";
import { auditActions } from "../domain/audit-log";

const optionalText = z
  .string()
  .trim()
  .max(100)
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional();

export const auditLogSearchSchema = z
  .object({
    actor: optionalText,
    action: z.enum(auditActions).optional(),
    entityType: optionalText,
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
