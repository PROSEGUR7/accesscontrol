type ValiditySource = {
  habilitadoDesde: string | null
  habilitadoHasta: string | null
}

const defaultDateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
})

const defaultCurrencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 2,
})

export function formatDateTime(value: string | Date | null) {
  if (!value) return "—"
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return defaultDateTimeFormatter.format(date)
}

export function formatValidity(source: ValiditySource) {
  const since = source.habilitadoDesde ? formatDateTime(source.habilitadoDesde) : null
  const until = source.habilitadoHasta ? formatDateTime(source.habilitadoHasta) : null

  if (since && until) return `${since} → ${until}`
  if (since) return `Desde ${since}`
  if (until) return `Hasta ${until}`
  return "Sin vigencia definida"
}

export function formatCurrency(value: number | null | undefined) {
  if (value == null) return "—"
  return defaultCurrencyFormatter.format(value)
}
