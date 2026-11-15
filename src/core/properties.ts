import { decodeEscapes } from './escape';
import { ALIASES, LOGICAL_GROUPS, LONGHANDS, SHORTHANDS } from './properties.data';

const shorthands = new Map(Object.entries(SHORTHANDS));
const aliases = new Map(Object.entries(ALIASES));
const known = new Set([...LONGHANDS.split(' '), ...shorthands.keys(), ...aliases.keys()]);

const groupOf = new Map<string, string[]>();
for (const group of LOGICAL_GROUPS) {
  const [physical, logical] = group.split(' | ').map((side) => side.split(' '));
  for (const name of logical) groupOf.set(name, [...physical, ...logical]);
}

const VENDOR_PREFIX = /^-(?:webkit|moz|ms|o)-/;
const reaches = new Map<string, ReadonlySet<string>>();

/** The longhands a known property can set or reset; a flow-relative one stands for its whole group. */
function reach(prop: string): ReadonlySet<string> {
  let names = reaches.get(prop) as Set<string> | undefined;
  if (!names) {
    names = new Set<string>();
    const pending = [prop];
    for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
      const target = aliases.get(name) ?? name;
      const parts = shorthands.get(target);
      if (parts) pending.push(...parts.split(' '));
      else for (const member of groupOf.get(target) ?? [target]) names.add(member);
    }
    reaches.set(prop, names);
  }
  return names;
}

/** The name the table knows a property by: its own, or the one without a vendor prefix. */
function tableName(prop: string): string {
  const name = decodeEscapes(prop).toLowerCase();
  if (known.has(name)) return name;
  const bare = name.replace(VENDOR_PREFIX, '');
  return known.has(bare) ? bare : name;
}

/** The names a property name starts with: `border-top-width` gives `border` and `border-top`. */
function stemsOf(name: string): string[] {
  const stems: string[] = [];
  for (let dash = name.indexOf('-', 1); dash !== -1; dash = name.indexOf('-', dash + 1)) {
    stems.push(name.slice(0, dash));
  }
  return stems;
}

/** What a group of regular declarations may set, to tell which other properties can meet them. */
export interface Footprint {
  add(prop: string): void;
  /** False only when the order of this property and the group can never matter. */
  touches(prop: string): boolean;
}

export function createFootprint(): Footprint {
  const longhands = new Set<string>();
  const names = new Set<string>();
  const stems = new Set<string>();
  let everything = false;

  return {
    add(prop) {
      const name = tableName(prop);
      if (name === 'all' || !known.has(name)) {
        everything = true;
        return;
      }
      names.add(name);
      for (const stem of stemsOf(name)) stems.add(stem);
      for (const longhand of reach(name)) longhands.add(longhand);
    },
    touches(prop) {
      const name = tableName(prop);
      if (everything || name === 'all' || !known.has(name)) return true;
      if (stems.has(name) || stemsOf(name).some((stem) => names.has(stem))) return true;
      for (const longhand of reach(name)) if (longhands.has(longhand)) return true;
      return false;
    },
  };
}
