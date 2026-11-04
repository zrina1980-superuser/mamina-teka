import React, { useState } from 'react';
import { aiHeaders } from '../utils/userAiKey';
import {
  X,
  Plus,
  Trash2,
  Check,
  Edit3,
  Clock,
  Ruler,
  Flame,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  CATEGORIES,
  buildAuthenticDishImagePrompt,
  type CategoryId,
  type IngredientGroup,
  type IngredientItem,
  type Recipe,
} from '../utils/recipeLogic';

interface EditRecipeModalProps {
  recipe: Recipe;
  onClose: () => void;
  onSave: (updatedRecipe: Recipe) => void;
}

export const EditRecipeModal: React.FC<EditRecipeModalProps> = ({
  recipe,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState(recipe.title || '');
  const [subtitle, setSubtitle] = useState(recipe.subtitle || '');
  const [category, setCategory] = useState<CategoryId>(recipe.category || 'kolaci');
  const [subcategory, setSubcategory] = useState(recipe.subcategory || 'Ostalo');
  const [panDimensions, setPanDimensions] = useState(recipe.panDimensions || '');
  const [ovenTemp, setOvenTemp] = useState(recipe.ovenTemp || '');
  const [servings, setServings] = useState(recipe.servings || '');
  const [prepTimeMinutes, setPrepTimeMinutes] = useState<number>(
    Number(recipe.prepTimeMinutes) || 20
  );
  const [cookTimeMinutes, setCookTimeMinutes] = useState<number>(
    Number(recipe.cookTimeMinutes) >= 0 ? Number(recipe.cookTimeMinutes) : 25
  );
  const [secretTip, setSecretTip] = useState(
    recipe.secretTip || recipe.momTips?.[0] || ''
  );
  const [englishImagePrompt, setEnglishImagePrompt] = useState<string>(() => {
    if (recipe.englishImagePrompt && recipe.englishImagePrompt.trim()) {
      return recipe.englishImagePrompt.trim();
    }
    const flatIngs = (recipe.ingredientGroups || []).flatMap((g) =>
      g.items.map((i) => i.name)
    );
    return buildAuthenticDishImagePrompt(
      recipe.title || 'Domaći recept',
      flatIngs,
      recipe.category || 'kolaci'
    ).englishPrompt;
  });
  const [isTranslatingPrompt, setIsTranslatingPrompt] = useState(false);

  const [ingredientGroups, setIngredientGroups] = useState<IngredientGroup[]>(() => {
    if (!recipe.ingredientGroups || recipe.ingredientGroups.length === 0) {
      return [
        {
          groupTitle: 'Glavni sastojci',
          items: [{ id: `ing-${Date.now()}`, name: '', amount: null, unit: '' }],
        },
      ];
    }
    return recipe.ingredientGroups.map((g) => ({
      groupTitle: g.groupTitle,
      items: g.items.map((item) => ({ ...item })),
    }));
  });

  const [steps, setSteps] = useState<string[]>(() =>
    recipe.steps && recipe.steps.length > 0 ? [...recipe.steps] : ['']
  );

  const [formError, setFormError] = useState<string | null>(null);

  const activeCategoryMeta = CATEGORIES.find((c) => c.id === category);

  const handleCategoryChange = (newCat: CategoryId) => {
    setCategory(newCat);
    const meta = CATEGORIES.find((c) => c.id === newCat);
    if (meta && meta.subcategories.length > 0 && !meta.subcategories.includes(subcategory)) {
      setSubcategory(meta.subcategories[0]);
    }
  };

  // Ingredient Group Handlers
  const handleGroupTitleChange = (gIdx: number, newTitle: string) => {
    setIngredientGroups((prev) =>
      prev.map((g, idx) => (idx === gIdx ? { ...g, groupTitle: newTitle } : g))
    );
  };

  const handleAddGroup = () => {
    setIngredientGroups((prev) => [
      ...prev,
      {
        groupTitle: `Nova faza (${prev.length + 1})`,
        items: [
          {
            id: `ing-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: '',
            amount: null,
            unit: 'g',
          },
        ],
      },
    ]);
  };

  const handleRemoveGroup = (gIdx: number) => {
    setIngredientGroups((prev) =>
      prev.length > 1 ? prev.filter((_, idx) => idx !== gIdx) : prev
    );
  };

  const handleIngredientChange = (
    gIdx: number,
    iIdx: number,
    field: keyof IngredientItem,
    value: string
  ) => {
    setIngredientGroups((prev) =>
      prev.map((group, groupIndex) => {
        if (groupIndex !== gIdx) return group;
        const nextItems = group.items.map((item, itemIndex) => {
          if (itemIndex !== iIdx) return item;
          if (field === 'amount') {
            const cleaned = value.replace(',', '.').trim();
            const parsed = cleaned === '' ? null : Number(cleaned);
            return {
              ...item,
              amount: parsed !== null && !Number.isNaN(parsed) ? parsed : null,
            };
          }
          return { ...item, [field]: value };
        });
        return { ...group, items: nextItems };
      })
    );
  };

  const handleAddIngredient = (gIdx: number) => {
    setIngredientGroups((prev) =>
      prev.map((group, idx) => {
        if (idx !== gIdx) return group;
        return {
          ...group,
          items: [
            ...group.items,
            {
              id: `ing-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: '',
              amount: null,
              unit: 'g',
            },
          ],
        };
      })
    );
  };

  const handleRemoveIngredient = (gIdx: number, iIdx: number) => {
    setIngredientGroups((prev) =>
      prev.map((group, idx) => {
        if (idx !== gIdx) return group;
        if (group.items.length <= 1) {
          return {
            ...group,
            items: [{ ...group.items[0], name: '', amount: null, unit: '' }],
          };
        }
        return {
          ...group,
          items: group.items.filter((_, itemIdx) => itemIdx !== iIdx),
        };
      })
    );
  };

  // Steps Handlers
  const handleStepChange = (sIdx: number, value: string) => {
    setSteps((prev) => prev.map((s, idx) => (idx === sIdx ? value : s)));
  };

  const handleAddStep = () => {
    setSteps((prev) => [...prev, '']);
  };

  const handleRemoveStep = (sIdx: number) => {
    setSteps((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== sIdx) : ['']));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError('Molimo unesite naziv recepta.');
      return;
    }

    const cleanedGroups: IngredientGroup[] = ingredientGroups
      .map((g) => ({
        groupTitle: g.groupTitle.trim() || 'Sastojci',
        items: g.items
          .map((item) => ({
            ...item,
            name: item.name.trim(),
            unit: item.unit.trim(),
          }))
          .filter((item) => item.name.length > 0),
      }))
      .filter((g) => g.items.length > 0);

    if (cleanedGroups.length === 0) {
      cleanedGroups.push({
        groupTitle: 'Sastojci',
        items: [
          {
            id: `ing-${Date.now()}`,
            name: 'Prema izvornom zapisu',
            amount: 1,
            unit: 'mjera',
          },
        ],
      });
    }

    const cleanedSteps = steps.map((s) => s.trim()).filter((s) => s.length > 0);
    if (cleanedSteps.length === 0) {
      cleanedSteps.push('Pripremiti prema uputama iz mamine teke.');
    }

    const trimmedSecret = secretTip.trim();
    const updatedMomTips = trimmedSecret
      ? [trimmedSecret, ...(recipe.momTips || []).slice(1)]
      : recipe.momTips || [];

    const updatedRecipe: Recipe = {
      ...recipe,
      title: trimmedTitle,
      subtitle: subtitle.trim() || 'Obiteljski recept iz mamine teke',
      category,
      subcategory: subcategory.trim() || 'Ostalo',
      panDimensions: panDimensions.trim() || 'Standardni protvan (35 × 25 cm)',
      ovenTemp: ovenTemp.trim(),
      servings: servings.trim() || panDimensions.trim() || '1 mjera',
      prepTimeMinutes: Math.max(0, Number(prepTimeMinutes) || 0),
      cookTimeMinutes: Math.max(0, Number(cookTimeMinutes) || 0),
      ingredientGroups: cleanedGroups,
      steps: cleanedSteps,
      secretTip: trimmedSecret,
      momTips: updatedMomTips,
      englishImagePrompt: englishImagePrompt.trim(),
      updatedAt: Date.now(),
      syncStatus: 'pending',
    };

    onSave(updatedRecipe);
  };

  const handleRefreshEnglishPrompt = async () => {
    if (isTranslatingPrompt) return;
    setIsTranslatingPrompt(true);
    const flatIngNames = ingredientGroups
      .flatMap((g) => g.items.map((i) => i.name.trim()))
      .filter(Boolean);
    try {
      const res = await fetch('/api/translate-dish-prompt', {
        method: 'POST',
        headers: aiHeaders(),
        body: JSON.stringify({
          title: title.trim() || recipe.title,
          category,
          ingredients: flatIngNames,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && typeof data?.englishPrompt === 'string' && data.englishPrompt.trim()) {
        setEnglishImagePrompt(data.englishPrompt.trim());
      } else {
        setEnglishImagePrompt(
          buildAuthenticDishImagePrompt(
            title.trim() || recipe.title,
            flatIngNames,
            category
          ).englishPrompt
        );
      }
    } catch {
      setEnglishImagePrompt(
        buildAuthenticDishImagePrompt(
          title.trim() || recipe.title,
          flatIngNames,
          category
        ).englishPrompt
      );
    } finally {
      setIsTranslatingPrompt(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-recipe-modal-title"
    >
      <div className="w-full max-w-4xl rounded-3xl bg-[#FAF6F0] border-2 border-[#D5C7B4] shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Modal Header */}
        <div className="px-5 sm:px-7 py-4 bg-[#F3ECE1] border-b border-[#DFD3C3] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#9E3B24] text-white flex items-center justify-center shrink-0">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="edit-recipe-modal-title"
                className="font-display text-lg sm:text-xl font-bold text-[#231F1D]"
              >
                Uredi recept
              </h2>
              <p className="text-xs text-[#655A52]">
                Sve izmjene spremaju se izravno u lokalnu Teku
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zatvori uređivanje"
            className="p-2 rounded-xl border border-[#D5C7B4] bg-[#FAF6F0] text-[#5A4F47] hover:bg-[#EAE0D1] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          onSubmit={handleSubmit}
          className="p-5 sm:p-7 overflow-y-auto space-y-6 flex-1"
        >
          {formError && (
            <div className="rounded-xl bg-[#FDF2F0] border border-[#E5B8B2] px-4 py-2.5 text-xs font-bold text-[#B42318]">
              {formError}
            </div>
          )}

          {/* 1. Osnovni podaci: Naziv, Kratki opis, Kategorija i Podkategorija */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-7">
              <label className="block text-xs font-bold text-[#5A4F47] uppercase tracking-wider mb-1">
                Naziv recepta *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setFormError(null);
                }}
                placeholder="npr. Puter štapići ili Krekeri sa sjemenkama"
                className="w-full rounded-xl border border-[#D5C7B4] bg-white px-3.5 py-2.5 text-sm font-bold text-[#231F1D] focus:outline-none focus:border-[#9E3B24]"
              />
            </div>

            <div className="sm:col-span-5">
              <label className="block text-xs font-bold text-[#5A4F47] uppercase tracking-wider mb-1">
                Kategorija (Polica)
              </label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as CategoryId)}
                className="w-full rounded-xl border border-[#D5C7B4] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#231F1D] focus:outline-none focus:border-[#9E3B24]"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-7">
              <label className="block text-xs font-bold text-[#5A4F47] uppercase tracking-wider mb-1">
                Kratki opis / podnaslov
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Kratka obiteljska napomena o jelu..."
                className="w-full rounded-xl border border-[#D5C7B4] bg-white px-3.5 py-2 text-sm text-[#231F1D] focus:outline-none focus:border-[#9E3B24]"
              />
            </div>

            <div className="sm:col-span-5">
              <label className="block text-xs font-bold text-[#5A4F47] uppercase tracking-wider mb-1">
                Podkategorija
              </label>
              <input
                type="text"
                list="edit-subcategory-suggestions"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder="npr. Prhki kolači, Glavna jela..."
                className="w-full rounded-xl border border-[#D5C7B4] bg-white px-3.5 py-2 text-sm text-[#231F1D] focus:outline-none focus:border-[#9E3B24]"
              />
              <datalist id="edit-subcategory-suggestions">
                {activeCategoryMeta?.subcategories.map((sub) => (
                  <option key={sub} value={sub} />
                ))}
              </datalist>
            </div>
          </div>

          {/* 2. Tehnički podaci: Protvan/kalup, Pećnica, Vrijeme pripreme i pečenja */}
          <div className="rounded-2xl bg-[#F3ECE1] border border-[#DFD3C3] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="inline-flex items-center gap-1 text-xs font-bold text-[#5A4F47] mb-1">
                <Ruler className="w-3.5 h-3.5 text-[#9E3B24]" />
                <span>Protvan / kalup</span>
              </label>
              <input
                type="text"
                value={panDimensions}
                onChange={(e) => setPanDimensions(e.target.value)}
                placeholder="npr. Veliki lim (40 × 35 cm)"
                className="w-full rounded-xl border border-[#D5C7B4] bg-white px-3 py-2 text-xs sm:text-sm text-[#231F1D]"
              />
            </div>

            <div>
              <label className="inline-flex items-center gap-1 text-xs font-bold text-[#5A4F47] mb-1">
                <Flame className="w-3.5 h-3.5 text-[#9E3B24]" />
                <span>Temperatura pećnice</span>
              </label>
              <input
                type="text"
                value={ovenTemp}
                onChange={(e) => setOvenTemp(e.target.value)}
                placeholder="npr. 180 °C (umjerena vatra)"
                className="w-full rounded-xl border border-[#D5C7B4] bg-white px-3 py-2 text-xs sm:text-sm text-[#231F1D]"
              />
            </div>

            <div>
              <label className="inline-flex items-center gap-1 text-xs font-bold text-[#5A4F47] mb-1">
                <Clock className="w-3.5 h-3.5 text-[#9E3B24]" />
                <span>Priprema (min)</span>
              </label>
              <input
                type="number"
                min={0}
                max={1440}
                value={prepTimeMinutes}
                onChange={(e) => setPrepTimeMinutes(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-[#D5C7B4] bg-white px-3 py-2 text-xs sm:text-sm font-mono-tabular text-[#231F1D]"
              />
            </div>

            <div>
              <label className="inline-flex items-center gap-1 text-xs font-bold text-[#5A4F47] mb-1">
                <Clock className="w-3.5 h-3.5 text-[#9E3B24]" />
                <span>Pečenje / kuhanje (min)</span>
              </label>
              <input
                type="number"
                min={0}
                max={1440}
                value={cookTimeMinutes}
                onChange={(e) => setCookTimeMinutes(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-[#D5C7B4] bg-white px-3 py-2 text-xs sm:text-sm font-mono-tabular text-[#231F1D]"
              />
            </div>
          </div>

          {/* 3. Sastojci po fazama (dodavanje, brisanje, izmjena naziva i količina) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base sm:text-lg font-bold text-[#231F1D]">
                Sastojci i mjere
              </h3>
              <button
                type="button"
                onClick={handleAddGroup}
                className="inline-flex items-center gap-1 rounded-xl border border-[#D5C7B4] bg-[#F3ECE1] px-3 py-1.5 text-xs font-bold text-[#9E3B24] hover:bg-[#EAE0D1] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova grupa (npr. Krema, Glazura)</span>
              </button>
            </div>

            {ingredientGroups.map((group, gIdx) => (
              <div
                key={gIdx}
                className="rounded-2xl border border-[#DFD3C3] bg-white p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={group.groupTitle}
                    onChange={(e) => handleGroupTitleChange(gIdx, e.target.value)}
                    placeholder="Naziv faze (npr. Tijesto, Nadjev)"
                    className="font-display text-sm font-bold text-[#9E3B24] bg-[#FAF6F0] border border-[#DFD3C3] rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#9E3B24]"
                  />
                  {ingredientGroups.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveGroup(gIdx)}
                      className="text-xs font-semibold text-[#B42318] hover:underline cursor-pointer"
                    >
                      Ukloni grupu
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {group.items.map((item, iIdx) => (
                    <div
                      key={item.id || iIdx}
                      className="grid grid-cols-12 gap-2 items-center"
                    >
                      <div className="col-span-3 sm:col-span-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.amount !== null && item.amount !== undefined ? String(item.amount) : ''}
                          onChange={(e) =>
                            handleIngredientChange(gIdx, iIdx, 'amount', e.target.value)
                          }
                          placeholder="Kol."
                          aria-label="Količina sastojka"
                          className="w-full rounded-lg border border-[#D5C7B4] bg-[#FAF6F0] px-2.5 py-1.5 text-xs sm:text-sm font-mono-tabular text-[#231F1D]"
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <input
                          type="text"
                          value={item.unit || ''}
                          onChange={(e) =>
                            handleIngredientChange(gIdx, iIdx, 'unit', e.target.value)
                          }
                          placeholder="Jed. (g, dl)"
                          aria-label="Jedinica mjere"
                          className="w-full rounded-lg border border-[#D5C7B4] bg-[#FAF6F0] px-2.5 py-1.5 text-xs sm:text-sm text-[#231F1D]"
                        />
                      </div>
                      <div className="col-span-5 sm:col-span-7">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) =>
                            handleIngredientChange(gIdx, iIdx, 'name', e.target.value)
                          }
                          placeholder="Naziv sastojka (npr. oštro brašno, maslac)"
                          aria-label="Naziv sastojka"
                          className="w-full rounded-lg border border-[#D5C7B4] bg-[#FAF6F0] px-2.5 py-1.5 text-xs sm:text-sm font-medium text-[#231F1D]"
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredient(gIdx, iIdx)}
                          aria-label="Obriši sastojak"
                          className="p-1.5 rounded-lg text-[#7A6A5E] hover:text-[#B42318] hover:bg-[#FDF2F0] cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleAddIngredient(gIdx)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#9E3B24] hover:underline pt-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Dodaj sastojak</span>
                </button>
              </div>
            ))}
          </div>

          {/* 4. Koraci postupka (dodavanje, brisanje, izmjena teksta) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base sm:text-lg font-bold text-[#231F1D]">
                Koraci pripreme
              </h3>
              <button
                type="button"
                onClick={handleAddStep}
                className="inline-flex items-center gap-1 rounded-xl border border-[#D5C7B4] bg-[#F3ECE1] px-3 py-1.5 text-xs font-bold text-[#9E3B24] hover:bg-[#EAE0D1] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Dodaj korak</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {steps.map((stepText, sIdx) => (
                <div key={sIdx} className="flex items-start gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-[#9E3B24] text-white font-mono-tabular text-xs font-bold flex items-center justify-center shrink-0 mt-1.5">
                    {sIdx + 1}.
                  </span>
                  <textarea
                    rows={2}
                    value={stepText}
                    onChange={(e) => handleStepChange(sIdx, e.target.value)}
                    placeholder={`Opišite ${sIdx + 1}. korak pripreme...`}
                    className="flex-1 rounded-xl border border-[#D5C7B4] bg-white p-2.5 text-xs sm:text-sm text-[#231F1D] leading-relaxed focus:outline-none focus:border-[#9E3B24]"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveStep(sIdx)}
                    aria-label={`Obriši korak ${sIdx + 1}`}
                    className="p-2 rounded-lg text-[#7A6A5E] hover:text-[#B42318] hover:bg-[#FDF2F0] mt-1 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Mamina tajna (žuti post-it) */}
          <div className="rounded-2xl bg-[#FFF7C2] border border-[#E6D073] p-4 space-y-2">
            <label className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#7A5210]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Mamina tajna / napomena s margine</span>
            </label>
            <textarea
              rows={2}
              value={secretTip}
              onChange={(e) => setSecretTip(e.target.value)}
              placeholder="npr. Ne otvaraj pećnicu prvih 15 minuta, ili posipaj štaub-šećerom dok su još vrući..."
              className="w-full rounded-xl border border-[#DFC354] bg-white/90 p-2.5 text-xs sm:text-sm text-[#231F1D] focus:outline-none focus:border-[#9E3B24]"
            />
          </div>

          {/* 6. AI Prompt Generator (Engleski kulinarski prijevod) — uredivo tekstualno polje (Textarea) */}
          <div className="rounded-2xl bg-white border border-[#DFD3C3] p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="edit-english-prompt-textarea"
                className="text-xs font-bold text-[#9E3B24]"
              >
                AI Prompt Generator (Engleski kulinarski prijevod)
              </label>
              <button
                type="button"
                onClick={handleRefreshEnglishPrompt}
                disabled={isTranslatingPrompt}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#9E3B24] hover:underline cursor-pointer disabled:opacity-50"
                title="Prevedi trenutni naziv, kategoriju i sastojke u fotorealističan engleski opis pomoću AI modela"
              >
                <RefreshCw
                  className={`w-3 h-3 ${isTranslatingPrompt ? 'animate-spin' : ''}`}
                />
                <span>
                  {isTranslatingPrompt
                    ? 'Prevodim...'
                    : 'Prevedi ponovno iz naziva i sastojaka'}
                </span>
              </button>
            </div>
            <p className="text-xs text-[#655A52]">
              Ovdje možete pročitati ili ručno upisati engleski opis za generiranje AI slike jela (npr.{' '}
              <em>Traditional walnut roll cake, powdered sugar, sliced on vintage plate</em>):
            </p>
            <textarea
              id="edit-english-prompt-textarea"
              data-testid="edit-english-prompt-textarea"
              rows={3}
              value={englishImagePrompt}
              onChange={(e) => setEnglishImagePrompt(e.target.value)}
              placeholder="Traditional walnut roll cake, powdered sugar, sliced on vintage plate..."
              className="w-full rounded-xl border border-[#D5C7B4] bg-[#FAF6F0] p-2.5 text-xs sm:text-sm font-mono text-[#231F1D] leading-relaxed focus:outline-none focus:border-[#9E3B24]"
            />
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t border-[#DFD3C3] flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#D5C7B4] bg-[#F3ECE1] text-xs sm:text-sm font-bold text-[#5A4F47] hover:bg-[#EAE0D1] min-h-[42px] cursor-pointer"
            >
              Odustani
            </button>
            <button
              type="submit"
              data-testid="save-edited-recipe-btn"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#9E3B24] hover:bg-[#842F1B] text-xs sm:text-sm font-bold text-white transition-colors min-h-[42px] cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Spremi izmjene</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
