"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ArrowUpRight, KeyRound } from "lucide-react";

import { KeysTable } from "@/components/keys/keys-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import type { Key } from "@/types/key";
import type { Location } from "@/types/location";
import type { Person } from "@/types/person";
import { keyFormSchema, type KeyFormValues } from "./key-form-schema";

const estadoOptions = [
  { value: "activo" as const, label: "Activa" },
  { value: "extraviado" as const, label: "Extraviada" },
  { value: "baja" as const, label: "En baja" },
];

const estadoLabels: Record<Key["estado"], string> = {
  activo: "Activa",
  extraviado: "Extraviada",
  baja: "En baja",
};

const UNASSIGNED_VALUE = "__none__";

type ReferenceData = {
  personas: Person[];
  ubicaciones: Location[];
};

const defaultKeyValues: KeyFormValues = {
  nombre: "",
  descripcion: undefined,
  rfidEpc: undefined,
  codigoActivo: undefined,
  estado: "activo",
  propietarioId: undefined,
  custodioId: undefined,
  ubicacionId: undefined,
  zonaActual: undefined,
  categoria: undefined,
  marca: undefined,
  modelo: undefined,
  serial: undefined,
  valor: undefined,
  fechaCompra: undefined,
  vidaUtilMeses: undefined,
  centroCosto: undefined,
};

function keyToFormValues(key: Key): KeyFormValues {
  return {
    nombre: key.nombre,
    descripcion: key.descripcion ?? undefined,
    rfidEpc: key.rfidEpc ?? undefined,
    codigoActivo: key.codigoActivo ?? undefined,
    estado: key.estado,
    propietarioId: key.propietarioId ?? undefined,
    custodioId: key.custodioId ?? undefined,
    ubicacionId: key.ubicacionId ?? undefined,
    zonaActual: key.zonaActual ?? undefined,
    categoria: key.categoria ?? undefined,
    marca: key.marca ?? undefined,
    modelo: key.modelo ?? undefined,
    serial: key.serial ?? undefined,
    valor: key.valor ?? undefined,
    fechaCompra: key.fechaCompra
      ? new Date(key.fechaCompra).toISOString().slice(0, 10)
      : undefined,
    vidaUtilMeses: key.vidaUtilMeses ?? undefined,
    centroCosto: key.centroCosto ?? undefined,
  };
}

export default function KeysPage() {
  const [keys, setKeys] = useState<Key[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [references, setReferences] = useState<ReferenceData>({
    personas: [],
    ubicaciones: [],
  });
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<Key | null>(null);

  const form = useForm<KeyFormValues>({
    resolver: zodResolver(keyFormSchema),
    defaultValues: defaultKeyValues,
  });

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/keys", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Respuesta no válida del servidor");
      }
      const data = (await response.json()) as { llaves?: Key[] };
      setKeys(data.llaves ?? []);
    } catch (error) {
      console.error("Error al cargar llaves", error);
      toast({
        variant: "destructive",
        title: "No se pudieron cargar las llaves",
        description: "Revisa la conexión o intenta nuevamente.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReferences = useCallback(async () => {
    setLoadingReferences(true);
    try {
      const [peopleResponse, locationsResponse] = await Promise.all([
        fetch("/api/personas", { cache: "no-store" }),
        fetch("/api/ubicaciones", { cache: "no-store" }),
      ]);

      if (!peopleResponse.ok) {
        throw new Error("No se pudieron cargar las personas");
      }

      if (!locationsResponse.ok) {
        throw new Error("No se pudieron cargar las ubicaciones");
      }

      const [peopleData, locationData] = await Promise.all([
        peopleResponse.json() as Promise<{ personas?: Person[] }>,
        locationsResponse.json() as Promise<{ ubicaciones?: Location[] }>,
      ]);

      setReferences({
        personas: peopleData.personas ?? [],
        ubicaciones: locationData.ubicaciones ?? [],
      });
    } catch (error) {
      console.error("Error al cargar referencias", error);
      toast({
        variant: "destructive",
        title: "No se pudieron cargar los datos auxiliares",
        description: "Intenta actualizar la página o verifica tu conexión.",
      });
    } finally {
      setLoadingReferences(false);
    }
  }, []);

  useEffect(() => {
    void loadKeys();
    void loadReferences();
  }, [loadKeys, loadReferences]);

  const resetForm = useCallback(() => {
    form.reset(defaultKeyValues);
  }, [form]);

  const closeSheet = useCallback(() => {
    setIsSheetOpen(false);
    setEditingKey(null);
    resetForm();
  }, [resetForm]);

  const openCreateSheet = useCallback(() => {
    setEditingKey(null);
    resetForm();
    setIsSheetOpen(true);
  }, [resetForm]);

  const openEditSheet = useCallback((key: Key) => {
    setEditingKey(key);
    form.reset(keyToFormValues(key));
    setIsSheetOpen(true);
  }, [form]);

  const handleReorder = useCallback((next: Key[]) => {
    setKeys(next);
  }, []);

  const handleView = useCallback((item: Key) => {
    const details = [
      item.codigoActivo ? `Código: ${item.codigoActivo}` : null,
      item.rfidEpc ? `EPC: ${item.rfidEpc}` : null,
      `Estado: ${estadoLabels[item.estado]}`,
      item.custodioNombre ? `Custodio: ${item.custodioNombre}` : null,
      item.propietarioNombre ? `Propietario: ${item.propietarioNombre}` : null,
      item.ubicacionNombre ? `Ubicación: ${item.ubicacionNombre}` : null,
      item.zonaActual ? `Zona: ${item.zonaActual}` : null,
      item.valor ? `Valor: ${formatCurrency(item.valor)}` : null,
  item.fechaCompra ? `Creación: ${formatDateTime(item.fechaCompra)}` : null,
    ].filter(Boolean)
      .join(" · ");

    toast({
      title: item.nombre,
      description: details || "Sin información adicional",
    });
  }, []);

  const handleEdit = useCallback((item: Key) => {
    openEditSheet(item);
  }, [openEditSheet]);

  const handleDelete = useCallback(async (item: Key) => {
    if (processingId !== null) return;

    const confirmed = typeof window === "undefined"
      ? true
      : window.confirm(`Eliminar la llave "${item.nombre}"?`);

    if (!confirmed) return;

    setProcessingId(item.id);
    try {
      const response = await fetch(`/api/keys/${item.id}`, { method: "DELETE" });
      const raw = await response.text();
      const parsed = raw ? (JSON.parse(raw) as { llave?: Key; error?: string }) : {};
      if (!response.ok || !parsed.llave) {
        throw new Error(parsed.error ?? "No se pudo eliminar la llave");
      }

      setKeys((current) => current.filter((key) => key.id !== item.id));

      toast({
        title: "Llave eliminada",
        description: `${item.nombre} fue eliminada correctamente`,
      });
    } catch (error) {
      console.error("Error al eliminar llave", error);
      toast({
        variant: "destructive",
        title: "No se pudo eliminar",
        description: (error as Error).message,
      });
    } finally {
      setProcessingId(null);
    }
  }, [processingId]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        nombre: values.nombre.trim(),
        estado: values.estado,
      };

      const optionalStrings: Array<[string, string | undefined]> = [
        ["descripcion", values.descripcion],
        ["rfidEpc", values.rfidEpc],
        ["codigoActivo", values.codigoActivo],
        ["zonaActual", values.zonaActual],
        ["categoria", values.categoria],
        ["marca", values.marca],
        ["modelo", values.modelo],
        ["serial", values.serial],
        ["centroCosto", values.centroCosto],
      ];

      optionalStrings.forEach(([key, value]) => {
        if (typeof value === "string") {
          const trimmed = value.trim();
          if (trimmed) {
            payload[key] = trimmed;
          }
        }
      });

      if (typeof values.propietarioId === "number") {
        payload.propietarioId = values.propietarioId;
      }

      if (typeof values.custodioId === "number") {
        payload.custodioId = values.custodioId;
      }

      if (typeof values.ubicacionId === "number") {
        payload.ubicacionId = values.ubicacionId;
      }

      if (typeof values.valor === "number") {
        payload.valor = values.valor;
      }

      if (typeof values.vidaUtilMeses === "number") {
        payload.vidaUtilMeses = values.vidaUtilMeses;
      }

      if (values.fechaCompra) {
        const date = new Date(values.fechaCompra);
        if (!Number.isNaN(date.getTime())) {
          payload.fechaCompra = date.toISOString();
        }
      }

      const isEditing = Boolean(editingKey);
      const requestUrl = isEditing && editingKey
        ? `/api/keys/${editingKey.id}`
        : "/api/keys";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(requestUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const raw = await response.text();
      const parsed = raw ? (JSON.parse(raw) as { llave?: Key; error?: string }) : {};
      const llave = parsed.llave;

      if (!response.ok || !llave) {
        throw new Error(parsed.error ?? (isEditing ? "No se pudo actualizar la llave" : "No se pudo registrar la llave"));
      }

      setKeys((current) => {
        if (isEditing) {
          return current.map((item) => (item.id === llave.id ? llave : item));
        }
        return [llave, ...current];
      });

      toast({
        title: isEditing ? "Llave actualizada" : "Llave registrada",
        description: `${llave.nombre} se guardó correctamente`,
      });

      closeSheet();
    } catch (error) {
      console.error("Error al guardar llave", error);
      toast({
        variant: "destructive",
        title: "No se pudo guardar",
        description: (error as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  });

  const handleSheetOpenChange = useCallback((open: boolean) => {
    if (open) {
      setIsSheetOpen(true);
    } else {
      closeSheet();
    }
  }, [closeSheet]);

  const totalKeys = keys.length;
  const totalLabel = totalKeys === 1 ? "1 llave registrada" : `${totalKeys} llaves registradas`;

  const statusSummary = useMemo(() => {
    return keys.reduce(
      (acc, item) => {
        acc[item.estado] = (acc[item.estado] ?? 0) + 1;
        return acc;
      },
      { activo: 0, extraviado: 0, baja: 0 } as Record<Key["estado"], number>,
    );
  }, [keys]);

  const sheetTitle = editingKey ? "Editar llave" : "Registrar llave";
  const sheetDescription = editingKey
    ? "Actualiza la información de la llave seleccionada."
    : "Completa los detalles para registrar una nueva llave.";

  return (
    <>
      <div className="space-y-6">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="size-5" /> Inventario de llaves
            </CardTitle>
            <CardDescription>{totalLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {estadoOptions.map((option) => (
                <div key={option.value} className="rounded-lg border bg-muted/20 p-4">
                  <p className="text-muted-foreground text-sm">{option.label}</p>
                  <p className="text-foreground text-2xl font-semibold">
                    {statusSummary[option.value] ?? 0}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">Llaves registradas</CardTitle>
              <CardDescription>Gestiona las llaves usando la tabla y abre el panel para crear o editar.</CardDescription>
            </div>
            <Button onClick={openCreateSheet} disabled={submitting} className="lg:ml-auto">
              <ArrowUpRight className="mr-2 size-4" /> Registrar llave
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : keys.length === 0 ? (
              <Empty className="border border-dashed">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <KeyRound className="size-5" />
                  </EmptyMedia>
                  <EmptyTitle>No hay llaves registradas</EmptyTitle>
                  <EmptyDescription>Registra la primera llave para comenzar a controlar el inventario.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={openCreateSheet} variant="outline">
                    Registrar llave
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <KeysTable
                data={keys}
                loading={loading}
                onReorder={handleReorder}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
                formatCurrency={formatCurrency}
                formatDate={(value) => formatDateTime(value)}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent className="sm:max-w-xl">
          <Form {...form}>
            <form onSubmit={onSubmit} className="flex h-full flex-col">
              <SheetHeader className="border-b pb-4">
                <SheetTitle>{sheetTitle}</SheetTitle>
                <SheetDescription>{sheetDescription}</SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="nombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. Llave principal" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="descripcion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción</FormLabel>
                        <FormControl>
                          <Textarea rows={3} placeholder="Detalles adicionales" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormDescription>Opcional, máximo 500 caracteres.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="estado"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un estado" />
                              </SelectTrigger>
                              <SelectContent>
                                {estadoOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="fechaCompra"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fecha de creación</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormDescription>Opcional, registra cuándo se creó la llave.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="rfidEpc"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Etiqueta RFID (EPC)</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej. 9000..." maxLength={24} {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormDescription>Debe ser única y contener 24 caracteres.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="codigoActivo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Código de activo</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej. ACT-001" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="propietarioId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Propietario</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value ? String(field.value) : UNASSIGNED_VALUE}
                              onValueChange={(value) => field.onChange(value === UNASSIGNED_VALUE ? undefined : Number(value))}
                              disabled={loadingReferences}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={loadingReferences ? "Cargando..." : "Selecciona una persona"} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={UNASSIGNED_VALUE}>Sin propietario</SelectItem>
                                {references.personas.map((person) => (
                                  <SelectItem key={person.id} value={String(person.id)}>
                                    {person.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormDescription>Opcional, asigna la llave a un responsable.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="custodioId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Custodio</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value ? String(field.value) : UNASSIGNED_VALUE}
                              onValueChange={(value) => field.onChange(value === UNASSIGNED_VALUE ? undefined : Number(value))}
                              disabled={loadingReferences}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={loadingReferences ? "Cargando..." : "Selecciona una persona"} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={UNASSIGNED_VALUE}>Sin custodio</SelectItem>
                                {references.personas.map((person) => (
                                  <SelectItem key={person.id} value={String(person.id)}>
                                    {person.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormDescription>Opcional, indica quién custodia la llave.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="ubicacionId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ubicación</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value ? String(field.value) : UNASSIGNED_VALUE}
                            onValueChange={(value) => field.onChange(value === UNASSIGNED_VALUE ? undefined : Number(value))}
                            disabled={loadingReferences}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={loadingReferences ? "Cargando..." : "Selecciona una ubicación"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={UNASSIGNED_VALUE}>Sin ubicación</SelectItem>
                              {references.ubicaciones.map((location) => (
                                <SelectItem key={location.id} value={String(location.id)}>
                                  {location.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="zonaActual"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zona actual</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. Piso 2 - Oficina" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="categoria"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoría</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej. Seguridad" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="marca"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Marca</FormLabel>
                          <FormControl>
                            <Input placeholder="Marca del candado" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="modelo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Modelo</FormLabel>
                          <FormControl>
                            <Input placeholder="Modelo del elemento" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="serial"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Serial</FormLabel>
                          <FormControl>
                            <Input placeholder="Número de serie" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="valor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor estimado</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(event) => field.onChange(event.target.value)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="vidaUtilMeses"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vida útil (meses)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(event) => field.onChange(event.target.value)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="centroCosto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Centro de costo</FormLabel>
                        <FormControl>
                          <Input placeholder="Centro asociado" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <SheetFooter className="border-t">
                <div className="flex w-full items-center justify-between gap-2">
                  <SheetClose asChild>
                    <Button type="button" variant="outline" disabled={submitting} onClick={closeSheet}>
                      Cancelar
                    </Button>
                  </SheetClose>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Spinner className="mr-2 size-4" /> Guardando...
                      </>
                    ) : (
                      editingKey ? "Guardar cambios" : "Registrar llave"
                    )}
                  </Button>
                </div>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    </>
  );
}
