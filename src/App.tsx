/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  BookOpen,
  LayoutGrid,
  CalendarClock,
  Star,
  Plus,
  Search,
  Shuffle,
  ChefHat,
  X,
  ArrowRight,
  Trash2,
  AlertTriangle,
  LogIn,
} from 'lucide-react';
import {
  CATEGORIES,
  filterRecipes,
  advanceDeleteConfirmationStep,
  parseVaultInviteFromSearch,
  applyDeletedRecipeFilter,
  resolveBackNavigationStep,
  type CategoryId,
  type Recipe,
  type SyncProgressState,
} from './utils/recipeLogic';
import {
  ensureSeededRecipes,
  saveRecipeToDb,
  softDeleteRecipeInDb,
  getDeletedRecipeIds,
  getHideSampleManuscripts,
  setHideSampleManuscripts,
} from './db/tekaDb';
import { INITIAL_RECIPES } from './db/seedRecipes';
import { Header } from './components/Header';
import { HomeView } from './components/HomeView';
import { RecipeDetailView } from './components/RecipeDetailView';
import { CookingModeModal } from './components/CookingModeModal';
import { ScanWizardModal } from './components/ScanWizardModal';
import { AboutAndPrintView } from './components/AboutAndPrintView';
import { OfflineIndicator } from './components/PWAInstallBanner';
import { Splash, AppIconEmblem } from './components/Splash';
import { getOfflineFallbackDishUri } from './utils/visualAssets';

import {
  subscribeToAuthChanges,
  signInWithGooglePopup,
  signOutGoogleUser,
  testFirestoreConnection,
  ensureActiveFamilyVault,
  syncLocalRecipesWithFirestore,
  runLocalSequentialSyncPass,
  getSyncProgress,
  setSyncProgressState,
  subscribeToSyncProgress,
  savePendingVaultInvite,
  type FamilyVaultDoc,
} from './services/firebaseSync';
import type { User } from 'firebase/auth';

type MainNavTab = 'teka' | 'kategorije' | 'planer' | 'favoriti' | 'o-teki';

export default function App() {
  const [recipes, setRecipes] = useState<Recipe[]>(() =>
    applyDeletedRecipeFilter(INITIAL_RECIPES, getDeletedRecipeIds())
  );
  const [isLoaded, setIsLoaded] = useState(true);

  // Nostalgic Scrapbook Splash Screen (~1.4s on initial launch, skipped when ?autostart=1, invite link, or already shown in session)
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    try {
      const search = window.location.search;
      if (search.includes('autostart=1') || search.includes('trezorId=')) {
        return false;
      }
      if (sessionStorage.getItem('mamina_teka_splash_shown') === '1') {
        return false;
      }
    } catch {
      // Ignore
    }
    return true;
  });

  const handleFinishSplash = useCallback(() => {
    try {
      sessionStorage.setItem('mamina_teka_splash_shown', '1');
    } catch {
      // Ignore storage errors
    }
    setShowSplash(false);
  }, []);

  useEffect(() => {
    if (!showSplash) return;
    const failsafeTimer = window.setTimeout(() => {
      handleFinishSplash();
    }, 1600);
    return () => window.clearTimeout(failsafeTimer);
  }, [showSplash, handleFinishSplash]);
  const [activeInviteNotice, setActiveInviteNotice] = useState<{
    trezorId: string;
    inviteKey: string;
  } | null>(null);

  // Navigation & Active States
  const [activeTab, setActiveTab] = useState<MainNavTab>('teka');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [cookingState, setCookingState] = useState<{
    recipe: Recipe;
    multiplier: number;
    lessSweet?: boolean;
  } | null>(null);
  const [showScanWizard, setShowScanWizard] = useState(false);

  // Double-Back to Exit Toast State & Refs
  const [exitToastVisible, setExitToastVisible] = useState(false);
  const lastHomeBackPressRef = useRef<number>(0);
  const exitToastTimerRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Search & Category Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | 'all'>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | 'all'>('all');

  // Mamin Mod (25-30% larger text & simplified large touch cards)
  const [maminMod, setMaminMod] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mamina_teka_mamin_mod') === 'true';
    } catch {
      return false;
    }
  });

  // Topla tamna tema (Warm Rustic Dark Mode)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mamina_teka_dark_mode') === 'true';
    } catch {
      return false;
    }
  });

  // Random Idea ("Daj ideju") suggestion spotlight
  const [randomIdeaRecipe, setRandomIdeaRecipe] = useState<Recipe | null>(null);

  // Sample manuscripts visibility ("Isprobaj odmah") persisted in localStorage
  const [hideSampleManuscriptsState, setHideSampleManuscriptsState] = useState<boolean>(() =>
    getHideSampleManuscripts()
  );

  // Card-level 2-step delete confirmation state
  const [cardDeleteTarget, setCardDeleteTarget] = useState<Recipe | null>(null);
  const [cardDeleteStep, setCardDeleteStep] = useState<0 | 1 | 2>(0);

  // Firebase Auth & Local-First Cloud Sync States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [vaultInfo, setVaultInfo] = useState<FamilyVaultDoc | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgressState>(() =>
    getSyncProgress()
  );
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeProgress = subscribeToSyncProgress((nextState) => {
      setSyncProgress(nextState);
    });
    return () => unsubscribeProgress();
  }, []);

  const loadRecipes = useCallback(async () => {
    try {
      const list = await ensureSeededRecipes();
      setRecipes(list);
    } catch (err) {
      console.warn('Učitavanje recepata iz lokalne baze nije uspjelo, koristim zadane recepte:', err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadRecipes();
    testFirestoreConnection();
    try {
      const parsedInvite = parseVaultInviteFromSearch(window.location.search);
      if (parsedInvite) {
        savePendingVaultInvite(parsedInvite.trezorId, parsedInvite.inviteKey);
        window.history.replaceState(
          window.history.state || { maminaTeka: true, tab: 'teka', recipeId: null },
          document.title,
          window.location.pathname
        );
        setActiveInviteNotice(parsedInvite);
      }
    } catch {
      // Ignore URL parse errors
    }
  }, [loadRecipes]);

  // Listen to online/offline status
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const syncInProgressRef = useRef(false);
  const prevOnlineRef = useRef(isOnline);
  const lastAutoSyncRef = useRef<{ uid: string; timestamp: number }>({
    uid: '',
    timestamp: 0,
  });

  // Run background or manual sequential sync with strict try...finally cleanup
  const runBackgroundSync = useCallback(
    async (
      user: User | null,
      _existingVault?: FamilyVaultDoc | null,
      allowLocalSequentialFallback = false
    ) => {
      if (!navigator.onLine) return;
      if (!user || !user.email) {
        if (!allowLocalSequentialFallback) return;
      }
      if (syncInProgressRef.current) return;
      syncInProgressRef.current = true;
      setIsSyncing(true);
      try {
        if (user && user.email) {
          const activeVault = await ensureActiveFamilyVault(user);
          setVaultInfo(activeVault);
          if (
            window.location.search.includes('trezorId=') ||
            window.location.search.includes('inviteKey=')
          ) {
            window.history.replaceState(
              window.history.state || { maminaTeka: true, tab: 'teka', recipeId: null },
              document.title,
              window.location.pathname
            );
          }
          setActiveInviteNotice(null);
          await syncLocalRecipesWithFirestore(user, activeVault);
        } else {
          await runLocalSequentialSyncPass();
        }
        const refreshed = await ensureSeededRecipes();
        setRecipes(refreshed);
      } catch (err) {
        console.warn('Sinkronizacija odgođena (lokalna baza aktivna):', err);
      } finally {
        syncInProgressRef.current = false;
        setIsSyncing(false);
        setSyncProgressState({ active: false });
      }
    },
    []
  );


  useEffect(() => {
    const unsub = subscribeToAuthChanges((user) => {
      setCurrentUser(user);
      if (user && user.email) {
        const now = Date.now();
        if (
          lastAutoSyncRef.current.uid !== user.uid ||
          now - lastAutoSyncRef.current.timestamp > 45000
        ) {
          lastAutoSyncRef.current = { uid: user.uid, timestamp: now };
          runBackgroundSync(user, null);
        }
      } else {
        lastAutoSyncRef.current = { uid: '', timestamp: 0 };
        setVaultInfo(null);
      }
    });
    return () => unsub();
  }, [runBackgroundSync]);

  // Automatically trigger sync only when transitioning from offline -> online
  useEffect(() => {
    const wasOffline = !prevOnlineRef.current;
    prevOnlineRef.current = isOnline;
    if (wasOffline && isOnline && currentUser) {
      runBackgroundSync(currentUser, null);
    }
  }, [isOnline, currentUser, runBackgroundSync]);

  useEffect(() => {
    const root = document.documentElement;
    if (maminMod) {
      root.classList.add('mamin-mod');
    } else {
      root.classList.remove('mamin-mod');
    }
    try {
      localStorage.setItem('mamina_teka_mamin_mod', String(maminMod));
    } catch {
      // Ignore storage errors
    }
  }, [maminMod]);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark-mode');
      root.classList.add('dark');
    } else {
      root.classList.remove('dark-mode');
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('mamina_teka_dark_mode', String(darkMode));
    } catch {
      // Ignore storage errors
    }
  }, [darkMode]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGooglePopup();
    } catch {
      setAuthError('Google prijava nije uspjela ili je prozor zatvoren.');
      window.setTimeout(() => setAuthError(null), 4000);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await signOutGoogleUser();
    } catch {
      // Ignore
    }
  };

  const handleUpdateRecipe = async (updated: Recipe) => {
    const stamped: Recipe = {
      ...updated,
      updatedAt: Date.now(),
      syncStatus: currentUser && isOnline ? 'pending' : 'synced',
      authorEmail: currentUser?.email || updated.authorEmail,
    };
    await saveRecipeToDb(stamped, !(currentUser && isOnline));
    setRecipes((prev) => prev.map((r) => (r.id === stamped.id ? stamped : r)));
    if (currentUser && isOnline) {
      runBackgroundSync(currentUser, vaultInfo);
    }
  };

  const handleSaveScannedRecipe = async (newRecipe: Recipe) => {
    const stamped: Recipe = {
      ...newRecipe,
      updatedAt: Date.now(),
      syncStatus: currentUser && isOnline ? 'pending' : 'synced',
      authorEmail: currentUser?.email || newRecipe.authorEmail,
    };
    await saveRecipeToDb(stamped, !(currentUser && isOnline));
    setRecipes((prev) => [stamped, ...prev]);
    setShowScanWizard(false);
    setSelectedRecipeId(stamped.id);
    if (currentUser && isOnline) {
      runBackgroundSync(currentUser, vaultInfo);
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    await softDeleteRecipeInDb(recipeId, currentUser?.email || undefined);
    setRecipes((prev) => prev.filter((r) => r.id !== recipeId));
    setSelectedRecipeId((prev) => (prev === recipeId ? null : prev));
    setRandomIdeaRecipe((prev) => (prev?.id === recipeId ? null : prev));
    if (currentUser && isOnline) {
      runBackgroundSync(currentUser, vaultInfo);
    }
  };

  const handleChangeHideSampleManuscripts = (hide: boolean) => {
    setHideSampleManuscripts(hide);
    setHideSampleManuscriptsState(hide);
  };

  const handlePickRandomIdea = () => {
    if (recipes.length === 0) return;
    const pool =
      recipes.length > 1 && randomIdeaRecipe
        ? recipes.filter((r) => r.id !== randomIdeaRecipe.id)
        : recipes;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    setRandomIdeaRecipe(picked);
  };

  const selectedRecipe = useMemo(
    () => recipes.find((r) => r.id === selectedRecipeId) || null,
    [recipes, selectedRecipeId]
  );

  const filteredRecipes = useMemo(
    () => filterRecipes(recipes, searchQuery, selectedCategory, selectedSubcategory),
    [recipes, searchQuery, selectedCategory, selectedSubcategory]
  );

  const cookSoonRecipes = useMemo(
    () => recipes.filter((r) => r.inCookSoon),
    [recipes]
  );

  const favoriteRecipes = useMemo(
    () => recipes.filter((r) => r.isFavorite),
    [recipes]
  );

  const recentlyDigitized = useMemo(
    () => [...recipes].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4),
    [recipes]
  );

  const pendingSyncCount = useMemo(
    () => recipes.filter((r) => r.syncStatus === 'pending').length,
    [recipes]
  );

  const navigationStackRef = useRef<
    Array<{
      tab: MainNavTab;
      category: CategoryId | 'all';
      subcategory: string | 'all';
      searchQuery: string;
      scrollY: number;
    }>
  >([]);

  // Track whether list view is currently scrolled > 120px so history depth includes scroll-to-top step
  const [isListScrolled, setIsListScrolled] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // History depth tracking refs for Android Chrome HistoryManipulationIntervention compliance:
  // depth = 0 is the root entry (entries_[0]). We NEVER call pushState on mount before a user gesture,
  // so entries_[0] receives the first user gesture (has_user_gesture = true) before depth = 1 is pushed.
  // Thus on Home ('teka'):
  // - Active browsing is at depth = 1 (entries_[1]).
  // - 1st Back press pops 1 -> 0 (entries_[0], which has has_user_gesture = true), firing popstate and showing the exit toast.
  // - 2nd Back press at depth = 0 (entries_[0], root of session history) natively exits the app!
  const historyDepthRef = useRef<number>(0);
  const entryHasGestureRef = useRef<boolean>(false);
  const lastHistoryPushMsRef = useRef<number>(0);
  const silentHistoryRewindRef = useRef<boolean>(false);
  const handlingPopStateRef = useRef<boolean>(false);

  const hasOpenModal = Boolean(cookingState || showScanWizard || cardDeleteTarget);
  const hasActiveSearchOrFilter =
    searchQuery.trim().length > 0 ||
    (activeTab === 'kategorije' &&
      (selectedCategory !== 'all' || selectedSubcategory !== 'all'));

  // Calculate exact required history depth so Back steps match history entries 1-to-1
  const requiredHistoryDepth = useMemo(() => {
    if (!hasUserInteracted) {
      return 0;
    }
    if (
      exitToastVisible &&
      activeTab === 'teka' &&
      !hasActiveSearchOrFilter &&
      !selectedRecipeId &&
      !hasOpenModal
    ) {
      return 0;
    }

    let depth = 1; // Home ('teka') guard entry (depth = 1)

    if (selectedRecipeId) {
      const topSnap =
        navigationStackRef.current[navigationStackRef.current.length - 1];
      const snapIsNonHome =
        topSnap &&
        (topSnap.tab !== 'teka' ||
          topSnap.searchQuery.trim().length > 0);
      if (snapIsNonHome) {
        depth += 1; // return-to-home step
        if ((topSnap?.scrollY || 0) > 120) {
          depth += 1; // scroll-to-top step
        }
      }
      depth += 1; // close-recipe-restore-scroll step
    } else if (activeTab !== 'teka' || hasActiveSearchOrFilter) {
      depth += 1; // return-to-home step
      if (isListScrolled) {
        depth += 1; // scroll-to-top step
      }
    }

    if (hasOpenModal) {
      depth += 1; // close-modal step
    }

    return depth;
  }, [
    hasUserInteracted,
    exitToastVisible,
    activeTab,
    hasActiveSearchOrFilter,
    selectedRecipeId,
    hasOpenModal,
    isListScrolled,
  ]);

  const syncHistoryDepthUpwards = useCallback(
    (targetDepth: number) => {
      if (!entryHasGestureRef.current) return;
      if (historyDepthRef.current >= targetDepth) return;
      try {
        const nextDepth = historyDepthRef.current + 1;
        window.history.pushState(
          {
            maminaTeka: true,
            depth: nextDepth,
            tab: activeTab,
            recipeId: selectedRecipeId,
          },
          ''
        );
        historyDepthRef.current = nextDepth;
        entryHasGestureRef.current = false;
        lastHistoryPushMsRef.current = performance.now();
      } catch {
        // Ignore history errors in restricted sandboxes
      }
    },
    [activeTab, selectedRecipeId]
  );

  // Sync history depth whenever requiredHistoryDepth changes
  useEffect(() => {
    if (handlingPopStateRef.current) return;

    if (historyDepthRef.current < requiredHistoryDepth) {
      syncHistoryDepthUpwards(requiredHistoryDepth);
    } else if (historyDepthRef.current > requiredHistoryDepth) {
      const delta = requiredHistoryDepth - historyDepthRef.current;
      if (delta < 0) {
        silentHistoryRewindRef.current = true;
        historyDepthRef.current = requiredHistoryDepth;
        try {
          window.history.go(delta);
        } catch {
          silentHistoryRewindRef.current = false;
        }
      }
    }
  }, [requiredHistoryDepth, syncHistoryDepthUpwards]);

  // Listen to scroll to track isListScrolled (> 120px) and arm scroll guard entry if user interacted
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || 0;
      const scrolledPastThreshold = y > 120;
      setIsListScrolled((prev) =>
        prev !== scrolledPastThreshold ? scrolledPastThreshold : prev
      );
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Listen to real user gestures (pointerdown, touchstart, click, keydown, wheel) to mark active NavigationEntry
  useEffect(() => {
    const onUserGesture = (e: Event) => {
      const nowPerf = performance.now();
      // Ignore duplicate touchstart/mousedown fired in the same millisecond as pointerdown
      if (
        (e.type === 'touchstart' || e.type === 'mousedown') &&
        nowPerf - lastHistoryPushMsRef.current < 18
      ) {
        return;
      }

      entryHasGestureRef.current = true;
      if (!hasUserInteracted) {
        setHasUserInteracted(true);
      }

      // If user interacts with the page while exit toast is visible (and didn't press Back), re-arm Home guard
      if (
        exitToastVisible &&
        (e.type === 'pointerdown' || e.type === 'touchstart' || e.type === 'click')
      ) {
        if (exitToastTimerRef.current) {
          window.clearTimeout(exitToastTimerRef.current);
          exitToastTimerRef.current = null;
        }
        lastHomeBackPressRef.current = 0;
        setExitToastVisible(false);
      }

      // Immediately push the Home guard entry (depth: 0 -> 1) during the user gesture
      const effectiveTargetDepth = Math.max(1, requiredHistoryDepth);
      if (historyDepthRef.current < effectiveTargetDepth) {
        syncHistoryDepthUpwards(effectiveTargetDepth);
      }
    };

    window.addEventListener('pointerdown', onUserGesture, { capture: true, passive: true });
    window.addEventListener('touchstart', onUserGesture, { capture: true, passive: true });
    window.addEventListener('click', onUserGesture, { capture: true, passive: true });
    window.addEventListener('keydown', onUserGesture, { capture: true, passive: true });
    window.addEventListener('wheel', onUserGesture, { capture: true, passive: true });

    return () => {
      window.removeEventListener('pointerdown', onUserGesture, { capture: true });
      window.removeEventListener('touchstart', onUserGesture, { capture: true });
      window.removeEventListener('click', onUserGesture, { capture: true });
      window.removeEventListener('keydown', onUserGesture, { capture: true });
      window.removeEventListener('wheel', onUserGesture, { capture: true });
    };
  }, [
    hasUserInteracted,
    exitToastVisible,
    requiredHistoryDepth,
    syncHistoryDepthUpwards,
  ]);

  const navigateToTab = useCallback((tab: MainNavTab) => {
    entryHasGestureRef.current = true;
    setHasUserInteracted(true);
    setSelectedRecipeId(null);
    setActiveTab(tab);
    if (tab === 'teka') {
      setSearchQuery('');
      setSelectedCategory('all');
      setSelectedSubcategory('all');
      navigationStackRef.current = [];
    } else if (tab !== 'kategorije') {
      setSelectedCategory('all');
      setSelectedSubcategory('all');
    }
    setIsListScrolled(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openRecipeDetail = useCallback(
    (recipeId: string) => {
      entryHasGestureRef.current = true;
      setHasUserInteracted(true);
      const currentScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
      navigationStackRef.current.push({
        tab: activeTab,
        category: selectedCategory,
        subcategory: selectedSubcategory,
        searchQuery,
        scrollY: currentScrollY,
      });
      setSelectedRecipeId(recipeId);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    },
    [activeTab, selectedCategory, selectedSubcategory, searchQuery]
  );

  const openCategoryShelf = (catId: CategoryId, sub?: string) => {
    entryHasGestureRef.current = true;
    setHasUserInteracted(true);
    setSelectedCategory(catId);
    setSelectedSubcategory(sub || 'all');
    setSelectedRecipeId(null);
    setActiveTab('kategorije');
    setIsListScrolled(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Unified Multi-Step Back Action (Browser Back button, Android hardware Back, iOS edge-swipe, or UI Back button)
  const handleBackNavigation = useCallback(
    (fromPopState = false, landedHistoryDepth?: number) => {
      const currentScrollY = typeof window !== 'undefined' ? window.scrollY : 0;

      const stepAction = resolveBackNavigationStep({
        hasOpenModal,
        hasSelectedRecipe: Boolean(selectedRecipeId),
        currentScrollY,
        activeTab,
        hasActiveSearchOrFilter,
        lastHomeBackPressMs: lastHomeBackPressRef.current,
        nowMs: Date.now(),
        scrollThresholdPx: 120,
      });

      if (stepAction === 'close-modal') {
        if (cookingState) {
          setCookingState(null);
        } else if (showScanWizard) {
          setShowScanWizard(false);
        } else if (cardDeleteTarget) {
          setCardDeleteStep(0);
          setCardDeleteTarget(null);
        }
        return;
      }

      if (stepAction === 'close-recipe-restore-scroll') {
        const previousSnapshot = navigationStackRef.current.pop();
        setSelectedRecipeId(null);
        if (previousSnapshot) {
          setActiveTab(previousSnapshot.tab);
          setSelectedCategory(previousSnapshot.category);
          setSelectedSubcategory(previousSnapshot.subcategory);
          setSearchQuery(previousSnapshot.searchQuery);
          const targetScrollY = previousSnapshot.scrollY || 0;
          setIsListScrolled(targetScrollY > 120);
          window.requestAnimationFrame(() => {
            window.scrollTo({ top: targetScrollY, behavior: 'instant' as ScrollBehavior });
            window.setTimeout(() => {
              window.scrollTo({ top: targetScrollY, behavior: 'instant' as ScrollBehavior });
            }, 35);
          });
        }
        return;
      }

      if (stepAction === 'scroll-to-top') {
        setIsListScrolled(false);
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        });
        return;
      }

      if (stepAction === 'return-to-home') {
        setSelectedRecipeId(null);
        setActiveTab('teka');
        setSearchQuery('');
        setSelectedCategory('all');
        setSelectedSubcategory('all');
        setIsListScrolled(false);
        navigationStackRef.current = [];
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        });
        return;
      }

      if (stepAction === 'exit-app') {
        if (exitToastTimerRef.current) {
          window.clearTimeout(exitToastTimerRef.current);
          exitToastTimerRef.current = null;
        }
        setExitToastVisible(false);
        lastHomeBackPressRef.current = 0;
        try {
          const depthToExit =
            typeof landedHistoryDepth === 'number' && landedHistoryDepth > 0
              ? -(landedHistoryDepth + 1)
              : -1;
          window.history.go(depthToExit);
        } catch {
          // Ignore
        }
        return;
      }

      // 'show-exit-toast': 1st Back press on Home ('teka')
      if (currentScrollY > 0) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      lastHomeBackPressRef.current = Date.now();
      setExitToastVisible(true);
      if (exitToastTimerRef.current) {
        window.clearTimeout(exitToastTimerRef.current);
      }
      exitToastTimerRef.current = window.setTimeout(() => {
        setExitToastVisible(false);
        lastHomeBackPressRef.current = 0;
      }, 3000);

      // Ensure browser is positioned at root entry (depth = 0) so the 2nd hardware Back press exits immediately
      if (
        fromPopState &&
        typeof landedHistoryDepth === 'number' &&
        landedHistoryDepth > 0
      ) {
        silentHistoryRewindRef.current = true;
        historyDepthRef.current = 0;
        try {
          window.history.go(-landedHistoryDepth);
        } catch {
          silentHistoryRewindRef.current = false;
        }
      }
    },
    [
      hasOpenModal,
      cookingState,
      showScanWizard,
      cardDeleteTarget,
      selectedRecipeId,
      activeTab,
      hasActiveSearchOrFilter,
    ]
  );

  // Initialize root history state (depth = 0) on mount WITHOUT calling pushState before user gesture
  useEffect(() => {
    try {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }
      const existingDepth =
        typeof window.history.state?.depth === 'number'
          ? window.history.state.depth
          : 0;
      if (existingDepth > 0) {
        historyDepthRef.current = existingDepth;
      } else {
        window.history.replaceState(
          { maminaTekaRoot: true, maminaTeka: true, depth: 0 },
          ''
        );
        historyDepthRef.current = 0;
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const stateDepth =
        typeof event.state?.depth === 'number'
          ? event.state.depth
          : Math.max(0, historyDepthRef.current - 1);
      historyDepthRef.current = stateDepth;
      entryHasGestureRef.current = false;

      if (silentHistoryRewindRef.current) {
        silentHistoryRewindRef.current = false;
        return;
      }

      handlingPopStateRef.current = true;
      try {
        handleBackNavigation(true, stateDepth);
      } finally {
        window.setTimeout(() => {
          handlingPopStateRef.current = false;
        }, 0);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [handleBackNavigation]);


  // Mobile Left-Edge Swipe Gesture (swipe from left edge <= 28px to right > 70px)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    if (touch.clientX <= 28) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    } else {
      touchStartRef.current = null;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
    touchStartRef.current = null;

    if (deltaX > 70 && deltaY < 55) {
      handleBackNavigation(false);
    }
  };

  const renderRecipeCard = (recipe: Recipe) => {
    const cat = CATEGORIES.find((c) => c.id === recipe.category);
    const coverImage = recipe.image || recipe.imageUrl;
    return (
      <div
        key={recipe.id}
        className="group rounded-3xl border border-[#DFD3C3] bg-white overflow-hidden transition-transform duration-150 hover:-translate-y-0.5 flex flex-col justify-between"
      >
        <div>
          <button
            type="button"
            onClick={() => openRecipeDetail(recipe.id)}
            className="w-full text-left block cursor-pointer"
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#2B1D16]">
              <img
                src={coverImage}
                alt={recipe.title}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.currentTarget;
                  const fallback = getOfflineFallbackDishUri(recipe.title);
                  if (target.src !== fallback) {
                    target.src = fallback;
                  }
                }}
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />

              {recipe.imageStatus === 'ai' && (
                <span className="absolute bottom-3 right-3 rounded-full bg-black/70 backdrop-blur-xs border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-[#FAF6F0]">
                  ✨ AI slika
                </span>
              )}

              <div className="absolute bottom-3 left-3 text-xs font-medium text-[#FAF6F0]">
                <span>{cat?.shortTitle}</span>
                <span aria-hidden="true" className="mx-1.5">·</span>
                <span>{recipe.subcategory}</span>
              </div>
            </div>

            <div className="p-5">
              <h3 className="font-display text-xl font-bold text-[#231F1D] group-hover:text-[#9E3B24] transition-colors">
                {recipe.title}
              </h3>
              {!maminMod && (
                <p className="text-sm text-[#5A4F47] mt-1.5 line-clamp-2 leading-relaxed">
                  {recipe.subtitle}
                </p>
              )}
              <div className="mt-3 flex items-center gap-2 text-xs text-[#655A52]">
                <span className="font-mono-tabular">
                  {recipe.prepTimeMinutes + recipe.cookTimeMinutes} min
                </span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{recipe.panDimensions || recipe.servings}</span>
              </div>
            </div>
          </button>
        </div>

        {/* Card Footer Actions */}
        <div className="px-5 pb-4 pt-2 border-t border-[#F1E8DA] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => openRecipeDetail(recipe.id)}
            className="text-xs font-bold text-[#9E3B24] hover:underline py-1.5 cursor-pointer"
          >
            Otvori recept →
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                handleUpdateRecipe({ ...recipe, inCookSoon: !recipe.inCookSoon })
              }
              aria-label={
                recipe.inCookSoon
                  ? `Ukloni ${recipe.title} iz plana Kuhaj uskoro`
                  : `Dodaj ${recipe.title} u plan Kuhaj uskoro`
              }
              className={`p-2 rounded-lg text-xs font-semibold min-h-[40px] min-w-[40px] flex items-center justify-center transition-colors cursor-pointer ${
                recipe.inCookSoon
                  ? 'bg-[#4A5D3F]/15 text-[#4A5D3F]'
                  : 'text-[#7A6A5E] hover:bg-[#F3ECE1]'
              }`}
              title="Kuhaj uskoro"
            >
              <CalendarClock className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() =>
                handleUpdateRecipe({ ...recipe, isFavorite: !recipe.isFavorite })
              }
              aria-label={
                recipe.isFavorite
                  ? `Ukloni ${recipe.title} iz favorita`
                  : `Dodaj ${recipe.title} u favorite`
              }
              className={`p-2 rounded-lg text-xs font-semibold min-h-[40px] min-w-[40px] flex items-center justify-center transition-colors cursor-pointer ${
                recipe.isFavorite
                  ? 'bg-[#C88A2B]/15 text-[#C88A2B]'
                  : 'text-[#7A6A5E] hover:bg-[#F3ECE1]'
              }`}
              title="Mami najdraže"
            >
              <Star className={`w-4 h-4 ${recipe.isFavorite ? 'fill-current' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => {
                setCardDeleteTarget(recipe);
                setCardDeleteStep(1);
              }}
              data-testid={`delete-card-btn-${recipe.id}`}
              aria-label={`Obriši recept ${recipe.title}`}
              className="p-2 rounded-lg text-xs font-semibold min-h-[40px] min-w-[40px] flex items-center justify-center text-[#7A6A5E] hover:text-[#B42318] hover:bg-[#FDF2F2] transition-colors cursor-pointer"
              title="Obriši recept (uz dvostruku provjeru)"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen w-full max-w-full overflow-x-hidden flex flex-col bg-[#FAF6F0] text-[#231F1D]"
    >
      {/* Uvodni Splash zaslon (/splash.png na #FAF7F2 pozadini) */}
      {showSplash && (
        <Splash
          onFinish={handleFinishSplash}
          durationMs={1400}
        />
      )}

      <OfflineIndicator />

      {/* Čisto, kompaktno jednolinijsko zaglavlje (Header / Navbar s vizualnim brojačem sinkronizacije) */}
      <Header
        activeTab={activeTab}
        selectedRecipeId={selectedRecipeId}
        onNavigateToTab={navigateToTab}
        maminMod={maminMod}
        onToggleMaminMod={() => setMaminMod((m) => !m)}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        currentUser={currentUser}
        isOnline={isOnline}
        isSyncing={isSyncing}
        syncProgress={syncProgress}
        pendingSyncCount={pendingSyncCount}
        onManualSync={() => runBackgroundSync(currentUser, vaultInfo, true)}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={handleGoogleSignOut}
      />

      {/* Main Layout Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 pt-20 pb-32 overflow-x-hidden">
        {activeInviteNotice && (
          <div
            role="status"
            data-testid="invite-link-joined-banner"
            className="mb-4 rounded-2xl bg-[#F3ECE1] dark:bg-[#24201E] border border-[#9E3B24] px-4 py-3 text-xs sm:text-sm flex flex-wrap items-center justify-between gap-3"
          >
            <div className="text-[#231F1D] dark:text-stone-100">
              <strong className="text-[#9E3B24] dark:text-[#F08C70]">
                Obiteljska pozivnica aktivna ({activeInviteNotice.trezorId.slice(0, 14)}):
              </strong>{' '}
              {currentUser
                ? 'Vaš Google račun je automatski povezan s ovim obiteljskim trezorom i recepti su vam dostupni!'
                : 'Otvorili ste link pozivnice obiteljskog trezora. Prijavite se svojim Google računom za automatsko povezivanje.'}
            </div>
            <div className="flex items-center gap-2">
              {!currentUser && (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#9E3B24] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#842F1B] cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Google prijava</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveInviteNotice(null)}
                aria-label="Zatvori obavijest o pozivnici"
                className="p-1.5 rounded-lg text-[#655A52] hover:bg-[#EAE0D1] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {authError && (
          <div
            role="status"
            className="mb-4 rounded-xl bg-[#FDF3E7] border border-[#E5C687] px-4 py-2.5 text-xs font-semibold text-[#664614]"
          >
            {authError}
          </div>
        )}

        {/* Main View Switcher */}
        <main>
          {!isLoaded ? (
            <div className="py-20 text-center text-sm text-[#655A52]">
              Otvaramo Maminu Teku...
            </div>
          ) : selectedRecipe ? (
            /* EKRAN 2: Prikaz recepta (Digitalni list) */
            <RecipeDetailView
              recipe={selectedRecipe}
              onBack={() => handleBackNavigation(false)}
              onUpdateRecipe={handleUpdateRecipe}
              onDeleteRecipe={handleDeleteRecipe}
              onStartCooking={(mult, lessSweet) =>
                setCookingState({
                  recipe: selectedRecipe,
                  multiplier: mult,
                  lessSweet,
                })
              }
            />
          ) : activeTab === 'teka' ? (
            /* EKRAN 1: Početna stranica (Teka - Vizualni redizajn) */
            <HomeView
              recipes={recipes}
              filteredRecipes={filteredRecipes}
              favoriteRecipes={favoriteRecipes}
              searchQuery={searchQuery}
              onChangeSearchQuery={setSearchQuery}
              onOpenRecipe={openRecipeDetail}
              onNavigateToTab={navigateToTab}
              onOpenCategoryShelf={openCategoryShelf}
              onOpenScanWizard={() => setShowScanWizard(true)}
              renderRecipeCard={renderRecipeCard}
              maminMod={maminMod}
            />
          ) : activeTab === 'kategorije' ? (
            /* KATEGORIJE VIEW: Dublji tematski pregled s vodoravnim bedževima (horizontal scrollable chips) */
            <div className="space-y-8 pb-32">
              <div>
                <h1 className="font-display text-3xl font-bold text-[#231F1D]">
                  Tematske police i kategorije
                </h1>
                <p className="text-sm sm:text-base text-[#5A4F47] mt-1">
                  Odaberite policu iz mamine kuhinje i podkategoriju za pregled recepata.
                </p>
              </div>

              {/* Main Category Horizontal Scrollable Chips (Terracotta active with white text) */}
              <div
                data-testid="category-chips-bar"
                className="flex items-center gap-2.5 overflow-x-auto pb-2 -mx-1 px-1"
              >
                <button
                  type="button"
                  data-testid="category-chip-all"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSelectedSubcategory('all');
                  }}
                  className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold border transition-all min-h-[42px] whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-[#9E3B24] text-white border-[#9E3B24] shadow-xs'
                      : 'bg-white text-[#5A4F47] border-[#DFD3C3] hover:border-[#9E3B24] hover:text-[#231F1D]'
                  }`}
                >
                  Sve police ({recipes.length})
                </button>
                {CATEGORIES.map((cat) => {
                  const isActive = selectedCategory === cat.id;
                  const catCount = recipes.filter((r) => r.category === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      data-testid={`category-chip-${cat.id}`}
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setSelectedSubcategory('all');
                      }}
                      className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold border transition-all min-h-[42px] whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-[#9E3B24] text-white border-[#9E3B24] shadow-xs'
                          : 'bg-white text-[#5A4F47] border-[#DFD3C3] hover:border-[#9E3B24] hover:text-[#231F1D]'
                      }`}
                    >
                      {cat.title} ({catCount})
                    </button>
                  );
                })}
              </div>

              {/* Subcategory Horizontal Scrollable Chips when a Category is selected */}
              {selectedCategory !== 'all' && (
                <div
                  data-testid="subcategory-chips-bar"
                  className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedSubcategory('all')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all min-h-[38px] whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedSubcategory === 'all'
                        ? 'bg-[#9E3B24] text-white border-[#9E3B24] shadow-2xs'
                        : 'bg-white text-[#5A4F47] border-[#DFD3C3] hover:border-[#9E3B24]'
                    }`}
                  >
                    Sve u polici
                  </button>
                  {Array.from(
                    new Set([
                      ...(CATEGORIES.find((c) => c.id === selectedCategory)?.subcategories || []),
                      ...recipes
                        .filter((r) => r.category === selectedCategory && r.subcategory)
                        .map((r) => r.subcategory),
                    ])
                  ).map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setSelectedSubcategory(sub)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all min-h-[38px] whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedSubcategory === sub
                          ? 'bg-[#9E3B24] text-white border-[#9E3B24] shadow-2xs'
                          : 'bg-white text-[#5A4F47] border-[#DFD3C3] hover:border-[#9E3B24]'
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              )}

              <div
                className={`grid gap-6 ${
                  maminMod
                    ? 'grid-cols-1 md:grid-cols-2'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                }`}
              >
                {filteredRecipes.map(renderRecipeCard)}
              </div>
            </div>
          ) : activeTab === 'planer' ? (
            /* KUHAJ USKORO (PLANER) VIEW */
            <div className="space-y-8 pb-32">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="font-display text-3xl font-bold text-[#231F1D]">
                    Kuhaj uskoro (Planer pripreme)
                  </h1>
                  <p className="text-sm sm:text-base text-[#5A4F47] mt-1">
                    Zbirka recepata koje planirate pripremati ovaj tjedan, za vikend ili blagdane.
                  </p>
                </div>
              </div>

              {cookSoonRecipes.length === 0 ? (
                <div className="rounded-3xl border border-[#DFD3C3] bg-white p-12 text-center space-y-3">
                  <CalendarClock className="w-10 h-10 text-[#9E3B24] mx-auto" />
                  <h2 className="font-display text-xl font-bold text-[#231F1D]">
                    Planer je trenutno prazan
                  </h2>
                  <p className="text-sm text-[#655A52] max-w-md mx-auto">
                    Dodajte bilo koji recept iz Teke klikom na gumb „Kuhaj uskoro” kako bi vam bio pri ruci za kupovinu i pripremu.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigateToTab('teka')}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#9E3B24] px-5 py-2.5 text-sm font-bold text-white cursor-pointer"
                  >
                    <span>Pretraži Teku</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {cookSoonRecipes.map((recipe) => (
                    <div
                      key={recipe.id}
                      className="rounded-3xl border border-[#DFD3C3] bg-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5"
                    >
                      <div className="flex items-start sm:items-center gap-4">
                        <img
                          src={recipe.imageUrl}
                          alt={recipe.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const target = e.currentTarget;
                            const fallback = getOfflineFallbackDishUri(recipe.title, recipe.category);
                            if (target.src !== fallback) {
                              target.src = fallback;
                            }
                          }}
                          className="w-24 h-20 rounded-2xl object-cover shrink-0 border border-[#E5DAC8]"
                        />
                        <div>
                          <div className="text-xs font-semibold text-[#4A5D3F]">
                            {recipe.cookSoonNote || 'U planu za pripremu'}
                          </div>
                          <button
                            type="button"
                            onClick={() => openRecipeDetail(recipe.id)}
                            className="text-left font-display text-xl font-bold text-[#231F1D] hover:text-[#9E3B24] cursor-pointer"
                          >
                            {recipe.title}
                          </button>
                          <div className="text-xs text-[#655A52] mt-1">
                            Priprema: {recipe.prepTimeMinutes + recipe.cookTimeMinutes} min ·{' '}
                            {recipe.panDimensions || recipe.servings}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setCookingState({ recipe, multiplier: 1 })
                          }
                          className="inline-flex items-center gap-2 rounded-xl bg-[#9E3B24] px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-[#842F1B] min-h-[44px] whitespace-nowrap cursor-pointer"
                        >
                          <ChefHat className="w-4 h-4" />
                          <span>Pripremi / Kuhaj</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openRecipeDetail(recipe.id)}
                          className="px-4 py-2.5 rounded-xl border border-[#DFD3C3] bg-[#F3ECE1] text-xs sm:text-sm font-semibold text-[#231F1D] min-h-[44px] whitespace-nowrap cursor-pointer"
                        >
                          Popis sastojaka
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateRecipe({ ...recipe, inCookSoon: false })
                          }
                          aria-label={`Ukloni ${recipe.title} iz planera`}
                          className="p-2.5 rounded-xl border border-[#DFD3C3] text-[#655A52] hover:bg-[#EFE6D8] min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                          title="Označi skuhanim / ukloni iz planera"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'favoriti' ? (
            /* FAVORITI VIEW: Provjereni obiteljski klasici */
            <div className="space-y-8 pb-32">
              <div>
                <h1 className="font-display text-3xl font-bold text-[#231F1D]">
                  Mami najdraže (Obiteljski favoriti)
                </h1>
                <p className="text-sm sm:text-base text-[#5A4F47] mt-1">
                  Provjereni obiteljski klasici označeni zvjezdicom.
                </p>
              </div>

              {favoriteRecipes.length === 0 ? (
                <div className="rounded-3xl border border-[#DFD3C3] bg-white p-12 text-center space-y-3">
                  <Star className="w-10 h-10 text-[#C88A2B] mx-auto" />
                  <h2 className="font-display text-xl font-bold text-[#231F1D]">
                    Još nema označenih favorita
                  </h2>
                  <p className="text-sm text-[#655A52]">
                    Kliknite na zvjezdicu uz omiljene recepte kako bi se prikazali na ovoj polici.
                  </p>
                </div>
              ) : (
                <div
                  className={`grid gap-6 ${
                    maminMod
                      ? 'grid-cols-1 md:grid-cols-2'
                      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  }`}
                >
                  {favoriteRecipes.map(renderRecipeCard)}
                </div>
              )}
            </div>
          ) : (
            /* EKRAN 5: O Teki (About, Dedication Polaroid, Family Sharing & Zrina Ecosystem) */
            <AboutAndPrintView
              recipes={recipes}
              onRecipesImported={loadRecipes}
              userEmail={currentUser?.email || null}
              userName={currentUser?.displayName || null}
              userPhotoUrl={currentUser?.photoURL || null}
              vaultInfo={vaultInfo}
              onVaultUpdated={(nextVault) => setVaultInfo(nextVault)}
              onTriggerGoogleSignIn={handleGoogleSignIn}
              onManualSync={() => runBackgroundSync(currentUser, vaultInfo, true)}
              isSyncing={isSyncing}
              syncProgress={syncProgress}
              onReplaySplash={() => setShowSplash(true)}
              hideSampleManuscripts={hideSampleManuscriptsState}
              onChangeHideSampleManuscripts={handleChangeHideSampleManuscripts}
            />
          )}
        </main>
      </div>

      {/* Footer (Quiet Ecosystem Signature — pb-32 on mobile so floating bottom nav never covers links) */}
      <footer className="no-print border-t border-[#DFD3C3] dark:border-stone-800 bg-transparent dark:bg-[#181514] pt-6 pb-32 md:pb-8 px-4 sm:px-8 text-xs text-[#655A52] dark:text-stone-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AppIconEmblem className="w-5 h-5 rounded-md" />
            <span>
              <strong className="text-[#231F1D] dark:text-stone-200">Mamina Teka</strong> · Digitalni obiteljski trezor recepata
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://zrina.app"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#9E3B24] dark:hover:text-[#F08C70] underline"
            >
              zrina.app
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="mailto:maminateka@zrina.app"
              className="hover:text-[#9E3B24] dark:hover:text-[#F08C70] underline"
            >
              maminateka@zrina.app
            </a>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar (5 Ergonomic Thumb Destinations including central Skeniraj +) */}
      <nav
        aria-label="Mobilna navigacija"
        className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FAF6F0]/95 backdrop-blur-md border-t border-[#DFD3C3] px-2 h-16 grid grid-cols-5 items-center"
      >
        <button
          type="button"
          onClick={() => navigateToTab('teka')}
          className={`flex flex-col items-center justify-center min-h-[48px] cursor-pointer ${
            activeTab === 'teka' && !selectedRecipeId ? 'text-[#9E3B24] font-bold' : 'text-[#655A52]'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[11px] mt-0.5 whitespace-nowrap">Teka</span>
        </button>

        <button
          type="button"
          onClick={() => navigateToTab('kategorije')}
          className={`flex flex-col items-center justify-center min-h-[48px] cursor-pointer ${
            activeTab === 'kategorije' && !selectedRecipeId
              ? 'text-[#9E3B24] font-bold'
              : 'text-[#655A52]'
          }`}
        >
          <LayoutGrid className="w-5 h-5" />
          <span className="text-[11px] mt-0.5 whitespace-nowrap">Kategorije</span>
        </button>

        {/* Central Floating Scan (+) Button */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => setShowScanWizard(true)}
            aria-label="Skeniraj novi recept"
            className="flex flex-col items-center justify-center w-13 h-13 -mt-4 rounded-2xl bg-[#9E3B24] text-white shadow-md border-2 border-[#FAF6F0] cursor-pointer"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => navigateToTab('planer')}
          className={`flex flex-col items-center justify-center min-h-[48px] cursor-pointer ${
            activeTab === 'planer' && !selectedRecipeId ? 'text-[#9E3B24] font-bold' : 'text-[#655A52]'
          }`}
        >
          <CalendarClock className="w-5 h-5" />
          <span className="text-[11px] mt-0.5 whitespace-nowrap">Kuhaj uskoro</span>
        </button>

        <button
          type="button"
          onClick={() => navigateToTab('favoriti')}
          className={`flex flex-col items-center justify-center min-h-[48px] cursor-pointer ${
            activeTab === 'favoriti' && !selectedRecipeId
              ? 'text-[#9E3B24] font-bold'
              : 'text-[#655A52]'
          }`}
        >
          <Star className="w-5 h-5" />
          <span className="text-[11px] mt-0.5 whitespace-nowrap">Favoriti</span>
        </button>
      </nav>

      {/* EKRAN 3: Način „Za pripremu” (Cooking Mode Modal) */}
      {cookingState && (
        <CookingModeModal
          recipe={cookingState.recipe}
          multiplier={cookingState.multiplier}
          lessSweet={cookingState.lessSweet}
          onClose={() => setCookingState(null)}
        />
      )}

      {/* EKRAN 4: Čarobnjak za unos i OCR obradu (Scan Wizard Modal) */}
      {showScanWizard && (
        <ScanWizardModal
          onClose={() => setShowScanWizard(false)}
          onSaveRecipe={handleSaveScannedRecipe}
          userEmail={currentUser?.email || undefined}
          hideSampleManuscriptsProp={hideSampleManuscriptsState}
          onSampleManuscriptsVisibilityChange={handleChangeHideSampleManuscripts}
        />
      )}

      {/* Dvostruka provjera prije brisanja recepta s kartice */}
      {cardDeleteTarget && cardDeleteStep > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="card-delete-confirm-modal"
          className="no-print fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-3xl bg-[#FAF6F0] border-2 border-[#E6B8B5] p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-[#FDF2F2] text-[#B42318] shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#B42318]">
                  Dvostruka provjera brisanja ({cardDeleteStep}/2)
                </div>
                <h3 className="font-display text-xl font-bold text-[#231F1D] mt-0.5">
                  {cardDeleteStep === 1
                    ? 'Želite li obrisati ovaj recept iz Teke?'
                    : 'Potvrdite trajno brisanje (Korak 2 od 2)'}
                </h3>
              </div>
            </div>

            {cardDeleteStep === 1 ? (
              <p className="text-sm text-[#5A4F47] leading-relaxed">
                Odabrali ste brisanje recepta{' '}
                <strong className="text-[#231F1D]">„{cardDeleteTarget.title}”</strong>. Radi zaštite obiteljskih recepata tražimo dvostruku potvrdu prije uklanjanja.
              </p>
            ) : (
              <div className="rounded-2xl bg-[#FDF2F2] border border-[#E6B8B5] p-3.5 text-xs sm:text-sm text-[#7A1C14] leading-relaxed">
                <strong>Druga i konačna provjera:</strong> Jeste li potpuno sigurni da želite trajno ukloniti{' '}
                <strong>„{cardDeleteTarget.title}”</strong> iz Mamine Teke?
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCardDeleteStep(0);
                  setCardDeleteTarget(null);
                }}
                className="px-4 py-2.5 rounded-xl border border-[#DFD3C3] bg-white text-xs sm:text-sm font-semibold text-[#5A4F47] hover:bg-[#F3ECE1] min-h-[42px] cursor-pointer"
              >
                Odustani
              </button>

              {cardDeleteStep === 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    const next = advanceDeleteConfirmationStep(cardDeleteStep);
                    if (next === 2) setCardDeleteStep(2);
                  }}
                  data-testid="card-delete-step1-btn"
                  className="px-4 py-2.5 rounded-xl bg-[#B42318] text-white text-xs sm:text-sm font-bold hover:bg-[#911B12] min-h-[42px] cursor-pointer"
                >
                  Nastavi na 2. provjeru →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    const id = cardDeleteTarget.id;
                    setCardDeleteStep(0);
                    setCardDeleteTarget(null);
                    await handleDeleteRecipe(id);
                  }}
                  data-testid="card-delete-step2-btn"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#7A1C14] text-white text-xs sm:text-sm font-bold hover:bg-[#5E140E] min-h-[42px] cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Da, trajno obriši recept</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mali popup kod pritiska na Back na početnoj stranici */}
      {exitToastVisible && (
        <div
          role="status"
          aria-live="polite"
          data-testid="double-back-exit-toast"
          className="no-print fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-[#231F1D] text-[#FAF6F0] px-4 py-2.5 text-xs sm:text-sm font-semibold shadow-xl border border-white/15 whitespace-nowrap"
        >
          Pritisni natrag (Back) još jednom za izlazak iz aplikacije
        </div>
      )}
    </div>
  );
}
