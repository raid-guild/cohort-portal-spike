export type RaidGuildRole = {
  id: string;
  name: string;
  type: string;
  description: string;
  group: "builder" | "support";
  icon?: string;
};

const ROLE_ICON_BASE = "/assets/raid-guild-roles";

export const RAID_GUILD_ROLES: RaidGuildRole[] = [
  {
    id: "archer",
    name: "Archer",
    type: "Design",
    description: "For specialists in graphic design, illustration, and visual arts.",
    group: "builder",
    icon: `${ROLE_ICON_BASE}/archer.svg`,
  },
  {
    id: "druid",
    name: "Druid",
    type: "Data Science/Analytics",
    description: "For those skilled in research, SEO, and data analysis.",
    group: "builder",
    icon: `${ROLE_ICON_BASE}/druid.svg`,
  },
  {
    id: "paladin",
    name: "Paladin",
    type: "Backend Dev",
    description: "For developers focused on backend languages like Java, Python, or Node.js.",
    group: "builder",
    icon: `${ROLE_ICON_BASE}/paladin.svg`,
  },
  {
    id: "necromancer",
    name: "Necromancer",
    type: "DevOps",
    description: "For experts in technical configuration and optimization.",
    group: "builder",
    icon: `${ROLE_ICON_BASE}/necromancer.svg`,
  },
  {
    id: "ranger",
    name: "Ranger",
    type: "UX/User Testing",
    description: "For those who specialize in user experience and usability testing.",
    group: "builder",
    icon: `${ROLE_ICON_BASE}/ranger.svg`,
  },
  {
    id: "warrior",
    name: "Warrior",
    type: "Frontend Dev",
    description: "For frontend specialists skilled in React, CSS, HTML, or similar tech.",
    group: "builder",
    icon: `${ROLE_ICON_BASE}/warrior.svg`,
  },
  {
    id: "wizard",
    name: "Wizard",
    type: "Smart Contracts",
    description: "For those skilled in Solidity, Vyper, and other smart contract languages.",
    group: "builder",
    icon: `${ROLE_ICON_BASE}/wizard.svg`,
  },
  {
    id: "cleric",
    name: "Cleric",
    type: "Account Manager",
    description: "For hybrid communicators or project managers.",
    group: "builder",
    icon: `${ROLE_ICON_BASE}/cleric.svg`,
  },
  {
    id: "hunter",
    name: "Hunter",
    type: "BizDev",
    description: "For business development and sales strategists.",
    group: "builder",
    icon: `${ROLE_ICON_BASE}/hunter.svg`,
  },
  {
    id: "monk",
    name: "Monk",
    type: "Project Manager",
    description: "For managers skilled in budgeting, planning, and documentation.",
    group: "builder",
    icon: `${ROLE_ICON_BASE}/monk.svg`,
  },
  {
    id: "alchemist",
    name: "Mystic Alchemist",
    type: "DAO Consultant",
    description: "For DAO experts and consultants.",
    group: "builder",
    icon: `${ROLE_ICON_BASE}/alchemist.svg`,
  },
  {
    id: "apprentice",
    name: "Apprentice",
    type: "New Applicants",
    description: "For those applying to join the DAO, marking them as apprentices.",
    group: "support",
  },
  {
    id: "dwarf",
    name: "Angry Dwarf",
    type: "Treasury",
    description: "For those with skills in accounting, finance, and treasury management.",
    group: "support",
    icon: `${ROLE_ICON_BASE}/dwarf.svg`,
  },
  {
    id: "bard",
    name: "Bard",
    type: "Marketing",
    description: "For members who excel in marketing, social media, and community growth.",
    group: "support",
  },
  {
    id: "rogue",
    name: "Rogue",
    type: "Legal",
    description: "For legal advisors and analysts.",
    group: "support",
    icon: `${ROLE_ICON_BASE}/rogue.svg`,
  },
  {
    id: "scribe",
    name: "Scribe",
    type: "Content Creator",
    description: "For media creators skilled in writing, podcasting, and video production.",
    group: "support",
    icon: `${ROLE_ICON_BASE}/scribe.svg`,
  },
  {
    id: "tavernkeeper",
    name: "Tavern Keeper",
    type: "Community",
    description: "For those managing community relations and activities.",
    group: "support",
    icon: `${ROLE_ICON_BASE}/tavernkeeper.svg`,
  },
  {
    id: "healer",
    name: "Healer",
    type: "Internal Ops",
    description: "For internal operations managers focused on Guild logistics.",
    group: "support",
    icon: `${ROLE_ICON_BASE}/healer.svg`,
  },
];

export const RAID_GUILD_ROLE_NAMES = RAID_GUILD_ROLES.map((role) => role.name);
