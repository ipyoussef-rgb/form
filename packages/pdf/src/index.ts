import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { VollmachtInput } from "@repo/shared";

export async function generateVollmachtPdf(input: VollmachtInput) {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Vollmacht");
  pdf.setLanguage("de-DE");
  pdf.setProducer("KOBIL Monorepo Demo");
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 780;
  page.drawText("Vollmacht", { x: 50, y, size: 24, font: bold, color: rgb(0, 0, 0) });
  y -= 50;
  const body = [
    "Hiermit bevollmächtige ich,",
    "",
    `${input.firstName} ${input.lastName}`,
    input.address,
    `Geburtsdatum: ${input.birthday}`,
    "",
    "die nachfolgend benannte Vollmacht gegenüber den jeweils zuständigen Stellen zu verwenden,",
    "soweit dies im Rahmen des vorgesehenen Verwaltungs- oder Kommunikationsprozesses erforderlich ist.",
    "",
    "Ort, Datum: ______________________",
    "Unterschrift Vollmachtgeber/in: ______________________"
  ];
  for (const line of body) {
    page.drawText(line, { x: 50, y, size: 12, font, color: rgb(0, 0, 0) });
    y -= 24;
  }
  return pdf.save();
}
