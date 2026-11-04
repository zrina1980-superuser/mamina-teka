import React, { useEffect, useRef, useState } from 'react';

interface SplashProps {
  onFinish: () => void;
  durationMs?: number;
}

/**
 * Uvodni Splash zaslon (Splash.tsx)
 * Prikazuje pripremljenu sliku /splash.png centriranu na ekranu
 * s ugodnom pozadinom boje vanilije (#FAF7F2), uz blagi fade-out prijelaz.
 */
export const Splash: React.FC<SplashProps> = ({
  onFinish,
  durationMs = 1400,
}) => {
  const [fadingOut, setFadingOut] = useState(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    const safeDuration = Math.max(600, durationMs);
    const fadeTimer = window.setTimeout(() => {
      setFadingOut(true);
    }, Math.max(300, safeDuration - 350));

    const doneTimer = window.setTimeout(() => {
      onFinishRef.current();
    }, safeDuration);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [durationMs]);

  return (
    <div
      role="dialog"
      aria-label="Mamina Teka — uvodni zaslon"
      onClick={() => onFinishRef.current()}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FAF7F2] dark:bg-[#181514] p-4 sm:p-6 transition-opacity duration-300 cursor-pointer select-none ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <img
        src="/splash.png"
        alt="Mamina Teka — obiteljski trezor recepata"
        className="w-auto h-auto max-h-[82vh] max-w-[92vw] object-contain rounded-[28px] shadow-2xl"
      />
      <span className="mt-3 text-xs font-semibold text-[#655A52] dark:text-[#C5B8AA] tracking-wide">
        Otvaranje Mamine Teke… (dodirni za preskakanje)
      </span>
    </div>
  );
};

export const AppIconEmblem: React.FC<{ className?: string }> = ({
  className = 'w-9 h-9 rounded-xl',
}) => (
  <img
    src="/icon.png"
    alt="Mamina Teka ikona"
    className={`${className} object-cover select-none`}
  />
);
