/**
 * Seed rich test families: multi-wife, alive/dead, in-kin / out-of-kin.
 * Usage:
 *   bun run db:seed-test-family
 *   bun run db:seed-test-family -- --force   # remove prior test seed and re-run
 */
import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "../src/db/index.server";
import { familyMembers, memberWives } from "../src/db/schema";
import { computeLineageFields } from "../src/lib/lineage-compute.server";
import { ensureDatabaseUrl } from "./database-url";

const MARKER = "Test Seed";

type Row = typeof familyMembers.$inferSelect;

async function byName(name: string): Promise<Row | null> {
  const db = getDb();
  const [row] = await db.select().from(familyMembers).where(eq(familyMembers.fullName, name)).limit(1);
  return row ?? null;
}

async function insertMember(input: {
  fullName: string;
  gender: "male" | "female";
  fatherId?: number | null;
  motherId?: number | null;
  isAlive?: boolean;
  birthYear?: number | null;
  deathYear?: number | null;
  birthOrder?: number | null;
  currentLocation?: string | null;
}): Promise<Row> {
  const db = getDb();
  const father = input.fatherId ? await byId(input.fatherId) : null;
  const mother = input.motherId ? await byId(input.motherId) : null;
  const lineage = computeLineageFields(input.fullName, false, father, mother);

  const [row] = await db
    .insert(familyMembers)
    .values({
      fullName: input.fullName,
      gender: input.gender,
      fatherId: input.fatherId ?? null,
      motherId: input.motherId ?? null,
      isAlive: input.isAlive ?? true,
      isApproved: true,
      isInKin: lineage.isInKin,
      generationLevel: lineage.generationLevel,
      lineagePathFather: lineage.lineagePathFather,
      lineagePathMother: lineage.lineagePathMother,
      birthYear: input.birthYear ?? null,
      deathYear: input.deathYear ?? null,
      birthOrder: input.birthOrder ?? null,
      currentLocation: input.currentLocation ?? null,
      submittedBy: MARKER,
    })
    .returning();
  return row;
}

async function byId(id: number): Promise<Row | null> {
  const db = getDb();
  const [row] = await db.select().from(familyMembers).where(eq(familyMembers.id, id)).limit(1);
  return row ?? null;
}

async function linkMarriage(husbandId: number, wifeId: number): Promise<void> {
  const db = getDb();
  await db
    .insert(memberWives)
    .values({ husbandId, wifeId })
    .onConflictDoNothing({ target: [memberWives.husbandId, memberWives.wifeId] });
}

async function clearTestSeed(): Promise<number> {
  const db = getDb();
  const rows = await db.select().from(familyMembers).where(eq(familyMembers.submittedBy, MARKER));
  if (rows.length === 0) return 0;

  const ids = rows.map((r) => r.id);
  await db.delete(memberWives).where(inArray(memberWives.husbandId, ids));
  await db.delete(memberWives).where(inArray(memberWives.wifeId, ids));

  const sorted = [...rows].sort((a, b) => b.generationLevel - a.generationLevel);
  for (const row of sorted) {
    await db.delete(familyMembers).where(eq(familyMembers.id, row.id));
  }
  return rows.length;
}

async function alreadySeeded(): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: familyMembers.id })
    .from(familyMembers)
    .where(and(eq(familyMembers.submittedBy, MARKER), eq(familyMembers.fullName, "Test Gen9 Baby")))
    .limit(1);
  return !!row;
}

export async function seedTestFamilies(force = false): Promise<void> {
  const root = await byName("Qadi Yonis");
  if (!root) throw new Error('Root "Qadi Yonis" not found — run db:setup first.');

  const ahmed = await byName("Ahmed");
  const abdosh = await byName("Abdosh");
  const teweleda = await byName("Teweleda");
  const abdulhamid = await byName("Abdulhamid");
  if (!ahmed || !abdosh || !teweleda || !abdulhamid) {
    throw new Error("Base lineage (Ahmed → Abdulhamid) missing — run db:setup first.");
  }

  if (force) {
    const removed = await clearTestSeed();
    if (removed > 0) console.log(`Removed ${removed} prior test members.`);
  } else if (await alreadySeeded()) {
    console.log("Test family seed already present — skipping (use --force to re-seed).");
    return;
  }

  // Extra son of root — supplies in-kin wives for Ahmed (endogamy)
  const ibrahim = await insertMember({
    fullName: "Test Ibrahim",
    gender: "male",
    fatherId: root.id,
    isAlive: false,
    birthYear: 1895,
    deathYear: 1970,
    currentLocation: "Harar",
  });

  // Qadi Yonis: two wives (Melika/Muna) with interleaved global child order a..i
  const melika = await insertMember({
    fullName: "Test Melika",
    gender: "female",
    fatherId: ibrahim.id,
    isAlive: false,
    birthYear: 1902,
    deathYear: 1980,
    currentLocation: "Harar",
  });
  const muna = await insertMember({
    fullName: "Test Muna",
    gender: "female",
    fatherId: ibrahim.id,
    isAlive: false,
    birthYear: 1905,
    deathYear: 1991,
    currentLocation: "Harar",
  });
  await linkMarriage(root.id, melika.id);
  await linkMarriage(root.id, muna.id);

  const qadiKids = [
    { fullName: "Test a", motherId: muna.id, birthOrder: 1, birthYear: 1928, gender: "male" as const },
    { fullName: "Test b", motherId: melika.id, birthOrder: 2, birthYear: 1930, gender: "male" as const },
    { fullName: "Test c", motherId: muna.id, birthOrder: 3, birthYear: 1932, gender: "female" as const },
    { fullName: "Test d", motherId: melika.id, birthOrder: 4, birthYear: 1934, gender: "male" as const },
    { fullName: "Test e", motherId: muna.id, birthOrder: 5, birthYear: 1936, gender: "female" as const },
    { fullName: "Test f", motherId: melika.id, birthOrder: 6, birthYear: 1938, gender: "male" as const },
    { fullName: "Test g", motherId: muna.id, birthOrder: 7, birthYear: 1940, gender: "male" as const },
    { fullName: "Test h", motherId: melika.id, birthOrder: 8, birthYear: 1942, gender: "female" as const },
    { fullName: "Test i", motherId: muna.id, birthOrder: 9, birthYear: 1944, gender: "male" as const },
  ];
  const insertedQadiKids: Record<string, Row> = {};
  for (const kid of qadiKids) {
    insertedQadiKids[kid.fullName] = await insertMember({
      fullName: kid.fullName,
      gender: kid.gender,
      fatherId: root.id,
      motherId: kid.motherId,
      isAlive: false,
      birthYear: kid.birthYear,
      birthOrder: kid.birthOrder,
      currentLocation: "Harar",
    });
  }

  // a branch: a has one wife and aa..ad children; plus aaab descendant
  const aWife = await insertMember({
    fullName: "Test a wife",
    gender: "female",
    isAlive: true,
    birthYear: 1931,
    currentLocation: "Harar",
  });
  await linkMarriage(insertedQadiKids["Test a"].id, aWife.id);
  const aa = await insertMember({
    fullName: "Test aa",
    gender: "male",
    fatherId: insertedQadiKids["Test a"].id,
    motherId: aWife.id,
    isAlive: true,
    birthYear: 1956,
    birthOrder: 1,
    currentLocation: "Harar",
  });
  const ab = await insertMember({
    fullName: "Test ab",
    gender: "male",
    fatherId: insertedQadiKids["Test a"].id,
    motherId: aWife.id,
    isAlive: true,
    birthYear: 1958,
    birthOrder: 2,
    currentLocation: "Harar",
  });
  await insertMember({
    fullName: "Test ac",
    gender: "female",
    fatherId: insertedQadiKids["Test a"].id,
    motherId: aWife.id,
    isAlive: true,
    birthYear: 1960,
    birthOrder: 3,
    currentLocation: "Harar",
  });
  await insertMember({
    fullName: "Test ad",
    gender: "male",
    fatherId: insertedQadiKids["Test a"].id,
    motherId: aWife.id,
    isAlive: true,
    birthYear: 1962,
    birthOrder: 4,
    currentLocation: "Harar",
  });

  const abWife = await insertMember({
    fullName: "Test ab wife",
    gender: "female",
    isAlive: true,
    birthYear: 1960,
    currentLocation: "Harar",
  });
  await linkMarriage(ab.id, abWife.id);
  const aaab = await insertMember({
    fullName: "Test aaab",
    gender: "male",
    fatherId: ab.id,
    motherId: abWife.id,
    isAlive: true,
    birthYear: 1989,
    birthOrder: 1,
    currentLocation: "Addis Ababa",
  });
  const aaabWife = await insertMember({
    fullName: "Test aaab wife",
    gender: "female",
    isAlive: true,
    birthYear: 1992,
    currentLocation: "Addis Ababa",
  });
  await linkMarriage(aaab.id, aaabWife.id);
  await insertMember({
    fullName: "Test aaab child",
    gender: "female",
    fatherId: aaab.id,
    motherId: aaabWife.id,
    isAlive: true,
    birthYear: 2014,
    birthOrder: 1,
    currentLocation: "Addis Ababa",
  });

  const fatuma = await insertMember({
    fullName: "Test Fatuma",
    gender: "female",
    fatherId: ibrahim.id,
    isAlive: false,
    birthYear: 1925,
    deathYear: 1998,
    currentLocation: "Harar",
  });
  const halima = await insertMember({
    fullName: "Test Halima",
    gender: "female",
    fatherId: ibrahim.id,
    isAlive: true,
    birthYear: 1932,
    currentLocation: "Addis Ababa",
  });
  const safiya = await insertMember({
    fullName: "Test Safiya",
    gender: "female",
    isAlive: true,
    birthYear: 1940,
    currentLocation: "Dire Dawa",
  });

  await linkMarriage(ahmed.id, fatuma.id);
  await linkMarriage(ahmed.id, halima.id);
  await linkMarriage(ahmed.id, safiya.id);

  await insertMember({
    fullName: "Test Omar",
    gender: "male",
    fatherId: ahmed.id,
    motherId: fatuma.id,
    isAlive: false,
    birthYear: 1955,
    deathYear: 2018,
    birthOrder: 1,
    currentLocation: "Harar",
  });
  await insertMember({
    fullName: "Test Sara",
    gender: "female",
    fatherId: ahmed.id,
    motherId: fatuma.id,
    isAlive: true,
    birthYear: 1960,
    birthOrder: 2,
    currentLocation: "Addis Ababa",
  });
  await insertMember({
    fullName: "Test Yusuf",
    gender: "male",
    fatherId: ahmed.id,
    motherId: halima.id,
    isAlive: true,
    birthYear: 1965,
    birthOrder: 1,
    currentLocation: "Addis Ababa",
  });
  await insertMember({
    fullName: "Test Layla",
    gender: "female",
    fatherId: ahmed.id,
    motherId: halima.id,
    isAlive: false,
    birthYear: 1968,
    deathYear: 2020,
    birthOrder: 2,
    currentLocation: "Harar",
  });
  await insertMember({
    fullName: "Test External Child",
    gender: "male",
    fatherId: ahmed.id,
    motherId: safiya.id,
    isAlive: true,
    birthYear: 1972,
    birthOrder: 1,
    currentLocation: "Dire Dawa",
  });

  // Abdosh: two wives (one dead, one alive)
  const zehra = await insertMember({
    fullName: "Test Zehra",
    gender: "female",
    fatherId: ibrahim.id,
    isAlive: false,
    birthYear: 1938,
    deathYear: 2005,
    currentLocation: "Harar",
  });
  const amina = await insertMember({
    fullName: "Test Amina",
    gender: "female",
    fatherId: ibrahim.id,
    isAlive: true,
    birthYear: 1945,
    currentLocation: "Addis Ababa",
  });
  await linkMarriage(abdosh.id, zehra.id);
  await linkMarriage(abdosh.id, amina.id);

  await insertMember({
    fullName: "Test Hamza",
    gender: "male",
    fatherId: abdosh.id,
    motherId: zehra.id,
    isAlive: false,
    birthYear: 1962,
    deathYear: 2010,
    birthOrder: 1,
    currentLocation: "Harar",
  });
  await insertMember({
    fullName: "Test Nadia",
    gender: "female",
    fatherId: abdosh.id,
    motherId: amina.id,
    isAlive: true,
    birthYear: 1970,
    birthOrder: 1,
    currentLocation: "Addis Ababa",
  });
  await insertMember({
    fullName: "Test Khalid",
    gender: "male",
    fatherId: abdosh.id,
    motherId: amina.id,
    isAlive: true,
    birthYear: 1975,
    birthOrder: 2,
    currentLocation: "Nairobi",
  });

  // Teweleda: in-kin wife + out-of-kin wife
  const mariam = await insertMember({
    fullName: "Test Mariam",
    gender: "female",
    fatherId: ahmed.id,
    motherId: fatuma.id,
    isAlive: true,
    birthYear: 1958,
    currentLocation: "Addis Ababa",
  });
  const outsider = await insertMember({
    fullName: "Test Outsider Wife",
    gender: "female",
    isAlive: true,
    birthYear: 1963,
    currentLocation: "Jijiga",
  });
  await linkMarriage(teweleda.id, mariam.id);
  await linkMarriage(teweleda.id, outsider.id);

  const idris = await insertMember({
    fullName: "Test Idris",
    gender: "male",
    fatherId: teweleda.id,
    motherId: mariam.id,
    isAlive: true,
    birthYear: 1985,
    birthOrder: 1,
    currentLocation: "Addis Ababa",
  });
  await insertMember({
    fullName: "Test Hawa",
    gender: "female",
    fatherId: teweleda.id,
    motherId: mariam.id,
    isAlive: false,
    birthYear: 1988,
    deathYear: 2015,
    birthOrder: 2,
    currentLocation: "Harar",
  });
  await insertMember({
    fullName: "Test Out Child",
    gender: "female",
    fatherId: teweleda.id,
    motherId: outsider.id,
    isAlive: true,
    birthYear: 1990,
    birthOrder: 1,
    currentLocation: "Jijiga",
  });

  // Abdulhamid: young family (alive)
  const selam = await insertMember({
    fullName: "Test Selam",
    gender: "female",
    fatherId: teweleda.id,
    motherId: mariam.id,
    isAlive: true,
    birthYear: 1992,
    currentLocation: "Addis Ababa",
  });
  await linkMarriage(abdulhamid.id, selam.id);

  await insertMember({
    fullName: "Test Biniam",
    gender: "male",
    fatherId: abdulhamid.id,
    motherId: selam.id,
    isAlive: true,
    birthYear: 2015,
    birthOrder: 1,
    currentLocation: "Addis Ababa",
  });
  await insertMember({
    fullName: "Test Eden",
    gender: "female",
    fatherId: abdulhamid.id,
    motherId: selam.id,
    isAlive: true,
    birthYear: 2018,
    birthOrder: 2,
    currentLocation: "Addis Ababa",
  });

  // —— Gen 6–9: deeper branches ——

  // Idris (gen 5): two wives, four children
  const idrisWife1 = await insertMember({
    fullName: "Test Idris Wife A",
    gender: "female",
    fatherId: ibrahim.id,
    isAlive: true,
    birthYear: 1988,
    currentLocation: "Addis Ababa",
  });
  const idrisWife2 = await insertMember({
    fullName: "Test Idris Wife B",
    gender: "female",
    isAlive: true,
    birthYear: 1991,
    currentLocation: "Dire Dawa",
  });
  await linkMarriage(idris.id, idrisWife1.id);
  await linkMarriage(idris.id, idrisWife2.id);

  const idrisSon1 = await insertMember({
    fullName: "Test Mikael",
    gender: "male",
    fatherId: idris.id,
    motherId: idrisWife1.id,
    isAlive: true,
    birthYear: 2010,
    birthOrder: 1,
    currentLocation: "Addis Ababa",
  });
  await insertMember({
    fullName: "Test Ruth",
    gender: "female",
    fatherId: idris.id,
    motherId: idrisWife1.id,
    isAlive: true,
    birthYear: 2013,
    birthOrder: 2,
    currentLocation: "Addis Ababa",
  });
  await insertMember({
    fullName: "Test Daniel",
    gender: "male",
    fatherId: idris.id,
    motherId: idrisWife2.id,
    isAlive: false,
    birthYear: 2016,
    deathYear: 2038,
    birthOrder: 1,
    currentLocation: "Dire Dawa",
  });
  await insertMember({
    fullName: "Test Hanna",
    gender: "female",
    fatherId: idris.id,
    motherId: idrisWife2.id,
    isAlive: true,
    birthYear: 2019,
    birthOrder: 2,
    currentLocation: "Dire Dawa",
  });

  // Khalid (gen 4): Nairobi branch → gen 5–7
  const khalid = (await byName("Test Khalid"))!;
  const khalidWife = await insertMember({
    fullName: "Test Khalid Wife",
    gender: "female",
    isAlive: true,
    birthYear: 1978,
    currentLocation: "Nairobi",
  });
  await linkMarriage(khalid.id, khalidWife.id);

  const khalidSon = await insertMember({
    fullName: "Test Nairobi Son",
    gender: "male",
    fatherId: khalid.id,
    motherId: khalidWife.id,
    isAlive: true,
    birthYear: 2000,
    birthOrder: 1,
    currentLocation: "Nairobi",
  });
  const khalidDaughter = await insertMember({
    fullName: "Test Nairobi Daughter",
    gender: "female",
    fatherId: khalid.id,
    motherId: khalidWife.id,
    isAlive: true,
    birthYear: 2003,
    birthOrder: 2,
    currentLocation: "Nairobi",
  });

  const nairobiWife = await insertMember({
    fullName: "Test Nairobi Wife",
    gender: "female",
    isAlive: true,
    birthYear: 2002,
    currentLocation: "Nairobi",
  });
  await linkMarriage(khalidSon.id, nairobiWife.id);

  await insertMember({
    fullName: "Test Nairobi Grandson",
    gender: "male",
    fatherId: khalidSon.id,
    motherId: nairobiWife.id,
    isAlive: true,
    birthYear: 2025,
    birthOrder: 1,
    currentLocation: "Nairobi",
  });

  // Yusuf (gen 3): side branch → gen 4–6
  const yusuf = (await byName("Test Yusuf"))!;
  const yusufWife = await insertMember({
    fullName: "Test Yusuf Wife",
    gender: "female",
    fatherId: ibrahim.id,
    isAlive: false,
    birthYear: 1970,
    deathYear: 2040,
    currentLocation: "Addis Ababa",
  });
  await linkMarriage(yusuf.id, yusufWife.id);

  const yusufSon = await insertMember({
    fullName: "Test Yusuf Son",
    gender: "male",
    fatherId: yusuf.id,
    motherId: yusufWife.id,
    isAlive: true,
    birthYear: 1995,
    birthOrder: 1,
    currentLocation: "Addis Ababa",
  });
  await linkMarriage(yusufSon.id, khalidDaughter.id);

  await insertMember({
    fullName: "Test Yusuf Grandson",
    gender: "male",
    fatherId: yusufSon.id,
    motherId: khalidDaughter.id,
    isAlive: true,
    birthYear: 2022,
    birthOrder: 1,
    currentLocation: "Addis Ababa",
  });

  // Biniam (gen 6): young family → gen 7–9 (deepest line from Abdulhamid)
  const biniam = (await byName("Test Biniam"))!;
  const biniamWife = await insertMember({
    fullName: "Test Biniam Wife",
    gender: "female",
    fatherId: idris.id,
    motherId: idrisWife1.id,
    isAlive: true,
    birthYear: 2014,
    currentLocation: "Addis Ababa",
  });
  await linkMarriage(biniam.id, biniamWife.id);

  const biniamSon = await insertMember({
    fullName: "Test Gen7 Abel",
    gender: "male",
    fatherId: biniam.id,
    motherId: biniamWife.id,
    isAlive: true,
    birthYear: 2035,
    birthOrder: 1,
    currentLocation: "Addis Ababa",
  });
  await insertMember({
    fullName: "Test Gen7 Sara",
    gender: "female",
    fatherId: biniam.id,
    motherId: biniamWife.id,
    isAlive: true,
    birthYear: 2038,
    birthOrder: 2,
    currentLocation: "Addis Ababa",
  });

  const gen7Wife = await insertMember({
    fullName: "Test Gen7 Wife",
    gender: "female",
    isAlive: true,
    birthYear: 2036,
    currentLocation: "Addis Ababa",
  });
  await linkMarriage(biniamSon.id, gen7Wife.id);

  const gen8Son = await insertMember({
    fullName: "Test Gen8 Yonas",
    gender: "male",
    fatherId: biniamSon.id,
    motherId: gen7Wife.id,
    isAlive: true,
    birthYear: 2058,
    birthOrder: 1,
    currentLocation: "Addis Ababa",
  });
  const gen8Wife = await insertMember({
    fullName: "Test Gen8 Wife",
    gender: "female",
    isAlive: true,
    birthYear: 2060,
    currentLocation: "Addis Ababa",
  });
  await linkMarriage(gen8Son.id, gen8Wife.id);

  await insertMember({
    fullName: "Test Gen9 Baby",
    gender: "female",
    fatherId: gen8Son.id,
    motherId: gen8Wife.id,
    isAlive: true,
    birthYear: 2082,
    birthOrder: 1,
    currentLocation: "Addis Ababa",
  });

  // Mikael (gen 6): parallel deep branch → gen 7–8
  const mikaelWife = await insertMember({
    fullName: "Test Mikael Wife",
    gender: "female",
    isAlive: true,
    birthYear: 2012,
    currentLocation: "Addis Ababa",
  });
  await linkMarriage(idrisSon1.id, mikaelWife.id);

  const mikaelChild = await insertMember({
    fullName: "Test Gen7 Dawit",
    gender: "male",
    fatherId: idrisSon1.id,
    motherId: mikaelWife.id,
    isAlive: true,
    birthYear: 2036,
    birthOrder: 1,
    currentLocation: "Addis Ababa",
  });
  const dawitWife = await insertMember({
    fullName: "Test Dawit Wife",
    gender: "female",
    isAlive: true,
    birthYear: 2038,
    currentLocation: "Hawassa",
  });
  await linkMarriage(mikaelChild.id, dawitWife.id);

  await insertMember({
    fullName: "Test Gen8 Liya",
    gender: "female",
    fatherId: mikaelChild.id,
    motherId: dawitWife.id,
    isAlive: true,
    birthYear: 2060,
    birthOrder: 1,
    currentLocation: "Hawassa",
  });

  const db = getDb();
  const count = await db
    .select({ id: familyMembers.id })
    .from(familyMembers)
    .where(eq(familyMembers.submittedBy, MARKER));

  const gens = await db
    .select({ gen: familyMembers.generationLevel })
    .from(familyMembers)
    .where(eq(familyMembers.submittedBy, MARKER));
  const maxGen = Math.max(...gens.map((g) => g.gen), root.generationLevel);

  console.log(`✓ Seeded ${count.length} test family members (up to generation ${maxGen})`);
  console.log("  Qadi Yonis: Melika/Muna with interleaved global order children a..i");
  console.log("  a branch: a + wife → aa/ab/ac/ad, with aaab descendant");
  console.log("  Ahmed: 3 wives (2 in-kin, 1 out-of-kin), 5 children");
  console.log("  Abdosh: 2 wives (1 dead, 1 alive), 3 children");
  console.log("  Teweleda: 2 wives, 3 children (mixed alive/dead)");
  console.log("  Abdulhamid → Biniam → Gen7 → Gen8 → Gen9 (deepest line)");
  console.log("  Idris & Khalid & Yusuf: extra branches gen 6–8");
  console.log("  Names prefixed with 'Test ' — filter tree search with 'Test'");
}

async function main() {
  ensureDatabaseUrl();
  const force = process.argv.includes("--force");
  await seedTestFamilies(force);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Test family seed failed:", err);
    process.exit(1);
  });
}
