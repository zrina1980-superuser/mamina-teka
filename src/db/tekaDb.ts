import Dexie, { type Table } from 'dexie';
import {
  DELETED_RECIPE_IDS_STORAGE_KEY,
  HIDE_SAMPLE_MANUSCRIPTS_STORAGE_KEY,
  MOCKUP_RECIPES_REMOVED_STORAGE_KEY,
  MOCKUP_RECIPE_IDS,
  MOCKUP_RECIPE_ID_SET,
  applyDeletedRecipeFilter,
  filterSyncableRecipes,
  isPlaceholderIngredientGroups,
  recoverIngredientsFromRecipeText,
  type Recipe,
} from '../utils/recipeLogic';
import { INITIAL_RECIPES } from './seedRecipes';

export class MaminaTekaDatabase extends Dexie {
  recipes!: Table<Recipe, string>;

  constructor() {
    super('MaminaTekaByZrinaDB');
    this.version(1).stores({
      recipes: 'id, title, category, subcategory, isFavorite, inCookSoon, createdAt',
    });
    this.version(2).stores({
      recipes:
        'id, title, category, subcategory, isFavorite, inCookSoon, syncStatus, updatedAt, createdAt, isDeleted, authorEmail',
    });
    this.version(3).stores({
      recipes:
        'id, title, category, subcategory, isFavorite, inCookSoon, syncStatus, updatedAt, createdAt, isDeleted, isMockup, authorEmail',
    });
  }
}

export const db = new MaminaTekaDatabase();

export function areMockupRecipesRemoved(): boolean {
  try {
    if (localStorage.getItem(MOCKUP_RECIPES_REMOVED_STORAGE_KEY) === 'true') {
      return true;
    }
    const raw = localStorage.getItem(DELETED_RECIPE_IDS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed) && parsed.length > 0) {
      const set = new Set<string>(parsed.filter((x): x is string => typeof x === 'string'));
      if (MOCKUP_RECIPE_IDS.every((id) => set.has(id))) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function getDeletedRecipeIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_RECIPE_IDS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const list: string[] = Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : [];
    const set = new Set<string>(list);
    if (areMockupRecipesRemoved()) {
      for (const seedId of MOCKUP_RECIPE_IDS) {
        set.add(seedId);
      }
    }
    return Array.from(set);
  } catch {
    return [];
  }
}

export function markRecipeIdsAsDeleted(ids: string[]): string[] {
  try {
    const current = new Set(getDeletedRecipeIds());
    for (const id of ids) {
      if (id) current.add(id);
    }
    const next = Array.from(current);
    localStorage.setItem(DELETED_RECIPE_IDS_STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return ids;
  }
}

export function unmarkRecipeIdsAsDeleted(idsToRestore: string[]): string[] {
  try {
    const removeSet = new Set(idsToRestore);
    if (MOCKUP_RECIPE_IDS.some((id) => removeSet.has(id))) {
      localStorage.removeItem(MOCKUP_RECIPES_REMOVED_STORAGE_KEY);
    }
    const raw = localStorage.getItem(DELETED_RECIPE_IDS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const existingList: string[] = Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : [];
    const next = existingList.filter((id) => !removeSet.has(id));
    localStorage.setItem(DELETED_RECIPE_IDS_STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export function getHideSampleManuscripts(): boolean {
  try {
    return localStorage.getItem(HIDE_SAMPLE_MANUSCRIPTS_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setHideSampleManuscripts(hide: boolean): void {
  try {
    localStorage.setItem(HIDE_SAMPLE_MANUSCRIPTS_STORAGE_KEY, hide ? 'true' : 'false');
  } catch {
    // Ignore storage errors
  }
}

/**
 * Physically deletes all mockup/sample recipes (and any soft-deleted records) from Dexie (`db.recipes`):
 * `await db.recipes.where('isMockup').equals(1).delete();`
 * plus explicit bulk deletion by `MOCKUP_RECIPE_IDS` so no stale mockup record can ever remain in IndexedDB.
 */
export async function purgeRemovedMockupRecipesFromDexie(): Promise<number> {
  let deletedCount = 0;
  try {
    deletedCount += await db.recipes.where('isMockup').equals(1).delete();
  } catch {
    // Ignore if index is still upgrading
  }
  try {
    const all = await db.recipes.toArray();
    const idsToDelete = new Set<string>(MOCKUP_RECIPE_IDS);
    for (const r of all) {
      if (r.isMockup || r.isSample || MOCKUP_RECIPE_ID_SET.has(r.id)) {
        idsToDelete.add(r.id);
      }
    }
    if (idsToDelete.size > 0) {
      await db.recipes.bulkDelete(Array.from(idsToDelete));
      deletedCount = Math.max(deletedCount, idsToDelete.size);
    }
  } catch {
    // Ignore DB errors
  }
  return deletedCount;
}

/**
 * Physically removes any soft-deleted records (`isDeleted === true` or present in `getDeletedRecipeIds()`)
 * from Dexie so deleted recipes never linger in IndexedDB or enter the sync queue.
 */
export async function purgeDeletedRecipesFromDexie(): Promise<void> {
  try {
    const deletedSet = new Set(getDeletedRecipeIds());
    const all = await db.recipes.toArray();
    const idsToPurge: string[] = [];
    for (const r of all) {
      if (r.isDeleted || r.hidden || deletedSet.has(r.id)) {
        idsToPurge.push(r.id);
      }
    }
    if (idsToPurge.length > 0) {
      await db.recipes.bulkDelete(idsToPurge);
    }
  } catch {
    // Ignore DB errors
  }
}

export async function ensureSeededRecipes(): Promise<Recipe[]> {
  const mockupsRemoved = areMockupRecipesRemoved();
  const deletedIds = new Set(getDeletedRecipeIds());

  const dbTask = async (): Promise<Recipe[]> => {
    // If mockup recipes were removed by the user, physically delete them from Dexie immediately
    if (mockupsRemoved) {
      await purgeRemovedMockupRecipesFromDexie();
    }
    await purgeDeletedRecipesFromDexie();

    const count = await db.recipes.count();
    if (count === 0) {
      if (!mockupsRemoved) {
        const initialToSeed = INITIAL_RECIPES.filter((r) => !deletedIds.has(r.id)).map((r) => ({
          ...r,
          isMockup: 1,
          isSample: true,
          isDeleted: false,
        }));
        if (initialToSeed.length > 0) {
          await db.recipes.bulkPut(initialToSeed);
        }
      }
    } else {
      const existing = await db.recipes.toArray();
      const existingMap = new Map(existing.map((r) => [r.id, r]));
      const seedMap = new Map(INITIAL_RECIPES.map((r) => [r.id, r]));
      const updates: Recipe[] = [];
      const idsToPhysicallyDelete: string[] = [];

      // Only seed missing mockup recipes if mockupsRemoved is false and user has not deleted them
      if (!mockupsRemoved) {
        for (const seed of INITIAL_RECIPES) {
          if (!existingMap.has(seed.id) && !deletedIds.has(seed.id)) {
            updates.push({
              ...seed,
              isMockup: 1,
              isSample: true,
            });
          }
        }
      }

      for (const item of existing) {
        const seeded = seedMap.get(item.id);
        const shouldBeDeleted = Boolean(
          item.isDeleted ||
            item.hidden ||
            deletedIds.has(item.id) ||
            (mockupsRemoved && (seeded || item.isMockup || item.isSample))
        );
        if (shouldBeDeleted) {
          idsToPhysicallyDelete.push(item.id);
          continue;
        }

        if (seeded && !shouldBeDeleted) {
          const hasCustomRegen = typeof item.aiRegenCount === 'number' && item.aiRegenCount > 0;
          const isExternalStockUrl =
            item.imageUrl.startsWith('http://') || item.imageUrl.startsWith('https://');
          const needsImageUpgrade =
            item.imageStatus !== 'real' &&
            !hasCustomRegen &&
            (isExternalStockUrl ||
              item.imageUrl !== seeded.imageUrl ||
              item.image !== seeded.imageUrl);
          const needsIngredientHeal = isPlaceholderIngredientGroups(item.ingredientGroups);

          if (
            needsImageUpgrade ||
            needsIngredientHeal ||
            !item.panDimensions ||
            !item.secretTip ||
            item.isMockup !== 1
          ) {
            const updatedImageUrl =
              item.imageStatus === 'real' || hasCustomRegen
                ? item.imageUrl
                : seeded.imageUrl;
            updates.push({
              ...seeded,
              ...item,
              isMockup: 1,
              isSample: true,
              ingredientGroups: needsIngredientHeal
                ? seeded.ingredientGroups
                : item.ingredientGroups,
              image: updatedImageUrl,
              imageUrl: updatedImageUrl,
              imageStatus: item.imageStatus === 'real' ? 'real' : 'ai',
              isAiGenerated: item.imageStatus !== 'real',
              originalScanUrl: item.originalScanUrl || seeded.originalScanUrl,
              originalImage: item.originalImage || item.originalScanUrl || seeded.originalScanUrl,
              panDimensions: item.panDimensions || seeded.panDimensions,
              secretTip: item.secretTip || seeded.secretTip,
              voiceMemoTranscript: item.voiceMemoTranscript || seeded.voiceMemoTranscript,
              cookingLogs: item.cookingLogs || seeded.cookingLogs || [],
              syncStatus: 'synced',
              updatedAt: item.updatedAt || item.createdAt || Date.now(),
              isDeleted: false,
              authorEmail: item.authorEmail || 'mama@obitelj.hr',
            });
          }
        } else if (!seeded && !shouldBeDeleted) {
          const currentImg = item.image || item.imageUrl || '';
          const manuscriptImg = item.originalImage || item.originalScanUrl || '';
          const needsIngredientHeal = isPlaceholderIngredientGroups(item.ingredientGroups);
          const healedIngredients = needsIngredientHeal
            ? recoverIngredientsFromRecipeText(item)
            : item.ingredientGroups;
          const didHealIngredients =
            needsIngredientHeal && !isPlaceholderIngredientGroups(healedIngredients);

          if (currentImg.startsWith('data:image/svg+xml') && manuscriptImg) {
            updates.push({
              ...item,
              isMockup: 0,
              isSample: false,
              ingredientGroups: healedIngredients,
              image: manuscriptImg,
              imageUrl: manuscriptImg,
              imageStatus: 'real',
              isAiGenerated: false,
              updatedAt: Date.now(),
              syncStatus: 'pending',
            });
          } else if (didHealIngredients) {
            updates.push({
              ...item,
              isMockup: 0,
              isSample: false,
              ingredientGroups: healedIngredients,
              updatedAt: Date.now(),
              syncStatus: 'pending',
            });
          }
        }
      }

      if (idsToPhysicallyDelete.length > 0) {
        await db.recipes.bulkDelete(idsToPhysicallyDelete);
      }

      if (updates.length > 0) {
        await db.recipes.bulkPut(updates);
      }
    }

    const all = await db.recipes.orderBy('createdAt').reverse().toArray();
    return applyDeletedRecipeFilter(all, deletedIds, mockupsRemoved);
  };

  try {
    return await Promise.race([
      dbTask(),
      new Promise<Recipe[]>((resolve) =>
        setTimeout(
          () =>
            resolve(
              mockupsRemoved
                ? []
                : applyDeletedRecipeFilter(INITIAL_RECIPES, deletedIds, mockupsRemoved)
            ),
          2500
        )
      ),
    ]);
  } catch {
    return mockupsRemoved
      ? []
      : applyDeletedRecipeFilter(INITIAL_RECIPES, deletedIds, mockupsRemoved);
  }
}

export async function getAllLocalRecipesIncludingDeleted(): Promise<Recipe[]> {
  try {
    if (areMockupRecipesRemoved()) {
      await purgeRemovedMockupRecipesFromDexie();
    }
    return await db.recipes.toArray();
  } catch {
    return areMockupRecipesRemoved() ? [] : INITIAL_RECIPES;
  }
}

/**
 * Returns ONLY real, active user recipes eligible for Cloud Synchronization:
 * `!recipe.isMockup && !recipe.isSample && !recipe.isDeleted && !recipe.hidden`
 * Also physically cleans removed mockup recipes from Dexie first.
 */
export async function getRecipesToSync(): Promise<Recipe[]> {
  try {
    const mockupsRemoved = areMockupRecipesRemoved();
    if (mockupsRemoved) {
      await purgeRemovedMockupRecipesFromDexie();
    }
    await purgeDeletedRecipesFromDexie();
    const all = await db.recipes.toArray();
    return filterSyncableRecipes(all, {
      deletedIds: getDeletedRecipeIds(),
      mockupsRemoved,
    });
  } catch {
    return [];
  }
}

export async function saveRecipeToDb(recipe: Recipe, markSynced = false): Promise<Recipe> {
  if (!recipe.isDeleted) {
    unmarkRecipeIdsAsDeleted([recipe.id]);
  }
  const isSeedMockup = MOCKUP_RECIPE_ID_SET.has(recipe.id);
  const stamped: Recipe = {
    ...recipe,
    isMockup: isSeedMockup ? 1 : 0,
    isSample: isSeedMockup,
    updatedAt: recipe.updatedAt || Date.now(),
    syncStatus: markSynced ? 'synced' : recipe.syncStatus || 'pending',
    isDeleted: recipe.isDeleted ?? false,
  };
  await db.recipes.put(stamped);
  return stamped;
}

export async function softDeleteRecipeInDb(
  id: string,
  _authorEmail?: string
): Promise<Recipe | null> {
  const updatedDeletedIds = new Set(markRecipeIdsAsDeleted([id]));
  const allSeedsDeleted = MOCKUP_RECIPE_IDS.every((seedId) => updatedDeletedIds.has(seedId));
  if (allSeedsDeleted) {
    try {
      localStorage.setItem(MOCKUP_RECIPES_REMOVED_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
    await purgeRemovedMockupRecipesFromDexie();
  }
  const existing = (await db.recipes.get(id)) || INITIAL_RECIPES.find((s) => s.id === id) || null;
  try {
    await db.recipes.delete(id);
  } catch {
    // Ignore DB delete error
  }
  if (!existing) return null;
  return {
    ...existing,
    isDeleted: true,
    updatedAt: Date.now(),
    syncStatus: 'synced',
  };
}

/**
 * Physically deletes all initial mockup/sample recipes from Dexie (`await db.recipes.where('isMockup').equals(1).delete()`)
 * and marks `mamina_teka_mockups_removed_v1 = 'true'` so they never enter the sync queue or block image loading.
 */
export async function softDeleteAllMockupRecipesInDb(_authorEmail?: string): Promise<number> {
  try {
    localStorage.setItem(MOCKUP_RECIPES_REMOVED_STORAGE_KEY, 'true');
  } catch {
    // Ignore storage errors
  }
  const seedIds = INITIAL_RECIPES.map((r) => r.id);
  markRecipeIdsAsDeleted(seedIds);
  const deletedCount = await purgeRemovedMockupRecipesFromDexie();
  return Math.max(deletedCount, seedIds.length);
}

export async function restoreMockupRecipesInDb(): Promise<number> {
  try {
    localStorage.removeItem(MOCKUP_RECIPES_REMOVED_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
  const seedIds = INITIAL_RECIPES.map((r) => r.id);
  unmarkRecipeIdsAsDeleted(seedIds);
  const now = Date.now();
  const restored = INITIAL_RECIPES.map((seed, idx) => ({
    ...seed,
    isMockup: 1,
    isSample: true,
    isDeleted: false,
    updatedAt: now - idx * 1000,
    syncStatus: 'synced' as const,
  }));
  await db.recipes.bulkPut(restored);
  return restored.length;
}

export async function exportAllRecipesJson(): Promise<string> {
  const deletedIds = getDeletedRecipeIds();
  const mockupsRemoved = areMockupRecipesRemoved();
  const recipes = applyDeletedRecipeFilter(await db.recipes.toArray(), deletedIds, mockupsRemoved);
  const payload = {
    app: 'Mamina Teka',
    ecosystem: 'https://zrina.app',
    contact: 'maminateka@zrina.app',
    exportedAt: new Date().toISOString(),
    recipeCount: recipes.length,
    recipes,
  };
  return JSON.stringify(payload, null, 2);
}

export async function importRecipesFromJson(jsonString: string): Promise<number> {
  const parsed = JSON.parse(jsonString);
  const list: Recipe[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.recipes)
      ? parsed.recipes
      : [];

  if (list.length === 0) {
    throw new Error('Datoteka ne sadrži valjane recepte.');
  }

  unmarkRecipeIdsAsDeleted(list.map((r) => r.id));

  const normalized = list.map((r) => ({
    ...r,
    isMockup: MOCKUP_RECIPE_ID_SET.has(r.id) ? 1 : 0,
    isSample: MOCKUP_RECIPE_ID_SET.has(r.id),
    updatedAt: r.updatedAt || Date.now(),
    syncStatus: 'pending' as const,
    isDeleted: false,
  }));

  await db.recipes.bulkPut(normalized);
  return normalized.length;
}
