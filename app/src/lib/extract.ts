import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

const ExtractedNote = z.object({
  bl_number: z.string().nullable().describe('Numéro BC/BL, e.g. "BL00030715"'),
  delivery_date: z.string().nullable().describe("Date Livraison as YYYY-MM-DD"),
  total: z.number().nullable().describe('"Montant" in DH, null if absent or masked'),
  lines: z.array(
    z.object({
      designation: z.string().describe("Désignation, copied exactly as printed"),
      qty: z.number(),
      unit_price: z.number().describe("P.U. in DH"),
      amount: z.number().nullable().describe("Montant column in DH"),
    }),
  ),
});
export type ExtractedNote = z.infer<typeof ExtractedNote>;

const PROMPT = `These photos are the printed sheets of one delivery note ("Bon de livraison") from a pastry factory to a shop. Several sheets can belong to the same note.

Transcribe every product line from every sheet, in order. Copy each value exactly as printed, even when it looks wrong: the shop uses this transcription to catch the factory's quantity, price and arithmetic mistakes, so never correct a figure. Numbers use a comma as the decimal separator ("4,70" is 4.70).

Take the note number, delivery date and the "Montant" total from whichever sheet shows them. Use null for anything unreadable or masked (e.g. "XXXXXX").`;

export async function extractDeliveryNote(images: { data: Buffer; mediaType: "image/jpeg" | "image/png" | "image/webp" }[]) {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(ExtractedNote) },
    messages: [
      {
        role: "user",
        content: [
          ...images.map((img) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: img.mediaType, data: img.data.toString("base64") },
          })),
          { type: "text" as const, text: PROMPT },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("unreadable");
  }
  return response.parsed_output;
}
