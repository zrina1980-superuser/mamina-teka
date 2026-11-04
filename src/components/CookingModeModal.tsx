import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Sun,
  UtensilsCrossed,
  Check,
} from 'lucide-react';
import {
  parseStepTimers,
  formatTimerSeconds,
  scaleIngredientWithSugarOption,
  type Recipe,
} from '../utils/recipeLogic';

interface ActiveTimer {
  id: string;
  label: string;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  isFinished: boolean;
}

interface CookingModeModalProps {
  recipe: Recipe;
  multiplier: number;
  lessSweet?: boolean;
  onClose: () => void;
}

function playKitchenAlarmSound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [587.33, 783.99, 1046.5, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.22);
      gain.gain.setValueAtTime(0.25, ctx.currentTime + idx * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.22 + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.22);
      osc.stop(ctx.currentTime + idx * 0.22 + 0.21);
    });
  } catch {
    // Ignore audio context restrictions
  }
}

export const CookingModeModal: React.FC<CookingModeModalProps> = ({
  recipe,
  multiplier,
  lessSweet = false,
  onClose,
}) => {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [timers, setTimers] = useState<ActiveTimer[]>([]);
  const [showIngredientsModal, setShowIngredientsModal] = useState(false);
  const wakeLockRef = useRef<any>(null);

  // Touch Swipe tracking refs
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const totalSteps = Math.max(1, recipe.steps.length);

  // Screen Wake Lock (prevents phone from sleeping during cooking)
  useEffect(() => {
    async function acquireWakeLock() {
      try {
        if ('wakeLock' in navigator && (navigator as any).wakeLock) {
          if (wakeLockRef.current) {
            try {
              await wakeLockRef.current.release();
            } catch {
              // ignore
            }
          }
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch {
        // wakeLock not supported or denied
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        acquireWakeLock();
      }
    };

    acquireWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current && typeof wakeLockRef.current.release === 'function') {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  // Hardware Volume Keys (+/-) & Arrow Keys navigation with e.preventDefault()
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isNext =
        e.key === 'AudioVolumeUp' ||
        e.code === 'AudioVolumeUp' ||
        e.key === 'VolumeUp' ||
        e.code === 'VolumeUp' ||
        e.key === 'ArrowRight' ||
        e.key === 'PageDown';

      const isPrev =
        e.key === 'AudioVolumeDown' ||
        e.code === 'AudioVolumeDown' ||
        e.key === 'VolumeDown' ||
        e.code === 'VolumeDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'PageUp';

      if (isNext) {
        e.preventDefault();
        setCurrentStepIdx((i) => Math.min(totalSteps - 1, i + 1));
      } else if (isPrev) {
        e.preventDefault();
        setCurrentStepIdx((i) => Math.max(0, i - 1));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (showIngredientsModal) {
          setShowIngredientsModal(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalSteps, showIngredientsModal, onClose]);

  // Touch Swipe Handlers (Swipe left for next, swipe right for previous)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartXRef.current;
    const deltaY = touchEndY - touchStartYRef.current;

    // Trigger only if horizontal swipe dominates vertical movement
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      if (deltaX < 0) {
        // Swiped Left -> Next Step
        setCurrentStepIdx((i) => Math.min(totalSteps - 1, i + 1));
      } else {
        // Swiped Right -> Previous Step
        setCurrentStepIdx((i) => Math.max(0, i - 1));
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  // Timer Tick Interval
  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimers((prev) =>
        prev.map((t) => {
          if (!t.isRunning || t.isFinished) return t;
          if (t.remainingSeconds <= 1) {
            playKitchenAlarmSound();
            return {
              ...t,
              remainingSeconds: 0,
              isRunning: false,
              isFinished: true,
            };
          }
          return {
            ...t,
            remainingSeconds: t.remainingSeconds - 1,
          };
        })
      );
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const startTimerFromText = (label: string, durationSeconds: number, stepNum: number) => {
    const timerLabel = `K${stepNum}: ${label}`;
    setTimers((prev) => {
      const existing = prev.find((t) => t.label === timerLabel);
      if (existing) {
        return prev.map((t) =>
          t.id === existing.id
            ? { ...t, remainingSeconds: durationSeconds, isRunning: true, isFinished: false }
            : t
        );
      }
      return [
        ...prev,
        {
          id: `timer-${Date.now()}-${Math.random()}`,
          label: timerLabel,
          totalSeconds: durationSeconds,
          remainingSeconds: durationSeconds,
          isRunning: true,
          isFinished: false,
        },
      ];
    });
  };

  const toggleTimer = (id: string) => {
    setTimers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isRunning: !t.isRunning, isFinished: false } : t))
    );
  };

  const resetTimer = (id: string) => {
    setTimers((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, remainingSeconds: t.totalSeconds, isRunning: false, isFinished: false }
          : t
      )
    );
  };

  const removeTimer = (id: string) => {
    setTimers((prev) => prev.filter((t) => t.id !== id));
  };

  // Parse step text into interactive timer badges if applicable
  const renderStepWithClickableTimers = (stepText: string, stepIndex: number) => {
    const segments = parseStepTimers(stepText);
    return segments.map((seg, idx) => {
      if (seg.type === 'timer' && seg.durationSeconds) {
        return (
          <button
            key={idx}
            type="button"
            onClick={() =>
              startTimerFromText(seg.label || seg.text, seg.durationSeconds!, stepIndex + 1)
            }
            className="inline-flex items-center gap-1.5 mx-1 px-2.5 py-0.5 rounded-lg bg-[#9E3B24]/12 text-[#9E3B24] font-bold underline decoration-2 decoration-[#9E3B24] underline-offset-4 hover:bg-[#9E3B24] hover:text-white transition-colors cursor-pointer"
            title={`Pokreni kuhinjski alarm: ${seg.text}`}
          >
            <Timer className="w-5 h-5 shrink-0 inline" />
            <span>{seg.text}</span>
          </button>
        );
      }
      return <span key={idx}>{seg.text}</span>;
    });
  };

  const currentStepText = recipe.steps[currentStepIdx] || 'Uživajte u pripremi jela!';

  // Mom's secret tip (only display inside card if relevant for this step / recipe)
  const currentStepSecret =
    (recipe.momTips && recipe.momTips[currentStepIdx]) ||
    recipe.secretTip ||
    (currentStepIdx === 0 && recipe.momTips && recipe.momTips[0]) ||
    null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#FAF7F2] dark:bg-[#181514] text-stone-900 dark:text-stone-100 h-[100dvh] max-h-[100dvh] flex flex-col justify-between overflow-hidden p-3.5 sm:p-5 select-none"
      role="dialog"
      aria-modal="true"
      aria-label={`Način za pripremu: ${recipe.title}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 1. ČISTO, JEDNOLINIJSKO ZAGLAVLJE */}
      <header className="shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-3">
          {/* Naziv jela s malom ikonom ☀️ u jednoj liniji */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Sun className="w-4 h-4 text-[#D99441] shrink-0" />
            <h2 className="font-display text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 truncate">
              {recipe.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Gumb "Sastojci" (otvara brzi pregled) */}
            <button
              type="button"
              onClick={() => setShowIngredientsModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F3ECE1] dark:bg-[#24201E] border border-[#D5C7B4] dark:border-stone-700 text-xs font-bold text-stone-900 dark:text-stone-100 hover:bg-[#EAE0D1] dark:hover:bg-stone-800 min-h-[42px] cursor-pointer"
            >
              <UtensilsCrossed className="w-3.5 h-3.5 text-[#9E3B24]" />
              <span>Sastojci</span>
            </button>

            {/* Gumb "✕" za izlaz */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Zatvori način za pripremu"
              className="w-10 h-10 rounded-xl bg-[#231F1D] dark:bg-stone-800 text-[#FAF6F0] flex items-center justify-center hover:bg-[#3A3330] dark:hover:bg-stone-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tanka linija napretka ("Korak X od Y") */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-[#9E3B24]">
            <span>
              Korak {currentStepIdx + 1} od {totalSteps}
            </span>
            <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-400">
              {recipe.panDimensions || (recipe.ovenTemp ? `Pećnica: ${recipe.ovenTemp}` : '')}
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#E6D9C6] dark:bg-stone-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#9E3B24] transition-all duration-300 rounded-full"
              style={{
                width: `${((currentStepIdx + 1) / totalSteps) * 100}%`,
              }}
            />
          </div>
        </div>
      </header>

      {/* 2. KARTICA KORAKA (Sredina ekrana – velika, čitka s metra, bez skrolanja) */}
      <main className="flex-1 flex flex-col justify-center min-h-0 my-3">
        <div className="rounded-3xl bg-white dark:bg-[#24201E] border-2 border-[#E2D6C3] dark:border-stone-700 p-5 sm:p-8 shadow-sm flex flex-col justify-between max-h-full overflow-hidden">
          {/* Veliki, krupni tekst koraka (20–24px na mobitelu, bold) */}
          <div className="flex-1 flex items-center justify-center text-center sm:text-left overflow-y-auto">
            <p className="text-xl sm:text-2xl md:text-3xl font-bold leading-relaxed sm:leading-loose text-stone-900 dark:text-stone-100">
              {renderStepWithClickableTimers(currentStepText, currentStepIdx)}
            </p>
          </div>

          {/* Mamina tajna (žuti post-it na dnu unutar kartice – samo ako postoji za ovaj korak/recept) */}
          {currentStepSecret && (
            <div className="mt-4 rounded-xl bg-[#FFF7C2] border border-[#E6D073] p-3 text-xs sm:text-sm text-[#5C4112] dark:text-[#F7E8A4] flex items-start gap-2 shadow-2xs shrink-0">
              <span className="font-bold text-[#9E3B24] shrink-0">💡 Mamina tajna:</span>
              <span className="italic leading-snug">„{currentStepSecret}”</span>
            </div>
          )}
        </div>
      </main>

      {/* 3. AKTIVNI TAJMERI (Ako postoje – kompaktna traka iznad navigacije) */}
      {timers.length > 0 && (
        <div className="mb-2 shrink-0 bg-[#231F1D] text-[#FAF6F0] rounded-2xl p-2.5 px-3 flex items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-2 min-w-0">
            <Timer className="w-4 h-4 text-[#D99441] shrink-0 animate-pulse" />
            <div className="min-w-0">
              <div className="text-[11px] text-[#D5C7B4] truncate">
                {timers[0].label}
              </div>
              <div className="font-mono-tabular text-sm font-bold text-white">
                {timers[0].isFinished
                  ? 'VRIJEME JE ISTEKLO!'
                  : formatTimerSeconds(timers[0].remainingSeconds)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!timers[0].isFinished && (
              <button
                type="button"
                onClick={() => toggleTimer(timers[0].id)}
                className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white min-h-[34px] min-w-[34px] flex items-center justify-center cursor-pointer"
                title={timers[0].isRunning ? 'Pauziraj' : 'Pokreni'}
              >
                {timers[0].isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => resetTimer(timers[0].id)}
              className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white min-h-[34px] min-w-[34px] flex items-center justify-center cursor-pointer"
              title="Ponovi"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => removeTimer(timers[0].id)}
              className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white min-h-[34px] min-w-[34px] flex items-center justify-center cursor-pointer"
              title="Ukloni tajmer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 4. DNO EKRANA: DVA VELIKA FIKSNA GUMBA ([ < Natrag ] 30% i [ Naprijed > ] 70%) */}
      <footer className="shrink-0 flex items-center gap-2.5 sm:gap-4">
        {/* [ < Natrag ] – 30% širine */}
        <button
          type="button"
          disabled={currentStepIdx === 0}
          onClick={() => setCurrentStepIdx((i) => Math.max(0, i - 1))}
          className="w-[30%] flex items-center justify-center gap-1.5 rounded-2xl border-2 border-[#D5C7B4] dark:border-stone-700 bg-[#F3ECE1] dark:bg-[#24201E] py-4 px-3 text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 disabled:opacity-35 hover:bg-[#E6D9C6] dark:hover:bg-stone-800 transition-colors min-h-[58px] sm:min-h-[64px] cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-6 h-6 shrink-0" />
          <span>Natrag</span>
        </button>

        {/* [ Naprijed > ] – 70% širine (terakota boja #9E3B24) */}
        {currentStepIdx < totalSteps - 1 ? (
          <button
            type="button"
            onClick={() => setCurrentStepIdx((i) => Math.min(totalSteps - 1, i + 1))}
            className="w-[70%] flex items-center justify-center gap-2 rounded-2xl bg-[#9E3B24] py-4 px-4 text-base sm:text-lg font-bold text-white hover:bg-[#842F1B] active:bg-[#722716] transition-colors min-h-[58px] sm:min-h-[64px] shadow-sm cursor-pointer"
          >
            <span>Naprijed</span>
            <ChevronRight className="w-6 h-6 shrink-0" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="w-[70%] flex items-center justify-center gap-2 rounded-2xl bg-[#4A5D3F] py-4 px-4 text-base sm:text-lg font-bold text-white hover:bg-[#3D4D34] transition-colors min-h-[58px] sm:min-h-[64px] shadow-sm cursor-pointer"
          >
            <Check className="w-6 h-6 shrink-0" />
            <span>Gotovo kuhanje!</span>
          </button>
        )}
      </footer>

      {/* 5. MODAL ZA PREGLED SASTOJAKA */}
      {showIngredientsModal && (
        <div
          className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ingredients-modal-title"
          onClick={() => setShowIngredientsModal(false)}
        >
          <div
            className="max-w-lg w-full max-h-[85vh] bg-[#FAF7F2] dark:bg-[#24201E] rounded-3xl border border-[#D5C7B4] dark:border-stone-700 p-5 sm:p-6 flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DAC8] dark:border-stone-700 shrink-0">
              <div>
                <span className="text-xs font-bold text-[#9E3B24]">
                  Mjera: {multiplier === 0.5 ? 'Pola mjere (0.5×)' : multiplier === 2 ? 'Dupla mjera (2×)' : 'Standardna (1×)'}
                  {lessSweet ? ' • Malo manje slatko' : ''}
                </span>
                <h3 id="ingredients-modal-title" className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
                  Sastojci za pripremu
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIngredientsModal(false)}
                aria-label="Zatvori sastojke"
                className="w-9 h-9 rounded-xl bg-[#F3ECE1] dark:bg-stone-800 text-stone-900 dark:text-stone-100 flex items-center justify-center hover:bg-[#EAE0D1] dark:hover:bg-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {recipe.ingredientGroups.map((group, gIdx) => (
                <div key={gIdx} className="space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#9E3B24]">
                    {group.groupTitle}
                  </h4>
                  <ul className="space-y-1.5">
                    {group.items.map((item) => {
                      const scaled = scaleIngredientWithSugarOption(item, multiplier, lessSweet);
                      return (
                        <li
                          key={item.id}
                          className="flex items-baseline justify-between gap-3 text-sm border-b border-[#EADFCF] dark:border-stone-800 pb-1.5"
                        >
                          <span className="text-stone-900 dark:text-stone-100">{item.name}</span>
                          <span className="font-mono-tabular font-bold text-stone-900 dark:text-stone-100 shrink-0">
                            {scaled.displayAmount}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowIngredientsModal(false)}
              className="w-full mt-2 py-3 rounded-2xl bg-[#9E3B24] text-white text-sm font-bold hover:bg-[#842F1B] transition-colors cursor-pointer shrink-0"
            >
              Natrag na kuhanje
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
