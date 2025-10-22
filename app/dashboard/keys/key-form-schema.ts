import { z } from "zod"

const preprocessOptional = <T,>(schema: z.ZodType<T>) =>
  z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined
    }
    return value
  }, schema.optional())

const preprocessNumber = (schema: z.ZodNumber) =>
  z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined
    }
    const numeric = typeof value === "number" ? value : Number(value)
    if (Number.isNaN(numeric)) {
      return undefined
    }
    return numeric
  }, schema.optional())

export const keyFormSchema = z
  .object({
    nombre: z.string().trim().min(1, "Ingresa un nombre").max(255, "Máximo 255 caracteres"),
    descripcion: preprocessOptional(z.string().trim().max(500, "Máximo 500 caracteres")),
    rfidEpc: preprocessOptional(z.string().trim().max(128, "Máximo 128 caracteres")),
    codigoActivo: preprocessOptional(z.string().trim().max(128, "Máximo 128 caracteres")),
    estado: z.enum(["activo", "baja", "extraviado"]).default("activo"),
    propietarioId: preprocessNumber(z.number().int().positive("Selecciona un propietario válido")),
    custodioId: preprocessNumber(z.number().int().positive("Selecciona un custodio válido")),
    ubicacionId: preprocessNumber(z.number().int().positive("Selecciona una ubicación válida")),
    zonaActual: preprocessOptional(z.string().trim().max(120, "Máximo 120 caracteres")),
    categoria: preprocessOptional(z.string().trim().max(120, "Máximo 120 caracteres")),
    marca: preprocessOptional(z.string().trim().max(120, "Máximo 120 caracteres")),
    modelo: preprocessOptional(z.string().trim().max(120, "Máximo 120 caracteres")),
    serial: preprocessOptional(z.string().trim().max(120, "Máximo 120 caracteres")),
    valor: preprocessNumber(z.number().nonnegative("Ingresa un valor válido")),
    fechaCompra: preprocessOptional(z.string()),
    vidaUtilMeses: preprocessNumber(z.number().int().nonnegative("Ingresa una cantidad válida")),
    centroCosto: preprocessOptional(z.string().trim().max(120, "Máximo 120 caracteres")),
  })
  .superRefine((values, ctx) => {
    if (values.fechaCompra) {
      const parsed = new Date(values.fechaCompra)
      if (Number.isNaN(parsed.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La fecha de compra no es válida",
          path: ["fechaCompra"],
        })
      }
    }
  })

export type KeyFormValues = z.infer<typeof keyFormSchema>
