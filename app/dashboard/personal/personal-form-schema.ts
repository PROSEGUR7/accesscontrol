import { z } from "zod"

const preprocessOptional = <T,>(schema: z.ZodType<T>) =>
  z.preprocess((value) => {
    if (typeof value === "string" && value.trim() === "") {
      return undefined
    }
    return value
  }, schema.optional())

export const formSchema = z
  .object({
    nombre: z.string().trim().min(1, "Ingresa un nombre"),
    documento: preprocessOptional(z.string().trim().max(120, "Máximo 120 caracteres")),
  rfidEpc: preprocessOptional(z.string().trim().length(24, "El EPC debe tener 24 caracteres")),
    habilitado: z.boolean().default(true),
    habilitadoDesde: preprocessOptional(z.string()),
    habilitadoHasta: preprocessOptional(z.string()),
  })
  .superRefine((values, ctx) => {
    if (values.habilitadoDesde && values.habilitadoHasta) {
      const since = new Date(values.habilitadoDesde)
      const until = new Date(values.habilitadoHasta)
      if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime())) {
        return
      }
      if (since > until) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La vigencia final debe ser posterior a la inicial",
          path: ["habilitadoHasta"],
        })
      }
    }
  })

export type FormSchema = z.infer<typeof formSchema>
