import { z } from "zod"

export const formSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio").max(120, "El nombre es demasiado largo"),
  descripcion: z.string().max(255, "La descripción es demasiado larga").optional().or(z.literal("")),
  ubicacion: z.string().max(120, "La ubicación es demasiado larga").optional().or(z.literal("")),
  activa: z.boolean(),
})

export type FormSchema = z.infer<typeof formSchema>
