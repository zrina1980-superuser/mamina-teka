import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCroatianText,
  filterRecipes,
  scaleIngredientAmount,
  scaleIngredientWithSugarOption,
  normalizeOvenTemperature,
  estimatePanDimensions,
  crossCheckMissingIngredients,
  buildAuthenticDishImagePrompt,
  buildExpressShoppingList,
  normalizeTraditionalMeasures,
  parseStepTimers,
  formatTimerSeconds,
  getRecipeVoiceMemos,
  addVoiceMemoToList,
  removeVoiceMemoFromList,
  applyDeletedRecipeFilter,
  advanceDeleteConfirmationStep,
  buildRegeneratedAiPrompt,
  shouldShowLessSweetToggle,
  resolveCategoryFromLabel,
  parseIngredientAmountString,
  mapVisionOcrResponseToRecipe,
  generateVaultInviteKey,
  isValidVaultInvite,
  buildFamilyInviteLink,
  buildWhatsAppInviteUrl,
  parseVaultInviteFromSearch,
  resolvePrintableRecipeImage,
  resolvePrintableOriginalScan,
  buildA5BookletImposition,
  shouldSkipDeletedRecipeOnPull,
  isPlaceholderIngredientGroups,
  recoverIngredientsFromRecipeText,
  pickDailyOrRandomHeroRecipe,
  resolveBackNavigationStep,
  type Recipe,
} from './recipeLogic';

const sampleRecipes: Recipe[] = [
  {
    id: 'r1',
    title: 'Mamina Orehnjača i Makovnjača',
    subtitle: 'Meko dizano tijesto s bogatim nadjevom od oraha i maka',
    category: 'kolaci',
    subcategory: 'Dizana tijesta',
    isFavorite: true,
    inCookSoon: true,
    prepTimeMinutes: 90,
    cookTimeMinutes: 40,
    servings: '2 štruce',
    panDimensions: 'Veliki duboki protvan za 2 štruce (36 × 26 cm)',
    ovenTemp: '180 °C',
    secretTip: 'Nikad ne otvaraj pećnicu prvih 20 minuta!',
    imageStatus: 'ai',
    imageUrl: '',
    originalScanUrl: '',
    originalHandwritingText: '',
    ingredientGroups: [
      {
        groupTitle: 'Nadjev',
        items: [
          { id: 'i1', name: 'mljeveni orasi', amount: 250, unit: 'g', originalMeasure: 'frtalj kile oraha' },
          { id: 'i2', name: 'šećer', amount: 150, unit: 'g', originalMeasure: '15 deka' },
        ],
      },
    ],
    steps: ['Ostavi tijesto da se diže 45 minuta, zatim peci 40 minuta.'],
    momTips: ['Mlijeko mora biti mlako.'],
    normalizedNotes: [],
    syncStatus: 'synced',
    updatedAt: 1000,
    createdAt: 1000,
    isDeleted: false,
    authorEmail: 'mama@obitelj.hr',
  },
  {
    id: 'r2',
    title: 'Domaće Češnjovke iz Sušione',
    subtitle: 'Gorski kotar i Prigorje receptura',
    category: 'mesarija',
    subcategory: 'Češnjovke',
    isFavorite: false,
    inCookSoon: false,
    prepTimeMinutes: 120,
    cookTimeMinutes: 0,
    servings: '10 kg smjese',
    imageStatus: 'ai',
    imageUrl: '',
    originalScanUrl: '',
    originalHandwritingText: '',
    ingredientGroups: [
      {
        groupTitle: 'Začini na 10 kg mesa',
        items: [
          { id: 'i3', name: 'domaći češnjak u vodi', amount: 150, unit: 'g' },
          { id: 'i4', name: 'crni papar mljeveni', amount: 40, unit: 'g' },
        ],
      },
    ],
    steps: ['Ostavi na hladnom 24 sata prije dimljenja.'],
    momTips: [],
    normalizedNotes: [],
    createdAt: 2000,
  },
];

test('normalizeCroatianText strips Croatian diacritics and lowercases', () => {
  assert.equal(normalizeCroatianText('Češnjovke i Špek s Žličicom Šećera'), 'cesnjovke i spek s zlicicom secera');
  assert.equal(normalizeCroatianText('Uskršnji Đumbir'), 'uskrsnji dumbir');
});

test('filterRecipes matches by ingredient name, secretTip, and skips soft-deleted recipes', () => {
  const byOrasi = filterRecipes(sampleRecipes, 'orasi');
  assert.equal(byOrasi.length, 1);
  assert.equal(byOrasi[0].id, 'r1');

  const bySecret = filterRecipes(sampleRecipes, 'otvaraj pecnicu');
  assert.equal(bySecret.length, 1);
  assert.equal(bySecret[0].id, 'r1');

  const withDeleted = [
    ...sampleRecipes,
    { ...sampleRecipes[0], id: 'r3', isDeleted: true },
  ];
  assert.equal(filterRecipes(withDeleted, '').length, 2);
});

test('scaleIngredientAmount & scaleIngredientWithSugarOption ("Malo manje slatko" -28% sugar)', () => {
  assert.equal(scaleIngredientAmount(250, 'g', 0.5), '125 g');
  assert.equal(scaleIngredientAmount(250, 'g', 2), '500 g');

  const sugarItem = { id: 's1', name: 'šećer u prahu', amount: 150, unit: 'g' };
  const normal = scaleIngredientWithSugarOption(sugarItem, 1, false);
  assert.equal(normal.displayAmount, '150 g');
  assert.equal(normal.isReducedSugar, false);

  const reduced = scaleIngredientWithSugarOption(sugarItem, 1, true);
  assert.equal(reduced.displayAmount, '110 g');
  assert.equal(reduced.isReducedSugar, true);
});

test('normalizeOvenTemperature translates archaic phrases into Celsius', () => {
  assert.equal(normalizeOvenTemperature('Peći na umjerenoj vatri'), 'Umjerena vatra (~180 °C)');
  assert.equal(normalizeOvenTemperature('u vrućoj roli'), 'Jaka vatra / vruća rola (200–220 °C)');
  assert.equal(normalizeOvenTemperature('na tihoj vatri'), 'Tiha vatra (~150 °C)');
});

test('estimatePanDimensions estimates mold size from recipe context', () => {
  assert.equal(
    estimatePanDimensions('Mamina Orehnjača za 2 štruce', 'kolaci'),
    'Veliki duboki protvan za 2 štruce (36 × 26 cm)'
  );
  assert.equal(
    estimatePanDimensions('Čokoladna torta u okruglom kalupu', 'kolaci'),
    'Okrugli kalup za tortu (Ø 26 cm)'
  );
});

test('crossCheckMissingIngredients detects forgotten ingredients mentioned in steps', () => {
  const groups = [
    {
      groupTitle: 'Biskvit',
      items: [{ id: '1', name: 'glatko brašno', amount: 300, unit: 'g' }],
    },
  ];
  const steps = ['Umiješaj brašno, dodaj ulje i malo ruma pa ispeci.'];
  const checked = crossCheckMissingIngredients(groups, steps);
  assert.equal(checked.addedItems.length, 2);
  assert.equal(checked.updatedGroups[0].items.length, 3);
});

test('buildAuthenticDishImagePrompt & translateDishToEnglishPrompt build dynamic category-safe prompts without static keyword matchers', () => {
  // Cookie recipe with "oblikuj tijesto u kobasicu" in steps must NEVER mention pork sausages or bacon
  const cookiePrompt = buildAuthenticDishImagePrompt(
    'Domaći keksi s orasima',
    ['glatko brašno', 'maslac', 'mljeveni orasi', 'šećer u prahu'],
    'kolaci',
    ['Zamijesi prhko tijesto, oblikuj tijesto u kobasicu, nareži na kolutiće i ispeci.']
  );
  assert.equal(cookiePrompt.englishPrompt.includes('Domaći keksi s orasima'), true);
  assert.equal(cookiePrompt.englishPrompt.includes('mljeveni orasi'), true);
  assert.equal(cookiePrompt.englishPrompt.includes('strictly no meat, no sausages, no bacon, no garlic'), true);
  assert.equal(cookiePrompt.englishPrompt.includes('pork sausages'), false);

  // Custom manually edited English prompt is respected verbatim
  const manualPrompt = buildAuthenticDishImagePrompt(
    'Orehnjača',
    ['orasi'],
    'kolaci',
    [],
    'Traditional walnut roll cake, powdered sugar, sliced on vintage plate'
  );
  assert.equal(
    manualPrompt.englishPrompt,
    'Traditional walnut roll cake, powdered sugar, sliced on vintage plate'
  );

  const shopList = buildExpressShoppingList(sampleRecipes[0], 1, {}, true);
  assert.equal(shopList.includes('Trebamo za Mamina Orehnjača i Makovnjača'), true);
  assert.equal(shopList.includes('110 g šećer'), true);
});

test('normalizeTraditionalMeasures converts old Croatian notebook measures to metric', () => {
  const raw = 'Uzmi frtalj kile oraha, 15 deka šećera, 1 čaša od kiselog mlijeka, jedan prašak, na umjerenoj vatri.';
  const result = normalizeTraditionalMeasures(raw);

  assert.equal(result.normalizedText.includes('250 g'), true);
  assert.equal(result.normalizedText.includes('150 g'), true);
  assert.equal(result.normalizedText.includes('200 ml'), true);
  assert.equal(result.normalizedText.includes('~180 °C'), true);
});

test('parseStepTimers & formatTimerSeconds work accurately', () => {
  const step = 'Ostavi tijesto da se diže 45 minuta na toplom, pa peci na 180 °C 30-35 minuta ili 1 sat.';
  const timerSegments = parseStepTimers(step).filter((s) => s.type === 'timer');
  assert.equal(timerSegments.length, 3);
  assert.equal(formatTimerSeconds(2700), '45:00');
});

test('voiceMemos supports up to 3 saved secrets and requires deletion before adding 4th', () => {
  let list = getRecipeVoiceMemos({ voiceMemoTranscript: 'Prva tajna' });
  assert.equal(list.length, 1);

  const r2 = addVoiceMemoToList(list, { transcript: 'Druga tajna', durationSec: 8 });
  assert.equal(r2.added, true);
  list = r2.memos;
  assert.equal(list.length, 2);

  const r3 = addVoiceMemoToList(list, { transcript: 'Treća tajna', durationSec: 10 });
  assert.equal(r3.added, true);
  list = r3.memos;
  assert.equal(list.length, 3);

  const r4 = addVoiceMemoToList(list, { transcript: 'Četvrta tajna', durationSec: 10 });
  assert.equal(r4.added, false);
  assert.equal(r4.memos.length, 3);

  const afterDelete = removeVoiceMemoFromList(list, list[0].id);
  assert.equal(afterDelete.length, 2);
  assert.equal(afterDelete[0].label, 'Tajna #1');
});

test('applyDeletedRecipeFilter excludes deleted IDs and soft-deleted recipes', () => {
  const filtered = applyDeletedRecipeFilter(sampleRecipes, new Set(['r1']));
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'r2');
});

test('advanceDeleteConfirmationStep enforces 2-step double confirmation before executing delete', () => {
  const step1 = advanceDeleteConfirmationStep(0);
  assert.equal(step1, 1);

  const step2 = advanceDeleteConfirmationStep(step1);
  assert.equal(step2, 2);

  const finalConfirm = advanceDeleteConfirmationStep(step2);
  assert.equal(finalConfirm, 'confirmed');
});

test('buildRegeneratedAiPrompt creates distinct variations across regeneration cycles', () => {
  const p0 = buildRegeneratedAiPrompt('Pekmez od šljiva', ['šljive'], 'zimnica', 1);
  const p1 = buildRegeneratedAiPrompt('Pekmez od šljiva', ['šljive'], 'zimnica', 2);
  assert.notEqual(p0, p1);
  assert.equal(p1.includes('Variation #2'), true);
});

test('shouldShowLessSweetToggle returns true ONLY for Kolači & Slatko (kolaci)', () => {
  assert.equal(shouldShowLessSweetToggle('kolaci'), true);
  assert.equal(shouldShowLessSweetToggle('slano'), false);
  assert.equal(shouldShowLessSweetToggle('mesarija'), false);
  assert.equal(shouldShowLessSweetToggle('zimnica'), false);
  assert.equal(shouldShowLessSweetToggle('tradicija'), false);
});

test('mapVisionOcrResponseToRecipe maps Gemini Vision structured JSON accurately without mock fallbacks', () => {
  assert.equal(resolveCategoryFromLabel('Slana kuhinja & Ručak'), 'slano');
  assert.equal(resolveCategoryFromLabel('Kolači & Slatko'), 'kolaci');

  const dlParsed = parseIngredientAmountString('2 dl', '2 dl');
  assert.equal(dlParsed.amount, 200);
  assert.equal(dlParsed.unit, 'ml');
  assert.equal(dlParsed.originalMeasure, '2 dl');

  const mapped = mapVisionOcrResponseToRecipe({
    title: 'Krekeri od kukuruznog brašna',
    category: 'Slana kuhinja & Ručak',
    subcategory: 'Slani prilozi i grickalice',
    oven: { temperature: '150 °C', notes: '' },
    panSize: 'Veliki plitki lim od pećnice (40 × 35 cm)',
    prepTime: 15,
    cookTime: 35,
    ingredients: [
      {
        phase: 'Smjesa',
        name: 'kukuruzno brašno za palentu',
        amount: '2 dl',
        originalAmount: '2 dl',
      },
      {
        phase: 'Smjesa',
        name: 'sjemenke sezama, lana i suncokreta',
        amount: '2 dl',
        originalAmount: '2 dl',
      },
    ],
    instructions: [
      'Pomiješati suhe sastojke, preliti kipućom vodom i uljem te tanko razvaljati na masnom papiru.',
      'Peći na 150 °C oko 35 minuta.',
    ],
    momSecret: 'blago rumeni i mirišljavi, suhi',
  });

  assert.equal(mapped.title, 'Krekeri od kukuruznog brašna');
  assert.equal(mapped.category, 'slano');
  assert.equal(mapped.subcategory, 'Slani prilozi i grickalice');
  assert.equal(mapped.ovenTemp, '150 °C');
  assert.equal(mapped.panDimensions, 'Veliki plitki lim od pećnice (40 × 35 cm)');
  assert.equal(mapped.prepTimeMinutes, 15);
  assert.equal(mapped.cookTimeMinutes, 35);
  assert.equal(mapped.secretTip, 'blago rumeni i mirišljavi, suhi');
  assert.equal(mapped.ingredientGroups[0].groupTitle, 'Smjesa');
  assert.equal(mapped.ingredientGroups[0].items[0].name, 'kukuruzno brašno za palentu');
  assert.equal(mapped.ingredientGroups[0].items[0].amount, 200);
  assert.equal(mapped.ingredientGroups[0].items[0].unit, 'ml');
  assert.equal(mapped.ingredientGroups[0].items[0].originalMeasure, '2 dl');
});

test('Family Vault invite link helpers generate, format WhatsApp message, and parse ?trezorId=&inviteKey=', () => {
  const vaultId = 'vault-zrina-123';
  const key = generateVaultInviteKey(vaultId);
  assert.equal(key.startsWith('mt-'), true);
  assert.equal(isValidVaultInvite(vaultId, key), true);

  const link = buildFamilyInviteLink('https://maminateka.zrina.app/', vaultId, key);
  assert.equal(
    link,
    `https://maminateka.zrina.app/?trezorId=${encodeURIComponent(vaultId)}&inviteKey=${encodeURIComponent(key)}`
  );

  const waUrl = buildWhatsAppInviteUrl(link);
  assert.equal(waUrl.startsWith('https://wa.me/?text='), true);
  assert.equal(
    decodeURIComponent(waUrl.replace('https://wa.me/?text=', '')),
    `Pridruži se našoj digitalnoj Maminoj Teki recepata: ${link}`
  );

  const parsed = parseVaultInviteFromSearch(`?trezorId=${vaultId}&inviteKey=${key}`);
  assert.deepEqual(parsed, { trezorId: vaultId, inviteKey: key });
  assert.equal(parseVaultInviteFromSearch('?trezorId=bad&inviteKey='), null);
});

test('resolvePrintableRecipeImage & resolvePrintableOriginalScan ignore local-indexeddb tokens and pick valid AI/raster images', () => {
  const aiDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD';
  const scanUrl = '/mockups/kiflice_rukopis.jpg';

  const resolved = resolvePrintableRecipeImage(
    {
      imageUrl: 'local-indexeddb',
      image: aiDataUrl,
      originalScanUrl: scanUrl,
    },
    '/fallback.png'
  );
  assert.equal(resolved, aiDataUrl);

  const resolvedScan = resolvePrintableOriginalScan(
    {
      originalScanUrl: 'local-indexeddb',
      originalImage: scanUrl,
    },
    '/fallback.png'
  );
  assert.equal(resolvedScan, scanUrl);
});

test('buildA5BookletImposition enforces Rule of 4, pads with notes, places Colophon last, and pairs Front/Back spreads accurately', () => {
  const booklet = buildA5BookletImposition(2);
  assert.equal(booklet.totalPages, 8);
  assert.equal(booklet.totalPages % 4, 0);
  assert.equal(booklet.logicalPages[0].type, 'cover');
  assert.equal(booklet.logicalPages[1].type, 'intro');
  assert.equal(booklet.logicalPages[2].type, 'toc');
  assert.equal(booklet.logicalPages[3].type, 'recipe');
  assert.equal(booklet.logicalPages[4].type, 'recipe');
  assert.equal(booklet.logicalPages[5].type, 'notes');
  assert.equal(booklet.logicalPages[6].type, 'notes');
  assert.equal(booklet.logicalPages[7].type, 'colophon');

  assert.equal(booklet.spreads.length, 4);
  assert.equal(booklet.spreads[0].side, 'front');
  assert.equal(booklet.spreads[0].leftPage.pageNumber, 8);
  assert.equal(booklet.spreads[0].rightPage.pageNumber, 1);
  assert.equal(booklet.spreads[1].side, 'back');
  assert.equal(booklet.spreads[1].leftPage.pageNumber, 2);
  assert.equal(booklet.spreads[1].rightPage.pageNumber, 7);
});

test('shouldSkipDeletedRecipeOnPull prevents deleted mockup/sample recipes from resurrecting during cloud pull', () => {
  const deletedSet = new Set<string>(['orehnjaca-makovnjaca']);

  // Locally deleted ID in deletedSet is skipped
  assert.equal(
    shouldSkipDeletedRecipeOnPull('orehnjaca-makovnjaca', false, false, deletedSet),
    true
  );
  // Remote or local tombstone flag is skipped
  assert.equal(
    shouldSkipDeletedRecipeOnPull('domace-cesnjovke', true, false, new Set()),
    true
  );
  assert.equal(
    shouldSkipDeletedRecipeOnPull('domace-cesnjovke', false, true, new Set()),
    true
  );
  // Active user recipe is not skipped
  assert.equal(
    shouldSkipDeletedRecipeOnPull('moj-novi-recept-123', false, false, deletedSet),
    false
  );
});

test('isPlaceholderIngredientGroups & recoverIngredientsFromRecipeText heal overwritten sync-1 placeholder ingredients', () => {
  const placeholderGroup = [
    {
      groupTitle: 'Sastojci',
      items: [{ id: 'sync-1', name: 'Prema obiteljskom zapisu', amount: 1, unit: 'kom' as const }],
    },
  ];
  assert.equal(isPlaceholderIngredientGroups(placeholderGroup), true);
  assert.equal(isPlaceholderIngredientGroups(sampleRecipes[0].ingredientGroups), false);

  const recovered = recoverIngredientsFromRecipeText({
    title: 'Mamina pita od jabuka',
    originalHandwritingText: `Tijesto:
- 400 g glatkog brašna
- 200 g maslaca
- 100 g šećera
Nadjev:
- 1 kg naribanih jabuka
- 1 žličica cimeta
1. Zamijesi prhko tijesto od brašna, maslaca i šećera pa ostavi da odmori.`,
    steps: ['Zamijesi prhko tijesto od brašna, maslaca i šećera pa ispeci s jabukama i cimetom.'],
  });
  assert.equal(isPlaceholderIngredientGroups(recovered), false);
  const allNames = recovered.flatMap((g) => g.items.map((i) => i.name)).join(' ');
  assert.equal(allNames.includes('glatkog brašna'), true);
  assert.equal(allNames.includes('maslaca'), true);
  assert.equal(allNames.includes('naribanih jabuka'), true);
});

test('pickDailyOrRandomHeroRecipe deterministically selects daily recipe and rotates on forceRandom', () => {
  const daily1 = pickDailyOrRandomHeroRecipe(sampleRecipes, null, false, '2026-10-30');
  const daily2 = pickDailyOrRandomHeroRecipe(sampleRecipes, null, false, '2026-10-30');
  assert.equal(daily1?.id, daily2?.id);

  const rotated = pickDailyOrRandomHeroRecipe(sampleRecipes, daily1?.id, true, '2026-10-30');
  assert.notEqual(rotated?.id, daily1?.id);
});

test('resolveBackNavigationStep enforces exact multi-step Back order (modal -> recipe -> scroll-top -> home -> double-back exit)', () => {
  // 1. Open modal closes first
  assert.equal(
    resolveBackNavigationStep({
      hasOpenModal: true,
      hasSelectedRecipe: true,
      currentScrollY: 500,
      activeTab: 'kategorije',
      hasActiveSearchOrFilter: false,
      lastHomeBackPressMs: 0,
      nowMs: 5000,
    }),
    'close-modal'
  );

  // 2. Open recipe detail closes and restores scroll position
  assert.equal(
    resolveBackNavigationStep({
      hasOpenModal: false,
      hasSelectedRecipe: true,
      currentScrollY: 500,
      activeTab: 'kategorije',
      hasActiveSearchOrFilter: false,
      lastHomeBackPressMs: 0,
      nowMs: 5000,
    }),
    'close-recipe-restore-scroll'
  );

  // 3. Scrolled down in list -> scrolls back to top of list first
  assert.equal(
    resolveBackNavigationStep({
      hasOpenModal: false,
      hasSelectedRecipe: false,
      currentScrollY: 450,
      activeTab: 'kategorije',
      hasActiveSearchOrFilter: false,
      lastHomeBackPressMs: 0,
      nowMs: 5000,
    }),
    'scroll-to-top'
  );

  // 4. At top of non-home tab -> returns to Home ('teka')
  assert.equal(
    resolveBackNavigationStep({
      hasOpenModal: false,
      hasSelectedRecipe: false,
      currentScrollY: 0,
      activeTab: 'kategorije',
      hasActiveSearchOrFilter: false,
      lastHomeBackPressMs: 0,
      nowMs: 5000,
    }),
    'return-to-home'
  );

  // 5. On Home ('teka' without search filter) first press -> shows double-back exit toast (even if scrolled down on Home)
  assert.equal(
    resolveBackNavigationStep({
      hasOpenModal: false,
      hasSelectedRecipe: false,
      currentScrollY: 250,
      activeTab: 'teka',
      hasActiveSearchOrFilter: false,
      lastHomeBackPressMs: 0,
      nowMs: 5000,
    }),
    'show-exit-toast'
  );

  // 6. Second press within 3000ms on Home ('teka') -> exits app
  assert.equal(
    resolveBackNavigationStep({
      hasOpenModal: false,
      hasSelectedRecipe: false,
      currentScrollY: 0,
      activeTab: 'teka',
      hasActiveSearchOrFilter: false,
      lastHomeBackPressMs: 3500,
      nowMs: 5000,
    }),
    'exit-app'
  );
});

test('isImageAlreadyOptimizedForSync & isValidImageSourceForCompression validate image sources and skip re-compression for < 180 KB', async () => {
  const {
    isValidImageSourceForCompression,
    isImageAlreadyOptimizedForSync,
    calculateSyncProgressPercent,
  } = await import('./recipeLogic');

  const smallDataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(120_000);
  const largeDataUrl = 'data:image/jpeg;base64,' + 'B'.repeat(240_000);

  // Valid URLs: data:image (non-svg), http/https, blob:
  assert.equal(isValidImageSourceForCompression(smallDataUrl), true);
  assert.equal(isValidImageSourceForCompression('https://example.com/dish.jpg'), true);
  assert.equal(isValidImageSourceForCompression('blob:https://example.com/123'), true);

  // Invalid URLs: null, empty, local-indexeddb, non-existent relative placeholder, SVG fallback
  assert.equal(isValidImageSourceForCompression(null), false);
  assert.equal(isValidImageSourceForCompression(''), false);
  assert.equal(isValidImageSourceForCompression('local-indexeddb'), false);
  assert.equal(isValidImageSourceForCompression('/mockups/kiflice.jpg'), false);
  assert.equal(isValidImageSourceForCompression('data:image/svg+xml;utf8,<svg></svg>'), false);

  // Under 180 KB is already optimized
  assert.equal(isImageAlreadyOptimizedForSync(smallDataUrl, false), true);
  // Over 180 KB without flag needs compression
  assert.equal(isImageAlreadyOptimizedForSync(largeDataUrl, false), false);
  // Over 180 KB but marked optimized is skipped
  assert.equal(isImageAlreadyOptimizedForSync(largeDataUrl, true), true);
  // Relative placeholder is rejected as invalid
  assert.equal(isImageAlreadyOptimizedForSync('/mockups/kiflice.jpg', false), false);

  assert.equal(
    calculateSyncProgressPercent({ current: 15, total: 30, active: true }),
    50
  );
  assert.equal(
    calculateSyncProgressPercent({ current: 31, total: 31, active: true }),
    100
  );
  assert.equal(
    calculateSyncProgressPercent({ current: 0, total: 0, active: false }),
    0
  );
});

test('filterSyncableRecipes strictly excludes isMockup, isSample, isDeleted, hidden, and seed IDs so 31 real + 3 mockup/deleted = 31', async () => {
  const { filterSyncableRecipes } = await import('./recipeLogic');

  const real31: Recipe[] = Array.from({ length: 31 }, (_, idx) => ({
    ...sampleRecipes[0],
    id: `real-user-recipe-${idx + 1}`,
    title: `Stvarni recept #${idx + 1}`,
    isMockup: 0,
    isSample: false,
    isDeleted: false,
    hidden: false,
  }));

  const extra3Invalid: Recipe[] = [
    {
      ...sampleRecipes[0],
      id: 'pekmez-od-sljiva',
      title: 'Pekmez od Bistrica Šljiva iz Pećnice',
      isMockup: 1,
      isSample: true,
      isDeleted: false,
    },
    {
      ...sampleRecipes[0],
      id: 'deleted-user-recipe',
      title: 'Obrisani recept',
      isDeleted: true,
    },
    {
      ...sampleRecipes[0],
      id: 'hidden-sample-recipe',
      title: 'Skriveni ogledni recept',
      hidden: true,
    },
  ];

  const syncedList = filterSyncableRecipes([...extra3Invalid, ...real31], {
    deletedIds: ['pekmez-od-sljiva'],
    mockupsRemoved: true,
  });

  assert.equal(syncedList.length, 31);
  assert.equal(
    syncedList.some((r) => r.id === 'pekmez-od-sljiva'),
    false
  );
});


