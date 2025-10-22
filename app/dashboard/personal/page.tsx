"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CirclePlus, Users } from "lucide-react";

import { PersonalTable } from "@/components/personal/personal-table";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
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
import { formatDateTime, formatValidity } from "@/lib/formatters";
import type { Person } from "@/types/person";
import { formSchema, type FormSchema } from "./personal-form-schema";

const defaultPersonValues: FormSchema = {
	nombre: "",
	documento: "",
	rfidEpc: "",
	habilitado: true,
	habilitadoDesde: "",
	habilitadoHasta: "",
};

function toDateTimeLocal(value: string | null): string {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	const offsetMinutes = date.getTimezoneOffset();
	const localDate = new Date(date.getTime() - offsetMinutes * 60000);
	return localDate.toISOString().slice(0, 16);
}

function personToFormValues(person: Person): FormSchema {
	return {
		nombre: person.nombre,
		documento: person.documento ?? "",
		rfidEpc: person.rfidEpc ?? "",
		habilitado: person.habilitado,
		habilitadoDesde: toDateTimeLocal(person.habilitadoDesde),
		habilitadoHasta: toDateTimeLocal(person.habilitadoHasta),
	};
}

function toIsoString(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return undefined;
	return date.toISOString();
}

export default function PersonalPage() {
	const [people, setPeople] = useState<Person[]>([]);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [processingId, setProcessingId] = useState<number | null>(null);
	const [isSheetOpen, setIsSheetOpen] = useState(false);
	const [editingPerson, setEditingPerson] = useState<Person | null>(null);

	const form = useForm<FormSchema>({
		resolver: zodResolver(formSchema),
		defaultValues: defaultPersonValues,
	});

	const loadPeople = useCallback(async () => {
		setLoading(true);
		try {
			const response = await fetch("/api/personas", { cache: "no-store" });
			if (!response.ok) {
				throw new Error("Respuesta no válida del servidor");
			}
			const data = (await response.json()) as { personas?: Person[] };
			setPeople(data.personas ?? []);
		} catch (error) {
			console.error("Error al cargar personas", error);
			toast({
				variant: "destructive",
				title: "No se pudieron cargar las personas",
				description: "Revisa la conexión o intenta nuevamente.",
			});
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadPeople();
	}, [loadPeople]);

	const resetForm = useCallback(() => {
		form.reset(defaultPersonValues);
	}, [form]);

	const closeSheet = useCallback(() => {
		setIsSheetOpen(false);
		setEditingPerson(null);
		resetForm();
	}, [resetForm]);

	const openCreateSheet = useCallback(() => {
		setEditingPerson(null);
		resetForm();
		setIsSheetOpen(true);
	}, [resetForm]);

	const openEditSheet = useCallback((person: Person) => {
		setEditingPerson(person);
		form.reset(personToFormValues(person));
		setIsSheetOpen(true);
	}, [form]);

	const handleReorder = useCallback((next: Person[]) => {
		setPeople(next);
	}, []);

	const handleView = useCallback((person: Person) => {
		const details = [
			person.documento ? `Documento: ${person.documento}` : null,
			person.rfidEpc ? `EPC: ${person.rfidEpc}` : null,
			person.habilitadoDesde ? `Desde: ${formatDateTime(person.habilitadoDesde)}` : null,
			person.habilitadoHasta ? `Hasta: ${formatDateTime(person.habilitadoHasta)}` : null,
			`Estado: ${person.habilitado ? "Habilitado" : "Suspendido"}`,
		]
			.filter(Boolean)
			.join(" · ");

		toast({
			title: person.nombre,
			description: details || "Sin información adicional",
		});
	}, []);

	const handleEdit = useCallback((person: Person) => {
		openEditSheet(person);
	}, [openEditSheet]);

	const handleDelete = useCallback(async (person: Person) => {
		if (processingId !== null) return;

		const confirmed = typeof window === "undefined"
			? true
			: window.confirm(`Eliminar a ${person.nombre}?`);

		if (!confirmed) return;

		setProcessingId(person.id);
		try {
			const response = await fetch(`/api/personas/${person.id}`, { method: "DELETE" });
			const raw = await response.text();
			const parsed = raw ? (JSON.parse(raw) as { persona?: Person; error?: string }) : {};
			if (!response.ok || !parsed.persona) {
				throw new Error(parsed.error ?? "No se pudo eliminar a la persona");
			}

			setPeople((current) => current.filter((item) => item.id !== person.id));

			toast({
				title: "Persona eliminada",
				description: `${person.nombre} fue eliminada correctamente`,
			});
		} catch (error) {
			console.error("Error al eliminar persona", error);
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
				habilitado: values.habilitado,
			};

			if (values.documento?.trim()) {
				payload.documento = values.documento.trim();
			}

			if (values.rfidEpc?.trim()) {
				payload.rfidEpc = values.rfidEpc.trim();
			}

			const sinceIso = toIsoString(values.habilitadoDesde);
			if (sinceIso) {
				payload.habilitadoDesde = sinceIso;
			}

			const untilIso = toIsoString(values.habilitadoHasta);
			if (untilIso) {
				payload.habilitadoHasta = untilIso;
			}

			const isEditing = Boolean(editingPerson);
			const requestUrl = isEditing && editingPerson
				? `/api/personas/${editingPerson.id}`
				: "/api/personas";
			const method = isEditing ? "PATCH" : "POST";

			const response = await fetch(requestUrl, {
				method,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const raw = await response.text();
			const parsed = raw ? (JSON.parse(raw) as { persona?: Person; error?: string }) : {};
			const persona = parsed.persona;

			if (!response.ok || !persona) {
				throw new Error(
					parsed.error ?? (isEditing ? "No se pudo actualizar a la persona" : "No se pudo registrar a la persona"),
				);
			}

			setPeople((current) => {
				if (isEditing) {
					return current.map((item) => (item.id === persona.id ? persona : item));
				}
				return [persona, ...current];
			});

			toast({
				title: isEditing ? "Persona actualizada" : "Persona registrada",
				description: `${persona.nombre} se guardó correctamente`,
			});

			closeSheet();
		} catch (error) {
			console.error("Error al guardar persona", error);
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

	const totalPeople = people.length;
	const totalLabel = totalPeople === 1 ? "1 persona registrada" : `${totalPeople} personas registradas`;

	const statusSummary = useMemo(() => {
		return people.reduce(
			(acc, person) => {
				if (person.habilitado) {
					acc.habilitados += 1;
				} else {
					acc.suspendidos += 1;
				}
				if (person.rfidEpc) {
					acc.conRfid += 1;
				}
				return acc;
			},
			{ habilitados: 0, suspendidos: 0, conRfid: 0 },
		);
	}, [people]);

	const sheetTitle = editingPerson ? "Editar persona" : "Registrar persona";
	const sheetDescription = editingPerson
		? "Actualiza la información de la persona seleccionada."
		: "Completa los datos para registrar a una nueva persona.";

	return (
		<>
			<div className="space-y-6">
				<Card className="border-border/60">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-lg">
							<Users className="size-5" /> Personal
						</CardTitle>
						<CardDescription>{totalLabel}</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid gap-3 sm:grid-cols-3">
							<div className="rounded-lg border bg-muted/20 p-4">
								<p className="text-muted-foreground text-sm">Habilitados</p>
								<p className="text-foreground text-2xl font-semibold">{statusSummary.habilitados}</p>
							</div>
							<div className="rounded-lg border bg-muted/20 p-4">
								<p className="text-muted-foreground text-sm">Suspendidos</p>
								<p className="text-foreground text-2xl font-semibold">{statusSummary.suspendidos}</p>
							</div>
							<div className="rounded-lg border bg-muted/20 p-4">
								<p className="text-muted-foreground text-sm">Con RFID asignado</p>
								<p className="text-foreground text-2xl font-semibold">{statusSummary.conRfid}</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card className="border-border/60">
					<CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
						<div className="space-y-1">
							<CardTitle className="text-lg">Personal registrado</CardTitle>
							<CardDescription>Gestiona el personal y abre el panel para crear o actualizar registros.</CardDescription>
						</div>
						<Button onClick={openCreateSheet} disabled={submitting} className="lg:ml-auto">
							<CirclePlus className="mr-2 size-4" /> Registrar persona
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
						) : people.length === 0 ? (
							<Empty className="border border-dashed">
								<EmptyHeader>
									<EmptyMedia variant="icon">
										<Users className="size-5" />
									</EmptyMedia>
									<EmptyTitle>No hay personas registradas</EmptyTitle>
									<EmptyDescription>Registra el primer miembro del personal para comenzar a controlar accesos.</EmptyDescription>
								</EmptyHeader>
								<EmptyContent>
									<Button onClick={openCreateSheet} variant="outline">
										Registrar persona
									</Button>
								</EmptyContent>
							</Empty>
						) : (
							<PersonalTable
								data={people}
								loading={loading}
								onReorder={handleReorder}
								onView={handleView}
								onEdit={handleEdit}
								onDelete={handleDelete}
								formatValidity={formatValidity}
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
												<FormLabel>Nombre completo</FormLabel>
												<FormControl>
													<Input placeholder="Ej. Ana Martínez" {...field} value={field.value ?? ""} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="documento"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Documento</FormLabel>
												<FormControl>
													<Input placeholder="Número de documento" {...field} value={field.value ?? ""} />
												</FormControl>
												<FormDescription>Opcional, útil para búsquedas.</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="rfidEpc"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Etiqueta RFID (EPC)</FormLabel>
												<FormControl>
													<Input placeholder="24-BD-9C-..." {...field} value={field.value ?? ""} />
												</FormControl>
												<FormDescription>Debe ser única dentro del sistema.</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="habilitado"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between rounded-lg border px-4 py-3">
												<div className="space-y-0.5">
													<FormLabel>Acceso habilitado</FormLabel>
													<FormDescription>Controla si la persona puede usar su credencial.</FormDescription>
												</div>
												<FormControl>
													<Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Habilitar acceso" />
												</FormControl>
											</FormItem>
										)}
									/>

									<div className="grid gap-4 sm:grid-cols-2">
										<FormField
											control={form.control}
											name="habilitadoDesde"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Válido desde</FormLabel>
													<FormControl>
														<Input type="datetime-local" {...field} value={field.value ?? ""} />
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="habilitadoHasta"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Válido hasta</FormLabel>
													<FormControl>
														<Input type="datetime-local" {...field} value={field.value ?? ""} />
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>
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
											editingPerson ? "Guardar cambios" : "Registrar persona"
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

