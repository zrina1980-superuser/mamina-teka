export type CategoryId = 'kolaci' | 'slano' | 'mesarija' | 'zimnica' | 'tradicija';

export type SyncStatus = 'synced' | 'pending' | 'conflict';

export interface CategoryDefinition {
  id: CategoryId;
  title: string;
  shortTitle: string;
  description: string;
  subcategories: string[];
  accentColor: string;
}

export interface IngredientItem {
  id: string;
  name: string;
  amount: number | null;
  unit: string;
  originalMeasure?: string; // e.g., "frtalj kile" or "1 čaša od kiselog mlijeka"
}

export interface IngredientGroup {
  groupTitle: string; // e.g., "Biskvit", "Krema", "Glazura", "Tijesto", "Nadjev od oraha"
  items: IngredientItem[];
}

export interface CookingLogEntry {
  id: string;
  dateLabel: string; // e.g. "Uskrs 2026." or "29. 10. 2026."
  note: string; // e.g. "Pečeno za Uskrs – ispalo vrhunski, drugi put peći 5 minuta kraće."
  author?: string;
}

export interface VoiceMemoItem {
  id: string;
  label: string; // e.g., "Tajna #1"
  dataUrl?: string;
  transcript?: string;
  durationSec: number;
  createdAt: number;
}

export const MAX_VOICE_MEMOS = 3;

export interface Recipe {
  id: string;
  title: string;
  subtitle: string;
  category: CategoryId;
  subcategory: string;
  isFavorite: boolean;
  inCookSoon: boolean;
  cookSoonNote?: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: string; // e.g., "2 velike štruce (24 šnite)"
  panDimensions?: string; // Mandatory culinary cue: e.g., "Veliki protvan (35 × 25 cm)" or "Okrugli kalup (Ø 26 cm)"
  ovenTemp?: string; // e.g., "Umjerena vatra (~180 °C, bez ventilatora)"
  secretTip?: string; // Yellow Post-it note ("Mamina tajna")
  voiceMemos?: VoiceMemoItem[]; // Up to 3 saved voice secrets
  voiceMemoDataUrl?: string; // Legacy single audio recording
  voiceMemoDurationSec?: number;
  voiceMemoTranscript?: string;
  cookingLogs?: CookingLogEntry[]; // "Dnevnik pripreme"
  imageStatus: 'ai' | 'real';
  isAiGenerated?: boolean;
  aiRegenCount?: number;
  englishImagePrompt?: string;
  image?: string;
  imageUrl: string;
  originalImage?: string;
  originalScanUrl: string;
  originalHandwritingText: string;
  ingredientGroups: IngredientGroup[];
  steps: string[];
  momTips: string[];
  normalizedNotes: string[];
  // Local-First & Cloud Sync metadata
  syncStatus?: SyncStatus;
  imageSyncPending?: boolean;
  imageOptimized?: boolean;
  updatedAt?: number;
  createdAt: number;
  isDeleted?: boolean;
  isMockup?: boolean | number;
  isSample?: boolean | number;
  hidden?: boolean;
  authorEmail?: string;
}

export interface StepSegment {
  type: 'text' | 'timer';
  text: string;
  durationSeconds?: number;
  label?: string;
}

export interface NormalizedMeasureResult {
  normalizedText: string;
  conversions: Array<{
    original: string;
    normalized: string;
  }>;
}

export const CATEGORIES: CategoryDefinition[] = [
  {
    id: 'kolaci',
    title: 'Kolači & Slatko',
    shortTitle: 'Kolači',
    description: 'Biskviti, prhke pite, dizana tijesta, svečane torte i sitni kolači s maminog pladnja.',
    subcategories: ['Biskviti', 'Pite', 'Dizana tijesta', 'Torte', 'Sitni/suhi kolači'],
    accentColor: '#9E3B24',
  },
  {
    id: 'slano',
    title: 'Slana kuhinja & Ručak',
    shortTitle: 'Slano & Ručak',
    description: 'Nedjeljni ručkovi, domaće juhe, gusta variva na žlicu, slani krekeri i prilozi.',
    subcategories: ['Glavna jela', 'Juhe', 'Variva', 'Prilozi', 'Slani prilozi i grickalice'],
    accentColor: '#7A542E',
  },
  {
    id: 'mesarija',
    title: 'Mesarija & Sušiona',
    shortTitle: 'Mesarija',
    description: 'Provjerene obiteljske mjere soli, češnjaka i papra za pac, domaće češnjovke i sušenje.',
    subcategories: ['Pac za špek i plećku', 'Kobasice', 'Češnjovke', 'Sušenje mesa'],
    accentColor: '#6E2B1E',
  },
  {
    id: 'zimnica',
    title: 'Zimnica & Špajza',
    shortTitle: 'Zimnica',
    description: 'Staklenke pune ljeta: pečeni ajvar, kiseli krastavci, pekmez od šljiva i domaći likeri.',
    subcategories: ['Ukiseljeno povrće', 'Ajvar', 'Pekmezi', 'Domaći likeri i sokovi'],
    accentColor: '#4A5D3F',
  },
  {
    id: 'tradicija',
    title: 'Tradicija & Blagdani',
    shortTitle: 'Blagdani',
    description: 'Uskršnji goranski nadjev, božićni klasici i starinska jela koja čuvaju obiteljsku priču.',
    subcategories: ['Uskršnji goranski nadev', 'Božićni klasici', 'Starinska jela'],
    accentColor: '#B57B24',
  },
];

/**
 * Strips Croatian diacritics and normalizes case for forgiving, instant search.
 */
export function normalizeCroatianText(input: string): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .replace(/[čć]/g, 'c')
    .replace(/đ/g, 'd')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z')
    .trim();
}

/**
 * Filters recipes in real time across titles, subtitles, categories, subcategories,
 * and all ingredient names and original measures. Excludes soft-deleted recipes.
 */
export function filterRecipes(
  recipes: Recipe[],
  query: string,
  categoryId: CategoryId | 'all' = 'all',
  subcategory: string | 'all' = 'all'
): Recipe[] {
  const normalizedQuery = normalizeCroatianText(query);
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

  return recipes.filter((recipe) => {
    if (recipe.isDeleted) {
      return false;
    }
    if (categoryId !== 'all' && recipe.category !== categoryId) {
      return false;
    }
    if (subcategory !== 'all' && recipe.subcategory !== subcategory) {
      return false;
    }
    if (queryTokens.length === 0) {
      return true;
    }

    const categoryMeta = CATEGORIES.find((c) => c.id === recipe.category);
    const ingredientSearchBlob = recipe.ingredientGroups
      .flatMap((g) => [
        g.groupTitle,
        ...g.items.map((item) => `${item.name} ${item.unit} ${item.originalMeasure || ''}`),
      ])
      .join(' ');

    const searchableHaystack = normalizeCroatianText(
      [
        recipe.title,
        recipe.subtitle,
        recipe.subcategory,
        recipe.panDimensions || '',
        recipe.secretTip || '',
        categoryMeta?.title || '',
        ingredientSearchBlob,
        recipe.momTips.join(' '),
      ].join(' ')
    );

    return queryTokens.every((token) => searchableHaystack.includes(token));
  });
}

/**
 * Scales an ingredient quantity by multiplier (0.5 = Pola mjere, 1 = 1 mjera, 2 = Dupla mjera)
 * and formats it cleanly with Croatian decimal comma where needed.
 */
export function scaleIngredientAmount(
  baseAmount: number | null,
  unit: string,
  multiplier: number
): string {
  if (baseAmount === null || Number.isNaN(baseAmount)) {
    return unit.trim();
  }
  const scaled = baseAmount * multiplier;
  const rounded = Math.round(scaled * 100) / 100;

  let formattedNumber: string;
  if (Number.isInteger(rounded)) {
    formattedNumber = String(rounded);
  } else {
    formattedNumber = String(rounded).replace('.', ',');
  }

  return unit ? `${formattedNumber} ${unit}`.trim() : formattedNumber;
}

/**
 * Checks whether an ingredient item is sugar (excluding "vanilin šećer" packets if small, or reducing granulated/powdered sugar by 28%).
 */
export function isSugarIngredient(name: string): boolean {
  const norm = normalizeCroatianText(name);
  if (!norm.includes('secer') && !norm.includes('staub')) {
    return false;
  }
  // Do not reduce single 10g packets of vanilin šećer
  if (norm.includes('vanilin')) {
    return false;
  }
  return true;
}

/**
 * Scales an ingredient quantity by `multiplier` AND optionally applies the "Malo manje slatko"
 * (-28% sugar reduction) culinary toggle for old cakes that used excessive sugar.
 */
export function scaleIngredientWithSugarOption(
  item: IngredientItem,
  multiplier: number,
  lessSweet: boolean
): { displayAmount: string; isReducedSugar: boolean; originalScaledAmount?: string } {
  const originalScaled = scaleIngredientAmount(item.amount, item.unit, multiplier);
  if (!lessSweet || item.amount === null || !isSugarIngredient(item.name)) {
    return {
      displayAmount: originalScaled,
      isReducedSugar: false,
    };
  }

  // Reduce sugar by 28% (0.72 factor), rounding to nearest 5g if in grams >= 20
  const rawReduced = item.amount * multiplier * 0.72;
  const roundedReduced =
    item.unit.toLowerCase() === 'g' && rawReduced >= 20
      ? Math.round(rawReduced / 5) * 5
      : Math.round(rawReduced * 10) / 10;

  const formatted = Number.isInteger(roundedReduced)
    ? String(roundedReduced)
    : String(roundedReduced).replace('.', ',');

  return {
    displayAmount: item.unit ? `${formatted} ${item.unit}`.trim() : formatted,
    isReducedSugar: true,
    originalScaledAmount: originalScaled,
  };
}

/**
 * Translates archaic Croatian oven expressions ("umjerena vatra", "tiha vatra", "jaka vatra", "vruća rola")
 * into exact Celsius temperatures in parentheses.
 */
export function normalizeOvenTemperature(rawTempOrText: string): string {
  if (!rawTempOrText) return 'Umjerena vatra (~180 °C)';
  const lower = normalizeCroatianText(rawTempOrText);

  if (lower.includes('umjeren')) {
    if (rawTempOrText.includes('180')) return rawTempOrText;
    return 'Umjerena vatra (~180 °C)';
  }
  if (lower.includes('tiha vatra') || lower.includes('tihoj vatri') || lower.includes('lagana vatra') || lower.includes('laganoj vatri')) {
    if (rawTempOrText.includes('150')) return rawTempOrText;
    return 'Tiha vatra (~150 °C)';
  }
  if (lower.includes('jaka vatra') || lower.includes('jakoj vatri') || lower.includes('vruca rola') || lower.includes('vrucoj roli')) {
    if (rawTempOrText.includes('200') || rawTempOrText.includes('220')) return rawTempOrText;
    return 'Jaka vatra / vruća rola (200–220 °C)';
  }

  const degMatch = rawTempOrText.match(/(\d{3})\s*°?\s*C/i);
  if (degMatch) {
    const deg = parseInt(degMatch[1], 10);
    if (deg >= 175 && deg <= 185 && !lower.includes('vatr')) {
      return `${deg} °C (umjerena vatra)`;
    }
    if (deg <= 160 && !lower.includes('vatr')) {
      return `${deg} °C (tiha vatra)`;
    }
    if (deg >= 200 && !lower.includes('vatr')) {
      return `${deg} °C (vruća pećnica)`;
    }
  }

  return rawTempOrText;
}

/**
 * Estimates the baking pan or mold dimensions ("Dimenzije protvana / kalupa")
 * based on explicit notes or the quantity of eggs and flour in the recipe.
 */
export function estimatePanDimensions(rawText: string, category: CategoryId = 'kolaci'): string {
  const norm = normalizeCroatianText(rawText);

  if (category === 'mesarija') {
    return 'Drvena kaca za pac / štapovi u sušioni';
  }
  if (category === 'zimnica') {
    return 'Široki lonac za ukuhavanje + staklenke (370–450 ml)';
  }
  if (category === 'slano') {
    return 'Duboki lonac s debljim dnom (5 L)';
  }

  if (norm.includes('kiflic') || norm.includes('suhi kolac')) {
    return '2 velika plitka lima od pećnice (40 × 35 cm)';
  }
  if (norm.includes('struc') || norm.includes('orehnjac') || norm.includes('makovnjac')) {
    return 'Veliki duboki protvan za 2 štruce (36 × 26 cm)';
  }
  if (norm.includes('torta') || norm.includes('okrugli kalup')) {
    return 'Okrugli kalup za tortu (Ø 26 cm)';
  }
  if (norm.includes('srneci hrbat') || norm.includes('rebrasti kalup')) {
    return 'Duguljasti rebrasti kalup (30 × 11 cm)';
  }
  if (norm.includes('srednji protvan') || norm.includes('cupavc')) {
    return 'Srednji protvan (30 × 20 cm)';
  }

  // Check egg count or flour amount
  const eggMatch = norm.match(/(\d+)\s*(jaja|jaje|zumanj)/);
  if (eggMatch) {
    const eggs = parseInt(eggMatch[1], 10);
    if (eggs >= 6) return 'Veliki duboki protvan (38 × 26 cm)';
    if (eggs <= 3) return 'Srednji protvan (30 × 20 cm)';
  }

  return 'Standardni obiteljski protvan (35 × 25 cm)';
}

/**
 * "Sanity Check" for ingredients: cross-checks the preparation steps against the ingredient list.
 * If an ingredient is mentioned in the steps (e.g. "dodaj ulje", "vanilin šećer", "rum", "mlijeko")
 * but was forgotten in the ingredients list, automatically appends it with a clear warning note.
 */
export function crossCheckMissingIngredients(
  ingredientGroups: IngredientGroup[],
  steps: string[]
): { updatedGroups: IngredientGroup[]; addedItems: string[] } {
  const existingBlob = normalizeCroatianText(
    ingredientGroups.flatMap((g) => g.items.map((i) => i.name)).join(' ')
  );
  const stepsBlob = normalizeCroatianText(steps.join(' '));

  const commonForgottenCandidates: Array<{
    keywordRegex: RegExp;
    checkToken: string;
    defaultName: string;
    defaultAmount: number | null;
    defaultUnit: string;
    originalMeasure: string;
  }> = [
    {
      keywordRegex: /\b(ulje|ulja|uljem)\b/,
      checkToken: 'ulj',
      defaultName: 'suncokretovo ulje (spomenuto u postupku)',
      defaultAmount: 100,
      defaultUnit: 'ml',
      originalMeasure: 'provjera postupka (~1 dcl)',
    },
    {
      keywordRegex: /\b(mlijeko|mlijeka|mlijekom)\b/,
      checkToken: 'mlijek',
      defaultName: 'mlijeko (spomenuto u postupku)',
      defaultAmount: 150,
      defaultUnit: 'ml',
      originalMeasure: 'provjera postupka',
    },
    {
      keywordRegex: /\b(rum|ruma|rumom)\b/,
      checkToken: 'rum',
      defaultName: 'domaći rum za aromu (spomenuto u postupku)',
      defaultAmount: 2,
      defaultUnit: 'žlice',
      originalMeasure: 'provjera postupka',
    },
    {
      keywordRegex: /\b(cimet|cimeta|cimetom)\b/,
      checkToken: 'cimet',
      defaultName: 'mljeveni cimet (spomenuto u postupku)',
      defaultAmount: 1,
      defaultUnit: 'žličica',
      originalMeasure: 'provjera postupka',
    },
    {
      keywordRegex: /\b(vanilin)\b/,
      checkToken: 'vanilin',
      defaultName: 'vanilin šećer (spomenuto u postupku)',
      defaultAmount: 10,
      defaultUnit: 'g',
      originalMeasure: '1 vrećica (iz postupka)',
    },
    {
      keywordRegex: /\b(prasak za pecivo|praska za pecivo)\b/,
      checkToken: 'prasak',
      defaultName: 'prašak za pecivo (spomenuto u postupku)',
      defaultAmount: 12,
      defaultUnit: 'g',
      originalMeasure: '1 vrećica (iz postupka)',
    },
  ];

  const addedItems: string[] = [];
  const clonedGroups: IngredientGroup[] = ingredientGroups.map((g) => ({
    groupTitle: g.groupTitle,
    items: [...g.items],
  }));

  for (const candidate of commonForgottenCandidates) {
    if (candidate.keywordRegex.test(stepsBlob) && !existingBlob.includes(candidate.checkToken)) {
      if (clonedGroups.length === 0) {
        clonedGroups.push({ groupTitle: 'Glavni sastojci', items: [] });
      }
      clonedGroups[0].items.push({
        id: `sanity-${candidate.checkToken}-${Date.now()}`,
        name: candidate.defaultName,
        amount: candidate.defaultAmount,
        unit: candidate.defaultUnit,
        originalMeasure: candidate.originalMeasure,
      });
      addedItems.push(candidate.defaultName);
    }
  }

  return { updatedGroups: clonedGroups, addedItems };
}

/**
 * Generates a clean, category-aware English food photography prompt based strictly on the dish title,
 * category, and actual ingredient list (without static keyword matchers on preparation steps).
 * If category is 'kolaci' (Kolači & Slatko), strictly forbids meat, sausages, bacon, and garlic.
 */
export function translateDishToEnglishPrompt(
  dishName: string,
  ingredients: string[] = [],
  category: CategoryId = 'kolaci',
  _steps: string[] = [],
  customEnglishPrompt?: string
): string {
  if (customEnglishPrompt && customEnglishPrompt.trim().length > 0) {
    return customEnglishPrompt.trim();
  }

  const cleanTitle = (dishName || 'Homemade traditional family dish').trim();
  const cleanIngredients = ingredients
    .map((ing) => ing.trim())
    .filter(Boolean)
    .slice(0, 10)
    .join(', ');

  const categoryDescriptors: Record<CategoryId, string> = {
    kolaci:
      'Authentic homemade traditional sweet dessert, baked cake or pastry served on a vintage porcelain plate or wooden board, bakery food photography',
    slano:
      'Authentic homemade traditional savory dish, freshly prepared family recipe served on a rustic wooden table, food photography',
    mesarija:
      'Authentic homemade traditional cured meat delicacy sliced on a rustic wooden cutting board, artisan charcuterie photography',
    zimnica:
      'Authentic homemade traditional winter preserve in a rustic glass jar on a wooden pantry table, food photography',
    tradicija:
      'Authentic homemade traditional festive Croatian holiday family dish on a rustic platter, food photography',
  };

  const baseDesc = categoryDescriptors[category] || categoryDescriptors.kolaci;
  const ingredientsClause = cleanIngredients
    ? `, made with ${cleanIngredients}`
    : '';

  const categorySafetyGuard =
    category === 'kolaci'
      ? 'Sweet bakery dessert only: strictly no meat, no sausages, no bacon, no garlic, no savory stew.'
      : 'No plastic 3D renders, no text or watermarks.';

  return `${baseDesc}, dish: "${cleanTitle}"${ingredientsClause}, soft natural window lighting, shot on 35mm lens. ${categorySafetyGuard}`;
}

export const generateImagePrompt = translateDishToEnglishPrompt;

/**
 * Generates both the English culinary prompt for AI image generation and the Croatian display description
 * for warm, authentic homemade food photography (avoiding plastic stock look).
 */
export function buildAuthenticDishImagePrompt(
  dishName: string,
  ingredients: string[] = [],
  category: CategoryId = 'kolaci',
  steps: string[] = [],
  customEnglishPrompt?: string
): {
  englishPrompt: string;
  prompt: string;
  style: string;
  negativePrompt: string;
  fullPrompt: string;
} {
  const cleanTitle = (dishName || 'Domaći recept iz mamine teke').trim();
  const englishPrompt = translateDishToEnglishPrompt(
    cleanTitle,
    ingredients,
    category,
    steps,
    customEnglishPrompt
  );
  const prompt = `Prava, topla fotografija domaćeg jela: ${cleanTitle}, posluženo na drvenoj dasci ili pladnju na rustikalnom stolu, prirodno dnevno svjetlo s prozora, rustikalna domaća atmosfera, mrvice na stolu, nezaglađeno, autentično, u stilu domaće kuharice, meke sjene, fokus na teksturi hrane.`;
  const style = `Realistična fotografija hrane (Food Photography), toplo prirodno osvjetljenje (Golden Hour), shot on 35mm lens, plitka dubina polja (f/2.8), bez umjetnog sjaja.`;
  const negativePrompt =
    category === 'kolaci'
      ? `No meat, no sausages, no bacon, no garlic, no soup or stew, no restaurant styling, no plastic 3D renders, no text or watermarks.`
      : `No restaurant styling, no plastic 3D renders, no text or watermarks, crtić, ilustracija, plastična hrana.`;

  return {
    englishPrompt,
    prompt,
    style,
    negativePrompt,
    fullPrompt: `${englishPrompt} | HR: ${prompt}`,
  };
}

/**
 * Builds a clean, single-tap Express Shopping List ("Ekspresni popis za dućan")
 * ready to paste into WhatsApp, Viber, or Google Keep.
 */
export function buildExpressShoppingList(
  recipe: Recipe,
  multiplier = 1,
  checkedIngredients: Record<string, boolean> = {},
  lessSweet = false
): string {
  const measureLabel =
    multiplier === 0.5 ? 'Pola mjere' : multiplier === 2 ? 'Dupla mjera' : '1 mjera';
  const lines: string[] = [
    `🛒 Trebamo za ${recipe.title} (${measureLabel}${lessSweet ? ', manje slatko' : ''}):`,
  ];

  for (const group of recipe.ingredientGroups) {
    for (const item of group.items) {
      // Only include items that haven't been crossed off at home
      if (checkedIngredients[item.id]) continue;
      const { displayAmount } = scaleIngredientWithSugarOption(item, multiplier, lessSweet);
      lines.push(`- ${displayAmount ? `${displayAmount} ` : ''}${item.name}`);
    }
  }

  if (recipe.panDimensions) {
    lines.push(`\n📐 Kalup / protvan: ${recipe.panDimensions}`);
  }
  lines.push(`— Mamina Teka`);
  return lines.join('\n');
}

/**
 * Normalizes traditional Croatian regional & notebook measurements into standard metric units,
 * including archaic oven temperatures.
 */
export function normalizeTraditionalMeasures(rawText: string): NormalizedMeasureResult {
  if (!rawText) {
    return { normalizedText: '', conversions: [] };
  }

  const conversions: Array<{ original: string; normalized: string }> = [];
  let text = rawText;

  const rules: Array<{
    pattern: RegExp;
    replace: (match: string, ...groups: string[]) => { replacement: string; normalizedLabel: string };
  }> = [
    {
      pattern: /\bfrtalj\s+kile\b/gi,
      replace: () => ({ replacement: '250 g', normalizedLabel: '250 g' }),
    },
    {
      pattern: /\b(pol|pola)\s+kile\b/gi,
      replace: () => ({ replacement: '500 g', normalizedLabel: '500 g' }),
    },
    {
      pattern: /\btri\s+frtalja\s+kile\b/gi,
      replace: () => ({ replacement: '750 g', normalizedLabel: '750 g' }),
    },
    {
      pattern: /\b(\d+)\s*(deka|dag|dkg)\b/gi,
      replace: (_match, numStr) => {
        const grams = parseInt(numStr, 10) * 10;
        return { replacement: `${grams} g`, normalizedLabel: `${grams} g` };
      },
    },
    {
      pattern: /\b(\d+[.,]?\d*)\s*dcl\b/gi,
      replace: (_match, numStr) => {
        const val = parseFloat(numStr.replace(',', '.'));
        const ml = Math.round(val * 100);
        return { replacement: `${ml} ml`, normalizedLabel: `${ml} ml` };
      },
    },
    {
      pattern: /\b(pol|pola)\s+deci(litra)?\b/gi,
      replace: () => ({ replacement: '50 ml', normalizedLabel: '50 ml' }),
    },
    {
      pattern: /\b(jedna\s+|1\s+)?[čc]a[šs]a\s+od\s+(kiselog\s+mlijeka|jogurta|vrhnja)\b/gi,
      replace: () => ({ replacement: '200 ml', normalizedLabel: '200 ml (standardna čašica)' }),
    },
    {
      pattern: /\b(jedan|1)\s+pra[šs]ak(\s+za\s+pecivo)?\b/gi,
      replace: () => ({
        replacement: '12 g praška za pecivo (1 vrećica)',
        normalizedLabel: '12 g (1 vrećica)',
      }),
    },
    {
      pattern: /\b(jedan|1)\s+vanilin(\s+[šs]e[ćc]er)?\b/gi,
      replace: () => ({
        replacement: '10 g vanilin šećera (1 vrećica)',
        normalizedLabel: '10 g (1 vrećica)',
      }),
    },
    {
      pattern: /\bna\s+vrh\s+no[žz]a\b/gi,
      replace: () => ({
        replacement: '1 prstohvat (~1 g)',
        normalizedLabel: '1 prstohvat (~1 g)',
      }),
    },
    {
      pattern: /\b(jedna\s+|1\s+)?[šs]aka\b/gi,
      replace: () => ({
        replacement: '~40 g (1 šaka)',
        normalizedLabel: '~40 g',
      }),
    },
    {
      pattern: /\bna\s+umjerenoj\s+vatri\b/gi,
      replace: () => ({
        replacement: 'na umjerenoj vatri (~180 °C)',
        normalizedLabel: 'Umjerena vatra (~180 °C)',
      }),
    },
    {
      pattern: /\bu\s+vru[ćc]oj\s+roli\b/gi,
      replace: () => ({
        replacement: 'u vrućoj roli (200–220 °C)',
        normalizedLabel: 'Vruća rola (200–220 °C)',
      }),
    },
    {
      pattern: /\bna\s+tihoj\s+vatri\b/gi,
      replace: () => ({
        replacement: 'na tihoj vatri (~150 °C)',
        normalizedLabel: 'Tiha vatra (~150 °C)',
      }),
    },
  ];

  for (const rule of rules) {
    text = text.replace(rule.pattern, (match, ...args) => {
      const { replacement, normalizedLabel } = rule.replace(match, ...args);
      conversions.push({
        original: match,
        normalized: normalizedLabel,
      });
      return replacement;
    });
  }

  return {
    normalizedText: text,
    conversions,
  };
}

/**
 * Parses a cooking step string and extracts clickable timer durations (minutes, hours, seconds).
 */
export function parseStepTimers(stepText: string): StepSegment[] {
  if (!stepText) return [];

  // Matches e.g. "45 minuta", "30-35 minuta", "20 min", "1 sat", "2 sata", "30 sekundi"
  const timerRegex =
    /\b(\d+)(?:\s*[-–do]+\s*(\d+))?\s*(minuta|minute|min|sati|sata|sat|sekundi|sekunde|sek)\b/gi;

  const segments: StepSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = timerRegex.exec(stepText)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        text: stepText.slice(lastIndex, match.index),
      });
    }

    const fullMatch = match[0];
    const firstNum = parseInt(match[1], 10);
    const secondNum = match[2] ? parseInt(match[2], 10) : null;
    const unitRaw = match[3].toLowerCase();

    // If a range like "30-35 minuta" is given, use the lower bound so food doesn't burn
    const targetValue = secondNum ? firstNum : firstNum;
    let durationSeconds = targetValue * 60;

    if (unitRaw.startsWith('sat')) {
      durationSeconds = targetValue * 3600;
    } else if (unitRaw.startsWith('sek')) {
      durationSeconds = targetValue;
    }

    segments.push({
      type: 'timer',
      text: fullMatch,
      durationSeconds,
      label: fullMatch,
    });

    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < stepText.length) {
    segments.push({
      type: 'text',
      text: stepText.slice(lastIndex),
    });
  }

  return segments;
}

/**
 * Formats remaining timer seconds as MM:SS or HH:MM:SS.
 */
export function formatTimerSeconds(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Returns the normalized array of saved voice secrets (up to MAX_VOICE_MEMOS = 3) for a recipe.
 * Migrates any legacy single voiceMemoDataUrl or voiceMemoTranscript into the array.
 */
export function getRecipeVoiceMemos(recipe: Pick<Recipe, 'voiceMemos' | 'voiceMemoDataUrl' | 'voiceMemoTranscript' | 'voiceMemoDurationSec'>): VoiceMemoItem[] {
  if (Array.isArray(recipe.voiceMemos)) {
    return recipe.voiceMemos.slice(0, MAX_VOICE_MEMOS);
  }
  if (recipe.voiceMemoDataUrl || recipe.voiceMemoTranscript) {
    return [
      {
        id: 'legacy-memo-1',
        label: 'Tajna #1',
        dataUrl: recipe.voiceMemoDataUrl,
        transcript: recipe.voiceMemoTranscript,
        durationSec: recipe.voiceMemoDurationSec || 12,
        createdAt: 1000,
      },
    ];
  }
  return [];
}

/**
 * Adds a new voice secret to the list if fewer than MAX_VOICE_MEMOS (3) are saved.
 * Throws or returns unchanged if already at 3.
 */
export function addVoiceMemoToList(
  existing: VoiceMemoItem[],
  newMemo: Omit<VoiceMemoItem, 'id' | 'label' | 'createdAt'>
): { memos: VoiceMemoItem[]; added: boolean; error?: string } {
  if (existing.length >= MAX_VOICE_MEMOS) {
    return {
      memos: existing,
      added: false,
      error: 'Možete spremiti najviše 3 glasovne tajne. Obrišite jednu kako biste snimili novu.',
    };
  }
  const nextNumber = existing.length + 1;
  const created: VoiceMemoItem = {
    id: `voice-secret-${Date.now()}-${nextNumber}`,
    label: `Tajna #${nextNumber}`,
    dataUrl: newMemo.dataUrl,
    transcript: newMemo.transcript,
    durationSec: Math.max(1, newMemo.durationSec || 10),
    createdAt: Date.now(),
  };
  const updated = [...existing, created].map((item, idx) => ({
    ...item,
    label: `Tajna #${idx + 1}`,
  }));
  return { memos: updated, added: true };
}

/**
 * Removes a voice secret by ID and re-numbers remaining secrets cleanly.
 */
export function removeVoiceMemoFromList(existing: VoiceMemoItem[], idToRemove: string): VoiceMemoItem[] {
  return existing
    .filter((m) => m.id !== idToRemove)
    .map((item, idx) => ({
      ...item,
      label: `Tajna #${idx + 1}`,
    }));
}

export const DELETED_RECIPE_IDS_STORAGE_KEY = 'mamina_teka_deleted_recipe_ids';
export const HIDE_SAMPLE_MANUSCRIPTS_STORAGE_KEY = 'mamina_teka_hide_sample_manuscripts';

/**
 * Pure filter that excludes recipes marked as `isDeleted`, `hidden`, or present in the persistent deleted IDs set.
 */
export function applyDeletedRecipeFilter(
  recipes: Recipe[],
  deletedIds: Iterable<string> = [],
  mockupsRemoved = false
): Recipe[] {
  const deletedSet = new Set(deletedIds);
  return recipes.filter((r) => {
    if (!r || !r.id) return false;
    if (r.isDeleted || r.hidden || deletedSet.has(r.id)) return false;
    if (mockupsRemoved && (r.isMockup || r.isSample || MOCKUP_RECIPE_ID_SET.has(r.id))) {
      return false;
    }
    return true;
  });
}

/**
 * Pure state machine for the mandatory 2-step (double) confirmation before deleting a recipe:
 * - Step 0 -> 1: Opens first confirmation warning ("Jeste li sigurni da želite obrisati recept?")
 * - Step 1 -> 2: Advances to second/final confirmation ("Dvostruka provjera: potvrdite trajno brisanje")
 * - Step 2 -> 'confirmed': Executes the permanent deletion
 */
export function advanceDeleteConfirmationStep(currentStep: 0 | 1 | 2): 1 | 2 | 'confirmed' {
  if (currentStep === 0) return 1;
  if (currentStep === 1) return 2;
  return 'confirmed';
}

const REGEN_CAMERA_VARIATIONS = [
  '45-degree angle on a rustic wooden board, morning window light, natural linen napkin',
  'overhead flat-lay composition on an old oak kitchen table, warm golden hour sunlight',
  'close-up macro food photography highlighting homemade texture, parchment paper, cozy cottage kitchen',
  'three-quarter side view on an heirloom flat platter, checkered kitchen towel, soft natural side lighting',
];

/**
 * Builds a varied English culinary prompt for regenerating a new AI dish photo so each click on
 * "Generiraj AI sliku" produces a distinct composition and lighting style based on ingredients and steps.
 */
export function buildRegeneratedAiPrompt(
  dishName: string,
  ingredients: string[] = [],
  category: CategoryId = 'kolaci',
  variationIndex = 1,
  steps: string[] = [],
  customEnglishPrompt?: string
): string {
  const base = translateDishToEnglishPrompt(
    dishName,
    ingredients,
    category,
    steps,
    customEnglishPrompt
  );
  const variation =
    REGEN_CAMERA_VARIATIONS[Math.abs(variationIndex) % REGEN_CAMERA_VARIATIONS.length];
  return `${base} Variation #${variationIndex}: ${variation}.`;
}

/**
 * Returns true ONLY if the recipe belongs to "Kolači & Slatko" ('kolaci').
 * Savory dishes ('slano'), cured meats ('mesarija'), pantry ('zimnica'), and general holiday dishes
 * do not display the "-28% šećera" toggle.
 */
export function shouldShowLessSweetToggle(category: CategoryId): boolean {
  return category === 'kolaci';
}

export interface VisionOcrIngredient {
  phase: string;
  name: string;
  amount: string;
  originalAmount?: string;
}

export interface VisionOcrStructuredOutput {
  title: string;
  subtitle?: string;
  category: string;
  subcategory: string;
  oven?: {
    temperature: string;
    notes?: string;
  };
  panSize?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: string;
  ingredients: VisionOcrIngredient[];
  instructions: string[];
  momSecret?: string;
  englishImagePrompt?: string;
}

/**
 * Resolves either a Croatian shelf label (e.g. "Slana kuhinja & Ručak", "Kolači & Slatko")
 * or a category ID into a valid CategoryId.
 */
export function resolveCategoryFromLabel(rawCategory: string, title = '', subcategory = ''): CategoryId {
  const norm = normalizeCroatianText(`${rawCategory} ${subcategory} ${title}`);
  const exactId = rawCategory?.trim().toLowerCase() as CategoryId;
  if (['kolaci', 'slano', 'mesarija', 'zimnica', 'tradicija'].includes(exactId)) {
    return exactId;
  }
  if (rawCategory.includes('Slana') || rawCategory.includes('Ručak') || norm.includes('slana kuhinja')) {
    return 'slano';
  }
  if (rawCategory.includes('Mesarija') || rawCategory.includes('Sušiona') || norm.includes('mesarija')) {
    return 'mesarija';
  }
  if (rawCategory.includes('Zimnica') || rawCategory.includes('Špajza') || norm.includes('zimnica')) {
    return 'zimnica';
  }
  if (rawCategory.includes('Tradicija') || rawCategory.includes('Blagdani') || norm.includes('tradicija')) {
    return 'tradicija';
  }
  if (rawCategory.includes('Kolači') || rawCategory.includes('Slatko') || norm.includes('kolaci')) {
    return 'kolaci';
  }

  // Fallback by dish context
  if (norm.includes('kreker') || norm.includes('slani') || norm.includes('gulas') || norm.includes('juha') || norm.includes('varivo')) {
    return 'slano';
  }
  if (norm.includes('cesnjov') || norm.includes('kobasic') || norm.includes('spek') || norm.includes('pac')) {
    return 'mesarija';
  }
  if (norm.includes('ajvar') || norm.includes('pekmez') || norm.includes('ukiselj')) {
    return 'zimnica';
  }
  if (norm.includes('uskrs') || norm.includes('bozic') || norm.includes('nadjev')) {
    return 'tradicija';
  }
  return 'kolaci';
}

/**
 * Parses an ingredient amount string from Gemini Vision (e.g., "2 dl", "250 g", "1 žličica", "3-4 žlice")
 * into numeric amount + unit + originalMeasure so the 0.5x / 1x / 2x calculator works seamlessly.
 */
export function parseIngredientAmountString(
  amountStr: string,
  originalAmountStr?: string
): { amount: number | null; unit: string; originalMeasure?: string } {
  const cleanAmount = (amountStr || '').trim();
  const cleanOrig = (originalAmountStr || '').trim();

  if (!cleanAmount) {
    return {
      amount: null,
      unit: '',
      originalMeasure: cleanOrig || undefined,
    };
  }

  // Convert dl / dcl / deka / dag into standard ml / g while preserving originalMeasure
  const dlMatch = cleanAmount.match(/^(\d+[.,]?\d*)\s*(dl|dcl)$/i);
  if (dlMatch) {
    const val = parseFloat(dlMatch[1].replace(',', '.'));
    return {
      amount: Math.round(val * 100),
      unit: 'ml',
      originalMeasure: cleanOrig || cleanAmount,
    };
  }

  const dagMatch = cleanAmount.match(/^(\d+[.,]?\d*)\s*(dag|dkg|deka)$/i);
  if (dagMatch) {
    const val = parseFloat(dagMatch[1].replace(',', '.'));
    return {
      amount: Math.round(val * 10),
      unit: 'g',
      originalMeasure: cleanOrig || cleanAmount,
    };
  }

  const numUnitMatch = cleanAmount.match(/^(\d+[.,]?\d*)\s*(.*)$/);
  if (numUnitMatch) {
    const val = parseFloat(numUnitMatch[1].replace(',', '.'));
    const unit = numUnitMatch[2].trim() || 'kom';
    return {
      amount: Number.isNaN(val) ? null : val,
      unit,
      originalMeasure:
        cleanOrig && cleanOrig.toLowerCase() !== cleanAmount.toLowerCase()
          ? cleanOrig
          : cleanOrig || undefined,
    };
  }

  return {
    amount: null,
    unit: cleanAmount,
    originalMeasure: cleanOrig || undefined,
  };
}

/**
 * Maps the structured JSON returned by Gemini Vision (`gemini-3.8-flash`) into the application's
 * internal Recipe structure while preserving all original fields.
 */
export function mapVisionOcrResponseToRecipe(
  ocr: VisionOcrStructuredOutput,
  rawHandwritingText = ''
) {
  const title = (ocr.title || '').trim();
  if (!title) {
    throw new Error('Naziv recepta nije prepoznat sa slike.');
  }

  const safeCategory = resolveCategoryFromLabel(
    ocr.category || '',
    title,
    ocr.subcategory || ''
  );
  const categoryDef = CATEGORIES.find((c) => c.id === safeCategory) || CATEGORIES[0];
  const subcategory = (ocr.subcategory || '').trim() || categoryDef.subcategories[0] || 'Ostalo';

  // Group ingredients by phase
  const groupMap = new Map<string, IngredientItem[]>();
  const rawIngredients = Array.isArray(ocr.ingredients) ? ocr.ingredients : [];

  rawIngredients.forEach((ing, idx) => {
    const phaseTitle = (ing.phase || '').trim() || 'Sastojci';
    const parsedAmt = parseIngredientAmountString(ing.amount, ing.originalAmount);
    const item: IngredientItem = {
      id: `ocr-ing-${idx}-${Date.now()}`,
      name: (ing.name || '').trim(),
      amount: parsedAmt.amount,
      unit: parsedAmt.unit,
      originalMeasure: parsedAmt.originalMeasure,
    };
    if (!item.name) return;
    const list = groupMap.get(phaseTitle) || [];
    list.push(item);
    groupMap.set(phaseTitle, list);
  });

  const mappedGroups: IngredientGroup[] = Array.from(groupMap.entries()).map(
    ([groupTitle, items]) => ({
      groupTitle,
      items,
    })
  );

  const steps = Array.isArray(ocr.instructions)
    ? ocr.instructions.map((s) => s.trim()).filter(Boolean)
    : [];

  const sanity = crossCheckMissingIngredients(mappedGroups, steps);

  const rawOvenTemp = ocr.oven?.temperature?.trim() || '';
  const rawOvenNotes = ocr.oven?.notes?.trim() || '';
  const combinedOven = [rawOvenTemp, rawOvenNotes].filter(Boolean).join(', ');
  const ovenTemp = combinedOven
    ? combinedOven.includes('°')
      ? combinedOven
      : normalizeOvenTemperature(combinedOven)
    : '';

  const panDimensions =
    ocr.panSize?.trim() || estimatePanDimensions(`${title} ${rawHandwritingText}`, safeCategory);

  const momSecret = (ocr.momSecret || '').trim();
  const momTips = momSecret ? [momSecret] : [];

  const flatIngredients = sanity.updatedGroups.flatMap((g) => g.items.map((i) => i.name));
  const rawOcrPrompt = (ocr.englishImagePrompt || '').trim();
  const builtPrompt = buildAuthenticDishImagePrompt(
    title,
    flatIngredients,
    safeCategory,
    steps,
    rawOcrPrompt || undefined
  );
  const finalEnglishPrompt =
    rawOcrPrompt.length > 10 ? rawOcrPrompt : builtPrompt.englishPrompt;

  return {
    // Exact Gemini Vision fields
    title,
    category: safeCategory,
    categoryLabel: categoryDef.title,
    subcategory,
    oven: {
      temperature: rawOvenTemp || ovenTemp,
      notes: rawOvenNotes,
    },
    panSize: panDimensions,
    prepTime: Number(ocr.prepTime) || 20,
    cookTime: Number(ocr.cookTime) >= 0 ? Number(ocr.cookTime) : 25,
    ingredients: rawIngredients,
    instructions: steps,
    momSecret,
    // Mapped app Recipe fields
    subtitle:
      ocr.subtitle?.trim() ||
      (momSecret
        ? momSecret
        : `Recept iz mamine bilježnice (${categoryDef.shortTitle} · ${subcategory})`),
    prepTimeMinutes: Number(ocr.prepTime) || 20,
    cookTimeMinutes: Number(ocr.cookTime) >= 0 ? Number(ocr.cookTime) : 25,
    servings: ocr.servings?.trim() || panDimensions,
    panDimensions,
    ovenTemp,
    secretTip: momSecret,
    ingredientGroups: sanity.updatedGroups,
    steps,
    momTips,
    normalizedNotes: [],
    sanityCheckAdded: sanity.addedItems,
    imagePrompt: {
      ...builtPrompt,
      englishPrompt: finalEnglishPrompt,
    },
    englishImagePrompt: finalEnglishPrompt,
  };
}

/**
 * Generates a deterministic, URL-safe invite key for a given Family Vault ID (`trezorId`).
 */
export function generateVaultInviteKey(trezorId: string): string {
  const clean = (trezorId || 'obiteljski-trezor').trim();
  let hash = 2166136261;
  const seed = `mamina-teka-zrina:${clean}`;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  const suffix = clean
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 6)
    .toLowerCase();
  return `mt-${hex}${suffix ? `-${suffix}` : ''}`;
}

/**
 * Validates that an inviteKey matches the expected format or deterministic key for trezorId.
 */
export function isValidVaultInvite(trezorId: string, inviteKey: string): boolean {
  const cleanId = (trezorId || '').trim();
  const cleanKey = (inviteKey || '').trim();
  if (!cleanId || cleanId.length < 3 || cleanId.length > 128) return false;
  if (!/^[a-zA-Z0-9_-]+$/.test(cleanId)) return false;
  if (!cleanKey || cleanKey.length < 4 || cleanKey.length > 128) return false;
  return cleanKey === generateVaultInviteKey(cleanId) || cleanKey.startsWith('mt-');
}

/**
 * Builds the shareable Family Vault invite link (`?trezorId=...&inviteKey=...`).
 */
export function buildFamilyInviteLink(
  baseOriginUrl: string,
  trezorId: string,
  inviteKey?: string
): string {
  const cleanId = (trezorId || 'obiteljski-trezor').trim();
  const key = (inviteKey || '').trim() || generateVaultInviteKey(cleanId);
  const base = (baseOriginUrl || 'https://zrina.app').replace(/\/+$/, '');
  return `${base}/?trezorId=${encodeURIComponent(cleanId)}&inviteKey=${encodeURIComponent(key)}`;
}

/**
 * Builds the WhatsApp share URL (`https://wa.me/?text=...`) for a Family Vault invite link.
 */
export function buildWhatsAppInviteUrl(inviteLink: string): string {
  const message = `Pridruži se našoj digitalnoj Maminoj Teki recepata: ${inviteLink}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * Parses `?trezorId=...&inviteKey=...` from a URL query string.
 */
export function parseVaultInviteFromSearch(
  search: string
): { trezorId: string; inviteKey: string } | null {
  if (!search) return null;
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const trezorId = (params.get('trezorId') || '').trim();
  const inviteKey = (params.get('inviteKey') || '').trim();
  if (!isValidVaultInvite(trezorId, inviteKey)) {
    return null;
  }
  return { trezorId, inviteKey };
}

/**
 * Checks if a candidate image URL is a valid renderable image source (excluding placeholder tokens like 'local-indexeddb').
 */
export function isValidPrintableImageUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'local-indexeddb' || trimmed === 'undefined' || trimmed === 'null') {
    return false;
  }
  return (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:')
  );
}

/**
 * Resolves the best printable dish photo URL (`recipe.imageUrl || recipe.image || recipe.dishImageUrl`),
 * prioritizing real raster data URLs (`data:image/jpeg`, `data:image/webp`, `data:image/png`) over
 * static placeholders or `'local-indexeddb'` markers so AI dish photos always appear in PDF output.
 */
export function resolvePrintableRecipeImage(
  recipe: Partial<Recipe> & { dishImageUrl?: string },
  fallbackUri = ''
): string {
  const candidates = [
    recipe.imageUrl,
    recipe.image,
    recipe.dishImageUrl,
    recipe.originalScanUrl,
    recipe.originalImage,
  ];

  // First pass: prefer raster data URLs (AI-generated or camera photos)
  for (const c of [recipe.imageUrl, recipe.image, recipe.dishImageUrl]) {
    if (
      isValidPrintableImageUrl(c) &&
      c!.trim().startsWith('data:image/') &&
      !c!.trim().startsWith('data:image/svg')
    ) {
      return c!.trim();
    }
  }

  // Second pass: any valid printable URL
  for (const c of candidates) {
    if (isValidPrintableImageUrl(c)) {
      return c!.trim();
    }
  }

  return fallbackUri;
}

/**
 * Resolves the printable original scanned handwriting image (`originalScanUrl` / `originalImage`).
 */
export function resolvePrintableOriginalScan(
  recipe: Partial<Recipe> & { dishImageUrl?: string },
  fallbackUri = ''
): string {
  const candidates = [
    recipe.originalScanUrl,
    recipe.originalImage,
    recipe.imageUrl,
    recipe.image,
  ];

  for (const c of [recipe.originalScanUrl, recipe.originalImage]) {
    if (
      isValidPrintableImageUrl(c) &&
      c!.trim().startsWith('data:image/') &&
      !c!.trim().startsWith('data:image/svg')
    ) {
      return c!.trim();
    }
  }

  for (const c of candidates) {
    if (isValidPrintableImageUrl(c)) {
      return c!.trim();
    }
  }

  return fallbackUri;
}

export type BookletPageType = 'cover' | 'intro' | 'toc' | 'recipe' | 'notes' | 'colophon';

export interface BookletPageDescriptor {
  pageNumber: number; // 1-indexed logical A5 page number (1..totalPages)
  type: BookletPageType;
  recipeIndex?: number; // 0-indexed into selected recipes when type === 'recipe'
  notesIndex?: number; // 1-indexed note page counter when type === 'notes'
}

export interface BookletSpreadDescriptor {
  spreadIndex: number; // 0..(totalPages / 2 - 1)
  sheetNumber: number; // 1-indexed physical A4 sheet number
  side: 'front' | 'back';
  leftPage: BookletPageDescriptor;
  rightPage: BookletPageDescriptor;
}

/**
 * Builds the A5 Booklet Imposition ("Pravilo četvorke") for printing an A5 booklet on landscape A4 sheets:
 * 1. Logical A5 page sequence:
 *    - Str. 1: Svečana naslovnica ('cover')
 *    - Str. 2: Uvodna priča o Teki i posveta ('intro')
 *    - Str. 3: Kazalo recepata ('toc')
 *    - Str. 4..N: Recepti (1 recept = 1 A5 stranica, 'recipe')
 *    - Padding pages (if needed to reach a multiple of 4): "Mamine zabilješke i kulinarske crtice" ('notes')
 *    - Final page (`totalPages`): Zadnja stranica (korica) — Kolofon i obiteljska vinjeta ('colophon')
 * 2. Total pages is always a multiple of 4 (`const totalPages = Math.ceil(pages.length / 4) * 4`).
 * 3. Pairs pages into spreads for two-sided (duplex) printing:
 *    For each sheet `i` from 0 to `(totalPages / 4) - 1`:
 *    - Prednja strana lista (Front): Lijevo `totalPages - 2*i`, Desno `2*i + 1`
 *    - Stražnja strana lista (Back): Lijevo `2*i + 2`, Desno `totalPages - 2*i - 1`
 */
export function buildA5BookletImposition(recipeCount: number): {
  totalPages: number;
  logicalPages: BookletPageDescriptor[];
  spreads: BookletSpreadDescriptor[];
} {
  const safeRecipeCount = Math.max(0, Math.floor(recipeCount));
  const corePages: Omit<BookletPageDescriptor, 'pageNumber'>[] = [
    { type: 'cover' }, // Str. 1
    { type: 'intro' }, // Str. 2
    { type: 'toc' },   // Str. 3
  ];

  for (let r = 0; r < safeRecipeCount; r++) {
    corePages.push({ type: 'recipe', recipeIndex: r });
  }

  // Reserve 1 page at the very end for the Back Cover ('colophon')
  const minRequiredWithColophon = corePages.length + 1;
  const totalPages = Math.max(4, Math.ceil(minRequiredWithColophon / 4) * 4);
  const notesCount = totalPages - corePages.length - 1;

  for (let n = 0; n < notesCount; n++) {
    corePages.push({ type: 'notes', notesIndex: n + 1 });
  }

  corePages.push({ type: 'colophon' });

  const logicalPages: BookletPageDescriptor[] = corePages.map((p, idx) => ({
    ...p,
    pageNumber: idx + 1,
  }));

  const getPage = (oneBasedNum: number): BookletPageDescriptor =>
    logicalPages[oneBasedNum - 1] || { pageNumber: oneBasedNum, type: 'notes', notesIndex: 1 };

  const spreads: BookletSpreadDescriptor[] = [];
  const sheetCount = totalPages / 4;

  for (let i = 0; i < sheetCount; i++) {
    // Prednja strana lista (Front): Lijevo `totalPages - 2*i`, Desno `2*i + 1`
    spreads.push({
      spreadIndex: i * 2,
      sheetNumber: i + 1,
      side: 'front',
      leftPage: getPage(totalPages - 2 * i),
      rightPage: getPage(2 * i + 1),
    });

    // Stražnja strana lista (Back): Lijevo `2*i + 2`, Desno `totalPages - 2*i - 1`
    spreads.push({
      spreadIndex: i * 2 + 1,
      sheetNumber: i + 1,
      side: 'back',
      leftPage: getPage(2 * i + 2),
      rightPage: getPage(totalPages - 2 * i - 1),
    });
  }

  return {
    totalPages,
    logicalPages,
    spreads,
  };
}

export const MOCKUP_RECIPES_REMOVED_STORAGE_KEY = 'mamina_teka_mockups_removed_v1';

export const MOCKUP_RECIPE_IDS: readonly string[] = [
  'orehnjaca-makovnjaca',
  'prhka-pita-jabuke',
  'goranski-nadjev',
  'domace-cesnjovke',
  'pac-za-sunku-i-spek',
  'domaci-ajvar',
  'vanilin-kiflice',
  'pekmez-od-sljiva',
];

export const MOCKUP_RECIPE_ID_SET = new Set<string>(MOCKUP_RECIPE_IDS);

export function isMockupRecipe(
  recipeOrId: Partial<Recipe> | Record<string, any> | string | null | undefined
): boolean {
  if (!recipeOrId) return false;
  if (typeof recipeOrId === 'string') {
    return MOCKUP_RECIPE_ID_SET.has(recipeOrId);
  }
  return Boolean(
    recipeOrId.isMockup ||
      recipeOrId.isSample ||
      (typeof recipeOrId.id === 'string' && MOCKUP_RECIPE_ID_SET.has(recipeOrId.id))
  );
}

/**
 * Strictly filters recipes for Cloud Sync (Push & Pull) so that ONLY real, active recipes pass:
 * `!recipe.isMockup && !recipe.isSample && !recipe.isDeleted && !recipe.hidden`
 * Also excludes any recipe ID in `MOCKUP_RECIPE_ID_SET` or `deletedIds`.
 */
export function filterSyncableRecipes(
  recipes: Recipe[],
  options?: {
    deletedIds?: Iterable<string>;
    mockupsRemoved?: boolean;
  }
): Recipe[] {
  if (!Array.isArray(recipes)) return [];
  const deletedSet = new Set<string>(options?.deletedIds || []);
  const mockupsRemoved = options?.mockupsRemoved ?? true;

  return recipes.filter((recipe) => {
    if (!recipe || !recipe.id) return false;
    if (
      recipe.isMockup ||
      recipe.isSample ||
      recipe.isDeleted ||
      recipe.hidden
    ) {
      return false;
    }
    if (deletedSet.has(recipe.id)) {
      return false;
    }
    if (MOCKUP_RECIPE_ID_SET.has(recipe.id)) {
      return false;
    }
    if (mockupsRemoved && isMockupRecipe(recipe)) {
      return false;
    }
    return true;
  });
}

/**
 * Determines whether a recipe should be skipped (treated as permanently deleted or mockup) during a cloud pull
 * or local seeding pass. Prevents deleted or mockup/sample recipes from ever resurrecting on reload or sync.
 */
export function shouldSkipDeletedRecipeOnPull(
  recipeId: string,
  remoteIsDeleted: boolean,
  localIsDeleted: boolean,
  deletedIds: Iterable<string>,
  remoteOrLocalFlags?: {
    isMockup?: boolean | number;
    isSample?: boolean | number;
    hidden?: boolean;
    mockupsRemoved?: boolean;
  }
): boolean {
  if (!recipeId) return true;
  if (remoteIsDeleted || localIsDeleted) return true;
  if (
    remoteOrLocalFlags?.isMockup ||
    remoteOrLocalFlags?.isSample ||
    remoteOrLocalFlags?.hidden
  ) {
    return true;
  }
  if (remoteOrLocalFlags?.mockupsRemoved && MOCKUP_RECIPE_ID_SET.has(recipeId)) {
    return true;
  }
  const set = deletedIds instanceof Set ? deletedIds : new Set(deletedIds);
  return set.has(recipeId);
}

/**
 * Selects the "Mamin prijedlog dana" hero recipe:
 * - When `forceRandom` is false and no current hero is valid, picks deterministically based on today's date
 *   so the daily suggestion feels purposeful.
 * - When `forceRandom` is true ("🎲 Druga ideja"), picks a random recipe different from `currentHeroId`
 *   (whenever `recipes.length > 1`).
 */
export function pickDailyOrRandomHeroRecipe(
  recipes: Recipe[],
  currentHeroId?: string | null,
  forceRandom = false,
  dateKey?: string
): Recipe | null {
  if (!Array.isArray(recipes) || recipes.length === 0) return null;
  if (recipes.length === 1) return recipes[0];

  if (!forceRandom && currentHeroId) {
    const existing = recipes.find((r) => r.id === currentHeroId);
    if (existing) return existing;
  }

  if (forceRandom) {
    const pool = currentHeroId ? recipes.filter((r) => r.id !== currentHeroId) : recipes;
    const effectivePool = pool.length > 0 ? pool : recipes;
    const randomIdx = Math.floor(Math.random() * effectivePool.length);
    return effectivePool[randomIdx] || recipes[0];
  }

  const key = dateKey || new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return recipes[hash % recipes.length] || recipes[0];
}

export type BackNavigationStepAction =
  | 'close-modal'
  | 'close-recipe-restore-scroll'
  | 'scroll-to-top'
  | 'return-to-home'
  | 'show-exit-toast'
  | 'exit-app';

/**
 * Resolves the exact multi-step Back button behavior:
 * 1. Open modal (cooking mode, scan wizard, delete confirmation) -> close modal
 * 2. Open recipe detail -> close recipe & restore previous view + exact scroll position
 * 3. Scrolled down in a list (`scrollY > 120`) -> scroll back to top of current list
 * 4. On a non-Home tab (`kategorije`, `planer`, `favoriti`, `o-teki`) or active search/category filter -> return to Home (`teka`)
 * 5. At top of Home (`teka`): first Back shows toast, second Back within 2500ms exits app.
 */
export function resolveBackNavigationStep(params: {
  hasOpenModal: boolean;
  hasSelectedRecipe: boolean;
  currentScrollY: number;
  activeTab: string;
  hasActiveSearchOrFilter: boolean;
  lastHomeBackPressMs: number;
  nowMs: number;
  scrollThresholdPx?: number;
}): BackNavigationStepAction {
  const threshold = params.scrollThresholdPx ?? 120;
  if (params.hasOpenModal) {
    return 'close-modal';
  }
  if (params.hasSelectedRecipe) {
    return 'close-recipe-restore-scroll';
  }

  const isOnNonHomeOrFilteredList =
    params.activeTab !== 'teka' || params.hasActiveSearchOrFilter;

  if (isOnNonHomeOrFilteredList) {
    if (params.currentScrollY > threshold) {
      return 'scroll-to-top';
    }
    return 'return-to-home';
  }

  // Na početnom zaslonu ('teka' bez aktivne pretrage/filtera):
  // 1. pritisak na Back prikazuje obavijest za izlaz, a 2. pritisak unutar 3000 ms izlazi iz aplikacije
  if (params.lastHomeBackPressMs > 0 && params.nowMs - params.lastHomeBackPressMs < 3000) {
    return 'exit-app';
  }
  return 'show-exit-toast';
}

/**
 * Returns true if the ingredient groups array is empty or contains only the generic sync placeholder
 * ("Prema obiteljskom zapisu" / "sync-1" / "fallback-1").
 */
export function isPlaceholderIngredientGroups(groups?: IngredientGroup[] | null): boolean {
  if (!Array.isArray(groups) || groups.length === 0) return true;
  const allItems = groups.flatMap((g) => (Array.isArray(g?.items) ? g.items : []));
  if (allItems.length === 0) return true;
  if (
    allItems.length === 1 &&
    (allItems[0].id === 'sync-1' ||
      String(allItems[0].id || '').startsWith('fallback-') ||
      /prema obiteljskom zapisu|prema izvornom rukopisu/i.test(String(allItems[0].name || '')))
  ) {
    return true;
  }
  return false;
}

/**
 * Reconstructs structured `IngredientGroup[]` from a recipe's preserved `originalHandwritingText`,
 * `steps`, `normalizedNotes`, `momTips`, and `englishImagePrompt` whenever its `ingredientGroups`
 * was accidentally replaced by the placeholder `sync-1`.
 */
export function recoverIngredientsFromRecipeText(recipe: {
  title?: string;
  category?: CategoryId;
  originalHandwritingText?: string;
  steps?: string[];
  normalizedNotes?: string[];
  momTips?: string[];
  secretTip?: string;
  englishImagePrompt?: string;
}): IngredientGroup[] {
  const items: IngredientItem[] = [];
  const seenKeys = new Set<string>();

  const addUniqueItem = (
    name: string,
    amount: number,
    unit: string,
    originalMeasure?: string
  ) => {
    const cleanName = name
      .replace(/^[,\s.\-–•*]+|[,\s.\-–•*;:()]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleanName || cleanName.length < 2) return;
    if (/^(peći|kuhati|dodati|umutiti|izmiješati|staviti|ostaviti|poslužiti|temperatura|vrijeme)$/i.test(cleanName)) {
      return;
    }
    const key = cleanName.toLowerCase().slice(0, 18);
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    items.push({
      id: `rec-ing-${items.length + 1}`,
      name: cleanName,
      amount: Number.isFinite(amount) && amount > 0 ? amount : 1,
      unit: unit || 'kom',
      originalMeasure,
    });
  };

  // 1. Parse explicit lines from originalHandwritingText if available
  const rawHandwriting = String(recipe.originalHandwritingText || '').trim();
  if (rawHandwriting.length > 0) {
    const lines = rawHandwriting
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 2 && l.length <= 90);

    for (const line of lines) {
      const m = line.match(
        /^[-•*]?\s*(\d+(?:[.,]\d+)?)\s*(g|gr|dkg|dag|deka|kg|ml|dl|dcl|l|žlic[aeu]|žličic[aeu]|šalic[aeu]|čaš[aeu]|kom(?:ada)?|vrećic[aeu])\s+(.+)$/i
      );
      if (m) {
        const rawNum = parseFloat(m[1].replace(',', '.'));
        const rawUnit = m[2].toLowerCase();
        const ingName = m[3].trim();
        let amount = rawNum;
        let unit = rawUnit;
        if (rawUnit === 'dkg' || rawUnit === 'dag' || rawUnit === 'deka') {
          amount = Math.round(rawNum * 10);
          unit = 'g';
        } else if (rawUnit === 'dcl') {
          unit = 'dl';
        }
        addUniqueItem(ingName, amount, unit, `${m[1]} ${m[2]}`);
      }
    }
  }

  // 2. Extract quantity + unit + ingredient phrases mentioned inside `steps`
  const stepsList = Array.isArray(recipe.steps) ? recipe.steps : [];
  const fullStepsText = stepsList.join(' . ');

  const stepQuantityRegex =
    /\b(\d+(?:[.,]\d+)?)\s*(g|gr|grama|dkg|dag|deka|kg|ml|dl|dcl|l|žlic[aeu]|žličic[aeu]|šalic[aeu]|čaš[aeu]|vrećic[aeu]|kom(?:ada)?)\s+([a-zčćžšđA-ZČĆŽŠĐ]+(?:\s+[a-zčćžšđA-ZČĆŽŠĐ]+){0,2})/gi;

  let qMatch: RegExpExecArray | null;
  while ((qMatch = stepQuantityRegex.exec(fullStepsText)) !== null) {
    const rawNum = parseFloat(qMatch[1].replace(',', '.'));
    const rawUnit = qMatch[2].toLowerCase();
    const rawName = qMatch[3]
      .replace(/\b(i|te|pa|ili|u|za|sa|od|po|na|dok|kako|sve|dobro|lagano|postupno)\b.*$/i, '')
      .trim();
    if (!rawName || rawName.length < 2) continue;
    if (/^(min|minuta|sat|sata|sati|stupnjeva|cm|mm|puta|dijela|kore|sloja)$/i.test(rawName)) {
      continue;
    }
    let amount = rawNum;
    let unit = rawUnit;
    if (rawUnit === 'dkg' || rawUnit === 'dag' || rawUnit === 'deka') {
      amount = Math.round(rawNum * 10);
      unit = 'g';
    } else if (rawUnit === 'grama' || rawUnit === 'gr') {
      unit = 'g';
    } else if (rawUnit === 'dcl') {
      unit = 'dl';
    } else if (rawUnit.startsWith('žlic')) {
      unit = 'žlice';
    } else if (rawUnit.startsWith('žličic')) {
      unit = 'žličica';
    } else if (rawUnit.startsWith('vrećic')) {
      unit = 'vrećica';
    }
    addUniqueItem(rawName, amount, unit, `${qMatch[1]} ${qMatch[2]}`);
  }

  // 3. Extract counted whole items from steps (e.g., "4 jaja", "3 žumanjka", "2 jabuke")
  const countedItemRegex =
    /\b(\d+)\s+(jaja|jaje|žumanjka|žumanjak|bjelanjka|bjelanjak|limuna|limun|naranče|jabuke|jabuka|glavice\s+luka|češnja\s+češnjaka|krumpira|paprike)\b/gi;
  let cMatch: RegExpExecArray | null;
  while ((cMatch = countedItemRegex.exec(fullStepsText)) !== null) {
    const count = parseInt(cMatch[1], 10);
    const noun = cMatch[2].toLowerCase();
    addUniqueItem(noun, count, 'kom', `${count} ${noun}`);
  }

  // 4. Use step sanity detector for common ingredients mentioned in steps without explicit numbers
  if (stepsList.length > 0) {
    const detected = crossCheckMissingIngredients(
      [{ groupTitle: 'Sastojci', items: [...items] }],
      stepsList
    );
    for (const group of detected.updatedGroups) {
      for (const it of group.items) {
        const cleanLabel = it.name.replace(/\s*\(spomenuto u postupku\)/i, '').trim();
        addUniqueItem(cleanLabel, it.amount ?? 1, it.unit, it.originalMeasure);
      }
    }
  }

  // 5. Also check `made with ...` inside `englishImagePrompt` if still empty
  if (items.length === 0 && recipe.englishImagePrompt) {
    const madeWithMatch = recipe.englishImagePrompt.match(/made with\s+([^,.]+(?:,\s*[^,.]+)*)/i);
    if (madeWithMatch && madeWithMatch[1]) {
      const parts = madeWithMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 1 && !/soft natural|window lighting|35mm/i.test(s));
      for (const p of parts.slice(0, 10)) {
        addUniqueItem(p, 1, 'mjera');
      }
    }
  }

  if (items.length > 0) {
    return [
      {
        groupTitle: 'Glavni sastojci',
        items,
      },
    ];
  }

  return [
    {
      groupTitle: 'Sastojci',
      items: [{ id: 'sync-1', name: 'Prema obiteljskom zapisu', amount: 1, unit: 'mjera' }],
    },
  ];
}

export interface SyncProgressState {
  current: number;
  total: number;
  active: boolean;
  currentItemName?: string;
}

/**
 * Validates that an image source string is a genuine loadable image URL
 * (`typeof src === 'string' && (src.startsWith('data:image') || src.startsWith('http') || src.startsWith('blob:'))`)
 * and NOT an empty string, local placeholder (`local-indexeddb`, `/mockups/...`), or synthetic SVG.
 */
export function isValidImageSourceForCompression(src?: unknown): src is string {
  if (typeof src !== 'string') return false;
  const trimmed = src.trim();
  if (!trimmed || trimmed === 'local-indexeddb' || trimmed === 'same-as-cover') {
    return false;
  }
  if (trimmed.startsWith('data:image/svg')) {
    return false;
  }
  return (
    trimmed.startsWith('data:image') ||
    trimmed.startsWith('http') ||
    trimmed.startsWith('blob:')
  );
}

/**
 * Checks whether an image string is already smaller than 180 KB (`maxBytes = 180000`)
 * or flagged as already optimized, so `compressImageForCloudSync` can pass it through
 * immediately without spawning an HTML5 Canvas or Image element.
 */
export function isImageAlreadyOptimizedForSync(
  imageUri?: string | null,
  isMarkedOptimized = false,
  maxBytes = 180000
): boolean {
  if (!isValidImageSourceForCompression(imageUri)) return false;
  const trimmed = imageUri.trim();

  if (trimmed.startsWith('http')) {
    return trimmed.length <= 2048;
  }

  if (trimmed.startsWith('blob:')) {
    return false;
  }

  if (isMarkedOptimized && trimmed.length <= 450000) {
    return true;
  }

  // Any raster data URL already <= 180 KB (~180,000 chars) does not need re-compression
  return trimmed.length <= maxBytes;
}

/**
 * Calculates a bounded 0-100 percentage for the sync progress bar.
 */
export function calculateSyncProgressPercent(progress: SyncProgressState): number {
  if (!progress || !progress.active || progress.total <= 0) {
    return progress && !progress.active && progress.total > 0 && progress.current >= progress.total
      ? 100
      : 0;
  }
  const ratio = (progress.current / progress.total) * 100;
  return Math.min(100, Math.max(0, Math.round(ratio)));
}

