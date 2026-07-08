/**
 * Renumbers every father's children to spaced birth_order values (1000, 2000, …)
 * preserving each sibling set's current relative order.
 *
 * Usage: bun run scripts/renumber-sibling-birth-order.ts
 */
import { asc, eq, isNotNull } from "drizzle-orm";

import { getDb } from "../src/db/index.server";
import { familyMembers } from "../src/db/schema";
import { SIBLING_BIRTH_ORDER_SPACING } from "../src/lib/sibling-order";
import { ensureDatabaseUrl } from "./database-url";

async function main() {
  ensureDatabaseUrl();
  const db = getDb();

  const fatherRows = await db
    .selectDistinct({ fatherId: familyMembers.fatherId })
    .from(familyMembers)
    .where(isNotNull(familyMembers.fatherId));

  let updated = 0;

  for (const { fatherId } of fatherRows) {
    if (fatherId == null) continue;

    const children = await db
      .select({ id: familyMembers.id, birthOrder: familyMembers.birthOrder })
      .from(familyMembers)
      .where(eq(familyMembers.fatherId, fatherId))
      .orderBy(asc(familyMembers.birthOrder), asc(familyMembers.fullName));

    for (let index = 0; index < children.length; index++) {
      const nextOrder = (index + 1) * SIBLING_BIRTH_ORDER_SPACING;
      if (children[index].birthOrder === nextOrder) continue;
      await db
        .update(familyMembers)
        .set({ birthOrder: nextOrder, updatedAt: new Date() })
        .where(eq(familyMembers.id, children[index].id));
      updated++;
    }
  }

  console.log(`✓ Renumbered birth_order for ${updated} child row(s)`);
}

main().catch((err) => {
  console.error("Renumber failed:", err);
  process.exit(1);
});
