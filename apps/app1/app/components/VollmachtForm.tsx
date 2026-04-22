"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { vollmachtInputSchema, type VollmachtInput } from "@repo/shared";

export function VollmachtForm({ defaults }: { defaults: VollmachtInput }) {
  const [status, setStatus] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<VollmachtInput>({ defaultValues: defaults });
  const onSubmit = async (values: VollmachtInput) => {
    const parsed = vollmachtInputSchema.safeParse(values);
    if (!parsed.success) {
      setStatus("Bitte korrigieren Sie die Eingaben.");
      return;
    }
    setStatus("Wird verarbeitet...");
    const c = await fetch("/api/documents/create", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(values) });
    const data = await c.json();
    if (!c.ok) return setStatus(data.error || "Fehler bei PDF-Erstellung");
    setPreviewUrl(data.document.fileUrl);
    const h = await fetch("/api/handoff/send-to-app2", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ documentId: data.document.id }) });
    if (!h.ok) return setStatus("Handoff an App2 fehlgeschlagen");
    setStatus("Ihre Datei ist jetzt im Chat zum Faxversand bereit.");
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 bg-white p-6 rounded shadow max-w-xl" aria-label="Vollmacht Formular">
      {([ ["firstName", "Vorname"], ["lastName", "Nachname"], ["birthday", "Geburtstag"], ["address", "Adresse"] ] as const).map(([k, l]) => (
        <label key={k} className="block">
          <span className="font-medium">{l}</span>
          <input {...register(k)} className="mt-1 w-full border rounded px-2 py-1" />
          {errors[k] && <p className="text-red-700 text-sm">{errors[k]?.message}</p>}
        </label>
      ))}
      <button className="bg-blue-700 text-white px-4 py-2 rounded" disabled={isSubmitting}>PDF erzeugen</button>
      {status && <p className="font-semibold">{status} <a className="underline ml-2" href={process.env.NEXT_PUBLIC_APP2_URL || "http://localhost:3002"}>Zum Chat</a></p>}
      {previewUrl && <a className="underline" href={previewUrl} target="_blank">PDF Vorschau öffnen</a>}
    </form>
  );
}
