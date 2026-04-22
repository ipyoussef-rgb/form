"use client";
import { useState } from "react";

type Msg = { id: string; createdAt: string; body: string; attachment?: { id: string; filename: string; mimeType: string; createdAt: string; size?: number; fileUrl: string } };

export function ChatClient({ initial }: { initial: Msg[] }) {
  const [messages, setMessages] = useState(initial);
  const [faxNumber, setFaxNumber] = useState("+491234567890");
  const [state, setState] = useState("");
  const [txByDoc, setTxByDoc] = useState<Record<string, string>>({});

  const createPayment = async (documentId: string) => {
    const idempotencyId = `fax-${documentId}`;
    setState("payment pending");
    const pay = await fetch("/api/pay/create-transaction", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyId, amountCents: 199, currency: "EUR", documentId }) });
    const payData = await pay.json();
    if (!pay.ok) return setState("payment failed");
    setTxByDoc((prev) => ({ ...prev, [documentId]: payData.transactionId }));
    if (payData.checkoutUrl) {
      window.open(payData.checkoutUrl, "_blank", "noopener,noreferrer");
      setState("payment checkout opened");
    }
  };

  const verifyPayment = async (documentId: string) => {
    const transactionId = txByDoc[documentId];
    if (!transactionId) {
      setState("no payment transaction");
      return;
    }
    const response = await fetch("/api/pay/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transactionId })
    });
    if (!response.ok) return setState("payment status check failed");
    const data = await response.json();
    setState(`payment ${data.status}`);
  };

  const sendFax = async (documentId: string) => {
    const transactionId = txByDoc[documentId];
    if (!transactionId) return setState("payment required");
    const fax = await fetch("/api/fax/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ documentId, transactionId, to: faxNumber }) });
    if (!fax.ok) return setState("fax failed");
    setState("fax sent");
    setMessages((m) => [...m, { id: crypto.randomUUID(), createdAt: new Date().toISOString(), body: "Das Dokument wurde erfolgreich per Fax versendet." }]);
  };

  return <div className="space-y-4">
    <label className="block">Faxnummer<input className="border rounded px-2 py-1 ml-2" value={faxNumber} onChange={(e)=>setFaxNumber(e.target.value)} /></label>
    {messages.map((m)=><div key={m.id} className="bg-white p-4 rounded shadow"><p>{m.body}</p>{m.attachment && <div className="mt-2 border p-2 rounded"><p>{m.attachment.filename}</p><p>{m.attachment.mimeType}</p><p>{new Date(m.attachment.createdAt).toLocaleString("de-DE")}</p><p>{m.attachment.size ? `${m.attachment.size} Bytes` : "Größe unbekannt"}</p><div className="mt-2 flex gap-2"><button className="bg-slate-700 text-white px-3 py-1 rounded" onClick={()=>createPayment(m.attachment!.id)}>Start Payment</button><button className="bg-amber-600 text-white px-3 py-1 rounded" onClick={()=>verifyPayment(m.attachment!.id)}>Check Payment</button><button className="bg-blue-700 text-white px-3 py-1 rounded" onClick={()=>sendFax(m.attachment!.id)}>Send to Fax</button></div></div>}</div>)}
    {state && <p className="font-medium">Status: {state}</p>}
  </div>;
}
