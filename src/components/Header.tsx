import React, { useEffect, useRef, useState } from 'react';
import {
  Info,
  Loader2,
  LogIn,
  LogOut,
  Moon,
  Sun,
  User as UserIcon,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { AppIconEmblem } from './Splash';
import {
  calculateSyncProgressPercent,
  type SyncProgressState,
} from '../utils/recipeLogic';

export type HeaderNavTab = 'teka' | 'kategorije' | 'planer' | 'favoriti' | 'o-teki';

interface HeaderProps {
  activeTab: HeaderNavTab;
  selectedRecipeId: string | null;
  onNavigateToTab: (tab: HeaderNavTab) => void;
  maminMod: boolean;
  onToggleMaminMod: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  currentUser: User | null;
  isOnline: boolean;
  isSyncing: boolean;
  syncProgress: SyncProgressState;
  pendingSyncCount: number;
  onManualSync: () => void;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  selectedRecipeId,
  onNavigateToTab,
  maminMod,
  onToggleMaminMod,
  darkMode,
  onToggleDarkMode,
  currentUser,
  isOnline,
  isSyncing,
  syncProgress,
  pendingSyncCount,
  onManualSync,
  onGoogleSignIn,
  onGoogleSignOut,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);

  const isActivelySyncing = Boolean(syncProgress.active || isSyncing);
  const progressPercent = calculateSyncProgressPercent(syncProgress);

  return (
    <header className="no-print fixed top-0 left-0 right-0 z-40 h-16 flex items-center justify-between gap-2 sm:gap-6 px-3 sm:px-8 bg-[#FAF6F0]/95 backdrop-blur-xs border-b border-[#DFD3C3] transform-gpu">
      {/* LIJEVA STRANA: Okrugla ikona s portretom mame + vertikalni blok "Mamina Teka" / "by Zrina" */}
      <button
        type="button"
        onClick={() => onNavigateToTab('teka')}
        className="inline-flex items-center gap-2 text-left shrink-0 cursor-pointer group"
      >
        <AppIconEmblem className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-[#D5C7B4] shadow-xs shrink-0" />
        <div className="flex flex-col">
          <span className="font-display text-[19px] sm:text-[20px] font-bold leading-tight tracking-tight text-[#231F1D] group-hover:text-[#9E3B24] transition-colors">
            Mamina Teka
          </span>
        </div>
      </button>

      {/* SREDINA (Desktop navigacija) */}
      <nav
        aria-label="Glavna navigacija"
        className="hidden md:flex items-center gap-6 text-sm font-medium text-[#5A4F47]"
      >
        <button
          type="button"
          onClick={() => onNavigateToTab('teka')}
          className={`hover:text-[#231F1D] transition-colors whitespace-nowrap shrink-0 pb-0.5 cursor-pointer ${
            activeTab === 'teka' && !selectedRecipeId
              ? 'text-[#9E3B24] font-bold underline decoration-2 underline-offset-8'
              : ''
          }`}
        >
          Teka
        </button>
        <button
          type="button"
          onClick={() => onNavigateToTab('kategorije')}
          className={`hover:text-[#231F1D] transition-colors whitespace-nowrap shrink-0 pb-0.5 cursor-pointer ${
            activeTab === 'kategorije' && !selectedRecipeId
              ? 'text-[#9E3B24] font-bold underline decoration-2 underline-offset-8'
              : ''
          }`}
        >
          Kategorije
        </button>
        <button
          type="button"
          onClick={() => onNavigateToTab('planer')}
          className={`hover:text-[#231F1D] transition-colors whitespace-nowrap shrink-0 pb-0.5 cursor-pointer ${
            activeTab === 'planer' && !selectedRecipeId
              ? 'text-[#9E3B24] font-bold underline decoration-2 underline-offset-8'
              : ''
          }`}
        >
          Kuhaj uskoro
        </button>
        <button
          type="button"
          onClick={() => onNavigateToTab('favoriti')}
          className={`hover:text-[#231F1D] transition-colors whitespace-nowrap shrink-0 pb-0.5 cursor-pointer ${
            activeTab === 'favoriti' && !selectedRecipeId
              ? 'text-[#9E3B24] font-bold underline decoration-2 underline-offset-8'
              : ''
          }`}
        >
          Favoriti
        </button>
      </nav>

      {/* DESNA STRANA: Kompaktne ikonice bez teksta (Aa, Tamna tema, Info, Avatar meni) */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* 1. Gumb "Aa" (okrugli gumb za 'Mamin mod' / krupni tekst, BEZ teksta) */}
        <button
          type="button"
          onClick={onToggleMaminMod}
          aria-pressed={maminMod}
          aria-label={
            maminMod
              ? 'Isključi krupni tekst (Mamin mod)'
              : 'Uključi krupni tekst (Mamin mod)'
          }
          title={
            maminMod
              ? 'Mamin mod uključen (klikni za standardna slova)'
              : 'Povećaj slova (Mamin mod)'
          }
          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border font-display text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
            maminMod
              ? 'bg-[#9E3B24] text-white border-[#9E3B24] shadow-xs'
              : 'bg-[#F3ECE1] text-[#231F1D] border-[#D5C7B4] hover:bg-[#EAE0D1]'
          }`}
        >
          Aa
        </button>

        {/* 2. Gumb za toplu tamnu temu (pored gumba 'Aa') */}
        <button
          type="button"
          data-testid="dark-mode-toggle-btn"
          onClick={onToggleDarkMode}
          aria-pressed={darkMode}
          aria-label={darkMode ? 'Prebaci na svijetlu temu' : 'Prebaci na toplu tamnu temu'}
          title={
            darkMode
              ? 'Topla tamna tema uključena (klikni za svijetlu)'
              : 'Uključi toplu tamnu temu'
          }
          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border transition-colors cursor-pointer ${
            darkMode
              ? 'bg-[#9E3B24] text-white border-[#9E3B24] shadow-xs'
              : 'bg-[#F3ECE1] text-[#231F1D] border-[#D5C7B4] hover:bg-[#EAE0D1]'
          }`}
        >
          {darkMode ? (
            <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          ) : (
            <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          )}
        </button>

        {/* 3. Gumb "ℹ️" (okrugli gumb za ekran 'O Teki', BEZ teksta) */}
        <button
          type="button"
          onClick={() => onNavigateToTab('o-teki')}
          aria-label="O Teki"
          title="O Teki i obiteljskoj arhivi"
          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border transition-colors cursor-pointer ${
            activeTab === 'o-teki' && !selectedRecipeId
              ? 'bg-[#9E3B24] text-white border-[#9E3B24] shadow-xs'
              : 'bg-[#F3ECE1] text-[#231F1D] border-[#D5C7B4] hover:bg-[#EAE0D1]'
          }`}
        >
          <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* 4. Okrugli avatar prijavljenog korisnika s brzim padajućim menijem */}
        <div className="relative" ref={profileMenuRef}>
          <button
            type="button"
            data-testid="profile-menu-trigger-btn"
            onClick={() => setShowProfileMenu((v) => !v)}
            aria-label="Korisnički profil i sinkronizacija"
            aria-expanded={showProfileMenu}
            title={
              currentUser
                ? `${currentUser.displayName || currentUser.email}`
                : 'Prijava u obiteljski oblak'
            }
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center overflow-hidden border-2 border-[#D5C7B4] bg-[#F3ECE1] hover:border-[#9E3B24] transition-colors cursor-pointer relative"
          >
            {currentUser?.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName || 'Profil'}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : isActivelySyncing ? (
              <Loader2 className="w-4 h-4 animate-spin text-terracotta text-[#9E3B24]" />
            ) : (
              <UserIcon className="w-4 h-4 text-[#9E3B24]" />
            )}
          </button>

          {showProfileMenu && (
            <div
              role="menu"
              data-testid="profile-dropdown-menu"
              className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#FAF6F0] border border-[#D5C7B4] shadow-xl p-3.5 z-50 space-y-3"
            >
              {/* Prekidač za toplu tamnu temu u izborniku profila */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E6D9C6]">
                <span className="text-xs font-semibold text-[#231F1D] inline-flex items-center gap-1.5">
                  {darkMode ? (
                    <Sun className="w-3.5 h-3.5 text-[#C88A2B]" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 text-[#9E3B24]" />
                  )}
                  <span>Topla tamna tema</span>
                </span>
                <button
                  type="button"
                  onClick={onToggleDarkMode}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    darkMode
                      ? 'bg-[#9E3B24] text-white'
                      : 'bg-[#F3ECE1] text-[#5A4F47] border border-[#D5C7B4]'
                  }`}
                >
                  {darkMode ? 'Uključeno' : 'Isključeno'}
                </button>
              </div>

              {currentUser && (
                <div className="flex items-center gap-2.5 pb-2.5 border-b border-[#E6D9C6]">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || 'Profil'}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded-full object-cover border border-[#9E3B24] shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[#F3ECE1] flex items-center justify-center text-[#9E3B24] shrink-0">
                      <UserIcon className="w-4 h-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-[#231F1D] truncate">
                      {currentUser.displayName || 'Član obitelji'}
                    </div>
                    <div className="text-[11px] text-[#655A52] truncate">
                      {currentUser.email}
                    </div>
                  </div>
                </div>
              )}

              {/* VIZUALNI BROJAČ NAPRETKA I STATUS SINKRONIZACIJE */}
              <div
                data-testid="profile-sync-status-card"
                className="rounded-xl bg-[#F3ECE1] px-3 py-2.5 text-xs space-y-2 border border-[#E5DAC8]"
              >
                {isActivelySyncing ? (
                  <div
                    data-testid="sync-active-progress-block"
                    className="space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-semibold text-[#231F1D]">
                        <Loader2 className="w-4 h-4 animate-spin text-terracotta text-[#9E3B24] shrink-0" />
                        <span>Sinkronizacija u tijeku...</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span
                        data-testid="sync-progress-badge"
                        className="text-xs font-mono bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded text-stone-600 dark:text-stone-300"
                      >
                        {syncProgress.current} / {syncProgress.total}
                      </span>
                      {syncProgress.currentItemName && (
                        <span className="text-[11px] text-[#655A52] truncate max-w-[130px]">
                          {syncProgress.currentItemName}
                        </span>
                      )}
                    </div>

                    {/* Tanka, diskretna traka napretka (progress bar) ispod brojača */}
                    <div
                      data-testid="sync-progress-bar"
                      className="w-full h-1.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden"
                    >
                      <div
                        className="h-full bg-[#9E3B24] transition-all duration-200 rounded-full"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div
                      data-testid="sync-status-label"
                      className="flex items-center gap-1.5 text-[#35462C] font-semibold"
                    >
                      {!isOnline ? (
                        <span className="text-[#B57B24]">🟡 Izvan mreže (lokalno)</span>
                      ) : pendingSyncCount > 0 ? (
                        <span className="text-[#4A5D3F]">
                          🟢 Sinkronizirano ({pendingSyncCount} na čekanju)
                        </span>
                      ) : (
                        <span className="text-[#35462C]">🟢 Sinkronizirano</span>
                      )}
                    </div>

                    {isOnline && (
                      <button
                        type="button"
                        data-testid="profile-sync-refresh-btn"
                        disabled={isActivelySyncing}
                        onClick={onManualSync}
                        className="text-[11px] font-bold text-[#9E3B24] hover:underline cursor-pointer disabled:opacity-50"
                      >
                        Osvježi
                      </button>
                    )}
                  </div>
                )}
              </div>

              {currentUser ? (
                <div className="pt-1 flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onNavigateToTab('o-teki');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-[#231F1D] hover:bg-[#EAE0D1] transition-colors cursor-pointer"
                  >
                    Obiteljska arhiva i PDF ispis
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onGoogleSignOut();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#B42318] hover:bg-[#FCE4E1] transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Odjavi se</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="text-xs text-[#5A4F47] leading-relaxed">
                    Recepti su sigurno spremljeni na ovom uređaju. Prijavite se za sinkronizaciju s obiteljskim oblakom.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onGoogleSignIn();
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#9E3B24] px-3.5 py-2.5 text-xs font-bold text-white hover:bg-[#842F1B] transition-colors cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Google prijava</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
