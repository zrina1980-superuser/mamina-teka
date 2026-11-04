import React, { useState, useEffect } from 'react';
import { Search, X, Clock, Star, ArrowRight, Plus } from 'lucide-react';
import {
  CATEGORIES,
  pickDailyOrRandomHeroRecipe,
  resolvePrintableRecipeImage,
  type CategoryId,
  type Recipe,
} from '../utils/recipeLogic';
import { getOfflineFallbackDishUri } from '../utils/visualAssets';

interface HomeViewProps {
  recipes: Recipe[];
  filteredRecipes: Recipe[];
  favoriteRecipes: Recipe[];
  searchQuery: string;
  onChangeSearchQuery: (q: string) => void;
  onOpenRecipe: (recipeId: string) => void;
  onNavigateToTab: (tab: 'teka' | 'kategorije' | 'planer' | 'favoriti' | 'o-teki') => void;
  onOpenCategoryShelf: (catId: CategoryId, subcategory?: string) => void;
  onOpenScanWizard: () => void;
  renderRecipeCard: (recipe: Recipe) => React.ReactNode;
  maminMod: boolean;
}

export const HomeView: React.FC<HomeViewProps> = ({
  recipes,
  filteredRecipes,
  favoriteRecipes,
  searchQuery,
  onChangeSearchQuery,
  onOpenRecipe,
  onNavigateToTab,
  onOpenCategoryShelf,
  onOpenScanWizard,
  renderRecipeCard,
  maminMod,
}) => {
  const [heroRecipeId, setHeroRecipeId] = useState<string | null>(() => {
    const initial = pickDailyOrRandomHeroRecipe(recipes, null, false);
    return initial?.id || null;
  });
  const [isShufflingHero, setIsShufflingHero] = useState(false);

  // Ensure heroRecipeId always points to an existing non-deleted recipe
  useEffect(() => {
    if (recipes.length === 0) {
      setHeroRecipeId(null);
      return;
    }
    if (!heroRecipeId || !recipes.some((r) => r.id === heroRecipeId)) {
      const next = pickDailyOrRandomHeroRecipe(recipes, null, false);
      setHeroRecipeId(next?.id || recipes[0].id);
    }
  }, [recipes, heroRecipeId]);

  const heroRecipe =
    recipes.find((r) => r.id === heroRecipeId) ||
    pickDailyOrRandomHeroRecipe(recipes, null, false);

  const handleAnotherHeroIdea = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (recipes.length === 0) return;
    setIsShufflingHero(true);
    const next = pickDailyOrRandomHeroRecipe(recipes, heroRecipe?.id || null, true);
    if (next) {
      setHeroRecipeId(next.id);
    }
    window.setTimeout(() => setIsShufflingHero(false), 220);
  };

  // Last 5 added recipes for "Zadnje upisano u Teku"
  const lastFiveRecipes = React.useMemo(
    () => [...recipes].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5),
    [recipes]
  );

  const getCardPhoto = (recipe: Recipe): string => {
    const fallback = getOfflineFallbackDishUri(recipe.title, recipe.category);
    const primary = resolvePrintableRecipeImage(recipe, '');
    if (primary) return primary;
    if (recipe.originalScanUrl && !recipe.originalScanUrl.startsWith('data:image/svg')) {
      return recipe.originalScanUrl;
    }
    if (recipe.originalImage && !recipe.originalImage.startsWith('data:image/svg')) {
      return recipe.originalImage;
    }
    return recipe.imageUrl || recipe.image || fallback;
  };

  const renderCarouselCard = (recipe: Recipe, testIdPrefix: string) => {
    const cat = CATEGORIES.find((c) => c.id === recipe.category);
    const photoUrl = getCardPhoto(recipe);
    const totalMinutes = (recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0);

    return (
      <button
        key={recipe.id}
        type="button"
        data-testid={`${testIdPrefix}-card-${recipe.id}`}
        onClick={() => onOpenRecipe(recipe.id)}
        className="snap-start shrink-0 w-44 sm:w-52 rounded-2xl border border-[#DFD3C3] dark:border-stone-700 bg-white dark:bg-[#24201E] overflow-hidden text-left group transition-transform duration-150 hover:-translate-y-0.5 cursor-pointer flex flex-col"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-[#2B1D16]">
          <img
            src={photoUrl}
            alt={recipe.title}
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.currentTarget;
              const fallback = getOfflineFallbackDishUri(recipe.title, recipe.category);
              if (target.src !== fallback) {
                target.src = fallback;
              }
            }}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
          <span className="absolute bottom-2 left-2.5 right-2.5 truncate text-[11px] font-semibold text-[#FAF6F0]">
            {cat?.shortTitle || recipe.subcategory}
          </span>
          {recipe.isFavorite && (
            <span
              aria-hidden="true"
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/55 backdrop-blur-xs flex items-center justify-center text-[#F3B64B]"
            >
              <Star className="w-3.5 h-3.5 fill-current" />
            </span>
          )}
        </div>
        <div className="p-3 flex-1 flex flex-col justify-between">
          <h3 className="font-display text-sm sm:text-base font-bold text-[#231F1D] dark:text-stone-100 line-clamp-2 leading-snug group-hover:text-[#9E3B24] dark:group-hover:text-[#F08C70] transition-colors">
            {recipe.title}
          </h3>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#655A52] dark:text-stone-400">
            <span className="truncate">{recipe.subcategory}</span>
            <span className="font-mono-tabular shrink-0 ml-1">{totalMinutes} min</span>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6 pb-32" data-testid="home-view-redesign">
      {/* Podnaslov odmah ispod zaglavlja */}
      <p className="text-xs sm:text-sm font-semibold tracking-wide text-[#7A542E] dark:text-[#D5B59C] pl-1">
        Digitalni obiteljski trezor recepata
      </p>

      {/* 1. NOVI HERO ELEMENT: "MAMIN PRIJEDLOG DANA" (Recept dana / Nasumični odabir) */}
      {heroRecipe && (
        <section aria-label="Mamin prijedlog dana">
          <div
            role="button"
            tabIndex={0}
            data-testid="home-hero-card"
            onClick={() => onOpenRecipe(heroRecipe.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenRecipe(heroRecipe.id);
              }
            }}
            className={`relative w-full h-48 sm:h-56 rounded-3xl overflow-hidden border border-[#DFD3C3] dark:border-stone-700 bg-[#2B1D16] shadow-sm group cursor-pointer transition-opacity duration-200 ${
              isShufflingHero ? 'opacity-75' : 'opacity-100'
            }`}
          >
            <img
              src={getCardPhoto(heroRecipe)}
              alt={heroRecipe.title}
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.currentTarget;
                const fallback = getOfflineFallbackDishUri(heroRecipe.title, heroRecipe.category);
                if (target.src !== fallback) {
                  target.src = fallback;
                }
              }}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            />

            {/* Tamni gradijent za savršenu čitljivost naslova i bedža */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/25" />

            {/* Gornji lijevi kut: Oznaka dana "Prijedlog za danas ☀️" */}
            <div className="absolute top-3.5 left-4 z-10">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-black/60 backdrop-blur-xs border border-white/20 px-3 py-1.5 text-xs font-bold text-[#FAF6F0]">
                <span>Prijedlog za danas ☀️</span>
              </span>
            </div>

            {/* Gornji desni kut: Diskretni gumb "🎲 Druga ideja" */}
            <div className="absolute top-3.5 right-4 z-10">
              <button
                type="button"
                data-testid="hero-another-idea-btn"
                onClick={handleAnotherHeroIdea}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#FAF6F0]/95 dark:bg-[#24201E]/95 hover:bg-white text-[#231F1D] dark:text-stone-100 border border-[#DFD3C3] dark:border-stone-600 px-3 py-1.5 text-xs font-bold shadow-md transition-transform active:scale-95 cursor-pointer"
                title="Učitaj drugi nasumični recept iz Teke"
              >
                <span aria-hidden="true">🎲</span>
                <span>Druga ideja</span>
              </button>
            </div>

            {/* Podnožje Hero kartice: Naziv recepta (krupni serif font) i vrijeme pripreme */}
            <div className="absolute bottom-3.5 left-4 right-4 z-10 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h1
                  data-testid="hero-recipe-title"
                  className="font-display text-xl sm:text-3xl font-bold text-[#FAF6F0] leading-tight line-clamp-2 drop-shadow-xs"
                >
                  {heroRecipe.title}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs sm:text-sm font-medium text-[#EEDEC9]">
                  <span className="inline-flex items-center gap-1 font-mono-tabular">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {(heroRecipe.prepTimeMinutes || 0) + (heroRecipe.cookTimeMinutes || 0)} min
                    </span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {CATEGORIES.find((c) => c.id === heroRecipe.category)?.shortTitle ||
                      heroRecipe.subcategory}
                  </span>
                </div>
              </div>

              <span className="hidden sm:inline-flex items-center gap-1 rounded-xl bg-[#9E3B24] px-3.5 py-2 text-xs font-bold text-white shrink-0 shadow-xs">
                <span>Otvori recept</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </section>
      )}

      {/* 2. KOMPAKTNA TRAŽILICA s bedžom ukupnog broja recepata */}
      <section aria-label="Pretraga recepata">
        <div className="relative flex items-center">
          <label htmlFor="smart-recipe-search" className="sr-only">
            Pretraži recepte po nazivu ili sastojku
          </label>
          <Search className="w-5 h-5 text-[#7A6A5E] dark:text-stone-400 absolute left-4 pointer-events-none" />
          <input
            id="smart-recipe-search"
            data-testid="compact-search-input"
            type="search"
            value={searchQuery}
            onChange={(e) => onChangeSearchQuery(e.target.value)}
            placeholder="Pretraži recepte po nazivu ili sastojku..."
            className="w-full rounded-2xl border-2 border-[#D5C7B4] dark:border-stone-700 bg-white dark:bg-[#24201E] pl-11 pr-20 py-3.5 text-sm sm:text-base text-[#231F1D] dark:text-stone-100 placeholder:text-[#847568] dark:placeholder:text-stone-400 focus:outline-none focus:border-[#9E3B24]"
          />
          <div className="absolute right-3 flex items-center gap-1.5">
            {searchQuery && (
              <button
                type="button"
                onClick={() => onChangeSearchQuery('')}
                aria-label="Očisti pretragu"
                className="p-1.5 rounded-lg text-[#655A52] hover:bg-[#EAE0D1] dark:hover:bg-stone-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <span
              data-testid="search-total-recipes-badge"
              title={`Ukupno ${recipes.length} recepata u Teki`}
              className="rounded-xl bg-[#F3ECE1] dark:bg-stone-800 border border-[#DFD3C3] dark:border-stone-700 px-2.5 py-1 text-xs font-mono-tabular font-bold text-[#7A542E] dark:text-stone-300"
            >
              {recipes.length}
            </span>
          </div>
        </div>
      </section>

      {/* Rezultati pretrage ako korisnik tipka u tražilicu */}
      {searchQuery.trim().length > 0 ? (
        <section className="space-y-4" data-testid="search-results-section">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#231F1D] dark:text-stone-100">
              Rezultati pretrage za „{searchQuery}” ({filteredRecipes.length})
            </h2>
            <button
              type="button"
              onClick={() => onChangeSearchQuery('')}
              className="text-xs font-semibold text-[#9E3B24] underline cursor-pointer"
            >
              Prikaži početni zaslon
            </button>
          </div>

          {filteredRecipes.length === 0 ? (
            <div className="rounded-3xl border border-[#DFD3C3] dark:border-stone-700 bg-white dark:bg-[#24201E] p-10 text-center space-y-3">
              <p className="font-display text-xl font-bold text-[#231F1D] dark:text-stone-100">
                Nismo pronašli recept s tim pojmom u Teki.
              </p>
              <p className="text-sm text-[#655A52] dark:text-stone-400">
                Imate taj recept na papiru? Slikajte stranicu i dodajte ga u trezor.
              </p>
              <button
                type="button"
                onClick={onOpenScanWizard}
                className="inline-flex items-center gap-2 rounded-xl bg-[#9E3B24] px-5 py-2.5 text-sm font-bold text-white cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Skeniraj novi recept</span>
              </button>
            </div>
          ) : (
            <div
              className={`grid gap-6 ${
                maminMod
                  ? 'grid-cols-1 md:grid-cols-2'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              }`}
            >
              {filteredRecipes.map(renderRecipeCard)}
            </div>
          )}
        </section>
      ) : (
        <>
          {/* 3A. VODORAVNI VRTULJAK 1: "Zadnje upisano u Teku" (zadnjih 5 recepata) */}
          <section className="space-y-3" aria-label="Zadnje upisano u Teku">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#231F1D] dark:text-stone-100">
                  Zadnje upisano u Teku
                </h2>
                <p className="text-xs sm:text-sm text-[#655A52] dark:text-stone-400">
                  Posljednjih 5 dodanih recepata iz vaše zbirke
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToTab('kategorije')}
                className="text-xs font-bold text-[#9E3B24] dark:text-[#F08C70] hover:underline whitespace-nowrap cursor-pointer"
              >
                Svi recepti ({recipes.length}) →
              </button>
            </div>

            <div
              data-testid="carousel-recently-added"
              className="flex items-stretch gap-3.5 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1"
            >
              {lastFiveRecipes.map((recipe) => renderCarouselCard(recipe, 'recent'))}
            </div>
          </section>

          {/* 3B. VODORAVNI VRTULJAK 2: "Mami najdraže" (Favoriti) */}
          <section className="space-y-3" aria-label="Mami najdraže">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#231F1D] dark:text-stone-100">
                  Mami najdraže ({favoriteRecipes.length})
                </h2>
                <p className="text-xs sm:text-sm text-[#655A52] dark:text-stone-400">
                  Obiteljski favoriti označeni zvjezdicom
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToTab('favoriti')}
                className="text-xs font-bold text-[#9E3B24] dark:text-[#F08C70] hover:underline whitespace-nowrap cursor-pointer"
              >
                Svi favoriti →
              </button>
            </div>

            {favoriteRecipes.length === 0 ? (
              <div className="rounded-2xl border border-[#DFD3C3] dark:border-stone-700 bg-white dark:bg-[#24201E] p-5 text-xs sm:text-sm text-[#655A52] dark:text-stone-400">
                Označite omiljene recepte zvjezdicom ★ kako bi se prikazali u ovom vrtuljku.
              </div>
            ) : (
              <div
                data-testid="carousel-favorites"
                className="flex items-stretch gap-3.5 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1"
              >
                {favoriteRecipes.map((recipe) => renderCarouselCard(recipe, 'favorite'))}
              </div>
            )}
          </section>

          {/* Tematske police u Teki (Brzi ulaz u 5 glavnih kategorija) */}
          <section className="space-y-3.5 pt-2" aria-label="Tematske police u Teki">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#231F1D] dark:text-stone-100">
                  Tematske police u Teki
                </h2>
                <p className="text-xs sm:text-sm text-[#655A52] dark:text-stone-400">
                  Od slatkih dizanih kolača i nedjeljnog ručka do sušione i špajze
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToTab('kategorije')}
                className="text-xs sm:text-sm font-bold text-[#9E3B24] dark:text-[#F08C70] hover:underline whitespace-nowrap cursor-pointer"
              >
                Sve kategorije →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {CATEGORIES.map((cat) => {
                const count = recipes.filter((r) => r.category === cat.id).length;
                return (
                  <div
                    key={cat.id}
                    className="rounded-2xl border border-[#DFD3C3] dark:border-stone-700 bg-white dark:bg-[#24201E] p-4 flex flex-col justify-between hover:border-[#9E3B24] transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs font-mono-tabular text-[#655A52] dark:text-stone-400 mb-1.5">
                        <span>Polica</span>
                        <span>{count} recepata</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenCategoryShelf(cat.id)}
                        className="text-left block group cursor-pointer"
                      >
                        <h3 className="font-display text-base sm:text-lg font-bold text-[#231F1D] dark:text-stone-100 group-hover:text-[#9E3B24] transition-colors">
                          {cat.title}
                        </h3>
                      </button>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {cat.subcategories.map((sub) => (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => onOpenCategoryShelf(cat.id, sub)}
                            className="rounded-xl bg-[#FAF6F0] dark:bg-stone-800 border border-[#E5DAC8] dark:border-stone-700 px-2.5 py-1 text-xs font-medium text-[#5A4F47] dark:text-stone-300 hover:bg-[#9E3B24] hover:text-white hover:border-[#9E3B24] transition-colors text-left cursor-pointer"
                          >
                            {sub}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenCategoryShelf(cat.id)}
                      className="mt-3 pt-2.5 border-t border-[#F1E8DA] dark:border-stone-700 text-xs font-bold text-[#9E3B24] dark:text-[#F08C70] text-left cursor-pointer"
                    >
                      Otvori policu →
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
};
