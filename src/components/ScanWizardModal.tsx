import React, { useState, useRef, useEffect } from 'react';
import { aiHeaders } from '../utils/userAiKey';
import {
  X,
  Camera,
  Image as ImageIcon,
  Sparkles,
  Check,
  ArrowRight,
  Loader2,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import {
  CATEGORIES,
  buildAuthenticDishImagePrompt,
  type CategoryId,
  type IngredientGroup,
  type Recipe,
} from '../utils/recipeLogic';
import { SAMPLE_MANUSCRIPTS, type SampleManuscript } from '../db/seedRecipes';
import { createManuscriptScanDataUri } from '../utils/visualAssets';
import { compressImageToWebPOrJpeg, formatBytesKb } from '../utils/imageCompressor';
import {
  getHideSampleManuscripts,
  setHideSampleManuscripts,
} from '../db/tekaDb';

interface ScanWizardModalProps {
  onClose: () => void;
  onSaveRecipe: (newRecipe: Recipe) => void;
  userEmail?: string | null;
  hideSampleManuscriptsProp?: boolean;
  onSampleManuscriptsVisibilityChange?: (hidden: boolean) => void;
}

export const ScanWizardModal: React.FC<ScanWizardModalProps> = ({
  onClose,
  onSaveRecipe,
  userEmail,
  hideSampleManuscriptsProp,
  onSampleManuscriptsVisibilityChange,
}) => {
  const initialSamplesHidden =
    typeof hideSampleManuscriptsProp === 'boolean'
      ? hideSampleManuscriptsProp
      : getHideSampleManuscripts();

  const [samplesHidden, setSamplesHidden] = useState<boolean>(initialSamplesHidden);
  const [step, setStep] = useState<'capture' | 'analyzing' | 'review'>('capture');
  const [uploadedPages, setUploadedPages] = useState<string[]>([]);
  const [compressionStats, setCompressionStats] = useState<string | null>(null);
  const [rawHandwritingInput, setRawHandwritingInput] = useState<string>('');
  const [selectedSampleId, setSelectedSampleId] = useState<string>('custom');
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Live Camera Viewfinder State (WebRTC + native capture="environment" fallback)
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Editable structured fields in Step 3 (Review & Confirm)
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState<CategoryId>('kolaci');
  const [subcategory, setSubcategory] = useState('Biskviti');
  const [prepTimeMinutes, setPrepTimeMinutes] = useState(35);
  const [cookTimeMinutes, setCookTimeMinutes] = useState(25);
  const [servings, setServings] = useState('1 standardni protvan');
  const [panDimensions, setPanDimensions] = useState('Srednji protvan (30 × 20 cm)');
  const [ovenTemp, setOvenTemp] = useState('Umjerena vatra (~180 °C)');
  const [secretTip, setSecretTip] = useState('Ne otvaraj pećnicu prvih 15 minuta da biskvit ne padne!');
  const [ingredientGroups, setIngredientGroups] = useState<IngredientGroup[]>([]);
  const [steps, setSteps] = useState<string[]>([]);
  const [momTips, setMomTips] = useState<string[]>([]);
  const [normalizedNotes, setNormalizedNotes] = useState<string[]>([]);
  const [analyzingStageIndex, setAnalyzingStageIndex] = useState<0 | 1 | 2>(0);
  const [generatedDishImage, setGeneratedDishImage] = useState<string | null>(null);
  const [isAiDishImageGenerated, setIsAiDishImageGenerated] = useState<boolean>(false);
  const [aiVariationIndex, setAiVariationIndex] = useState<number>(0);
  const [isRegeneratingWizardAi, setIsRegeneratingWizardAi] = useState<boolean>(false);
  const [englishImagePrompt, setEnglishImagePrompt] = useState<string>('');
  const [aiImageError, setAiImageError] = useState<string | null>(null);

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraCaptureInputRef = useRef<HTMLInputElement | null>(null);

  const stopCameraStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleOpenCamera = async () => {
    setCameraError(null);
    // If browser supports WebRTC getUserMedia, open live camera preview; otherwise trigger native mobile camera input
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1600 },
            height: { ideal: 1200 },
          },
          audio: false,
        });
        mediaStreamRef.current = stream;
        setIsCameraOpen(true);
        window.setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        }, 50);
        return;
      } catch {
        // Fallback to native mobile camera capture input (`capture="environment"`)
        cameraCaptureInputRef.current?.click();
        return;
      }
    }
    cameraCaptureInputRef.current?.click();
  };

  const handleTakeCameraSnapshot = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const rawDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    stopCameraStream();

    try {
      const compressed = await compressImageToWebPOrJpeg(rawDataUrl, 1600, 0.82);
      setUploadedPages((prev) =>
        selectedSampleId !== 'custom' ? [compressed.dataUrl] : [...prev, compressed.dataUrl]
      );
      if (selectedSampleId !== 'custom') {
        setRawHandwritingInput('');
      }
      setSelectedSampleId('custom');
      setOcrError(null);
      setCompressionStats(
        `Uslikano kamerom i optimizirano: ${formatBytesKb(
          compressed.compressedBytes
        )} (${compressed.width}×${compressed.height} px ${
          compressed.mimeType === 'image/webp' ? 'WebP' : 'JPEG'
        })`
      );
    } catch {
      setUploadedPages((prev) =>
        selectedSampleId !== 'custom' ? [rawDataUrl] : [...prev, rawDataUrl]
      );
      if (selectedSampleId !== 'custom') {
        setRawHandwritingInput('');
      }
      setSelectedSampleId('custom');
      setOcrError(null);
    }
  };

  const handleDismissSampleManuscripts = () => {
    setSamplesHidden(true);
    setHideSampleManuscripts(true);
    onSampleManuscriptsVisibilityChange?.(true);
    // Clear sample text if a sample was selected
    const wasUsingSample = SAMPLE_MANUSCRIPTS.some(
      (s) => s.id === selectedSampleId || s.rawHandwritingText === rawHandwritingInput
    );
    if (wasUsingSample) {
      setSelectedSampleId('custom');
      setRawHandwritingInput('');
      setUploadedPages([]);
    }
  };

  const handleSelectSample = (sample: SampleManuscript) => {
    setSelectedSampleId(sample.id);
    setUploadedPages([sample.scanDataUri]);
    setRawHandwritingInput(sample.rawHandwritingText);
    setCompressionStats(null);
    setOcrError(null);
  };

  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setOcrError(null);
    const wasSample = selectedSampleId !== 'custom';
    if (wasSample) {
      setRawHandwritingInput('');
      setSelectedSampleId('custom');
    }

    const newPages: string[] = [];
    for (const file of files) {
      try {
        const result = await compressImageToWebPOrJpeg(file, 1600, 0.82);
        newPages.push(result.dataUrl);
        setCompressionStats(
          `Optimizirano: ${formatBytesKb(result.originalBytes)} → ${formatBytesKb(
            result.compressedBytes
          )} (${result.width}×${result.height} px ${
            result.mimeType === 'image/webp' ? 'WebP' : 'JPEG'
          })`
        );
      } catch {
        const dataUrl = await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve(typeof reader.result === 'string' ? reader.result : null);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });
        if (dataUrl) {
          newPages.push(dataUrl);
        }
      }
    }
    if (newPages.length > 0) {
      setUploadedPages((prev) => (wasSample ? newPages : [...prev, ...newPages]));
    }
    e.target.value = '';
  };

  const handleRunAiPipeline = async () => {
    stopCameraStream();
    setOcrError(null);

    if (uploadedPages.length === 0 && rawHandwritingInput.trim().length === 0) {
      setOcrError(
        'Molimo uslikajte stranicu recepta kamerom, odaberite sliku iz galerije ili upišite tekst recepta prije čitanja.'
      );
      return;
    }

    setStep('analyzing');
    setAnalyzingStageIndex(0); // 1. "Čitam mamin rukopis..."

    const fallbackCustomScan = createManuscriptScanDataUri({
      pageNumber: 'Novo',
      handwrittenTitle:
        rawHandwritingInput.split('\n')[0]?.trim() || 'Rukopis iz Mamine Teke',
      lines:
        rawHandwritingInput.trim().length > 0
          ? rawHandwritingInput.split('\n').slice(0, 12)
          : ['Sastojci i postupak prema maminoj bilježnici'],
      marginNote: 'Sačuvano u Maminoj Teki',
    });

    const activeScanUri = uploadedPages[0] || fallbackCustomScan;

    if (uploadedPages.length === 0) {
      setUploadedPages([activeScanUri]);
    }

    try {
      const stageTimer = setTimeout(() => {
        setAnalyzingStageIndex(1); // 2. "Slaganje sastojaka i mjera..."
      }, 650);

      const response = await fetch('/api/ocr-recipe', {
        method: 'POST',
        headers: aiHeaders(),
        body: JSON.stringify({
          imagesBase64: uploadedPages,
          rawHandwritingText: rawHandwritingInput.trim(),
        }),
      });
      clearTimeout(stageTimer);

      const data = await response.json();
      if (
        response.status === 429 ||
        data?.code === 429 ||
        String(data?.error || '').includes('429') ||
        String(data?.error || '').includes('RESOURCE_EXHAUSTED') ||
        String(data?.error || '').toLowerCase().includes('quota')
      ) {
        throw new Error(
          'Iskorišten je besplatni dnevni limit Gemini API-ja. Molimo pokušajte ponovo sutra ili postavite novi API ključ.'
        );
      }

      if (!response.ok || data?.error || !data?.recipe) {
        throw new Error(
          data?.error ||
            'Obrada rukopisa nije uspjela. Provjerite je li fotografija čitljiva i pokušajte ponovno.'
        );
      }

      const parsed = data.recipe;
      const parsedTitle = (parsed.title || '').trim();
      if (!parsedTitle) {
        throw new Error('Naziv jela nije prepoznat na slici. Pokušajte s jasnijom fotografijom.');
      }

      const parsedCategory: CategoryId = parsed.category || 'slano';
      const parsedGroups: IngredientGroup[] = parsed.ingredientGroups || [];
      const flatIngNames = parsedGroups.flatMap((g) => g.items.map((i) => i.name));

      setTitle(parsedTitle);
      setSubtitle(parsed.subtitle || '');
      setCategory(parsedCategory);
      setSubcategory(parsed.subcategory || 'Glavna jela');
      setPrepTimeMinutes(Number(parsed.prepTimeMinutes ?? parsed.prepTime) || 20);
      setCookTimeMinutes(
        parsed.cookTimeMinutes !== undefined
          ? Number(parsed.cookTimeMinutes)
          : Number(parsed.cookTime) || 25
      );
      setServings(parsed.servings || parsed.panSize || parsed.panDimensions || '1 protvan');
      setPanDimensions(parsed.panDimensions || parsed.panSize || '');
      setOvenTemp(
        parsed.ovenTemp ||
          (parsed.oven?.temperature
            ? [parsed.oven.temperature, parsed.oven.notes].filter(Boolean).join(', ')
            : '')
      );
      setSecretTip(
        parsed.momSecret ||
          parsed.secretTip ||
          (parsed.momTips && parsed.momTips[0]) ||
          ''
      );
      setIngredientGroups(parsedGroups);
      setSteps(parsed.instructions || parsed.steps || []);
      setMomTips(parsed.momTips || (parsed.momSecret ? [parsed.momSecret] : []));
      setNormalizedNotes(parsed.normalizedNotes || []);

      // Stage 3: "Pripremam domaću AI fotografiju jela..."
      setAnalyzingStageIndex(2);
      const parsedSteps: string[] = parsed.instructions || parsed.steps || [];
      const ocrEnglishPrompt =
        typeof parsed.englishImagePrompt === 'string' ? parsed.englishImagePrompt.trim() : '';
      const fallbackPromptObj = buildAuthenticDishImagePrompt(
        parsedTitle,
        flatIngNames,
        parsedCategory,
        parsedSteps,
        ocrEnglishPrompt || undefined
      );
      const initialPrompt = ocrEnglishPrompt || fallbackPromptObj.englishPrompt;
      setEnglishImagePrompt(initialPrompt);

      let aiGeneratedDataUrl: string | null = null;
      let initialImgNotice: string | null = null;
      try {
        const imgRes = await fetch('/api/generate-recipe-image', {
          method: 'POST',
          headers: aiHeaders(),
          body: JSON.stringify({
            title: parsedTitle,
            ingredients: flatIngNames,
            steps: parsedSteps,
            category: parsedCategory,
            variationIndex: 0,
            englishPrompt: initialPrompt,
          }),
        });
        const imgData = await imgRes.json().catch(() => null);

        if (imgData?.englishPrompt && !ocrEnglishPrompt) {
          setEnglishImagePrompt(imgData.englishPrompt);
        }

        if (
          imgRes.ok &&
          imgData?.isAiGenerated &&
          typeof imgData?.imageDataUrl === 'string' &&
          imgData.imageDataUrl.startsWith('data:image/')
        ) {
          const compressed = await compressImageToWebPOrJpeg(imgData.imageDataUrl, 1600, 0.82);
          aiGeneratedDataUrl = compressed.dataUrl;
        } else {
          initialImgNotice =
            imgData?.infoMessage ||
            'Generiranje slika trenutačno nije podržano za ovaj API ključ. Koristi se izvorni rukopis.';
        }
      } catch {
        aiGeneratedDataUrl = null;
        initialImgNotice =
          'Generiranje slika trenutačno nije podržano za ovaj API ključ. Koristi se izvorni rukopis.';
      }

      if (aiGeneratedDataUrl) {
        setGeneratedDishImage(aiGeneratedDataUrl);
        setIsAiDishImageGenerated(true);
        setAiVariationIndex(1);
        setAiImageError(null);
      } else {
        // Fallback: use the captured handwritten manuscript photo (originalImage) as the cover image
        setGeneratedDishImage(activeScanUri);
        setIsAiDishImageGenerated(false);
        setAiVariationIndex(0);
        setAiImageError(initialImgNotice);
      }
      setStep('review');
    } catch (err: any) {
      const rawMsg = String(err?.message || '');
      const isQuotaErr =
        rawMsg.includes('429') ||
        rawMsg.includes('RESOURCE_EXHAUSTED') ||
        rawMsg.toLowerCase().includes('quota') ||
        rawMsg.includes('Iskorišten je besplatni dnevni limit');

      setOcrError(
        isQuotaErr
          ? 'Iskorišten je besplatni dnevni limit Gemini API-ja. Molimo pokušajte ponovo sutra ili postavite novi API ključ.'
          : rawMsg ||
              'Obrada rukopisa nije uspjela. Provjerite je li slika čitljiva ili pokušajte ponovno.'
      );
      setStep('capture');
    }
  };

  const handleRegenerateWizardAiImage = async (forceTranslate = false) => {
    if (isRegeneratingWizardAi) return;
    setIsRegeneratingWizardAi(true);
    setAiImageError(null);
    const nextVar = aiVariationIndex + 1;
    const flatIngNames = ingredientGroups.flatMap((g) => g.items.map((i) => i.name));
    const currentCustomPrompt = englishImagePrompt.trim();

    try {
      let nextUri: string | null = null;
      let regenNotice: string | null = null;
      try {
        const imgRes = await fetch('/api/generate-recipe-image', {
          method: 'POST',
          headers: aiHeaders(),
          body: JSON.stringify({
            title: title || 'Domaći recept',
            ingredients: flatIngNames,
            steps,
            category,
            variationIndex: nextVar,
            englishPrompt: currentCustomPrompt,
            forceTranslatePrompt: forceTranslate || currentCustomPrompt.length === 0,
          }),
        });
        const imgData = await imgRes.json().catch(() => null);

        if (
          imgData?.englishPrompt &&
          (forceTranslate || currentCustomPrompt.length === 0)
        ) {
          setEnglishImagePrompt(imgData.englishPrompt);
        }

        if (
          imgRes.ok &&
          imgData?.isAiGenerated &&
          typeof imgData?.imageDataUrl === 'string' &&
          imgData.imageDataUrl.startsWith('data:image/')
        ) {
          const compressed = await compressImageToWebPOrJpeg(imgData.imageDataUrl, 1600, 0.82);
          nextUri = compressed.dataUrl;
        } else {
          regenNotice =
            imgData?.infoMessage ||
            'Generiranje slika trenutačno nije podržano za ovaj API ključ. Koristi se izvorni rukopis.';
        }
      } catch {
        nextUri = null;
        regenNotice =
          'Generiranje slika trenutačno nije podržano za ovaj API ključ. Koristi se izvorni rukopis.';
      }

      if (nextUri) {
        setGeneratedDishImage(nextUri);
        setIsAiDishImageGenerated(true);
        setAiVariationIndex(nextVar);
        setAiImageError(null);
      } else {
        // Zadrži stvarnu fotografiju maminog rukopisa kao glavnu naslovnu sliku
        const manuscriptFallback =
          uploadedPages[0] ||
          createManuscriptScanDataUri({
            pageNumber: 'Novo',
            handwrittenTitle: title || 'Rukopis iz Mamine Teke',
            lines: rawHandwritingInput.split('\n').slice(0, 12),
            marginNote: secretTip || momTips[0] || 'Sačuvano u obiteljsku Teku',
          });
        setGeneratedDishImage(manuscriptFallback);
        setIsAiDishImageGenerated(false);
        setAiImageError(
          regenNotice ||
            'Generiranje slika trenutačno nije podržano za ovaj API ključ. Koristi se izvorni rukopis.'
        );
      }
    } finally {
      setIsRegeneratingWizardAi(false);
    }
  };

  const handleConfirmSave = () => {
    const finalTitle = title.trim() || 'Novi recept iz Mamine Teke';
    const manuscriptUri =
      uploadedPages[0] ||
      createManuscriptScanDataUri({
        pageNumber: 'Novo',
        handwrittenTitle: finalTitle,
        lines: rawHandwritingInput.split('\n').slice(0, 12),
        marginNote: secretTip || momTips[0] || 'Sačuvano u obiteljsku Teku',
      });

    const finalCoverImageUri =
      isAiDishImageGenerated && generatedDishImage ? generatedDishImage : manuscriptUri;

    const now = Date.now();
    const newRecipe: Recipe = {
      id: `recept-${now}`,
      title: finalTitle,
      subtitle: subtitle.trim() || 'Obiteljski recept iz mamine teke',
      category,
      subcategory,
      isFavorite: false,
      inCookSoon: true,
      cookSoonNote: 'Tek digitalizirano iz teke',
      prepTimeMinutes: Number(prepTimeMinutes) || 20,
      cookTimeMinutes: Number(cookTimeMinutes) >= 0 ? Number(cookTimeMinutes) : 25,
      servings: servings.trim() || panDimensions.trim() || '1 standardni protvan',
      panDimensions: panDimensions.trim() || 'Standardni protvan (35 × 25 cm)',
      ovenTemp: ovenTemp.trim(),
      secretTip: secretTip.trim() || momTips[0] || '',
      cookingLogs: [],
      imageStatus: isAiDishImageGenerated ? 'ai' : 'real',
      isAiGenerated: isAiDishImageGenerated,
      aiRegenCount: aiVariationIndex,
      englishImagePrompt:
        englishImagePrompt.trim() || generatedAiPrompt.englishPrompt,
      image: finalCoverImageUri,
      imageUrl: finalCoverImageUri,
      originalImage: manuscriptUri,
      originalScanUrl: manuscriptUri,
      originalHandwritingText: rawHandwritingInput,
      ingredientGroups,
      steps: steps.filter((s) => s.trim().length > 0),
      momTips: momTips.filter((t) => t.trim().length > 0),
      normalizedNotes,
      syncStatus: 'pending',
      updatedAt: now,
      createdAt: now,
      isDeleted: false,
      authorEmail: userEmail || 'mama@obitelj.hr',
    };

    onSaveRecipe(newRecipe);
  };

  const currentCategoryDef = CATEGORIES.find((c) => c.id === category) || CATEGORIES[0];
  const subcategoryOptions = Array.from(
    new Set([
      ...currentCategoryDef.subcategories,
      ...(subcategory ? [subcategory] : []),
    ])
  );
  const flatReviewIngredients = ingredientGroups.flatMap((g) => g.items.map((i) => i.name));
  const generatedAiPrompt = buildAuthenticDishImagePrompt(
    title || 'Domaći recept',
    flatReviewIngredients,
    category
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-wizard-title"
    >
      <div className="w-full max-w-5xl rounded-3xl bg-[#FAF6F0] border border-[#DFD3C3] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 bg-[#F3ECE1] border-b border-[#DFD3C3] shrink-0">
          <div>
            <span className="text-xs font-semibold text-[#9E3B24]">
              Čarobnjak za digitalizaciju rukopisa (AI Pipeline + WebP kompresija)
            </span>
            <h2 id="scan-wizard-title" className="font-display text-xl sm:text-2xl font-bold text-[#231F1D]">
              {step === 'capture' && '1. Snimi kamerom ili odaberi sliku stranice iz teke'}
              {step === 'analyzing' && '2. Čitanje rukopisa, provjera sastojaka i kalupa...'}
              {step === 'review' && '3. Pregledaj i spremi u Teku'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            aria-label="Zatvori čarobnjak za unos"
            className="p-2.5 rounded-xl text-[#655A52] hover:bg-[#EAE0D1] min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1">
          {ocrError && (
            <div
              role="alert"
              data-testid="ocr-error-banner"
              className="mb-6 rounded-2xl border-2 border-[#E6B8B5] bg-[#FDF2F2] p-4 flex items-start gap-3 text-sm text-[#7A1C14]"
            >
              <AlertTriangle className="w-5 h-5 text-[#B42318] shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold text-[#B42318]">
                  Greška pri čitanju rukopisa
                </div>
                <p className="mt-0.5 leading-relaxed">{ocrError}</p>
              </div>
              <button
                type="button"
                onClick={() => setOcrError(null)}
                aria-label="Zatvori obavijest o greški"
                className="p-1 rounded-lg text-[#7A1C14] hover:bg-[#F8D7D5] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 'capture' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left: Separate Camera & Gallery Upload + Dismissible Sample Selector */}
              <div className="lg:col-span-6 space-y-6">
                <div className="rounded-2xl border-2 border-dashed border-[#CBBBA4] bg-[#F3ECE1]/70 p-6 text-center">
                  {/* Dedicated Camera Input (capture="environment") */}
                  <input
                    ref={cameraCaptureInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleUploadFiles}
                    className="hidden"
                    id="scan-camera-capture-input"
                  />
                  {/* Dedicated Gallery Input (multiple, without capture) */}
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleUploadFiles}
                    className="hidden"
                    id="scan-gallery-file-input"
                  />

                  <Camera className="w-10 h-10 text-[#9E3B24] mx-auto mb-3" />
                  <h3 className="font-display text-lg font-bold text-[#231F1D]">
                    Slikaj stranicu mamine teke ili odaberi iz galerije
                  </h3>
                  <p className="text-sm text-[#655A52] mt-1 mb-4">
                    Svaka fotografija automatski se komprimira u oštri WebP (maks. 1600 px, ~200 KB) za trenutni rad bez trošenja memorije.
                  </p>

                  {isCameraOpen ? (
                    <div className="space-y-3 bg-[#231F1D] p-3.5 rounded-2xl border border-[#DFD3C3]">
                      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-black">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          data-testid="capture-snapshot-btn"
                          onClick={handleTakeCameraSnapshot}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#9E3B24] px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-[#842F1B] min-h-[42px] cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Okini fotografiju</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            stopCameraStream();
                            cameraCaptureInputRef.current?.click();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2.5 text-xs font-semibold text-white hover:bg-white/25 min-h-[42px] cursor-pointer"
                        >
                          <span>Sistemska kamera mobitela</span>
                        </button>
                        <button
                          type="button"
                          onClick={stopCameraStream}
                          className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2.5 text-xs font-semibold text-[#EADBC6] hover:bg-white/20 min-h-[42px] cursor-pointer"
                        >
                          <span>Zatvori kameru</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
                      <button
                        type="button"
                        data-testid="open-camera-btn"
                        onClick={handleOpenCamera}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#9E3B24] px-4 py-3 text-sm font-bold text-white hover:bg-[#842F1B] transition-colors min-h-[46px] cursor-pointer"
                      >
                        <Camera className="w-4 h-4 shrink-0" />
                        <span>Otvori kameru (Slikaj)</span>
                      </button>

                      <button
                        type="button"
                        data-testid="open-gallery-btn"
                        onClick={() => galleryInputRef.current?.click()}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#231F1D] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3A3330] transition-colors min-h-[46px] cursor-pointer"
                      >
                        <ImageIcon className="w-4 h-4 shrink-0" />
                        <span>Odaberi sliku iz galerije</span>
                      </button>
                    </div>
                  )}

                  {cameraError && (
                    <p className="mt-2 text-xs text-[#B42318] font-medium">{cameraError}</p>
                  )}

                  {compressionStats && (
                    <div className="mt-3 text-xs font-mono-tabular font-semibold text-[#4A5D3F]">
                      ✓ {compressionStats}
                    </div>
                  )}

                  {uploadedPages.length > 0 && (
                    <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
                      {uploadedPages.map((src, idx) => (
                        <div key={idx} className="relative w-20 h-24 rounded-lg overflow-hidden border border-[#CBBBA4]">
                          <img
                            src={src}
                            alt={`Stranica ${idx + 1}`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setUploadedPages((p) => p.filter((_, i) => i !== idx))}
                            aria-label={`Ukloni stranicu ${idx + 1}`}
                            className="absolute top-1 right-1 bg-black/70 text-white rounded p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ready-to-test sample pages from Mom's notebook (Permanently dismissible) */}
                {!samplesHidden && (
                  <div
                    data-testid="sample-manuscripts-section"
                    className="rounded-2xl border border-[#DFD3C3] bg-[#F3ECE1]/45 p-4"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <h4 className="text-xs font-bold text-[#655A52]">
                        Isprobaj odmah na oglednom listu iz bilježnice:
                      </h4>
                      <button
                        type="button"
                        data-testid="dismiss-sample-manuscripts-btn"
                        onClick={handleDismissSampleManuscripts}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#EAE0D1] hover:bg-[#DFD3C3] px-2.5 py-1 text-[11px] font-bold text-[#5A4F47] hover:text-[#B42318] transition-colors cursor-pointer"
                        title="Trajno ukloni ogledne primjere (neće se više prikazivati)"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Ukloni zauvijek</span>
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      {SAMPLE_MANUSCRIPTS.map((sample) => {
                        const isSelected = selectedSampleId === sample.id;
                        return (
                          <button
                            key={sample.id}
                            type="button"
                            onClick={() => handleSelectSample(sample)}
                            className={`w-full text-left p-3.5 rounded-2xl border transition-colors flex items-start justify-between gap-3 cursor-pointer ${
                              isSelected
                                ? 'bg-[#FAF6F0] border-2 border-[#9E3B24] shadow-xs'
                                : 'bg-[#FAF6F0]/60 border-[#DFD3C3] hover:bg-[#FAF6F0]'
                            }`}
                          >
                            <div>
                              <div className="font-semibold text-sm text-[#231F1D]">
                                {sample.label}
                              </div>
                              <div className="text-xs text-[#655A52] mt-0.5">
                                {sample.era}
                              </div>
                            </div>
                            {isSelected && (
                              <span className="text-xs font-bold text-[#9E3B24] shrink-0">
                                Odabrano
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Preview of Manuscript & Optional Text Input */}
              <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
                <div>
                  <label
                    htmlFor="handwriting-transcription-input"
                    className="block text-sm font-bold text-[#231F1D] mb-1.5"
                  >
                    Tekst sa stranice (ili dopišite bilješku s margine)
                  </label>
                  <p className="text-xs text-[#655A52] mb-2">
                    Sustav automatski pretvara starinske mjere („frtalj kile” → 250 g), prevodi „umjerenu vatru” u ~180 °C, procjenjuje dimenzije protvana i provjerava jesu li svi sastojci iz postupka na popisu.
                  </p>
                  <textarea
                    id="handwriting-transcription-input"
                    rows={10}
                    value={rawHandwritingInput}
                    onChange={(e) => setRawHandwritingInput(e.target.value)}
                    className="w-full rounded-2xl border border-[#D5C7B4] bg-white p-4 text-sm text-[#231F1D] leading-relaxed focus:outline-none focus:border-[#9E3B24]"
                    placeholder="Upišite ili zalijepite tekst recepta iz mamine teke (ili slikajte stranicu lijevo)..."
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      stopCameraStream();
                      onClose();
                    }}
                    className="px-4 py-3 rounded-xl border border-[#DFD3C3] text-sm font-semibold text-[#5A4F47] hover:bg-[#EFE6D8] min-h-[48px] cursor-pointer"
                  >
                    Odustani
                  </button>
                  <button
                    type="button"
                    onClick={handleRunAiPipeline}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#9E3B24] px-6 py-3 text-sm font-bold text-white hover:bg-[#842F1B] transition-colors min-h-[48px] cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Pročitaj rukopis i uredi mjere</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'analyzing' && (
            <div className="py-16 text-center max-w-md mx-auto space-y-5">
              <Loader2 className="w-12 h-12 text-[#9E3B24] animate-spin mx-auto" />
              <h3 className="font-display text-2xl font-bold text-[#231F1D]">
                {analyzingStageIndex === 0 && 'Čitam mamin rukopis...'}
                {analyzingStageIndex === 1 && 'Slaganje sastojaka i mjera...'}
                {analyzingStageIndex === 2 && 'Pripremam domaću AI fotografiju jela...'}
              </h3>
              <ul className="text-sm text-[#5A4F47] space-y-2.5 text-left bg-[#F3ECE1] p-5 rounded-2xl border border-[#DFD3C3]">
                <li className={`flex items-center gap-2.5 ${analyzingStageIndex >= 0 ? 'font-bold text-[#231F1D]' : 'opacity-60'}`}>
                  <span className="text-[#9E3B24]">{analyzingStageIndex > 0 ? '✓' : '1.'}</span>
                  <span>Čitam mamin rukopis...</span>
                </li>
                <li className={`flex items-center gap-2.5 ${analyzingStageIndex >= 1 ? 'font-bold text-[#231F1D]' : 'opacity-60'}`}>
                  <span className="text-[#9E3B24]">{analyzingStageIndex > 1 ? '✓' : '2.'}</span>
                  <span>Slaganje sastojaka i mjera („frtalj kile” → 250 g)...</span>
                </li>
                <li className={`flex items-center gap-2.5 ${analyzingStageIndex >= 2 ? 'font-bold text-[#9E3B24]' : 'opacity-60'}`}>
                  <span className="text-[#9E3B24]">3.</span>
                  <span>Pripremam domaću AI fotografiju jela...</span>
                </li>
              </ul>
            </div>
          )}

          {step === 'review' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Side: Generated AI Dish Photo, Original Manuscript Image, Normalized Measure Log & English Prompt */}
              <div className="lg:col-span-5 space-y-5">
                {generatedDishImage && (
                  <div className="rounded-2xl border border-[#DFD3C3] bg-white p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-bold text-[#231F1D]">
                        {isAiDishImageGenerated
                          ? 'Generirana AI fotografija jela'
                          : 'Naslovna slika: Izvorni rukopis'}
                      </h3>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-[#231F1D] text-[#FAF6F0]">
                        {isAiDishImageGenerated ? '✨ AI slika' : '📜 Izvorni rukopis'}
                      </span>
                    </div>
                    <img
                      src={generatedDishImage}
                      alt={title || 'Naslovna slika recepta'}
                      referrerPolicy="no-referrer"
                      className="w-full h-44 object-cover rounded-xl border border-[#D5C7B4]"
                    />
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        data-testid="wizard-regenerate-ai-btn"
                        onClick={() => handleRegenerateWizardAiImage(false)}
                        disabled={isRegeneratingWizardAi}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#9E3B24] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#842F1B] transition-colors cursor-pointer disabled:opacity-60"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${isRegeneratingWizardAi ? 'animate-spin' : ''}`}
                        />
                        <span>
                          {isRegeneratingWizardAi
                            ? 'Generiram...'
                            : isAiDishImageGenerated
                              ? 'Nova AI slika'
                              : 'Generiraj AI sliku'}
                        </span>
                      </button>
                      {isAiDishImageGenerated && (
                        <button
                          type="button"
                          onClick={() => {
                            const manuscriptUri =
                              uploadedPages[0] || SAMPLE_MANUSCRIPTS[0].scanDataUri;
                            setGeneratedDishImage(manuscriptUri);
                            setIsAiDishImageGenerated(false);
                          }}
                          className="text-xs font-semibold text-[#655A52] hover:underline cursor-pointer"
                        >
                          Koristi sliku rukopisa
                        </button>
                      )}
                    </div>
                    {aiImageError && (
                      <div
                        role="status"
                        data-testid="wizard-ai-image-notice"
                        className="mt-2 rounded-xl border border-[#DFD3C3] bg-[#F3ECE1] px-3 py-2 text-xs font-medium text-[#5A4F47]"
                      >
                        {aiImageError}
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-2xl border border-[#DFD3C3] bg-[#F3ECE1] p-4">
                  <h3 className="text-xs font-bold text-[#655A52] mb-2">
                    Izvorni rukopis (ostaje trajno sačuvan uz recept)
                  </h3>
                  <img
                    src={
                      uploadedPages[0] ||
                      SAMPLE_MANUSCRIPTS.find((s) => s.id === selectedSampleId)?.scanDataUri ||
                      SAMPLE_MANUSCRIPTS[0].scanDataUri
                    }
                    alt="Skenirani rukopis iz teke"
                    referrerPolicy="no-referrer"
                    className="w-full h-auto rounded-xl border border-[#D5C7B4]"
                  />
                </div>

                {normalizedNotes.length > 0 && (
                  <div className="rounded-2xl border border-[#DFD3C3] bg-[#FAF6F0] p-4">
                    <h4 className="text-xs font-bold text-[#4A5D3F] mb-2">
                      Automatski normalizirane mjere i Sanity Check:
                    </h4>
                    <ul className="space-y-1 text-xs font-mono-tabular text-[#231F1D]">
                      {normalizedNotes.map((n, i) => (
                        <li key={i}>✓ {n}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-2xl border border-[#DFD3C3] bg-white p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="wizard-english-prompt-textarea"
                      className="text-xs font-bold text-[#9E3B24]"
                    >
                      AI Prompt Generator (Engleski kulinarski prijevod):
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRegenerateWizardAiImage(true)}
                      disabled={isRegeneratingWizardAi}
                      className="text-[11px] font-semibold text-[#9E3B24] hover:underline cursor-pointer disabled:opacity-50"
                      title="Ponovno prevedi naziv jela, kategoriju i sastojke u engleski opis pomoću AI modela"
                    >
                      Prevedi ponovno (AI)
                    </button>
                  </div>
                  <p className="text-[11px] text-[#655A52]">
                    Možete slobodno urediti engleski opis jela prije klika na „Generiraj AI sliku”:
                  </p>
                  <textarea
                    id="wizard-english-prompt-textarea"
                    data-testid="wizard-english-prompt-textarea"
                    rows={3}
                    value={englishImagePrompt}
                    onChange={(e) => setEnglishImagePrompt(e.target.value)}
                    placeholder="e.g. Traditional walnut roll cake, powdered sugar, sliced on vintage plate..."
                    className="w-full rounded-xl border border-[#D5C7B4] bg-[#FAF6F0] p-2.5 text-xs font-mono text-[#231F1D] leading-relaxed focus:outline-none focus:border-[#9E3B24]"
                  />
                </div>
              </div>

              {/* Right Side: Structured & Editable Fields */}
              <div className="lg:col-span-7 space-y-5">
                <div className="rounded-2xl border border-[#DFD3C3] bg-white p-5 space-y-4">
                  <div>
                    <label htmlFor="review-recipe-title" className="block text-xs font-bold text-[#655A52] mb-1">
                      Naziv recepta
                    </label>
                    <input
                      id="review-recipe-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full rounded-xl border border-[#D5C7B4] px-3.5 py-2.5 font-display text-lg font-bold text-[#231F1D]"
                    />
                  </div>

                  <div>
                    <label htmlFor="review-recipe-subtitle" className="block text-xs font-bold text-[#655A52] mb-1">
                      Kratki opis
                    </label>
                    <input
                      id="review-recipe-subtitle"
                      type="text"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      className="w-full rounded-xl border border-[#D5C7B4] px-3.5 py-2 text-sm text-[#231F1D]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="review-pan-dimensions" className="block text-xs font-bold text-[#9E3B24] mb-1">
                        Dimenzije protvana / kalupa (obavezno polje)
                      </label>
                      <input
                        id="review-pan-dimensions"
                        type="text"
                        value={panDimensions}
                        onChange={(e) => setPanDimensions(e.target.value)}
                        className="w-full rounded-xl border border-[#D5C7B4] px-3 py-2 text-sm font-semibold text-[#231F1D]"
                      />
                    </div>

                    <div>
                      <label htmlFor="review-oven" className="block text-xs font-bold text-[#655A52] mb-1">
                        Pećnica / Režim (prevedeno u °C)
                      </label>
                      <input
                        id="review-oven"
                        type="text"
                        value={ovenTemp}
                        onChange={(e) => setOvenTemp(e.target.value)}
                        className="w-full rounded-xl border border-[#D5C7B4] px-3 py-2 text-sm text-[#231F1D]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="review-category" className="block text-xs font-bold text-[#655A52] mb-1">
                        Polica (Kategorija)
                      </label>
                      <select
                        id="review-category"
                        value={category}
                        onChange={(e) => {
                          const newCat = e.target.value as CategoryId;
                          setCategory(newCat);
                          const def = CATEGORIES.find((c) => c.id === newCat);
                          if (def && def.subcategories[0]) {
                            setSubcategory(def.subcategories[0]);
                          }
                        }}
                        className="w-full rounded-xl border border-[#D5C7B4] px-3 py-2 text-sm text-[#231F1D] bg-white"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="review-subcategory" className="block text-xs font-bold text-[#655A52] mb-1">
                        Podkategorija
                      </label>
                      <select
                        id="review-subcategory"
                        value={subcategory}
                        onChange={(e) => setSubcategory(e.target.value)}
                        className="w-full rounded-xl border border-[#D5C7B4] px-3 py-2 text-sm text-[#231F1D] bg-white"
                      >
                        {subcategoryOptions.map((sub) => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Yellow Post-it Secret Tip Field */}
                  <div className="rounded-xl bg-[#FFF7C2] border border-[#E6D073] p-3.5">
                    <label htmlFor="review-secret-tip" className="block text-xs font-bold text-[#7A5210] mb-1">
                      Mamina tajna (žuti Post-it na vrhu recepta)
                    </label>
                    <input
                      id="review-secret-tip"
                      type="text"
                      value={secretTip}
                      onChange={(e) => setSecretTip(e.target.value)}
                      className="w-full rounded-lg border border-[#D4B84A] bg-white/90 px-3 py-2 text-sm text-[#231F1D]"
                    />
                  </div>

                  {/* Ingredient Groups Preview */}
                  <div>
                    <span className="block text-xs font-bold text-[#655A52] mb-2">
                      Prepoznati sastojci po fazama (Biskvit / Krema / Glazura)
                    </span>
                    <div className="space-y-3 bg-[#FAF6F0] p-4 rounded-xl border border-[#E5DAC8]">
                      {ingredientGroups.map((group, gIdx) => (
                        <div key={gIdx}>
                          <div className="text-xs font-bold text-[#9E3B24] mb-1">
                            {group.groupTitle}
                          </div>
                          <ul className="space-y-1 text-sm">
                            {group.items.map((item) => (
                              <li key={item.id} className="flex items-center justify-between gap-2">
                                <span>{item.name}</span>
                                <span className="font-mono-tabular font-bold">
                                  {item.amount !== null ? `${item.amount} ${item.unit}` : item.unit}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Steps Preview & Edit */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-[#655A52]">
                        Koraci pripreme ({steps.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setSteps((s) => [...s, 'Novi korak pripreme...'])}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#9E3B24] cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Dodaj korak
                      </button>
                    </div>
                    <div className="space-y-2">
                      {steps.map((st, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-xs font-bold text-[#9E3B24] pt-2 w-5">
                            {idx + 1}.
                          </span>
                          <textarea
                            rows={2}
                            value={st}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSteps((prev) => prev.map((p, i) => (i === idx ? val : p)));
                            }}
                            aria-label={`Korak ${idx + 1}`}
                            className="flex-1 rounded-xl border border-[#D5C7B4] p-2.5 text-sm text-[#231F1D]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('capture')}
                    className="px-4 py-3 rounded-xl border border-[#DFD3C3] text-sm font-semibold text-[#5A4F47] hover:bg-[#EFE6D8] min-h-[48px] cursor-pointer"
                  >
                    ← Natrag na rukopis
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmSave}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#9E3B24] px-6 py-3.5 text-base font-bold text-white hover:bg-[#842F1B] transition-colors min-h-[50px] cursor-pointer"
                  >
                    <Check className="w-5 h-5" />
                    <span>Spremi u Teku</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
