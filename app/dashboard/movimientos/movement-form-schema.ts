import { z } from "zod"

const optionalId = z.number().int().positive().optional().nullable()

export const movementFormSchema = z.object({
  timestamp: z.string().trim().min(1, "La marca de tiempo es obligatoria"),
  tipo: z.string().trim().max(120, "Tipo demasiado largo").optional().nullable(),
  epc: z.string().trim().min(4, "El EPC es obligatorio").max(24, "El EPC debe tener 24 caracteres o menos"),
  personaId: optionalId,
  objetoId: optionalId,
  puertaId: optionalId,
  lectorId: optionalId,
  antenaId: optionalId,
  rssi: z.number().min(-200, "RSSI inválido").max(200, "RSSI inválido").optional().nullable(),
  direccion: z.string().trim().max(80, "Dirección demasiado larga").optional().nullable(),
  motivo: z.string().trim().max(255, "Motivo demasiado largo").optional().nullable(),
  extra: z.string().trim().max(4000, "El payload es demasiado largo").optional().nullable(),
})

export type MovementFormValues = z.infer<typeof movementFormSchema>
