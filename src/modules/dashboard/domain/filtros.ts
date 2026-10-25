import { z } from "zod";

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use una fecha válida")
  .refine((v) => new Date(`${v}T00:00:00Z`).toISOString().startsWith(v), "Use una fecha válida"); // rejects 2026-02-30

const opcional = <T extends z.ZodType>(s: T) => z.preprocess((v) => (v === "" || v === null ? undefined : v), s.optional());

/** Query string of GET /api/dashboard. Date range and funcionario only apply to admin+; others ignore them. */
export const filtrosSchema = z
  .object({
    desde: opcional(fecha),
    hasta: opcional(fecha),
    funcionario: opcional(z.string().max(128)),
    refrescar: opcional(z.literal("1")),
  })
  .refine((f) => !f.desde || !f.hasta || f.desde <= f.hasta, { path: ["hasta"], message: "La fecha final no puede ser anterior a la inicial" });

export type FiltrosDashboard = z.output<typeof filtrosSchema>;
