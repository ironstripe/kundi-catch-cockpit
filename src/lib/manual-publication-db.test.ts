import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PGlite();
beforeAll(async () => {
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
    CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.admin', true) = 'true' $$;
    CREATE TABLE public.catches (id uuid PRIMARY KEY, status text, sample_check_status text,
      purchase_quantity numeric DEFAULT 0, cancellation_reason text, reopen_reason text,
      CONSTRAINT catches_quantity_positive_when_ready CHECK (status IN ('draft','cancelled') OR purchase_quantity > 0));
    CREATE TABLE public.audit_events (entity_type text, entity_id uuid, action text, reason text, payload jsonb, actor_id uuid);
  `);
  await db.exec(
    readFileSync("drizzle/migrations/0001_optional_quality_manual_publication.sql", "utf8"),
  );
  await db.exec(
    `CREATE TRIGGER lifecycle BEFORE UPDATE ON public.catches FOR EACH ROW EXECUTE FUNCTION public.enforce_catch_status_transition();`,
  );
}, 30000);
afterAll(() => db.close());
let counter = 1;
async function row(status = "draft", sample = "pending", quantity = 0) {
  const id = `00000000-0000-0000-0001-${String(counter++).padStart(12, "0")}`;
  await db.query(
    "INSERT INTO catches(id,status,sample_check_status,purchase_quantity) VALUES ($1,$2,$3,$4)",
    [id, status, sample, quantity],
  );
  return id;
}
describe("actual migration in isolated PostgreSQL (no production records)", () => {
  it.each(["pending", "failed", "passed"])(
    "draft with %s sample, no reviews and zero/unknown quantity publishes truthfully",
    async (sample) => {
      const id = await row("draft", sample);
      await db.query("UPDATE catches SET status='published' WHERE id=$1", [id]);
      const result = await db.query("SELECT status,sample_check_status FROM catches WHERE id=$1", [
        id,
      ]);
      expect(result.rows).toEqual([{ status: "published", sample_check_status: sample }]);
      const audit = await db.query("SELECT payload FROM audit_events WHERE entity_id=$1", [id]);
      expect(audit.rows).toEqual([
        {
          payload: {
            previous: { status: "draft" },
            next: { status: "published" },
            summary: "draft → published",
          },
        },
      ]);
    },
  );
  it("ready no longer needs a quality round, but still requires positive quantity", async () => {
    const id = await row("draft", "failed", 1);
    await db.query("UPDATE catches SET status='ready' WHERE id=$1", [id]);
    const empty = await row();
    await expect(
      db.query("UPDATE catches SET status='ready' WHERE id=$1", [empty]),
    ).rejects.toThrow("catches_quantity_positive_when_ready");
  });
  it("closed/cancelled transitions and reopening reason/admin rules remain enforced", async () => {
    const cancelled = await row("cancelled");
    await expect(
      db.query("UPDATE catches SET status='published' WHERE id=$1", [cancelled]),
    ).rejects.toThrow("nicht zulässig");
    const closed = await row("closed", "pending", 1);
    await db.exec("SET test.admin='false'");
    await expect(
      db.query("UPDATE catches SET status='published',reopen_reason='Korrektur' WHERE id=$1", [
        closed,
      ]),
    ).rejects.toThrow("Nur Administratoren");
    await db.exec("SET test.admin='true'");
    await expect(
      db.query("UPDATE catches SET status='published' WHERE id=$1", [closed]),
    ).rejects.toThrow("Grund erforderlich");
    await expect(
      db.query("UPDATE catches SET status='draft' WHERE id=$1", [closed]),
    ).rejects.toThrow("nicht zulässig");
    const empty = await row();
    await db.query("UPDATE catches SET status='published' WHERE id=$1", [empty]);
    await expect(
      db.query("UPDATE catches SET status='closed' WHERE id=$1", [empty]),
    ).rejects.toThrow("catches_quantity_positive_when_ready");
  });
});
