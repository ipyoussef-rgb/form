import { readSession } from "../lib/auth";
import { repositories } from "@repo/shared";
import { ChatClient } from "./components/ChatClient";

export default async function Home() {
  const session = await readSession();
  const sub = String(session?.sub ?? "");
  const messages = repositories.chat.list(sub);
  return <main><h1 className="text-2xl font-bold mb-4">Chat / Faxversand</h1><ChatClient initial={messages} /></main>;
}
