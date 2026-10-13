import { db, newId } from '../db';
import { en } from '../i18n/en';
import { uk } from '../i18n/uk';
import { isPresetTagId, PRESET_TAG_IDS, type Tag } from '../types';

export class TagExistsError extends Error {}

const norm = (s: string) => s.trim().toLowerCase();

/** All names a tag can be referred to by (presets: id + translations). */
function aliases(tag: Tag): string[] {
  if (!isPresetTagId(tag.id)) return [norm(tag.name)];
  return [tag.id, en[`tag.${tag.id}`], uk[`tag.${tag.id}`]].map(norm);
}

async function findByName(name: string): Promise<Tag | undefined> {
  const n = norm(name);
  const all = await db.tags.toArray();
  return all.find((t) => aliases(t).includes(n));
}

/** Create a custom tag, or return the existing tag with that name. */
export async function createTag(name: string): Promise<Tag> {
  const existing = await findByName(name);
  if (existing) return existing;
  const tag: Tag = { id: newId(), name: name.trim(), preset: false, createdAt: Date.now() };
  await db.tags.add(tag);
  return tag;
}

export async function renameTag(id: string, name: string): Promise<void> {
  if (isPresetTagId(id)) return;
  const existing = await findByName(name);
  if (existing && existing.id !== id) throw new TagExistsError();
  await db.tags.update(id, { name: name.trim() });
}

export async function deleteTag(id: string): Promise<void> {
  if (isPresetTagId(id)) return;
  const now = Date.now();
  await db.transaction('rw', db.tags, db.cards, async () => {
    await db.cards
      .where('tags')
      .equals(id)
      .modify((c) => {
        c.tags = c.tags.filter((t) => t !== id);
        c.updatedAt = now;
      });
    await db.tags.delete(id);
  });
}

/** Map tag names (e.g. from CSV) to ids, creating missing tags. */
export async function resolveTagNames(names: Iterable<string>): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (const name of names) {
    const key = norm(name);
    if (!key || result.has(key)) continue;
    result.set(key, (await createTag(name)).id);
  }
  return result;
}

/** Make sure the built-in tags exist (e.g. after "replace" import). */
export async function ensurePresetTags(): Promise<void> {
  const now = Date.now();
  const missing = [];
  for (const [i, id] of PRESET_TAG_IDS.entries()) {
    if (!(await db.tags.get(id))) missing.push({ id, name: id, preset: true, createdAt: now + i });
  }
  if (missing.length) await db.tags.bulkAdd(missing);
}

export { norm as normalizeTagName };
