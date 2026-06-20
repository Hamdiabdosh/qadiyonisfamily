export const FOREIGN_LOCATION = "Biyya Alaa";

/** Regions shown first, in this order; all others keep their original order below. */
const REGION_PRIORITY = [
  "Oromia",
  "Addis Ababa (chartered city)",
  "Harari",
  "Dire Dawa (chartered city)",
  "Somali",
] as const;

/** Oromia zones shown first, in this order; all others keep their original order below. */
const OROMIA_ZONE_PRIORITY = [
  "East Bale",
  "East Shewa",
  "Borena",
  "Finfine Special Zone",
  "Arsi",
  "West Arsi",
] as const;

function sortWithPriority(items: string[], priority: readonly string[]): string[] {
  const originalIndex = new Map(items.map((item, i) => [item, i]));
  const priorityIndex = new Map(priority.map((item, i) => [item, i]));

  return [...items].sort((a, b) => {
    const pa = priorityIndex.get(a);
    const pb = priorityIndex.get(b);
    if (pa !== undefined && pb !== undefined) return pa - pb;
    if (pa !== undefined) return -1;
    if (pb !== undefined) return 1;
    return (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0);
  });
}

export type EthiopiaRegion = {
  name: string;
  zones: string[];
};

export const ETHIOPIA_REGIONS: EthiopiaRegion[] = [
  {
    name: "Oromia",
    zones: [
      "Bale",
      "East Bale",
      "Borena",
      "West Guji",
      "Guji",
      "Arsi",
      "West Arsi",
      "East Hararghe",
      "West Hararghe",
      "East Shewa",
      "West Shewa",
      "North Shewa",
      "South West Shewa",
      "Jimma",
      "Illubabor",
      "Buno Bedele",
      "Horo Guduru Wellega",
      "East Wellega",
      "West Wellega",
      "Kelam Wellega",
      "Finfine Special Zone",
    ],
  },
  {
    name: "Amhara",
    zones: [
      "Agew Awi",
      "Bahir Dar",
      "West Gojjam",
      "East Gojjam",
      "North Shewa",
      "Oromia Special Zone",
      "South Gondar",
      "North Wollo",
      "South Wollo",
      "Wag Hemra",
      "Central Gondar",
      "West Gondar",
    ],
  },
  {
    name: "Tigray",
    zones: ["Central", "Eastern", "Western", "North Western", "Southern", "South Eastern", "Mekelle"],
  },
  {
    name: "Somali",
    zones: ["Fafan", "Sitti", "Jarar", "Nogob", "Korahe", "Shabelle", "Afder", "Liben", "Dollo", "Erer", "Dhawa"],
  },
  {
    name: "Afar",
    zones: [
      "Awsi Rasu (Zone 1)",
      "Kilbet Rasu (Zone 2)",
      "Gabi Rasu (Zone 3)",
      "Fanti Rasu (Zone 4)",
      "Hari Rasu (Zone 5)",
    ],
  },
  {
    name: "Benishangul-Gumuz",
    zones: ["Asosa", "Kamashi", "Metekel", "Mao Komo"],
  },
  {
    name: "Gambela",
    zones: ["Anuak", "Nuer", "Mezhenger", "Itang"],
  },
  {
    name: "Sidama",
    zones: ["Sidama"],
  },
  {
    name: "South Ethiopia Regional State",
    zones: ["Gedeo", "Gamo", "Wolayita", "Gofa", "Konso", "South Omo", "Alle", "Derashe", "Burji", "Amaro", "Ari"],
  },
  {
    name: "Central Ethiopia Regional State",
    zones: ["Gurage", "East Gurage", "Hadiya", "Silt'e", "Halaba", "Kembata (Kembata Tembaro)", "Yem", "Kebena", "Mareko", "Tembaro"],
  },
  {
    name: "South West Ethiopia Peoples' Region",
    zones: ["Bench Sheko (Bench Maji)", "Keffa", "Sheka", "Dawro", "Konta", "Basketo", "West Omo (Mirab Omo)"],
  },
  {
    name: "Harari",
    zones: ["Harar"],
  },
  {
    name: "Addis Ababa (chartered city)",
    zones: ["Addis Ababa"],
  },
  {
    name: "Dire Dawa (chartered city)",
    zones: ["Dire Dawa"],
  },
];

export function getRegionNames(): string[] {
  const names = ETHIOPIA_REGIONS.map((r) => r.name);
  return sortWithPriority(names, REGION_PRIORITY);
}

export function getZonesForRegion(regionName: string): string[] {
  const zones = ETHIOPIA_REGIONS.find((r) => r.name === regionName)?.zones ?? [];
  if (regionName === "Oromia") return sortWithPriority(zones, OROMIA_ZONE_PRIORITY);
  return zones;
}

/** Chartered cities with no separate zone picker — region alone is the location. */
const REGIONS_WITHOUT_ZONES = new Set([
  "Addis Ababa (chartered city)",
  "Dire Dawa (chartered city)",
]);

export function regionRequiresZone(regionName: string): boolean {
  return Boolean(regionName) && !REGIONS_WITHOUT_ZONES.has(regionName);
}

/** Small hint shown beside a zone name in pickers (value stored unchanged). */
export const ZONE_DISPLAY_HINTS: Record<string, string> = {
  "East Shewa": "Adama",
};

export function formatLocation(region: string, zone: string, isForeign: boolean): string {
  if (isForeign) return FOREIGN_LOCATION;
  if (!region) return "";
  if (!regionRequiresZone(region) || !zone || getZonesForRegion(region).length <= 1) return region;
  return `${region} · ${zone}`;
}

export const DEFAULT_LOCATION = {
  isForeign: false,
  region: "",
  zone: "",
} as const;

export type LocationSelection = {
  isForeign: boolean;
  region: string;
  zone: string;
};
