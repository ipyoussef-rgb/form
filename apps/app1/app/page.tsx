import { readSession } from "../lib/auth";
import { mapProfileToForm, oidcProfileSchema } from "@repo/shared";
import { VollmachtForm } from "./components/VollmachtForm";

export default async function Home() {
  const session = await readSession();
  const parsed = oidcProfileSchema.safeParse(session?.profile ?? { sub: "" });
  const defaults = mapProfileToForm(parsed.success ? parsed.data : { sub: "" });
  return <main><h1 className="text-2xl font-bold mb-4">Vollmacht erstellen</h1><VollmachtForm defaults={defaults} /></main>;
}
