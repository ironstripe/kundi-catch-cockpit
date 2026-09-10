import { processOfferAttachmentContents } from "@/lib/supplier-offer-content.server";
import { extractOfferFields, emailSource, emailPlainText } from "@/lib/supplier-offer-ai.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const offerId = "e7f8a58a-d471-48b8-970e-0b80f6f3a0a7";
const res = await processOfferAttachmentContents(supabaseAdmin as any, offerId, { force: true });
console.log("read", res.read, "failed", res.failed);
for (const s of res.sources) console.log("SOURCE", s.source_type, s.source_name, s.truncated, s.text.slice(0, 200).replace(/\n/g, " | "));
const { data: offer } = await supabaseAdmin.from("supplier_offer_emails").select("subject, text_body, html_body, forwarded_by_email").eq("id", offerId).single();
const out = await extractOfferFields({
  subject: offer!.subject,
  from: offer!.forwarded_by_email,
  sources: [emailSource(offer!.subject, emailPlainText(offer!.text_body, offer!.html_body)), ...res.sources],
});
console.log(JSON.stringify(out.findings));
for (const [k, v] of Object.entries(out.data)) if (v && v.value !== null) console.log(k, "=", v.value, "|", v.source_name);
