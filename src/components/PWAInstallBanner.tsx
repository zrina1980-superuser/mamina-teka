import React, { useEffect, useState } from 'react';
import { Download, WifiOff, Share, X, Check } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="no-print fixed bottom-20 lg:bottom-6 right-4 z-50 flex items-center gap-2.5 rounded-xl bg-[#231F1D] px-4 py-2.5 text-xs font-medium text-[#FAF6F0] shadow-lg border border-[#3E3632]"
    >
      <WifiOff className="w-4 h-4 text-[#D99441] shrink-0" />
      <span>Rad bez interneta — svi recepti iz Teke su dostupni</span>
    </div>
  );
};

export const PWAInstallCard: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  if (isInstalled) {
    if (compact) return null;
    return (
      <div className="flex items-center gap-2 text-xs text-[#4A5D3F] font-medium">
        <Check className="w-4 h-4 shrink-0" />
        <span>Teka je instalirana na ovaj uređaj</span>
      </div>
    );
  }

  const handleTrigger = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={handleTrigger}
          className="inline-flex items-center gap-2 rounded-xl border border-[#DFD3C3] bg-[#F3ECE1] px-3.5 py-2 text-xs font-semibold text-[#231F1D] hover:bg-[#EAE0D1] transition-colors min-h-[42px] whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-[#9E3B24]" />
          <span>Spremi Teku na zaslon</span>
        </button>
      ) : (
        <div className="rounded-2xl border border-[#E4D9C8] bg-[#F3ECE1]/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="font-display text-base font-semibold text-[#231F1D]">
              Instalirajte Maminu Teku na početni zaslon
            </h4>
            <p className="text-sm text-[#655A52] mt-1">
              Otvorite Teku jednim dodirom kao pravu aplikaciju — radi trenutno i u vikendici ili podrumu bez interneta.
            </p>
          </div>
          <button
            type="button"
            onClick={handleTrigger}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#9E3B24] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#842F1B] transition-colors min-h-[44px] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Instaliraj aplikaciju</span>
          </button>
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#FAF6F0] border border-[#E4D9C8] p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <h3 id="pwa-install-title" className="font-display text-xl font-semibold text-[#231F1D]">
                Dodavanje Teke na početni zaslon
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Zatvori upute za instalaciju"
                className="p-2 rounded-lg text-[#655A52] hover:bg-[#EFE6D8] min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <div className="mt-4 space-y-3 text-sm text-[#3F3833]">
                <p>Za postavljanje ikone Mamine Teke na iPhone ili iPad:</p>
                <ol className="list-decimal list-inside space-y-2 font-medium">
                  <li className="flex items-center gap-2">
                    <span>1. Dodirnite gumb</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#EFE6D8] text-[#231F1D]">
                      <Share className="w-3.5 h-3.5" /> Dijeli
                    </span>
                    <span>u traci preglednika Safari.</span>
                  </li>
                  <li>2. Odaberite opciju <strong>„Dodaj na početni zaslon”</strong> (Add to Home Screen).</li>
                  <li>3. Potvrdite s <strong>„Dodaj”</strong> u gornjem kutu.</li>
                </ol>
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-sm text-[#3F3833]">
                <p>Za instalaciju Mamine Teke kao samostalne aplikacije:</p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Otvorite izbornik preglednika (tri točkice u gornjem desnom kutu).</li>
                  <li>Odaberite <strong>„Instaliraj aplikaciju”</strong> ili <strong>„Dodaj na početni zaslon”</strong>.</li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="mt-6 w-full rounded-xl bg-[#231F1D] py-3 text-sm font-semibold text-[#FAF6F0] hover:bg-[#3A3330] transition-colors min-h-[44px] cursor-pointer"
            >
              Razumijem
            </button>
          </div>
        </div>
      )}
    </>
  );
};
