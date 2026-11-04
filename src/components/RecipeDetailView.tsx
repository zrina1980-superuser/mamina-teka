import React, { useState, useRef, useEffect } from 'react';
import { aiHeaders } from '../utils/userAiKey';
import {
  ArrowLeft,
  Camera,
  Star,
  CalendarPlus,
  CalendarCheck,
  Share2,
  ChefHat,
  ZoomIn,
  ZoomOut,
  Check,
  Copy,
  BookOpen,
  FileText,
  X,
  ShoppingCart,
  Mic,
  Square,
  Volume2,
  Sparkles,
  Plus,
  Printer,
  Edit3,
  Ruler,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Image as ImageIcon,
  MoreVertical,
} from 'lucide-react';
import {
  CATEGORIES,
  MAX_VOICE_MEMOS,
  scaleIngredientWithSugarOption,
  buildExpressShoppingList,
  getRecipeVoiceMemos,
  addVoiceMemoToList,
  removeVoiceMemoFromList,
  advanceDeleteConfirmationStep,
  shouldShowLessSweetToggle,
  resolvePrintableRecipeImage,
  resolvePrintableOriginalScan,
  isPlaceholderIngredientGroups,
  recoverIngredientsFromRecipeText,
  type Recipe,
  type CookingLogEntry,
  type VoiceMemoItem,
} from '../utils/recipeLogic';

import { compressImageToWebPOrJpeg, formatBytesKb } from '../utils/imageCompressor';
import { getOfflineFallbackDishUri } from '../utils/visualAssets';
import { EditRecipeModal } from './EditRecipeModal';

interface RecipeDetailViewProps {
  recipe: Recipe;
  onBack: () => void;
  onUpdateRecipe: (updated: Recipe) => void;
  onDeleteRecipe: (recipeId: string) => void;
  onStartCooking: (multiplier: number, lessSweet: boolean) => void;
}

export const RecipeDetailView: React.FC<RecipeDetailViewProps> = ({
  recipe,
  onBack,
  onUpdateRecipe,
  onDeleteRecipe,
  onStartCooking,
}) => {
  const [activeTab, setActiveTab] = useState<'digital' | 'original'>('digital');
  const [multiplier, setMultiplier] = useState<number>(1);
  const [lessSweet, setLessSweet] = useState<boolean>(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});
  const [scanZoom, setScanZoom] = useState<number>(1);

  // Modals & Notices
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareMode, setShareMode] = useState<'shopping' | 'full' | 'pdf-card'>('shopping');
  const [copiedShare, setCopiedShare] = useState(false);
  const [photoReplaceInfo, setPhotoReplaceInfo] = useState<string | null>(null);
  const [isRegeneratingAiPhoto, setIsRegeneratingAiPhoto] = useState(false);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<0 | 1 | 2>(0);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  // Editable Yellow Post-it ("Mamina tajna")
  const [isEditingSecret, setIsEditingSecret] = useState(false);
  const [secretDraft, setSecretDraft] = useState(
    recipe.secretTip || recipe.momTips[0] || ''
  );

  // Short Voice Memos (up to 3 saved secrets, max 30s each)
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [playingMemoId, setPlayingMemoId] = useState<string | null>(null);
  const [voiceLimitWarning, setVoiceLimitWarning] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const savedVoiceMemos = getRecipeVoiceMemos(recipe);

  // Cooking Log ("Dnevnik pripreme")
  const [newLogDate, setNewLogDate] = useState(() => {
    const now = new Date();
    return `${now.getDate()}. ${now.getMonth() + 1}. ${now.getFullYear()}.`;
  });
  const [newLogNote, setNewLogNote] = useState('');
  const [newLogAuthor, setNewLogAuthor] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSecretDraft(recipe.secretTip || recipe.momTips[0] || '');
    setVoiceLimitWarning(null);
    setDeleteConfirmStep(0);
    setShowMoreMenu(false);
  }, [recipe.id, recipe.secretTip, recipe.momTips]);

  useEffect(() => {
    const handleClickOutsideMore = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutsideMore);
    }
    return () => document.removeEventListener('mousedown', handleClickOutsideMore);
  }, [showMoreMenu]);

  useEffect(() => {
    return () => {
      if (recordIntervalRef.current) {
        window.clearInterval(recordIntervalRef.current);
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, []);

  const categoryMeta = CATEGORIES.find((c) => c.id === recipe.category);
  const showSugarToggle = shouldShowLessSweetToggle(recipe.category);
  const effectiveLessSweet = showSugarToggle ? lessSweet : false;

  const toggleIngredient = (id: string) => {
    setCheckedIngredients((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleToggleFavorite = () => {
    onUpdateRecipe({
      ...recipe,
      isFavorite: !recipe.isFavorite,
      updatedAt: Date.now(),
      syncStatus: 'pending',
    });
  };

  const handleToggleCookSoon = () => {
    onUpdateRecipe({
      ...recipe,
      inCookSoon: !recipe.inCookSoon,
      cookSoonNote: !recipe.inCookSoon ? 'U planu za ovaj tjedan' : undefined,
      updatedAt: Date.now(),
      syncStatus: 'pending',
    });
  };

  const handleReplacePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToWebPOrJpeg(file, 1600, 0.82);
      onUpdateRecipe({
        ...recipe,
        image: compressed.dataUrl,
        imageUrl: compressed.dataUrl,
        imageStatus: 'real',
        isAiGenerated: false,
        updatedAt: Date.now(),
        syncStatus: 'pending',
      });
      setPhotoReplaceInfo(
        `Fotografija optimizirana (${compressed.width}×${compressed.height} px, ${
          compressed.mimeType === 'image/webp' ? 'WebP' : 'JPEG'
        } • ${formatBytesKb(compressed.compressedBytes)}) i spremljena! Bedž „✨ AI slika” je trajno uklonjen.`
      );
      window.setTimeout(() => setPhotoReplaceInfo(null), 6000);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onUpdateRecipe({
            ...recipe,
            image: reader.result,
            imageUrl: reader.result,
            imageStatus: 'real',
            isAiGenerated: false,
            updatedAt: Date.now(),
            syncStatus: 'pending',
          });
          setPhotoReplaceInfo('Domaća fotografija jela je spremljena u Teku!');
          window.setTimeout(() => setPhotoReplaceInfo(null), 4500);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSetManuscriptAsCover = () => {
    const manuscriptUri = recipe.originalImage || recipe.originalScanUrl;
    if (!manuscriptUri) return;
    setShowPhotoMenu(false);
    onUpdateRecipe({
      ...recipe,
      image: manuscriptUri,
      imageUrl: manuscriptUri,
      imageStatus: 'real',
      isAiGenerated: false,
      updatedAt: Date.now(),
      syncStatus: 'pending',
    });
    setPhotoReplaceInfo(
      'Izvorni rukopis iz mamine teke postavljen je kao naslovna slika recepta!'
    );
    window.setTimeout(() => setPhotoReplaceInfo(null), 5000);
  };

  const handleRegenerateAiPhoto = async () => {
    if (isRegeneratingAiPhoto) return;
    setIsRegeneratingAiPhoto(true);
    setPhotoReplaceInfo(null);
    const nextVariation = (recipe.aiRegenCount || 0) + 1;
    const flatIngNames = recipe.ingredientGroups.flatMap((g) =>
      g.items.map((i) =>
        [i.amount !== null && i.amount !== undefined ? String(i.amount) : '', i.unit, i.name]
          .filter(Boolean)
          .join(' ')
          .trim()
      )
    );

    try {
      let nextImageUri: string | null = null;
      let returnedEnglishPrompt = recipe.englishImagePrompt || '';
      let discreetMessage =
        'Generiranje slika trenutačno nije podržano za ovaj API ključ. Koristi se izvorni rukopis.';

      try {
        const res = await fetch('/api/generate-recipe-image', {
          method: 'POST',
          headers: aiHeaders(),
          body: JSON.stringify({
            title: recipe.title,
            ingredients: flatIngNames,
            steps: recipe.steps,
            category: recipe.category,
            variationIndex: nextVariation,
            englishPrompt: recipe.englishImagePrompt || '',
          }),
        });

        const data = await res.json().catch(() => null);
        if (typeof data?.englishPrompt === 'string' && data.englishPrompt.trim()) {
          returnedEnglishPrompt = data.englishPrompt.trim();
        }

        if (data?.rateLimited || data?.code === 429 || res.status === 429) {
          discreetMessage =
            data?.error ||
            'Iskorišten je besplatni dnevni limit Gemini API-ja. Molimo pokušajte ponovo sutra ili postavite novi API ključ.';
        } else if (typeof data?.infoMessage === 'string' && data.infoMessage.trim()) {
          discreetMessage = data.infoMessage.trim();
        }

        if (
          res.ok &&
          data?.isAiGenerated &&
          typeof data?.imageDataUrl === 'string' &&
          data.imageDataUrl.startsWith('data:image/')
        ) {
          const compressed = await compressImageToWebPOrJpeg(
            data.imageDataUrl,
            1600,
            0.82
          );
          nextImageUri = compressed.dataUrl;
        }
      } catch {
        nextImageUri = null;
      }

      if (nextImageUri) {
        onUpdateRecipe({
          ...recipe,
          image: nextImageUri,
          imageUrl: nextImageUri,
          imageStatus: 'ai',
          isAiGenerated: true,
          aiRegenCount: nextVariation,
          englishImagePrompt: returnedEnglishPrompt || recipe.englishImagePrompt,
          updatedAt: Date.now(),
          syncStatus: 'pending',
        });
        setPhotoReplaceInfo(
          `Nova AI fotografija jela (varijacija #${nextVariation}) je uspješno generirana i spremljena!`
        );
      } else {
        const manuscriptFallback =
          recipe.originalImage || recipe.originalScanUrl || recipe.image || recipe.imageUrl;
        onUpdateRecipe({
          ...recipe,
          image: manuscriptFallback,
          imageUrl: manuscriptFallback,
          imageStatus: 'real',
          isAiGenerated: false,
          englishImagePrompt: returnedEnglishPrompt || recipe.englishImagePrompt,
          updatedAt: Date.now(),
          syncStatus: 'pending',
        });
        setPhotoReplaceInfo(discreetMessage);
      }
      window.setTimeout(() => setPhotoReplaceInfo(null), 6500);
    } finally {
      setIsRegeneratingAiPhoto(false);
    }
  };

  const handleSaveSecretTip = () => {
    const trimmed = secretDraft.trim();
    onUpdateRecipe({
      ...recipe,
      secretTip: trimmed,
      updatedAt: Date.now(),
      syncStatus: 'pending',
    });
    setIsEditingSecret(false);
  };

  const persistVoiceMemos = (nextMemos: VoiceMemoItem[]) => {
    onUpdateRecipe({
      ...recipe,
      voiceMemos: nextMemos,
      voiceMemoDataUrl: nextMemos[0]?.dataUrl || undefined,
      voiceMemoTranscript: nextMemos[0]?.transcript || undefined,
      voiceMemoDurationSec: nextMemos[0]?.durationSec || undefined,
      updatedAt: Date.now(),
      syncStatus: 'pending',
    });
  };

  // Voice Memo Recording (up to 3 saved secrets, max 30 seconds each)
  const handleStartRecording = async () => {
    if (savedVoiceMemos.length >= MAX_VOICE_MEMOS) {
      setVoiceLimitWarning('Spremljene su maks. 3 tajne — obrišite jednu za snimanje nove.');
      return;
    }
    setVoiceLimitWarning(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            const addedRes = addVoiceMemoToList(getRecipeVoiceMemos(recipe), {
              dataUrl: reader.result,
              durationSec: Math.max(1, recordingSeconds),
            });
            if (addedRes.added) {
              persistVoiceMemos(addedRes.memos);
            } else if (addedRes.error) {
              setVoiceLimitWarning(addedRes.error);
            }
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingAudio(true);
      setRecordingSeconds(0);

      recordIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((sec) => {
          if (sec >= 29) {
            handleStopRecording();
            return 30;
          }
          return sec + 1;
        });
      }, 1000);
    } catch {
      // Fallback if microphone permission is unavailable in browser preview
      const currentList = getRecipeVoiceMemos(recipe);
      const fallbackTexts = [
        recipe.secretTip || recipe.momTips[0] || 'Pazi na točnu mjeru i temperaturu pri pripremi!',
        'Druga mamina tajna: uvijek koristi provjerene domaće sastojke.',
        'Treća mamina tajna: ostavi da malo odstoji prije posluživanja.',
      ];
      const addedRes = addVoiceMemoToList(currentList, {
        transcript: fallbackTexts[currentList.length] || fallbackTexts[0],
        durationSec: 10 + currentList.length * 2,
      });
      if (addedRes.added) {
        persistVoiceMemos(addedRes.memos);
      } else if (addedRes.error) {
        setVoiceLimitWarning(addedRes.error);
      }
    }
  };

  const handleStopRecording = () => {
    if (recordIntervalRef.current) {
      window.clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingAudio(false);
  };

  const handlePlayMemoItem = (memo: VoiceMemoItem) => {
    if (playingMemoId === memo.id) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setPlayingMemoId(null);
      return;
    }

    if (memo.dataUrl) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(memo.dataUrl);
      audioPlayerRef.current = audio;
      setPlayingMemoId(memo.id);
      audio.onended = () => setPlayingMemoId(null);
      audio.onerror = () => setPlayingMemoId(null);
      audio.play().catch(() => setPlayingMemoId(null));
      return;
    }

    const textToSpeak =
      memo.transcript ||
      recipe.secretTip ||
      recipe.momTips[0] ||
      'Snimi mamin glas kako govori svoju tajnu.';
    if (typeof window.speechSynthesis !== 'undefined') {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(textToSpeak);
      utter.lang = 'hr-HR';
      utter.rate = 0.95;
      utter.onend = () => setPlayingMemoId(null);
      setPlayingMemoId(memo.id);
      window.speechSynthesis.speak(utter);
    } else {
      setPlayingMemoId(memo.id);
      setTimeout(() => setPlayingMemoId(null), 2500);
    }
  };

  const handleDeleteMemoItem = (memoId: string) => {
    if (playingMemoId === memoId) {
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setPlayingMemoId(null);
    }
    const updated = removeVoiceMemoFromList(savedVoiceMemos, memoId);
    setVoiceLimitWarning(null);
    persistVoiceMemos(updated);
  };

  const handleAddCookingLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogNote.trim()) return;
    const entry: CookingLogEntry = {
      id: `log-${Date.now()}`,
      dateLabel: newLogDate.trim() || 'Danas',
      note: newLogNote.trim(),
      author: newLogAuthor.trim() || 'Obitelj',
    };
    const updatedLogs = [entry, ...(recipe.cookingLogs || [])];
    onUpdateRecipe({
      ...recipe,
      cookingLogs: updatedLogs,
      updatedAt: Date.now(),
      syncStatus: 'pending',
    });
    setNewLogNote('');
  };

  const buildFullShareText = () => {
    const lines: string[] = [
      `📖 *${recipe.title}*`,
      `${recipe.subtitle}`,
      `Kategorija: ${categoryMeta?.title || recipe.category} · ${recipe.subcategory}`,
      `Mjera: ${multiplier === 0.5 ? 'Pola mjere' : multiplier === 2 ? 'Dupla mjera' : '1 mjera'}${
        effectiveLessSweet ? ' (Malo manje slatko: -28% šećera)' : ''
      } (${recipe.servings})`,
      recipe.panDimensions ? `📐 Kalup / protvan: ${recipe.panDimensions}` : '',
      recipe.ovenTemp ? `🔥 Pećnica: ${recipe.ovenTemp}` : '',
      '',
      '*SASTOJCI:*',
    ].filter(Boolean);

    for (const group of recipe.ingredientGroups) {
      lines.push(`\n_${group.groupTitle}:_`);
      for (const item of group.items) {
        const { displayAmount } = scaleIngredientWithSugarOption(item, multiplier, effectiveLessSweet);
        lines.push(`• ${displayAmount} — ${item.name}`);
      }
    }

    lines.push('\n*POSTUPAK:*');
    recipe.steps.forEach((step, idx) => {
      lines.push(`${idx + 1}. ${step}`);
    });

    if (recipe.secretTip || recipe.momTips.length > 0) {
      lines.push(`\n📌 *Mamina tajna:* ${recipe.secretTip || recipe.momTips[0]}`);
    }

    lines.push('\n— Iz obiteljske arhive *Mamina Teka* (zrina.app)');
    return lines.join('\n');
  };

  const currentRecipePhoto = resolvePrintableRecipeImage(
    recipe,
    getOfflineFallbackDishUri(recipe.title, recipe.category)
  );
  const originalScanPhoto = resolvePrintableOriginalScan(
    recipe,
    currentRecipePhoto
  );

  const [isRecoveringIngredients, setIsRecoveringIngredients] = useState(false);
  const autoAttemptedScanRecoveryRef = useRef<Set<string>>(new Set());

  const effectiveIngredientGroups = isPlaceholderIngredientGroups(recipe.ingredientGroups)
    ? recoverIngredientsFromRecipeText(recipe)
    : recipe.ingredientGroups;

  const hasRasterScanPhoto =
    Boolean(originalScanPhoto) &&
    originalScanPhoto.startsWith('data:image/') &&
    !originalScanPhoto.startsWith('data:image/svg');

  const handleReReadIngredientsFromScan = async () => {
    if (isRecoveringIngredients) return;
    setIsRecoveringIngredients(true);
    try {
      const imagesToSend = hasRasterScanPhoto ? [originalScanPhoto] : [];
      const fallbackText = [
        recipe.title,
        recipe.originalHandwritingText || '',
        ...(recipe.steps || []),
        ...(recipe.normalizedNotes || []),
      ]
        .filter(Boolean)
        .join('\n');

      const res = await fetch('/api/ocr-recipe', {
        method: 'POST',
        headers: aiHeaders(),
        body: JSON.stringify({
          imagesBase64: imagesToSend,
          rawHandwritingText: fallbackText,
        }),
      });
      const data = await res.json().catch(() => null);
      const parsedGroups = data?.recipe?.ingredientGroups;
      if (res.ok && Array.isArray(parsedGroups) && !isPlaceholderIngredientGroups(parsedGroups)) {
        onUpdateRecipe({
          ...recipe,
          ingredientGroups: parsedGroups,
          steps:
            (!recipe.steps || recipe.steps.length === 0) && Array.isArray(data?.recipe?.steps)
              ? data.recipe.steps
              : recipe.steps,
        });
      } else if (!isPlaceholderIngredientGroups(effectiveIngredientGroups)) {
        onUpdateRecipe({
          ...recipe,
          ingredientGroups: effectiveIngredientGroups,
        });
      }
    } catch {
      if (!isPlaceholderIngredientGroups(effectiveIngredientGroups)) {
        onUpdateRecipe({
          ...recipe,
          ingredientGroups: effectiveIngredientGroups,
        });
      }
    } finally {
      setIsRecoveringIngredients(false);
    }
  };

  useEffect(() => {
    if (
      isPlaceholderIngredientGroups(recipe.ingredientGroups) &&
      !autoAttemptedScanRecoveryRef.current.has(recipe.id)
    ) {
      autoAttemptedScanRecoveryRef.current.add(recipe.id);
      if (hasRasterScanPhoto) {
        handleReReadIngredientsFromScan();
      } else if (!isPlaceholderIngredientGroups(effectiveIngredientGroups)) {
        onUpdateRecipe({
          ...recipe,
          ingredientGroups: effectiveIngredientGroups,
        });
      }
    }
  }, [recipe.id]);

  const activeShareText =
    shareMode === 'shopping'
      ? buildExpressShoppingList(
          { ...recipe, ingredientGroups: effectiveIngredientGroups },
          multiplier,
          checkedIngredients,
          effectiveLessSweet
        )
      : buildFullShareText();


  const createShareableImageFile = async (
    imageUri: string,
    recipeTitle: string
  ): Promise<File | null> => {
    if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
    const safeName =
      recipeTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'mamina-teka-recept';

    return new Promise<File | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timer = window.setTimeout(() => resolve(null), 3500);

      img.onload = () => {
        window.clearTimeout(timer);
        try {
          let w = img.naturalWidth || img.width || 800;
          let h = img.naturalHeight || img.height || 600;
          const maxDim = 1200;
          if (w > maxDim || h > maxDim) {
            if (w >= h) {
              h = Math.max(1, Math.round((h * maxDim) / w));
              w = maxDim;
            } else {
              w = Math.max(1, Math.round((w * maxDim) / h));
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.fillStyle = '#FAF6F0';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(null);
                return;
              }
              resolve(new File([blob], `${safeName}.jpg`, { type: 'image/jpeg' }));
            },
            'image/jpeg',
            0.86
          );
        } catch {
          resolve(null);
        }
      };

      img.onerror = () => {
        window.clearTimeout(timer);
        resolve(null);
      };

      img.src = imageUri;
    });
  };

  const handleCopyShareText = async () => {
    try {
      await navigator.clipboard.writeText(activeShareText);
      setCopiedShare(true);
      window.setTimeout(() => setCopiedShare(false), 2500);
    } catch {
      setCopiedShare(true);
    }
  };

  const handleNativeShareWithPhoto = async () => {
    const textToShare = activeShareText;
    const shareUrl = typeof window !== 'undefined' ? window.location.origin : 'https://zrina.app';
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        const photoFile = await createShareableImageFile(currentRecipePhoto, recipe.title);
        if (
          photoFile &&
          typeof navigator.canShare === 'function' &&
          navigator.canShare({ files: [photoFile] })
        ) {
          await navigator.share({
            title: `${recipe.title} — Mamina Teka`,
            text: textToShare,
            files: [photoFile],
          });
          return;
        }
        await navigator.share({
          title: `${recipe.title} — Mamina Teka`,
          text: textToShare,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or file share unsupported; fall through to copy text
      }
    }
    await handleCopyShareText();
  };

  const openShoppingListModal = () => {
    setShareMode('shopping');
    setShowShareModal(true);
  };

  const handleShareThisRecipe = async () => {
    setShowMoreMenu(false);
    setShareMode('full');
    setShowShareModal(true);
    try {
      await navigator.clipboard.writeText(buildFullShareText());
    } catch {
      // Ignore clipboard restriction
    }
  };

  const handlePrintOrSavePdf = () => {
    setShowMoreMenu(false);
    setShareMode('pdf-card');
    setShowShareModal(true);
  };

  return (
    <article className="max-w-5xl w-full mx-auto pb-32 overflow-x-hidden">
      {/* 1. GORNJA TRAKA S AKCIJAMA (Jedan fiksni red širine ekrana bez horizontalnog skrolanja) */}
      <div
        data-testid="recipe-top-action-bar"
        className="no-print flex items-center justify-between gap-2 mb-3 w-full"
      >
        {/* LIJEVO: Samo kompaktna ikona za povratak [ ← ] (bez riječi "Natrag") */}
        <button
          type="button"
          data-testid="recipe-back-btn"
          onClick={onBack}
          aria-label="Natrag"
          title="Natrag na Teku"
          className="inline-flex items-center justify-center rounded-xl border border-[#DFD3C3] dark:border-stone-700 bg-[#F3ECE1] dark:bg-[#24201E] w-10 h-10 text-[#231F1D] dark:text-stone-100 hover:bg-[#EAE0D1] dark:hover:bg-stone-800 transition-colors shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
        </button>

        {/* DESNO: Kompaktne ikone u nizu: [ ⭐ ] [ 🛒 ] [ 📅 ] [ ✏️ ] [ ⋮ ] */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* [ ⭐ ] (Favorit) */}
          <button
            type="button"
            data-testid="favorite-recipe-btn"
            onClick={handleToggleFavorite}
            aria-label={recipe.isFavorite ? 'Ukloni iz favorita' : 'Dodaj u favorite'}
            title={recipe.isFavorite ? 'Favorit (uključen)' : 'Favorit'}
            className={`inline-flex items-center justify-center rounded-xl border w-10 h-10 transition-colors shrink-0 cursor-pointer ${
              recipe.isFavorite
                ? 'bg-[#C88A2B] text-white border-[#C88A2B]'
                : 'bg-[#F3ECE1] dark:bg-[#24201E] text-[#231F1D] dark:text-stone-100 border-[#DFD3C3] dark:border-stone-700 hover:bg-[#EAE0D1] dark:hover:bg-stone-800'
            }`}
          >
            <Star className={`w-4 h-4 shrink-0 ${recipe.isFavorite ? 'fill-current' : ''}`} />
          </button>

          {/* [ 🛒 ] (Popis za dućan) */}
          <button
            type="button"
            data-testid="shopping-list-btn"
            onClick={openShoppingListModal}
            aria-label="Popis za dućan"
            title="Popis za dućan"
            className="inline-flex items-center justify-center rounded-xl border border-[#DFD3C3] dark:border-stone-700 bg-[#FAF6F0] dark:bg-[#24201E] w-10 h-10 text-[#9E3B24] dark:text-[#F08C70] hover:bg-[#EAE0D1] dark:hover:bg-stone-800 transition-colors shrink-0 cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4 shrink-0" />
          </button>

          {/* [ 📅 ] (Planer pripreme) */}
          <button
            type="button"
            data-testid="cook-soon-btn"
            onClick={handleToggleCookSoon}
            aria-label={recipe.inCookSoon ? 'Ukloni iz planera pripreme' : 'Planer pripreme'}
            title={recipe.inCookSoon ? 'U planeru pripreme' : 'Planer pripreme'}
            className={`inline-flex items-center justify-center rounded-xl border w-10 h-10 transition-colors shrink-0 cursor-pointer ${
              recipe.inCookSoon
                ? 'bg-[#4A5D3F] text-white border-[#4A5D3F]'
                : 'bg-[#F3ECE1] dark:bg-[#24201E] text-[#231F1D] dark:text-stone-100 border-[#DFD3C3] dark:border-stone-700 hover:bg-[#EAE0D1] dark:hover:bg-stone-800'
            }`}
          >
            {recipe.inCookSoon ? (
              <CalendarCheck className="w-4 h-4 shrink-0" />
            ) : (
              <CalendarPlus className="w-4 h-4 shrink-0" />
            )}
          </button>

          {/* [ ✏️ ] (Uredi recept) */}
          <button
            type="button"
            data-testid="edit-recipe-btn"
            onClick={() => setShowEditModal(true)}
            aria-label="Uredi recept"
            title="Uredi recept"
            className="inline-flex items-center justify-center rounded-xl border border-[#DFD3C3] dark:border-stone-700 bg-[#F3ECE1] dark:bg-[#24201E] w-10 h-10 text-[#231F1D] dark:text-stone-100 hover:bg-[#EAE0D1] dark:hover:bg-stone-800 transition-colors shrink-0 cursor-pointer"
          >
            <Edit3 className="w-4 h-4 text-[#9E3B24] dark:text-[#F08C70] shrink-0" />
          </button>

          {/* [ ⋮ ] (Izbornik dodatnih opcija / More menu) */}
          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              data-testid="recipe-more-menu-btn"
              onClick={() => setShowMoreMenu((v) => !v)}
              aria-label="Dodatne opcije recepta"
              aria-expanded={showMoreMenu}
              title="Dodatne opcije"
              className="inline-flex items-center justify-center rounded-xl border border-[#DFD3C3] dark:border-stone-700 bg-[#F3ECE1] dark:bg-[#24201E] w-10 h-10 text-[#231F1D] dark:text-stone-100 hover:bg-[#EAE0D1] dark:hover:bg-stone-800 transition-colors shrink-0 cursor-pointer"
            >
              <MoreVertical className="w-4 h-4 shrink-0" />
            </button>

            {showMoreMenu && (
              <div
                role="menu"
                data-testid="recipe-more-dropdown"
                className="absolute right-0 mt-2 w-60 rounded-2xl bg-[#FAF6F0] dark:bg-[#24201E] border border-[#D5C7B4] dark:border-stone-700 shadow-xl p-1.5 z-40 space-y-1"
              >
                <button
                  type="button"
                  role="menuitem"
                  data-testid="more-share-recipe-btn"
                  onClick={handleShareThisRecipe}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[#231F1D] dark:text-stone-100 hover:bg-[#EAE0D1] dark:hover:bg-stone-800 transition-colors text-left cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-[#9E3B24] dark:text-[#F08C70] shrink-0" />
                  <span>Podijeli ovaj recept</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  data-testid="more-print-pdf-btn"
                  onClick={handlePrintOrSavePdf}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[#231F1D] dark:text-stone-100 hover:bg-[#EAE0D1] dark:hover:bg-stone-800 transition-colors text-left cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-[#9E3B24] dark:text-[#F08C70] shrink-0" />
                  <span>Ispiši / Spremi kao PDF</span>
                </button>

                <div className="border-t border-[#E6D9C6] dark:border-stone-700 my-1" />

                <button
                  type="button"
                  role="menuitem"
                  data-testid="delete-recipe-btn"
                  onClick={() => {
                    setShowMoreMenu(false);
                    setDeleteConfirmStep(1);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-[#B42318] dark:text-[#FCA5A5] hover:bg-[#FCE4E1] dark:hover:bg-[#361B18] transition-colors text-left cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>Obriši recept</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. ČISTA SLIKA JELA (Bez preklopljenih duplih ikona kamere i natpisa koji prekrivaju sliku) */}
      <div className="relative rounded-3xl border border-[#DFD3C3] bg-[#2B1D16] shadow-xs">
        <div className="h-60 sm:h-80 w-full relative rounded-t-3xl overflow-hidden">
          <img
            src={recipe.image || recipe.imageUrl}
            alt={recipe.title}
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.currentTarget;
              const fallback =
                recipe.originalImage ||
                recipe.originalScanUrl ||
                getOfflineFallbackDishUri(recipe.title, recipe.category);
              if (target.src !== fallback) {
                target.src = fallback;
              }
            }}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

          {/* Diskretna mala oznaka u gornjem desnom kutu slike */}
          <div className="no-print absolute top-3 right-3 sm:top-4 sm:right-4">
            {recipe.imageStatus === 'ai' || recipe.isAiGenerated ? (
              <span
                data-testid="ai-image-badge"
                className="inline-flex items-center gap-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-[#FAF6F0]"
              >
                ✨ AI slika
              </span>
            ) : (recipe.image || recipe.imageUrl) ===
              (recipe.originalImage || recipe.originalScanUrl) ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-[#EFE6D5]">
                📜 Rukopis iz teke
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-[#EFE6D5]">
                📷 Gotovo jelo
              </span>
            )}
          </div>

          {/* Naslov i podnaslov jela na dnu slike */}
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-7 flex items-end justify-between gap-4">
            <div className="max-w-2xl min-w-0">
              <div className="text-xs sm:text-sm font-medium text-[#EFE6D5]/90 mb-1">
                <span>{categoryMeta?.title}</span>
                <span aria-hidden="true" className="mx-2">·</span>
                <span>{recipe.subcategory}</span>
              </div>
              <h1 className="font-display text-xl sm:text-4xl font-bold text-white leading-tight drop-shadow-xs break-words">
                {recipe.title}
              </h1>
              <p className="text-xs sm:text-base text-[#EFE6D5]/95 mt-1 line-clamp-2">
                {recipe.subtitle}
              </p>
            </div>

            {/* Nostalgična naljepnica izvornog rukopisa iz teke (vidljiva kod ispisa pojedinačnog recepta) */}
            <div className="hidden print:block shrink-0 bg-[#FFFEFA] p-1.5 pb-2.5 rounded-xl shadow-lg border-2 border-[#D5C7B4] -rotate-3 w-28">
              <div className="mx-auto -mt-2.5 mb-1 w-10 h-2 rounded-xs bg-[#F2E3B6]/95 border border-[#D8C58E]" />
              <img
                src={originalScanPhoto}
                alt={`Izvorni rukopis — ${recipe.title}`}
                loading="eager"
                decoding="sync"
                className="w-full h-18 object-cover rounded-lg border border-[#E5DAC8]"
              />
              <div className="font-handwriting text-[11px] text-[#3A281E] text-center mt-1 leading-none">
                Iz mamine teke 📝
              </div>
            </div>
          </div>
        </div>

        {/* Kontrole fotografije neposredno ispod slike (1. Generiraj AI sliku, 2. Fotografija gotovog jela, 3. Postavi izvorni rukopis kao naslovnu sliku) */}
        <div className="no-print bg-[#F3ECE1] border-t border-[#DFD3C3] rounded-b-3xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
          {/* Skriveni inputi za kameru i galeriju */}
          <input
            ref={cameraFileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              setShowPhotoMenu(false);
              handleReplacePhotoChange(e);
            }}
            className="hidden"
            id="replace-real-photo-camera-input"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              setShowPhotoMenu(false);
              handleReplacePhotoChange(e);
            }}
            className="hidden"
            id="replace-real-photo-input"
          />

          <div className="flex flex-wrap items-center gap-2 w-full">
            {/* 1. Gumb "Generiraj AI sliku" */}
            <button
              type="button"
              data-testid="regenerate-ai-photo-btn"
              onClick={handleRegenerateAiPhoto}
              disabled={isRegeneratingAiPhoto}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#9E3B24] hover:bg-[#842F1B] text-white px-3.5 py-2 text-xs sm:text-sm font-bold transition-colors min-h-[38px] cursor-pointer disabled:opacity-65"
              title="Generiraj AI vizualizaciju gotovog jela na temelju sastojaka i koraka"
            >
              {isRegeneratingAiPhoto ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>
                {isRegeneratingAiPhoto ? 'Generiram AI sliku...' : 'Generiraj AI sliku'}
              </span>
            </button>

            {/* 2. Gumb "Fotografija gotovog jela" s padajućim izbornikom */}
            <div className="relative flex-1 sm:flex-initial">
              <button
                type="button"
                onClick={() => setShowPhotoMenu((v) => !v)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#D5C7B4] bg-[#FAF6F0] hover:bg-[#EAE0D1] text-[#231F1D] px-3.5 py-2 text-xs sm:text-sm font-bold transition-colors min-h-[38px] cursor-pointer"
                title="Uslikaj kamerom, odaberi fotografiju gotovog jela ili postavi izvorni rukopis kao naslovnu sliku"
              >
                <Camera className="w-3.5 h-3.5 text-[#9E3B24] shrink-0" />
                <span>Fotografija gotovog jela</span>
              </button>

              {showPhotoMenu && (
                <div className="absolute right-0 bottom-full mb-2 w-72 rounded-2xl bg-[#FAF6F0] border border-[#D5C7B4] shadow-xl p-2 z-30 space-y-1">
                  <button
                    type="button"
                    onClick={() => cameraFileInputRef.current?.click()}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-[#231F1D] hover:bg-[#EAE0D1] transition-colors text-left cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-[#9E3B24] shrink-0" />
                    <span>Slikaj gotovo jelo kamerom</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-[#231F1D] hover:bg-[#EAE0D1] transition-colors text-left cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4 text-[#9E3B24] shrink-0" />
                    <span>Odaberi sliku iz galerije</span>
                  </button>
                  {(recipe.originalImage || recipe.originalScanUrl) && (
                    <button
                      type="button"
                      onClick={handleSetManuscriptAsCover}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-[#7A542E] hover:bg-[#EAE0D1] border-t border-[#E6D9C6] transition-colors text-left cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4 text-[#9E3B24] shrink-0" />
                      <span>Postavi izvorni rukopis kao naslovnu sliku</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 3. Izravna opcija "Postavi izvorni rukopis kao naslovnu sliku" kada naslovna slika nije rukopis */}
            {(recipe.originalImage || recipe.originalScanUrl) &&
              (recipe.image || recipe.imageUrl) !==
                (recipe.originalImage || recipe.originalScanUrl) && (
                <button
                  type="button"
                  onClick={handleSetManuscriptAsCover}
                  className="w-full sm:w-auto sm:ml-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#D5C7B4] bg-[#FAF6F0]/80 hover:bg-[#EAE0D1] text-[#7A542E] px-3 py-2 text-xs font-bold transition-colors min-h-[38px] cursor-pointer"
                  title="Postavi stvarnu sliku maminog rukopisa kao glavnu naslovnu sliku recepta"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#9E3B24] shrink-0" />
                  <span>Postavi izvorni rukopis kao naslovnu sliku</span>
                </button>
              )}
          </div>
        </div>
      </div>

      {photoReplaceInfo && (
        <div
          role="status"
          data-testid="photo-replace-status"
          className="mt-3 rounded-xl bg-[#F3ECE1] border border-[#DFD3C3] text-[#5A4F47] px-4 py-2.5 text-xs sm:text-sm font-medium flex items-center justify-between gap-3"
        >
          <span>{photoReplaceInfo}</span>
          <button
            type="button"
            onClick={() => setPhotoReplaceInfo(null)}
            className="shrink-0 text-[#7A7067] hover:text-[#231F1D] font-bold px-1.5 py-0.5 rounded cursor-pointer"
            aria-label="Zatvori obavijest"
          >
            ✕
          </button>
        </div>
      )}

      {/* COMPACT SLIM ROW: Yellow Post-it ("Mamina tajna") + Voice Memos (max 3 secrets) */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        <div
          data-testid="mamina-tajna-postit"
          className="lg:col-span-7 min-w-0 rounded-2xl bg-[#FFF7C2] border border-[#E6D073] px-3.5 py-2.5 shadow-2xs flex flex-col justify-center"
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#7A5210]">
              <Sparkles className="w-3.5 h-3.5 text-[#B57B16] shrink-0" />
              <span>Mamina tajna</span>
            </div>
            <button
              type="button"
              onClick={() => setIsEditingSecret((v) => !v)}
              className="no-print inline-flex items-center gap-1 text-[11px] font-bold text-[#7A5210] hover:underline cursor-pointer"
            >
              <Edit3 className="w-3 h-3" />
              <span>{isEditingSecret ? 'Odustani' : 'Uredi'}</span>
            </button>
          </div>

          {isEditingSecret ? (
            <div className="space-y-2">
              <textarea
                rows={2}
                value={secretDraft}
                onChange={(e) => setSecretDraft(e.target.value)}
                className="w-full rounded-lg border border-[#D4B84A] bg-white/90 p-2 text-xs sm:text-sm text-[#231F1D]"
                placeholder="Upišite mamin zlatni savjet..."
              />
              <button
                type="button"
                onClick={handleSaveSecretTip}
                className="px-3 py-1.5 rounded-lg bg-[#7A5210] text-white text-xs font-bold cursor-pointer"
              >
                Spremi tajnu
              </button>
            </div>
          ) : (
            <p className="font-handwriting text-lg sm:text-xl text-[#2E2414] leading-snug break-words">
              „{recipe.secretTip || recipe.momTips[0] || 'Sve sastojke izvadi ranije na sobnu temperaturu.'}”
            </p>
          )}
        </div>

        {/* Compact Voice Secrets Box (up to 3 secrets) */}
        <div
          data-testid="voice-memo-box"
          className="lg:col-span-5 min-w-0 rounded-2xl border border-[#DFD3C3] bg-[#F3ECE1] px-3.5 py-2.5 flex flex-col justify-between gap-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#9E3B24]">
                <Mic className="w-3.5 h-3.5 shrink-0" />
                <span>Glasovna bilješka</span>
                <span className="ml-1 rounded-md bg-[#EAE0D1] px-1.5 py-0.5 text-[10px] font-mono-tabular text-[#231F1D]">
                  {savedVoiceMemos.length > 0
                    ? `Spremljeno ${savedVoiceMemos.length}/${MAX_VOICE_MEMOS}`
                    : `Nema spremljene (0/${MAX_VOICE_MEMOS})`}
                </span>
              </div>
              <p className="text-[11px] text-[#5A4F47] leading-tight mt-0.5">
                Snimi mamin glas kako govori svoju tajnu.
              </p>
            </div>

            {/* Record / Add New Button (up to 3) */}
            <div className="shrink-0">
              {!isRecordingAudio ? (
                <button
                  type="button"
                  onClick={handleStartRecording}
                  disabled={savedVoiceMemos.length >= MAX_VOICE_MEMOS}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors min-h-[32px] cursor-pointer ${
                    savedVoiceMemos.length >= MAX_VOICE_MEMOS
                      ? 'bg-[#D5C7B4] text-[#655A52] cursor-not-allowed'
                      : 'bg-[#231F1D] text-white hover:bg-[#3A3330]'
                  }`}
                  title={
                    savedVoiceMemos.length >= MAX_VOICE_MEMOS
                      ? 'Maksimalno 3 tajne spremljene. Obrišite jednu za novu.'
                      : 'Snimi mamin glas (do 30s)'
                  }
                >
                  <Mic className="w-3 h-3 text-[#F2C17D] shrink-0" />
                  <span>
                    {savedVoiceMemos.length === 0
                      ? 'Snimi'
                      : savedVoiceMemos.length < MAX_VOICE_MEMOS
                        ? '+ Dodaj novu'
                        : 'Maks. 3/3'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopRecording}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#9E3B24] text-white px-2.5 py-1.5 text-[11px] font-bold min-h-[32px] cursor-pointer"
                >
                  <Square className="w-3 h-3 fill-current shrink-0" />
                  <span>Stop ({30 - recordingSeconds}s)</span>
                </button>
              )}
            </div>
          </div>

          {/* Saved Voice Secrets Chips (1 to 3) with Play & Delete */}
          {savedVoiceMemos.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {savedVoiceMemos.map((memo) => {
                const isPlaying = playingMemoId === memo.id;
                return (
                  <div
                    key={memo.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#D5C7B4] bg-[#FAF6F0] px-2 py-1 text-[11px] font-semibold text-[#231F1D]"
                  >
                    <button
                      type="button"
                      onClick={() => handlePlayMemoItem(memo)}
                      className="inline-flex items-center gap-1 hover:text-[#9E3B24] cursor-pointer"
                      title="Poslušaj spremljenu tajnu"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-[#9E3B24] shrink-0" />
                      <span>{isPlaying ? 'Slušam...' : memo.label}</span>
                      <span className="text-[10px] text-[#655A52] font-mono-tabular">
                        ({memo.durationSec}s)
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMemoItem(memo.id)}
                      aria-label={`Obriši ${memo.label}`}
                      title={`Obriši ${memo.label}`}
                      className="ml-0.5 p-0.5 rounded text-[#655A52] hover:text-[#B42318] hover:bg-[#EAE0D1] cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {(savedVoiceMemos.length >= MAX_VOICE_MEMOS || voiceLimitWarning) && (
            <p className="text-[10px] font-semibold text-[#9E3B24] leading-tight">
              {voiceLimitWarning || 'Spremljene su sve 3 tajne — za novu obrišite jednu postojeću.'}
            </p>
          )}
        </div>
      </div>

      {/* Dual View Tabs & Mandatory Pan Dimensions + Oven Strip */}
      <div className="mt-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#DFD3C3] dark:border-stone-700 pb-4">
        <div
          role="tablist"
          aria-label="Prikaz recepta"
          className="no-print flex w-full sm:w-auto items-center bg-stone-200/80 dark:bg-stone-900 p-1 rounded-2xl border border-[#DFD3C3] dark:border-stone-700"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'digital'}
            onClick={() => setActiveTab('digital')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors min-h-[42px] min-w-0 cursor-pointer ${
              activeTab === 'digital'
                ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            <FileText className="w-4 h-4 text-[#9E3B24] shrink-0" />
            <span className="truncate">Digitalni recept</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'original'}
            onClick={() => setActiveTab('original')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors min-h-[42px] min-w-0 cursor-pointer ${
              activeTab === 'original'
                ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            <BookOpen className="w-4 h-4 text-[#9E3B24] shrink-0" />
            <span className="truncate">Originalna teka (Rukopis)</span>
          </button>
        </div>

        {/* Culinary Info Strip including Mandatory Pan/Mold Dimensions */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs sm:text-sm text-stone-700 dark:text-stone-300">
          <span className="inline-flex flex-wrap items-center gap-1 text-[#9E3B24] font-semibold">
            <Ruler className="w-3.5 h-3.5 shrink-0" />
            <span>Kalup/protvan:</span>
            <strong className="text-stone-900 dark:text-stone-100 break-words">
              {recipe.panDimensions || 'Standardni protvan (35 × 25 cm)'}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Priprema: <strong className="font-mono-tabular text-stone-900 dark:text-stone-100">{recipe.prepTimeMinutes} min</strong>
          </span>
          {recipe.cookTimeMinutes > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                Pečenje: <strong className="font-mono-tabular text-stone-900 dark:text-stone-100">{recipe.cookTimeMinutes} min</strong>
              </span>
            </>
          )}
          {recipe.ovenTemp && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                Pećnica: <strong className="text-stone-900 dark:text-stone-100">{recipe.ovenTemp}</strong>
              </span>
            </>
          )}
        </div>
      </div>

      {activeTab === 'digital' ? (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Left Column: Measure Calculator + "Malo manje slatko" Sugar Toggle & Interactive Checklist */}
          <div className="lg:col-span-5 min-w-0 rounded-3xl border border-[#DFD3C3] dark:border-stone-700 bg-white dark:bg-[#24201E] p-4 sm:p-6">
            <div className="mb-4">
              <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-2">
                Kalkulator količine (preračunava sve gramaže)
              </label>
              <div
                role="group"
                aria-label="Kalkulator količine"
                className="grid grid-cols-3 gap-1.5 bg-stone-200/80 dark:bg-stone-900 p-1.5 rounded-xl border border-[#DFD3C3] dark:border-stone-700"
              >
                {[
                  { value: 0.5, label: 'Pola mjere' },
                  { value: 1, label: '1 mjera' },
                  { value: 2, label: 'Dupla mjera' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMultiplier(opt.value)}
                    className={`py-2 px-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors min-h-[40px] truncate cursor-pointer ${
                      multiplier === opt.value
                        ? 'bg-white dark:bg-stone-800 text-[#9E3B24] dark:text-[#F08C70] shadow-xs'
                        : 'text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Conditional Sugar Calculator Toggle ("Malo manje slatko" -28% sugar — ONLY for Kolači & Slatko) */}
            {showSugarToggle && (
              <div className="mb-5">
                <button
                  type="button"
                  onClick={() => setLessSweet((v) => !v)}
                  aria-pressed={lessSweet}
                  data-testid="less-sweet-toggle"
                  className={`w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs sm:text-sm font-semibold transition-colors min-h-[44px] text-left cursor-pointer ${
                    lessSweet
                      ? 'bg-[#4A5D3F] text-white border-[#4A5D3F]'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 border-[#D5C7B4] dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                >
                  <span className="min-w-0 break-words">
                    {lessSweet
                      ? '✓ Malo manje slatko (-28% šećera)'
                      : 'Malo manje slatko (-28% šećera)'}
                  </span>
                  <span className="font-mono-tabular text-xs opacity-90 shrink-0">
                    {lessSweet ? 'Uključeno' : 'Uključi'}
                  </span>
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DFD3C3] dark:border-stone-700 pb-3 mb-4">
              <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
                Popis sastojaka
              </h2>
              <div className="flex items-center gap-3">
                {hasRasterScanPhoto && (
                  <button
                    type="button"
                    onClick={handleReReadIngredientsFromScan}
                    disabled={isRecoveringIngredients}
                    data-testid="reread-ingredients-btn"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#4A5D3F] dark:text-[#96B882] hover:underline disabled:opacity-60 cursor-pointer"
                    title="Ponovno očitaj točne sastojke sa sačuvane fotografije rukopisa"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isRecoveringIngredients ? 'animate-spin' : ''}`}
                    />
                    <span>
                      {isRecoveringIngredients ? 'Čitam rukopis...' : 'Očitaj s rukopisa'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={openShoppingListModal}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#9E3B24] hover:underline cursor-pointer"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Pošalji u dućan</span>
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {effectiveIngredientGroups.map((group, gIdx) => (
                <div key={gIdx}>
                  <h3 className="text-sm font-bold text-[#9E3B24] mb-2.5">
                    {group.groupTitle}
                  </h3>
                  <ul className="space-y-2">
                    {group.items.map((item) => {

                      const isChecked = !!checkedIngredients[item.id];
                      const scaled = scaleIngredientWithSugarOption(
                        item,
                        multiplier,
                        effectiveLessSweet
                      );
                      return (
                        <li
                          key={item.id}
                          className="rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200/80 dark:border-stone-700/80 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => toggleIngredient(item.id)}
                            className="w-full px-3.5 py-2.5 flex items-start justify-between gap-3 text-left group min-h-[48px] cursor-pointer"
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                  isChecked
                                    ? 'bg-[#4A5D3F] border-[#4A5D3F] text-white'
                                    : 'border-stone-400 dark:border-stone-500 bg-white dark:bg-stone-900 group-hover:border-[#9E3B24]'
                                }`}
                              >
                                {isChecked && <Check className="w-3.5 h-3.5" />}
                              </span>
                              <div>
                                <span
                                  className={`text-base font-medium transition-opacity ${
                                    isChecked
                                      ? 'line-through opacity-55 text-stone-500 dark:text-stone-400'
                                      : 'text-stone-900 dark:text-stone-100'
                                  }`}
                                >
                                  {item.name}
                                </span>
                                {item.originalMeasure && (
                                  <span className="block text-xs text-stone-600 dark:text-stone-400">
                                    u teki: „{item.originalMeasure}”
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span
                                className={`font-mono-tabular text-base font-bold block ${
                                  isChecked
                                    ? 'line-through opacity-45 text-stone-500 dark:text-stone-400'
                                    : scaled.isReducedSugar
                                      ? 'text-[#4A5D3F] dark:text-[#86EFAC]'
                                      : 'text-stone-900 dark:text-stone-100'
                                }`}
                              >
                                {scaled.displayAmount}
                              </span>
                              {scaled.isReducedSugar && scaled.originalScaledAmount && (
                                <span className="block text-[11px] text-stone-500 dark:text-stone-400 line-through font-mono-tabular">
                                  {scaled.originalScaledAmount}
                                </span>
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Numbered Preparation Steps, Cooking Log ("Dnevnik pripreme"), and Cooking Mode CTA */}
          <div className="lg:col-span-7 min-w-0 space-y-6">
            <div className="rounded-3xl border border-[#DFD3C3] bg-white p-5 sm:p-8">
              <div className="border-b border-[#EFE6D8] pb-4 mb-6">
                <h2 className="font-display text-2xl font-bold text-[#231F1D]">
                  Postupak pripreme
                </h2>
                <p className="text-xs text-[#655A52] mt-0.5">
                  U načinu „Pripremi / Kuhaj” korake listate povlačenjem prsta (swipe) ili velikim gumbima na dnu ekrana.
                </p>
              </div>

              <ol className="space-y-6">
                {recipe.steps.map((step, index) => (
                  <li key={index} className="flex items-start gap-4">
                    <span className="font-display text-lg font-bold text-[#9E3B24] w-7 shrink-0 pt-0.5">
                      {String(index + 1).padStart(2, '0')}.
                    </span>
                    <p className="text-base sm:text-lg leading-relaxed text-[#231F1D]">
                      {step}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            {/* Cooking Log ("Dnevnik pripreme" — Obiteljske bilješke s pripreme i kuhanja) */}
            <div
              data-testid="dnevnik-pripreme"
              className="rounded-3xl border border-[#DFD3C3] bg-[#F3ECE1] p-6 sm:p-8 space-y-5"
            >
              <div>
                <h3 className="font-display text-xl font-bold text-[#231F1D]">
                  Dnevnik pripreme (Obiteljske bilješke s pripreme i kuhanja)
                </h3>
                <p className="text-xs sm:text-sm text-[#5A4F47] mt-0.5">
                  Zapišite kada ste pripremali jelo i kako je ispalo (npr. „Kuhano za nedjeljni ručak – drugi put dodati malo više začina”).
                </p>
              </div>

              <form onSubmit={handleAddCookingLog} className="no-print space-y-3 bg-[#FAF6F0] p-4 rounded-2xl border border-[#DFD3C3]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={newLogDate}
                    onChange={(e) => setNewLogDate(e.target.value)}
                    placeholder="Prigoda ili datum (npr. Nedjeljni ručak / Uskrs)"
                    aria-label="Prigoda ili datum pripreme"
                    className="rounded-xl border border-[#D5C7B4] bg-white px-3 py-2 text-xs sm:text-sm text-[#231F1D]"
                  />
                  <input
                    type="text"
                    value={newLogAuthor}
                    onChange={(e) => setNewLogAuthor(e.target.value)}
                    placeholder="Tko je kuhao (npr. Mama)"
                    aria-label="Tko je pripremao recept"
                    className="rounded-xl border border-[#D5C7B4] bg-white px-3 py-2 text-xs sm:text-sm text-[#231F1D]"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={newLogNote}
                    onChange={(e) => setNewLogNote(e.target.value)}
                    placeholder="Upišite bilješku s pripreme i kuhanja..."
                    aria-label="Bilješka u dnevniku pripreme"
                    className="flex-1 rounded-xl border border-[#D5C7B4] bg-white px-3.5 py-2.5 text-sm text-[#231F1D]"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#9E3B24] px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-[#842F1B] min-h-[42px] whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Dodaj u dnevnik</span>
                  </button>
                </div>
              </form>

              {recipe.cookingLogs && recipe.cookingLogs.length > 0 ? (
                <ul className="space-y-3">
                  {recipe.cookingLogs.map((log) => (
                    <li
                      key={log.id}
                      className="rounded-2xl bg-white border border-[#DFD3C3] p-4"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-[#9E3B24] mb-1">
                        <span>{log.dateLabel}</span>
                        {log.author && <span className="text-[#655A52]">Upis: {log.author}</span>}
                      </div>
                      <p className="text-sm sm:text-base text-[#231F1D] leading-relaxed">
                        {log.note}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[#655A52] italic">
                  Još nema unosa u dnevniku za ovaj recept — dodajte prvu obiteljsku bilješku nakon pripreme i kuhanja.
                </p>
              )}
            </div>

            {/* Primary Bottom CTA for Cooking Mode */}
            <div className="no-print rounded-3xl border border-[#DFD3C3] bg-[#231F1D] text-[#FAF6F0] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-bold">
                  Spremni za brašnjave ruke u kuhinji?
                </h3>
                <p className="text-sm text-[#D5C7B4] mt-1">
                  Krupna slova preko cijelog ekrana bez skrolanja, listanje povlačenjem (swipe), ugrađeni tajmeri i stalno upaljen zaslon.
                </p>
              </div>
              <button
                type="button"
                data-testid="bottom-start-cooking-btn"
                onClick={() => onStartCooking(multiplier, effectiveLessSweet)}
                className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-[#9E3B24] px-6 py-4 text-base font-bold text-white hover:bg-[#842F1B] transition-colors min-h-[54px] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ChefHat className="w-5 h-5" />
                <span>Pripremi / Kuhaj</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Tab 2: Originalna teka (Archival Handwritten Scan with Zoom) */
        <div className="mt-8 rounded-3xl border border-[#DFD3C3] bg-[#F3ECE1] p-5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-[#231F1D]">
                Izvorni list iz mamine teke
              </h2>
              <p className="text-sm text-[#655A52]">
                Arhivska fotografija rukopisa sačuvana uz recept — koristite povećalo za detalje.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-[#FAF6F0] p-1.5 rounded-xl border border-[#DFD3C3]">
              <button
                type="button"
                onClick={() => setScanZoom((z) => Math.max(1, +(z - 0.35).toFixed(2)))}
                aria-label="Smanji prikaz rukopisa"
                className="p-2 rounded-lg hover:bg-[#EFE6D8] text-[#231F1D] min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="font-mono-tabular text-xs font-bold px-2">
                {Math.round(scanZoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setScanZoom((z) => Math.min(2.05, +(z + 0.35).toFixed(2)))}
                aria-label="Povećaj prikaz rukopisa"
                className="p-2 rounded-lg hover:bg-[#EFE6D8] text-[#231F1D] min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-auto rounded-2xl border border-[#D5C7B4] bg-[#2B2420] p-4 sm:p-8 max-h-[680px]">
            <div
              className="mx-auto transition-transform duration-150 origin-top"
              style={{
                maxWidth: `${Math.round(580 * scanZoom)}px`,
              }}
            >
              <img
                src={recipe.originalImage || recipe.originalScanUrl}
                alt={`Izvorni rukopis za ${recipe.title}`}
                referrerPolicy="no-referrer"
                className="w-full h-auto rounded-xl shadow-lg"
              />
            </div>
          </div>

          {recipe.originalHandwritingText && (
            <div className="mt-6 rounded-2xl bg-[#FAF6F0] border border-[#DFD3C3] p-5">
              <h3 className="text-xs font-bold text-[#655A52] mb-1.5">
                Doslovni prijepis s papira:
              </h3>
              <p className="font-handwriting text-2xl text-[#243B67] leading-relaxed">
                {recipe.originalHandwritingText}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Share / Express Shopping List / Printable Single-Recipe PDF Card Modal */}
      {showShareModal && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-recipe-title"
        >
          <div className="w-full max-w-xl rounded-3xl bg-[#FAF6F0] dark:bg-[#24201E] border border-[#DFD3C3] dark:border-stone-700 p-5 sm:p-6 shadow-xl my-auto">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 id="share-recipe-title" className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
                Dijeljenje i ispis recepta
              </h3>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                aria-label="Zatvori prozor za dijeljenje"
                className="p-2 rounded-lg text-stone-600 dark:text-stone-300 hover:bg-[#EFE6D8] dark:hover:bg-stone-800 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-3 gap-1.5 bg-stone-200/80 dark:bg-[#181514] p-1.5 rounded-xl mb-4 border border-[#DFD3C3] dark:border-stone-700">
              <button
                type="button"
                onClick={() => setShareMode('shopping')}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  shareMode === 'shopping'
                    ? 'bg-white dark:bg-stone-800 text-[#9E3B24] dark:text-[#F08C70] shadow-xs'
                    : 'text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                🛒 Popis za dućan
              </button>
              <button
                type="button"
                onClick={() => setShareMode('full')}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  shareMode === 'full'
                    ? 'bg-white dark:bg-stone-800 text-[#9E3B24] dark:text-[#F08C70] shadow-xs'
                    : 'text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                📖 Cijeli recept
              </button>
              <button
                type="button"
                onClick={() => setShareMode('pdf-card')}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  shareMode === 'pdf-card'
                    ? 'bg-white dark:bg-stone-800 text-[#9E3B24] dark:text-[#F08C70] shadow-xs'
                    : 'text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                🖨️ PDF kartica
              </button>
            </div>

            {shareMode === 'pdf-card' ? (
              <div
                data-testid="single-recipe-pdf-card"
                className="rounded-2xl bg-[#FFFEFA] dark:bg-[#181514] border-2 border-[#D5C7B4] dark:border-stone-700 p-5 space-y-4 shadow-inner"
              >
                {/* Nostalgično zaglavlje kartice iz kuharice */}
                <div className="flex items-center justify-between border-b-2 border-[#DFD3C3] dark:border-stone-700 pb-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-[#9E3B24] dark:text-[#F08C70]">
                      Mamina Teka • List iz obiteljske kuharice
                    </div>
                    <h4 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                      {recipe.title}
                    </h4>
                    <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                      {categoryMeta?.title} · {recipe.subcategory}
                    </p>
                  </div>
                  <img
                    src="/icon.png"
                    alt="Mamina Teka"
                    className="w-11 h-11 rounded-xl object-cover border border-[#DFD3C3]"
                  />
                </div>

                {/* Trenutno postavljena fotografija recepta + mala naljepnica izvorne slike iz teke */}
                <div className="relative rounded-2xl overflow-hidden border border-[#DFD3C3] dark:border-stone-700 bg-[#2B1D16] h-44 sm:h-52">
                  <img
                    src={currentRecipePhoto}
                    alt={recipe.title}
                    onError={(e) => {
                      const target = e.currentTarget;
                      const fallback = getOfflineFallbackDishUri(recipe.title, recipe.category);
                      if (target.src !== fallback) target.src = fallback;
                    }}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  {/* Mala nostalgična naljepnica izvorne slike recepta iz mamine teke */}
                  <div
                    data-testid="pdf-card-original-scan-sticker"
                    className="absolute bottom-2.5 right-2.5 bg-[#FFFEFA] p-1.5 pb-2 rounded-xl shadow-xl border-2 border-[#D5C7B4] transform -rotate-3 w-24 sm:w-28"
                  >
                    <div className="mx-auto -mt-2.5 mb-1 w-10 h-2 rounded-xs bg-[#F2E3B6]/90 border border-[#D8C58E]" />
                    <img
                      src={originalScanPhoto}
                      alt={`Rukopis iz teke — ${recipe.title}`}
                      loading="eager"
                      decoding="sync"
                      onError={(e) => {
                        const target = e.currentTarget;
                        const fallback = getOfflineFallbackDishUri(recipe.title, recipe.category);
                        if (target.src !== fallback) target.src = fallback;
                      }}
                      className="w-full h-14 sm:h-16 object-cover rounded-md border border-[#E5DAC8]"
                    />
                    <div className="font-handwriting text-[11px] font-bold text-[#3A281E] text-center mt-1 leading-none">
                      Iz mamine teke 📝
                    </div>
                  </div>
                </div>

                <div className="text-xs text-stone-700 dark:text-stone-300 flex flex-wrap gap-x-3 gap-y-1">
                  <span>
                    <strong>Kalup:</strong> {recipe.panDimensions || 'Standardni protvan'}
                  </span>
                  <span>·</span>
                  <span>
                    <strong>Pećnica:</strong> {recipe.ovenTemp || '180 °C'}
                  </span>
                  <span>·</span>
                  <span>
                    <strong>Priprema:</strong> {recipe.prepTimeMinutes + recipe.cookTimeMinutes} min
                  </span>
                </div>

                {(recipe.secretTip || recipe.momTips.length > 0) && (
                  <div className="rounded-xl bg-[#FFF7C2] border border-[#E6D073] p-3 text-xs text-[#2E2414]">
                    <strong>📌 Mamina tajna:</strong> {recipe.secretTip || recipe.momTips[0]}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowShareModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-[#DFD3C3] dark:border-stone-700 text-xs sm:text-sm font-semibold text-stone-700 dark:text-stone-200 hover:bg-[#EFE6D8] dark:hover:bg-stone-800 min-h-[42px] cursor-pointer"
                  >
                    Zatvori
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#9E3B24] hover:bg-[#842F1B] text-xs sm:text-sm font-bold text-white min-h-[42px] cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Ispiši / Spremi PDF karticu</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Vizualna kartica s trenutno postavljenom fotografijom recepta i naljepnicom rukopisa */}
                <div
                  data-testid="share-recipe-photo-preview"
                  className="mb-3 rounded-2xl border border-[#DFD3C3] dark:border-stone-700 bg-[#F3ECE1] dark:bg-[#181514] p-3 flex items-center gap-3.5"
                >
                  <div className="relative w-24 h-20 sm:w-28 sm:h-22 rounded-xl overflow-hidden border border-[#D5C7B4] shrink-0 bg-[#2B1D16]">
                    <img
                      src={currentRecipePhoto}
                      alt={recipe.title}
                      onError={(e) => {
                        const target = e.currentTarget;
                        const fallback = getOfflineFallbackDishUri(recipe.title, recipe.category);
                        if (target.src !== fallback) target.src = fallback;
                      }}
                      className="w-full h-full object-cover"
                    />
                    {/* Mala naljepnica izvornog rukopisa u kutu */}
                    <div
                      title="Izvorni rukopis iz mamine teke"
                      className="absolute bottom-1 right-1 w-9 h-9 rounded-md bg-[#FFFEFA] p-0.5 shadow-md border border-[#D5C7B4] transform -rotate-3 overflow-hidden"
                    >
                      <img
                        src={originalScanPhoto}
                        alt="Izvorni rukopis"
                        className="w-full h-full object-cover rounded-xs"
                      />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-[#9E3B24] dark:text-[#F08C70]">
                      <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>Trenutno postavljena fotografija uključena u dijeljenje</span>
                    </div>
                    <h4 className="font-display text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 truncate mt-0.5">
                      {recipe.title}
                    </h4>
                    <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-1">
                      {recipe.subtitle}
                    </p>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 mb-2">
                  {shareMode === 'shopping'
                    ? 'Ekspresni popis samo onih sastojaka koje niste prekrižili — spreman za slanje u WhatsApp ili Viber:'
                    : 'Kompletna obiteljska kartica recepta s fotografijom spremna za slanje:'}
                </p>

                <pre className="rounded-2xl bg-[#F3ECE1] dark:bg-[#181514] border border-[#DFD3C3] dark:border-stone-700 p-4 text-xs sm:text-sm font-sans whitespace-pre-wrap max-h-56 overflow-y-auto text-stone-900 dark:text-stone-100">
                  {activeShareText}
                </pre>

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowShareModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-[#DFD3C3] dark:border-stone-700 text-xs sm:text-sm font-semibold text-stone-700 dark:text-stone-200 hover:bg-[#EFE6D8] dark:hover:bg-stone-800 min-h-[44px] cursor-pointer"
                  >
                    Zatvori
                  </button>
                  <button
                    type="button"
                    data-testid="copy-share-text-btn"
                    onClick={handleCopyShareText}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#D5C7B4] dark:border-stone-700 bg-[#F3ECE1] dark:bg-stone-800 text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 hover:bg-[#EAE0D1] min-h-[44px] cursor-pointer"
                  >
                    {copiedShare ? (
                      <>
                        <Check className="w-4 h-4 text-[#4A5D3F]" />
                        <span>Kopiran tekst!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Kopiraj tekst</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    data-testid="share-with-photo-btn"
                    onClick={handleNativeShareWithPhoto}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#9E3B24] text-xs sm:text-sm font-bold text-white hover:bg-[#842F1B] min-h-[44px] cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Podijeli recept i sliku</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal: Dvostruka provjera prije brisanja recepta (Step 1 & Step 2) */}
      {deleteConfirmStep > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          data-testid="delete-confirm-modal"
          aria-labelledby="delete-recipe-modal-title"
        >
          <div className="w-full max-w-md rounded-3xl bg-[#FAF6F0] border-2 border-[#E5B8B2] p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#B42318]">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {deleteConfirmStep === 1
                    ? 'Prva provjera brisanja (1/2)'
                    : 'Dvostruka provjera brisanja (2/2)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDeleteConfirmStep(0)}
                aria-label="Zatvori prozor brisanja"
                className="p-1.5 rounded-lg text-[#655A52] hover:bg-[#EFE6D8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {deleteConfirmStep === 1 ? (
              <>
                <h3
                  id="delete-recipe-modal-title"
                  className="font-display text-xl font-bold text-[#231F1D]"
                >
                  Želite li obrisati recept „{recipe.title}”?
                </h3>
                <p className="text-sm text-[#5A4F47] leading-relaxed">
                  Za zaštitu obiteljskih recepata od slučajnog brisanja potrebno je potvrditi u dva koraka. Kliknite „Nastavi” za drugi korak provjere.
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmStep(0)}
                    className="px-4 py-2.5 rounded-xl border border-[#DFD3C3] bg-white text-xs sm:text-sm font-semibold text-[#231F1D] hover:bg-[#F3ECE1] min-h-[42px] cursor-pointer"
                  >
                    Odustani
                  </button>
                  <button
                    type="button"
                    data-testid="delete-confirm-step1-btn"
                    onClick={() => {
                      const next = advanceDeleteConfirmationStep(1);
                      if (next === 2) setDeleteConfirmStep(2);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#B42318] text-xs sm:text-sm font-bold text-white hover:bg-[#911B12] min-h-[42px] cursor-pointer"
                  >
                    <span>Nastavi na 2. provjeru (1/2) →</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3
                  id="delete-recipe-modal-title"
                  className="font-display text-xl font-bold text-[#B42318]"
                >
                  Konačna potvrda: Trajno obriši „{recipe.title}”
                </h3>
                <div className="rounded-2xl bg-[#FDF2F0] border border-[#E5B8B2] p-3.5 text-xs sm:text-sm text-[#7A1C14] leading-relaxed">
                  <strong>Dvostruka provjera (2/2):</strong> Jeste li potpuno sigurni? Ovaj recept (uključujući i ogledne recepte) bit će trajno uklonjen iz vaše Teke.
                </div>
                <div className="pt-2 flex flex-wrap items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmStep(0)}
                    className="px-4 py-2.5 rounded-xl border border-[#DFD3C3] bg-white text-xs sm:text-sm font-semibold text-[#231F1D] hover:bg-[#F3ECE1] min-h-[42px] cursor-pointer"
                  >
                    Zadrži recept
                  </button>
                  <button
                    type="button"
                    data-testid="delete-confirm-step2-btn"
                    onClick={() => {
                      const next = advanceDeleteConfirmationStep(2);
                      if (next === 'confirmed') {
                        setDeleteConfirmStep(0);
                        onDeleteRecipe(recipe.id);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#B42318] text-xs sm:text-sm font-bold text-white hover:bg-[#7A150E] min-h-[42px] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Potvrdi trajno brisanje (2/2)</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal: Uređivanje recepta (EditRecipeModal) */}
      {showEditModal && (
        <EditRecipeModal
          recipe={recipe}
          onClose={() => setShowEditModal(false)}
          onSave={(updatedRecipe) => {
            onUpdateRecipe(updatedRecipe);
            setShowEditModal(false);
            setSecretDraft(updatedRecipe.secretTip || updatedRecipe.momTips?.[0] || '');
            setPhotoReplaceInfo('Izmjene na receptu su uspješno spremljene u lokalnu Teku!');
            window.setTimeout(() => setPhotoReplaceInfo(null), 5000);
          }}
        />
      )}
    </article>
  );
};
