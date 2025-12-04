import { z } from "zod"

const preprocessOptional = (schema: z.ZodString) =>
  z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined
    }
    return value
  }, schema.optional())

export const locationFormSchema = z.object({
  nombre: z.string().trim().min(1, "Ingresa un nombre").max(255, "Máximo 255 caracteres"),
  tipo: preprocessOptional(z.string().trim().max(120, "Máximo 120 caracteres")),
  descripcion: preprocessOptional(z.string().trim().max(500, "Máximo 500 caracteres")),
  activa: z.boolean().default(true),
})

export type LocationFormValues = z.infer<typeof locationFormSchema>
