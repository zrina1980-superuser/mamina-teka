import React, { useState, useRef } from 'react';
import { AiKeyCard } from './AiKeyCard';
import { DeleteAccountCard } from './DeleteAccountCard';
import {
  Heart,
  ExternalLink,
  Mail,
  Download,
  Upload,
  Printer,
  BookOpen,
  Check,
  X,
  Users,
  Trash2,
  CloudCheck,
  LogIn,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Copy,
  Link2,
  MessageCircle,
  Loader2,
} from 'lucide-react';
import {
  CATEGORIES,
  advanceDeleteConfirmationStep,
  generateVaultInviteKey,
  buildFamilyInviteLink,
  buildWhatsAppInviteUrl,
  resolvePrintableRecipeImage,
  resolvePrintableOriginalScan,
  buildA5BookletImposition,
  calculateSyncProgressPercent,
  type BookletPageDescriptor,
  type Recipe,
  type SyncProgressState,
} from '../utils/recipeLogic';
import {
  exportAllRecipesJson,
  importRecipesFromJson,
  getHideSampleManuscripts,
  setHideSampleManuscripts,
  softDeleteAllMockupRecipesInDb,
  restoreMockupRecipesInDb,
} from '../db/tekaDb';
import { INITIAL_RECIPES } from '../db/seedRecipes';
import { PWAInstallCard } from './PWAInstallBanner';
import { getOfflineFallbackDishUri } from '../utils/visualAssets';
import {
  DEFAULT_OWNER_NAME,
  DEFAULT_OWNER_EMAIL,
  DEFAULT_CONNECTED_MEMBER_NAME,
  DEFAULT_CONNECTED_MEMBER_EMAIL,
  formatMemberDisplayName,
  normalizeVaultMembers,
  getOrCreateLocalVaultId,
  type FamilyVaultDoc,
  type VaultMember,
} from '../services/firebaseSync';

interface AboutAndPrintViewProps {
  recipes: Recipe[];
  onRecipesImported: () => void;
  userEmail: string | null;
  userName: string | null;
  userPhotoUrl: string | null;
  vaultInfo: FamilyVaultDoc | null;
  onVaultUpdated: (nextVault: FamilyVaultDoc) => void;
  onTriggerGoogleSignIn: () => void;
  onManualSync: () => void;
  isSyncing: boolean;
  syncProgress?: SyncProgressState;
  onReplaySplash?: () => void;
  hideSampleManuscripts?: boolean;
  onChangeHideSampleManuscripts?: (hidden: boolean) => void;
}

export const AboutAndPrintView: React.FC<AboutAndPrintViewProps> = ({
  recipes,
  onRecipesImported,
  userEmail,
  userName,
  vaultInfo,
  onVaultUpdated,
  onTriggerGoogleSignIn,
  onManualSync,
  isSyncing,
  syncProgress,
  onReplaySplash,
  hideSampleManuscripts,
  onChangeHideSampleManuscripts,
}) => {
  const [showPrintBuilder, setShowPrintBuilder] = useState(false);
  const [printMode, setPrintMode] = useState<'a4-portrait' | 'a5-booklet'>('a4-portrait');
  const [showFormatSelectorModal, setShowFormatSelectorModal] = useState(false);
  const [selectedIdsForPrint, setSelectedIdsForPrint] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(recipes.map((r) => [r.id, true]))
  );
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // Sample Manuscripts ("Isprobaj odmah") Visibility & Mockup Recipes Management
  const [samplesHiddenLocal, setSamplesHiddenLocal] = useState<boolean>(() =>
    typeof hideSampleManuscripts === 'boolean'
      ? hideSampleManuscripts
      : getHideSampleManuscripts()
  );
  const [mockupDeleteStep, setMockupDeleteStep] = useState<0 | 1 | 2>(0);
  const [profileSettingNotice, setProfileSettingNotice] = useState<string | null>(null);

  const isSamplesHidden =
    typeof hideSampleManuscripts === 'boolean' ? hideSampleManuscripts : samplesHiddenLocal;

  const seedIdSet = new Set(INITIAL_RECIPES.map((r) => r.id));
  const activeMockupCount = recipes.filter((r) => seedIdSet.has(r.id)).length;

  const handleRemoveSampleManuscriptsOnProfile = () => {
    setHideSampleManuscripts(true);
    setSamplesHiddenLocal(true);
    onChangeHideSampleManuscripts?.(true);
    setProfileSettingNotice(
      'Ogledni rukopisi („Isprobaj odmah”) su trajno uklonjeni i više se neće prikazivati kod dodavanja novog recepta.'
    );
    window.setTimeout(() => setProfileSettingNotice(null), 4500);
  };

  const handleRestoreSampleManuscriptsOnProfile = () => {
    setHideSampleManuscripts(false);
    setSamplesHiddenLocal(false);
    onChangeHideSampleManuscripts?.(false);
    setProfileSettingNotice('Ogledni rukopisi su ponovno uključeni u čarobnjaku.');
    window.setTimeout(() => setProfileSettingNotice(null), 4000);
  };

  const handleConfirmDeleteAllMockups = async () => {
    await softDeleteAllMockupRecipesInDb(userEmail || undefined);
    setMockupDeleteStep(0);
    await onRecipesImported();
    onManualSync?.();
    setProfileSettingNotice(
      'Svi početni (mockup) recepti su trajno obrisani iz vaše Teke i obiteljskog oblaka.'
    );
    window.setTimeout(() => setProfileSettingNotice(null), 4500);
  };

  const handleRestoreAllMockups = async () => {
    await restoreMockupRecipesInDb();
    await onRecipesImported();
    onManualSync?.();
    setProfileSettingNotice('Početni obiteljski recepti su vraćeni u Teku.');
    window.setTimeout(() => setProfileSettingNotice(null), 4500);
  };


  // Family Sharing & Active Members State
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);

  const activeVaultId = vaultInfo?.vaultId || getOrCreateLocalVaultId();
  const activeInviteKey = vaultInfo?.inviteKey || generateVaultInviteKey(activeVaultId);
  const familyInviteLink = buildFamilyInviteLink(
    typeof window !== 'undefined' ? window.location.origin : 'https://zrina.app',
    activeVaultId,
    activeInviteKey
  );
  const whatsAppInviteUrl = buildWhatsAppInviteUrl(familyInviteLink);

  const handleCopyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(familyInviteLink);
      setInviteLinkCopied(true);
      window.setTimeout(() => setInviteLinkCopied(false), 3000);
    } catch {
      setInviteLinkCopied(true);
      window.setTimeout(() => setInviteLinkCopied(false), 3000);
    }
  };

  const resolvedOwnerEmail = vaultInfo?.ownerEmail || userEmail || DEFAULT_OWNER_EMAIL;
  const resolvedOwnerName = vaultInfo?.ownerName || userName || DEFAULT_OWNER_NAME;

  const isVaultOwner =
    Boolean(userEmail) &&
    userEmail?.toLowerCase() === (vaultInfo?.ownerEmail || resolvedOwnerEmail).toLowerCase();

  // Build connected family members list from Firestore vault document (`members` / `memberEmails` / `allowedEmails`)
  const connectedMembers: VaultMember[] = React.useMemo(() => {
    const normalized = normalizeVaultMembers(
      resolvedOwnerEmail,
      resolvedOwnerName,
      vaultInfo?.members,
      vaultInfo?.memberEmails,
      vaultInfo?.allowedEmails,
      userEmail
        ? ({ email: userEmail, displayName: userName } as any)
        : null
    );

    const nonOwners = normalized.members.filter(
      (m) => m.email.toLowerCase().trim() !== resolvedOwnerEmail
    );

    return nonOwners;
  }, [vaultInfo, userEmail, userName, resolvedOwnerEmail, resolvedOwnerName]);

  const handleExportBackup = async () => {
    const json = await exportAllRecipesJson();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mamina-teka-zrina-arhiva-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setBackupMessage('Kompletna arhiva Teke (recepti i slike) je preuzeta na vaš uređaj.');
    window.setTimeout(() => setBackupMessage(null), 4000);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const count = await importRecipesFromJson(text);
      onRecipesImported();
      setBackupMessage(`Uspješno učitano ${count} recepata u Maminu Teku.`);
      window.setTimeout(() => setBackupMessage(null), 4000);
    } catch {
      setBackupMessage('Greška pri čitanju sigurnosne kopije. Provjerite JSON datoteku.');
    }
  };

  const selectedPrintRecipes = recipes.filter((r) => selectedIdsForPrint[r.id]);

  const togglePrintRecipe = (id: string) => {
    setSelectedIdsForPrint((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const selectAllForPrint = (onlyFavorites = false) => {
    const next: Record<string, boolean> = {};
    recipes.forEach((r) => {
      next[r.id] = onlyFavorites ? r.isFavorite : true;
    });
    setSelectedIdsForPrint(next);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32">
      {/* Non-print wrapper for main settings & dedication sections when printing the PDF cookbook */}
      <div className={showPrintBuilder ? 'no-print space-y-8' : 'space-y-8'}>
      {/* Section 1: neutral intro + user-provided AI key */}
      <section className="rounded-3xl border border-[#DFD3C3] bg-[#F3ECE1] p-6 sm:p-10 text-center space-y-4">
        <div className="inline-flex items-center gap-2 text-xs font-bold text-[#9E3B24]">
          <Heart className="w-4 h-4 fill-current" />
          <span>Digitalni obiteljski trezor recepata</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#231F1D] leading-tight">
          Mamina Teka
        </h1>
        <blockquote className="max-w-2xl mx-auto font-display text-lg sm:text-xl text-[#2F2621] leading-relaxed italic bg-[#FAF7F2] border border-[#E2D6C3] rounded-2xl p-6">
          „Recepti koje volimo zaslužuju više od zaboravljene bilježnice. Sačuvajte ih, povežite s
          obitelji i prenesite dalje.”
        </blockquote>
        {onReplaySplash && (
          <button
            type="button"
            onClick={onReplaySplash}
            className="inline-flex items-center gap-2 rounded-xl border border-[#D5C7B4] bg-[#FAF6F0] px-4 py-2 text-xs font-bold text-[#9E3B24] hover:bg-[#EFE6D8] transition-colors min-h-[38px] cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Prikaži uvodni zaslon</span>
          </button>
        )}
      </section>

      <AiKeyCard />
      <DeleteAccountCard />

      {/* Section 2: Zrina Ecosystem & Contact */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-[#DFD3C3] bg-white p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-[#655A52]">
              Tehnički potpis i ekosustav
            </span>
            <h2 className="font-display text-2xl font-bold text-[#231F1D] mt-1">
              Dio zrina.app obitelji
            </h2>
            <p className="text-sm sm:text-base text-[#5A4F47] mt-2 leading-relaxed">
              Mamina Teka razvijena je unutar <strong>zrina.app</strong> ekosustava digitalnih
              alata i obiteljskih aplikacija koje spajaju nasljeđe, jednostavnost i pametnu
              tehnologiju.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-[#EFE6D8]">
            <a
              href="https://zrina.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#231F1D] px-4 py-2.5 text-sm font-semibold text-[#FAF6F0] hover:bg-[#3A3330] transition-colors min-h-[44px] whitespace-nowrap"
            >
              <span>Posjeti zrina.app</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div className="rounded-3xl border border-[#DFD3C3] bg-white p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-[#655A52]">
              Podrška, prijedlozi i obiteljske priče
            </span>
            <h2 className="font-display text-2xl font-bold text-[#231F1D] mt-1">
              Pišite nam
            </h2>
            <p className="text-sm sm:text-base text-[#5A4F47] mt-2 leading-relaxed">
              Imate prijedlog za novu starinsku mjeru, želite podijeliti priču o obiteljskom
              receptu ili vam treba podrška oko arhive? Javite nam se izravno.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-[#EFE6D8]">
            <a
              href="mailto:maminateka@zrina.app"
              className="inline-flex items-center gap-2 rounded-xl border border-[#DFD3C3] bg-[#F3ECE1] px-4 py-2.5 text-sm font-semibold text-[#9E3B24] hover:bg-[#EAE0D1] transition-colors min-h-[44px] whitespace-nowrap"
            >
              <Mail className="w-4 h-4" />
              <span>maminateka@zrina.app</span>
            </a>
          </div>
        </div>
      </section>

      {/* Section 3: Sigurnosna kopija (Arhiva) & Izradi PDF kuharicu za print */}
      <section className="rounded-3xl border border-[#DFD3C3] bg-white p-6 sm:p-8 space-y-6">
        <div>
          <span className="text-xs font-semibold text-[#655A52]">
            Sigurnosna kopija i fizička knjiga
          </span>
          <h2 className="font-display text-2xl font-bold text-[#231F1D] mt-1">
            Arhiva recepata i A4 PDF kuharica za print
          </h2>
          <p className="text-sm sm:text-base text-[#5A4F47] mt-1">
            Svi recepti i skenirani rukopisi pohranjeni su lokalno na vašem uređaju ({recipes.length}{' '}
            recepata u trezoru). Izvezite ih u arhiv ili složite formatiranu A4 knjigu za ispis i
            uvezivanje.
          </p>
        </div>

        {backupMessage && (
          <div
            role="status"
            className="rounded-xl bg-[#4A5D3F] text-white px-4 py-3 text-sm font-medium"
          >
            {backupMessage}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-testid="open-pdf-cookbook-builder-btn"
            onClick={() => {
              setShowPrintBuilder(true);
              setShowFormatSelectorModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#9E3B24] px-5 py-3 text-sm font-bold text-white hover:bg-[#842F1B] transition-colors min-h-[48px] whitespace-nowrap cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Izradi PDF kuharicu za print</span>
          </button>

          <button
            type="button"
            onClick={handleExportBackup}
            className="inline-flex items-center gap-2 rounded-xl border border-[#DFD3C3] bg-[#F3ECE1] px-4 py-3 text-sm font-semibold text-[#231F1D] hover:bg-[#EAE0D1] transition-colors min-h-[48px] whitespace-nowrap cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Izvezi lokalnu arhivu (JSON)</span>
          </button>

          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl border border-[#DFD3C3] bg-[#FAF6F0] px-4 py-3 text-sm font-semibold text-[#5A4F47] hover:bg-[#EFE6D8] transition-colors min-h-[48px] whitespace-nowrap cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Učitaj sigurnosnu kopiju</span>
          </button>
        </div>
      </section>

      {/* Section 4: Obiteljski pristup / Dijeljenje Teke (Multi-user Family Sharing & Invite Link) */}
      <section
        data-testid="family-sharing-section"
        className="rounded-3xl border border-[#DFD3C3] bg-white p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4A5D3F] mb-1">
              <Users className="w-4 h-4" />
              <span>Višekorisnički rad i dijeljenje u oblaku</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-[#231F1D]">
              Obiteljski pristup / Dijeljenje Teke
            </h2>
            <p className="text-sm sm:text-base text-[#5A4F47] mt-1 leading-relaxed">
              Dijeljenje obiteljskog trezora vrši se isključivo putem jedinstvene poveznice pozivnice
              i WhatsApp gumba. Kada novi član obitelji otvori link i prijavi se svojim Google
              računom, njegov profil se automatski povezuje s obiteljskim trezorom i preuzima sve
              recepte.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              data-testid="sync-now-btn"
              onClick={onManualSync}
              disabled={Boolean(isSyncing || syncProgress?.active)}
              className="inline-flex items-center gap-2 rounded-xl border border-[#DFD3C3] bg-[#F3ECE1] px-4 py-2.5 text-xs font-bold text-[#231F1D] hover:bg-[#EAE0D1] transition-colors min-h-[42px] cursor-pointer disabled:opacity-60"
            >
              {isSyncing || syncProgress?.active ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-terracotta text-[#9E3B24]" />
                  <span>Sinkronizacija u tijeku...</span>
                </>
              ) : (
                <>
                  <CloudCheck className="w-4 h-4 text-[#4A5D3F]" />
                  <span>Osvježi / Sinkroniziraj sada</span>
                </>
              )}
            </button>

            {(isSyncing || syncProgress?.active) && syncProgress ? (
              <div className="w-56 space-y-1.5 text-right">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-xs font-mono bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded text-stone-600 dark:text-stone-300">
                    {syncProgress.current} / {syncProgress.total}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                  <div
                    className="h-full bg-[#9E3B24] transition-all duration-200 rounded-full"
                    style={{ width: `${calculateSyncProgressPercent(syncProgress)}%` }}
                  />
                </div>
              </div>
            ) : (
              <span className="text-xs font-semibold text-[#35462C]">
                🟢 Sinkronizirano
              </span>
            )}
          </div>
        </div>

        {/* Sustav dijeljenja poveznicom (Invite Link: ?trezorId=...&inviteKey=...) */}
        <div
          data-testid="family-invite-link-card"
          className="rounded-2xl border border-[#DFD3C3] bg-[#F3ECE1] p-5 space-y-3.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#9E3B24]">
              <Link2 className="w-4 h-4 shrink-0" />
              <span>Jedinstveni link pozivnice obiteljskog trezora</span>
            </div>
            <span className="font-mono-tabular text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-[#FAF6F0] border border-[#D5C7B4] text-[#5A4F47]">
              Trezor: {activeVaultId.slice(0, 16)}
            </span>
          </div>

          <div className="rounded-xl border border-[#D5C7B4] bg-[#FAF6F0] px-3.5 py-2.5 font-mono text-xs text-[#231F1D] break-all select-all">
            {familyInviteLink}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {/* Gumb "Kopiraj link pozivnice" (s automatskom potvrdom "Link kopiran!") */}
            <button
              type="button"
              data-testid="copy-invite-link-btn"
              onClick={handleCopyInviteLink}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#9E3B24] px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-[#842F1B] transition-colors min-h-[44px] cursor-pointer"
            >
              {inviteLinkCopied ? (
                <>
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Link kopiran!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 shrink-0" />
                  <span>Kopiraj link pozivnice</span>
                </>
              )}
            </button>

            {/* Gumb "Pošalji pozivnicu na WhatsApp" */}
            <a
              href={whatsAppInviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="whatsapp-invite-link-btn"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2E7D32] hover:bg-[#256628] px-4 py-2.5 text-xs sm:text-sm font-bold text-white transition-colors min-h-[44px] cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span>Pošalji pozivnicu na WhatsApp</span>
            </a>
          </div>
        </div>

        {/* PRIKAZ STVARNIH ČLANOVA TREZORA (Active Members List) */}
        <div
          data-testid="active-vault-members-list"
          className="space-y-3 pt-1"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#655A52]">
              Povezani članovi trezora ({1 + connectedMembers.length})
            </h3>
            <span className="text-[11px] font-semibold text-[#4A5D3F]">
              Sinkronizirano s trezorom ({recipes.length} recepata)
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {/* 1. Vlasnik trezora: Vedran Zrinski (vedran.zrinski@gmail.com) */}
            <div
              data-testid="vault-owner-member-row"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DFD3C3] bg-[#FAF6F0] px-4 py-3 text-xs sm:text-sm"
            >
              <div className="min-w-0">
                <div className="font-bold text-[#231F1D]">
                  Vlasnik: {resolvedOwnerName} ({resolvedOwnerEmail})
                </div>
                <div className="text-[11px] text-[#655A52] mt-0.5">
                  Glavni obiteljski trezor recepata • Autor i skrbnik Teke
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#9E3B24]/15 text-[#9E3B24] px-3 py-1 text-xs font-bold shrink-0">
                <span className="w-2 h-2 rounded-full bg-[#9E3B24]" />
                <span>Vlasnik trezora</span>
              </span>
            </div>

            {/* 2. Povezani članovi iz Firestore dokumenta trezora (npr. Brankica Zrinski spojena putem linka pozivnice) */}
            {connectedMembers.map((member) => (
              <div
                key={member.email}
                data-testid="vault-connected-member-row"
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DFD3C3] bg-[#FAF6F0] px-4 py-3 text-xs sm:text-sm"
              >
                <div className="min-w-0">
                  <div className="font-bold text-[#231F1D]">
                    Član: {member.name} ({member.email})
                  </div>
                  <div className="text-[11px] text-[#655A52] mt-0.5">
                    Spojena putem linka pozivnice • Sinkronizirani svi recepti i slike
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#4A5D3F]/15 text-[#4A5D3F] px-3 py-1 text-xs font-bold shrink-0">
                  <span className="w-2 h-2 rounded-full bg-[#4A5D3F]" />
                  <span>Aktivan član</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {!userEmail ? (
          <div className="rounded-2xl border border-[#E5DAC8] bg-[#FAF6F0] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-[#231F1D]">
                Trenutno koristite lokalni način rada (Gost)
              </h3>
              <p className="text-xs text-[#655A52] mt-1">
                Svi recepti su sigurno spremljeni na ovom uređaju (IndexedDB). Prijavite se Google
                računom kako biste uključili pozadinsku sinkronizaciju i dijeljenje Teke s obitelji.
              </p>
            </div>
            <button
              type="button"
              onClick={onTriggerGoogleSignIn}
              className="inline-flex items-center gap-2 rounded-xl bg-[#9E3B24] px-5 py-3 text-xs sm:text-sm font-bold text-white hover:bg-[#842F1B] transition-colors min-h-[44px] whitespace-nowrap cursor-pointer shrink-0"
            >
              <LogIn className="w-4 h-4" />
              <span>Prijava putem Googlea</span>
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#E5DAC8] bg-[#FAF6F0] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs sm:text-sm text-[#3A322D]">
              Prijavljeni ste kao: <strong>{userName || userEmail}</strong> ({userEmail})
            </div>
            {vaultInfo && (
              <span className="rounded-lg bg-[#4A5D3F]/15 text-[#4A5D3F] px-3 py-1 text-xs font-bold">
                {isVaultOwner
                  ? 'Vlasnik obiteljskog trezora'
                  : 'Aktivan član obiteljskog trezora'}
              </span>
            )}
          </div>
        )}
      </section>

      {/* Section 4B: Postavke profila — Uklanjanje "Isprobaj odmah" primjera i oglednih (mockup) recepata */}
      <section
        data-testid="profile-preferences-section"
        className="rounded-3xl border border-[#DFD3C3] bg-white p-6 sm:p-8 space-y-6"
      >
        <div>
          <span className="text-xs font-semibold text-[#9E3B24]">
            Postavke profila i čišćenje Teke
          </span>
          <h2 className="font-display text-2xl font-bold text-[#231F1D] mt-1">
            Upravljanje oglednim primjerima i mockup receptima
          </h2>
          <p className="text-sm sm:text-base text-[#5A4F47] mt-1">
            Kada ovdje uklonite sekciju „Isprobaj odmah” ili obrišete početne ogledne recepte, vaša odluka trajno ostaje zapamćena i više se neće vraćati.
          </p>
        </div>

        {profileSettingNotice && (
          <div
            role="status"
            className="rounded-xl bg-[#4A5D3F] text-white px-4 py-3 text-xs sm:text-sm font-medium"
          >
            {profileSettingNotice}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Control 1: "Isprobaj odmah" sample manuscripts in Scan Wizard */}
          <div className="rounded-2xl border border-[#E5DAC8] bg-[#FAF6F0] p-5 flex flex-col justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-[#655A52]">
                Čarobnjak za dodavanje recepta
              </div>
              <h3 className="font-display text-lg font-bold text-[#231F1D] mt-0.5">
                Sekcija „Isprobaj odmah” (ogledni rukopisi)
              </h3>
              <p className="text-xs text-[#5A4F47] mt-1 leading-relaxed">
                {isSamplesHidden
                  ? 'Uklonjeno — kod dodavanja novog recepta više se ne prikazuju ogledni rukopisi.'
                  : 'Trenutno prikazano — možete trajno ukloniti ogledne listove iz prozora za skeniranje.'}
              </p>
            </div>

            <div>
              {!isSamplesHidden ? (
                <button
                  type="button"
                  data-testid="profile-remove-samples-btn"
                  onClick={handleRemoveSampleManuscriptsOnProfile}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#B42318] px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-[#911B12] transition-colors min-h-[42px] cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Ukloni „Isprobaj odmah” zauvijek</span>
                </button>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4A5D3F]">
                    <Check className="w-4 h-4" />
                    <span>Trajno uklonjeno s profila</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleRestoreSampleManuscriptsOnProfile}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#655A52] hover:text-[#231F1D] underline cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Ponovno prikaži</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Control 2: Mockup / Seed Recipes Bulk Removal (with Double Confirmation) */}
          <div className="rounded-2xl border border-[#E5DAC8] bg-[#FAF6F0] p-5 flex flex-col justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-[#655A52]">
                Početni ogledni recepti u Teki ({activeMockupCount} aktivno)
              </div>
              <h3 className="font-display text-lg font-bold text-[#231F1D] mt-0.5">
                Ogledni (mockup) recepti
              </h3>
              <p className="text-xs text-[#5A4F47] mt-1 leading-relaxed">
                Svaki recept možete obrisati pojedinačno u pregledu recepta ili ovdje ukloniti sve početne ogledne recepte odjednom uz dvostruku provjeru.
              </p>
            </div>

            <div>
              {activeMockupCount > 0 ? (
                mockupDeleteStep === 0 ? (
                  <button
                    type="button"
                    data-testid="profile-delete-mockups-btn"
                    onClick={() => setMockupDeleteStep(1)}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#E5B8B2] bg-[#FDF2F0] px-4 py-2.5 text-xs sm:text-sm font-bold text-[#B42318] hover:bg-[#FCE4E1] transition-colors min-h-[42px] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Ukloni sve ogledne recepte ({activeMockupCount})</span>
                  </button>
                ) : mockupDeleteStep === 1 ? (
                  <div className="rounded-xl bg-[#FDF2F0] border border-[#E5B8B2] p-3 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#B42318]">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Prva provjera (1/2): Ukloniti {activeMockupCount} oglednih recepata?</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMockupDeleteStep(0)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-[#DFD3C3] text-xs font-semibold text-[#231F1D] cursor-pointer"
                      >
                        Odustani
                      </button>
                      <button
                        type="button"
                        data-testid="profile-delete-mockups-step1"
                        onClick={() => {
                          const next = advanceDeleteConfirmationStep(1);
                          if (next === 2) setMockupDeleteStep(2);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#B42318] text-xs font-bold text-white cursor-pointer"
                      >
                        Nastavi na 2. provjeru →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-[#FDF2F0] border-2 border-[#B42318] p-3 space-y-2.5">
                    <div className="text-xs font-bold text-[#B42318]">
                      Dvostruka provjera (2/2): Potvrdite trajno brisanje oglednih recepata
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMockupDeleteStep(0)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-[#DFD3C3] text-xs font-semibold text-[#231F1D] cursor-pointer"
                      >
                        Zadrži
                      </button>
                      <button
                        type="button"
                        data-testid="profile-delete-mockups-step2"
                        onClick={handleConfirmDeleteAllMockups}
                        className="px-3 py-1.5 rounded-lg bg-[#B42318] text-xs font-bold text-white cursor-pointer"
                      >
                        Potvrdi trajno brisanje (2/2)
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4A5D3F]">
                    <Check className="w-4 h-4" />
                    <span>Ogledni recepti su uklonjeni</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleRestoreAllMockups}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#655A52] hover:text-[#231F1D] underline cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Vrati ogledne recepte</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: PWA Install Card */}
      <PWAInstallCard />
      </div>

      {/* Dynamic @page print rule based on selected print format (A4 Portrait vs A4 Landscape for A5 Booklet) */}
      {showPrintBuilder && (
        <style>
          {printMode === 'a5-booklet'
            ? `@media print { @page { size: A4 landscape; margin: 8mm 10mm; } }`
            : `@media print { @page { size: A4 portrait; margin: 10mm 12mm; } }`}
        </style>
      )}

      {/* Modal: PDF Kuharica (Način A: Klasični A4 Registrator | Način B: Mala obiteljska Tekica A5 knjižica) */}
      {showPrintBuilder && (() => {
        const bookletImposition = buildA5BookletImposition(selectedPrintRecipes.length);

        const renderCompactRecipeContent = (
          r: Recipe,
          rIdx: number,
          logicalPageNumber: number,
          isA5Booklet: boolean
        ) => {
          const cat = CATEGORIES.find((c) => c.id === r.category);
          const resolvedDish = resolvePrintableRecipeImage(r);
          const dishPhoto = resolvedDish || getOfflineFallbackDishUri(r.title, r.category);
          const manuscriptPhoto = resolvePrintableOriginalScan(r, dishPhoto);
          const secretText = r.secretTip || r.momTips[0] || '';

          return (
            <div className="flex flex-col justify-between h-full text-[#1A1615] space-y-2.5">
              <div className="space-y-2.5">
                {/* 1. ZAGLAVLJE: Naziv jela (serif font, istaknut), kategorija/podkategorija, vrijeme, pećnica, kalup */}
                <div className="border-b-2 border-[#DFD3C3] pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#9E3B24]">
                    <span>
                      Recept #{String(rIdx + 1).padStart(2, '0')} • {cat?.title} · {r.subcategory}
                    </span>
                    <span className="font-mono-tabular text-[#5A4F47]">
                      ⏱ {r.prepTimeMinutes + r.cookTimeMinutes} min · 🍽 {r.servings}
                    </span>
                  </div>

                  <h2
                    className={`font-display font-bold text-[#1A1615] leading-tight mt-0.5 ${
                      isA5Booklet ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'
                    }`}
                  >
                    {r.title}
                  </h2>

                  {r.subtitle && (
                    <p className="text-[11px] text-[#5A4F47] leading-snug mt-0.5 line-clamp-1">
                      {r.subtitle}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10px] text-[#3A312B]">
                    <span className="rounded-md bg-[#FAF6F0] border border-[#E5DAC8] px-2 py-0.5">
                      <strong>Kalup / protvan:</strong> {r.panDimensions || 'Standardni kalup'}
                    </span>
                    {r.ovenTemp && (
                      <span className="rounded-md bg-[#FAF6F0] border border-[#E5DAC8] px-2 py-0.5">
                        <strong>Pećnica:</strong> {r.ovenTemp}
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. VIZUAL: Fotografija gotovog jela s nakošenom minijaturom rukopisa u donjem desnom kutu */}
                <div className="relative">
                  <div
                    className={`relative w-full overflow-hidden rounded-lg border border-[#DFD3C3] bg-[#2B1D16] ${
                      isA5Booklet ? 'h-28 sm:h-32' : 'h-40 sm:h-44'
                    }`}
                  >
                    <img
                      src={dishPhoto}
                      alt={r.title}
                      loading="eager"
                      decoding="sync"
                      onError={(e) => {
                        const target = e.currentTarget;
                        const fallback = getOfflineFallbackDishUri(r.title, r.category);
                        if (target.src !== fallback) target.src = fallback;
                      }}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>

                  {/* Nakošena minijaturna naljepnica originalnog skena rukopisa s efektom ljepljive trake */}
                  <div
                    data-testid="pdf-recipe-original-sticker"
                    className={`absolute bottom-1.5 right-2 bg-[#FFFEFA] p-1 pb-1.5 rounded-lg shadow-md border border-[#CBBBA4] transform -rotate-3 z-10 ${
                      isA5Booklet ? 'w-16 sm:w-20' : 'w-20 sm:w-24'
                    }`}
                  >
                    <div className="mx-auto -mt-2 mb-0.5 w-7 h-1.5 rounded-xs bg-[#F2E3B6]/95 border border-[#D8C58E]" />
                    <img
                      src={manuscriptPhoto}
                      alt={`Izvorni rukopis — ${r.title}`}
                      loading="eager"
                      decoding="sync"
                      onError={(e) => {
                        const target = e.currentTarget;
                        const fallback = getOfflineFallbackDishUri(r.title, r.category);
                        if (target.src !== fallback) target.src = fallback;
                      }}
                      className={`w-full object-cover rounded-xs border border-[#E5DAC8] ${
                        isA5Booklet ? 'h-9 sm:h-10' : 'h-11 sm:h-12'
                      }`}
                    />
                    <div className="font-handwriting text-[9px] sm:text-[10px] font-bold text-[#3A281E] text-center mt-0.5 leading-none">
                      Iz mamine teke 📝
                    </div>
                  </div>
                </div>

                {/* 3. DVOSTUPČANI SADRŽAJ: Lijevi stupac (35% širine) Sastojci | Desni stupac (65% širine) Numerirani koraci */}
                <div className="flex flex-row items-start gap-3 pt-0.5">
                  {/* Lijevi stupac (35% širine): Popis sastojaka */}
                  <div className="w-[35%] shrink-0 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] p-2.5">
                    <h3 className="text-[10px] font-bold text-[#9E3B24] uppercase tracking-wider mb-1.5 border-b border-[#DFD3C3] pb-1">
                      Sastojci
                    </h3>
                    <div className="space-y-2">
                      {r.ingredientGroups.map((g, gi) => (
                        <div key={gi}>
                          {r.ingredientGroups.length > 1 && (
                            <div className="text-[10px] font-bold text-[#7A3A28] mb-0.5">
                              {g.groupTitle}
                            </div>
                          )}
                          <ul className="space-y-0.5 text-[10px] leading-snug">
                            {g.items.map((it) => (
                              <li
                                key={it.id}
                                className="flex justify-between gap-1.5 border-b border-dotted border-[#DFD3C3]/70 pb-0.5"
                              >
                                <span className="text-[#231F1D]">{it.name}</span>
                                <span className="font-mono-tabular font-bold text-[#1A1615] shrink-0">
                                  {it.amount !== null ? `${it.amount} ${it.unit}` : it.unit}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Desni stupac (65% širine): Numerirani koraci pripreme */}
                  <div className="w-[65%] min-w-0 space-y-2">
                    <h3 className="text-[10px] font-bold text-[#231F1D] uppercase tracking-wider border-b border-[#EFE6D8] pb-1">
                      Koraci pripreme
                    </h3>
                    <ol className="space-y-1 text-[10px] sm:text-[11px] leading-snug text-[#1A1615]">
                      {r.steps.map((st, si) => (
                        <li key={si} className="flex items-start gap-1.5">
                          <span className="font-mono-tabular font-bold text-[#9E3B24] shrink-0">
                            {si + 1}.
                          </span>
                          <span>{st}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>

              {/* 4. DNO: Žuta kartica "Mamina tajna" (ako postoji) i diskretan potpis "Mamina Teka" */}
              <div className="space-y-2 pt-1">
                {secretText && (
                  <div className="rounded-xl bg-[#FFF7C2] border border-[#E6D073] px-3 py-1.5 text-[10px] text-[#2E2414]">
                    <span className="font-bold uppercase tracking-wider text-[9px] text-[#7A5210] mr-1.5">
                      📌 Mamina tajna:
                    </span>
                    <span className="font-handwriting text-sm text-[#2E2414]">
                      „{secretText}”
                    </span>
                  </div>
                )}

                <div className="pt-1.5 border-t border-[#EFE6D8] flex items-center justify-between text-[10px] text-[#7A7067]">
                  <span className="italic font-display font-semibold text-[#5A4F47]">
                    Mamina Teka
                  </span>
                  <span className="font-mono-tabular font-semibold">
                    Str. {logicalPageNumber}
                  </span>
                </div>
              </div>
            </div>
          );
        };

        const renderBookletA5Page = (
          page: BookletPageDescriptor,
          sidePosition: 'left' | 'right'
        ) => {
          // Unutarnji rubovi uz hrbat imaju veći razmak radi lakšeg presavijanja i klamanja
          const spinePaddingClass =
            sidePosition === 'left'
              ? 'pr-5 sm:pr-7 pl-3 sm:pl-4 border-r border-dashed border-stone-300'
              : 'pl-5 sm:pl-7 pr-3 sm:pr-4';

          if (page.type === 'cover') {
            return (
              <div
                data-testid="a5-booklet-cover-page"
                className={`${spinePaddingClass} py-3 flex flex-col justify-between h-full bg-[#FAF6F0]`}
              >
                <div className="rounded-2xl border-4 border-double border-[#9E3B24]/75 bg-[#FFFEFA] p-4 sm:p-5 text-center flex flex-col justify-between h-full space-y-3">
                  <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#9E3B24]">
                    ✦ Mala obiteljska Tekica (A5 izdanje) ✦
                  </div>

                  <div className="space-y-1">
                    <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#231F1D]">
                      Mamina Teka
                    </h1>
                    <p className="font-display italic text-sm text-[#9E3B24]">
                      Obiteljska arhiva recepata
                    </p>
                  </div>

                  <img src="/icon.png" alt="Mamina Teka" className="mx-auto w-28 h-28 rounded-2xl" />

                  <p className="font-display italic text-[11px] text-[#3A312B] leading-snug px-2">
                    „Recepti prikupljani i čuvani desetljećima, spašeni od zaborava iz mamine originalne teke.”
                  </p>

                  <div className="pt-2 border-t border-[#E5DAC8] flex items-center justify-between text-[9px] text-[#655A52]">
                    <span className="font-bold text-[#231F1D]">Mamina Teka</span>
                    <span>Str. 1 (Naslovnica)</span>
                  </div>
                </div>
              </div>
            );
          }

          if (page.type === 'intro') {
            return (
              <div
                data-testid="a5-booklet-intro-page"
                className={`${spinePaddingClass} py-3 flex flex-col justify-between h-full bg-[#FFFEFA]`}
              >
                <div className="rounded-2xl border border-[#DFD3C3] bg-[#FAF6F0] p-4 sm:p-5 flex flex-col justify-between h-full space-y-3">
                  <div className="space-y-2">
                    <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#9E3B24]">
                      Uvodna priča o Teki i posveta
                    </span>
                    <h2 className="font-display text-xl font-bold text-[#231F1D]">
                      Priča o Maminoj Teki
                    </h2>
                    <p className="text-[11px] text-[#3A312B] leading-relaxed">
                      Ova knjižica nastala je iz obiteljske zbirke recepata. Svaki list čuva rukopis, male tajne pečenja i točne obiteljske mjere za kolače, kruh, nedjeljne ručkove i zimnicu.
                    </p>
                  </div>

                  <blockquote className="rounded-xl bg-[#FFFEFA] border border-[#E2D6C3] p-3.5 font-display italic text-xs text-[#2F2621] leading-relaxed">
                    „Za sve nedjeljne ručkove, blagdane i mirise djetinjstva koji ostaju zauvijek u našoj obitelji.”
                  </blockquote>

                  <div className="rounded-xl bg-[#FFF7C2] border border-[#E6D073] p-3 text-[10px] text-[#2E2414]">
                    <div className="font-bold text-[#7A5210] uppercase tracking-wider mb-0.5">
                      Obiteljski trezor recepata
                    </div>
                    <p>
                      U ovoj knjižici nalazi se ukupno <strong>{selectedPrintRecipes.length}</strong> odabranih recepata iz obiteljske arhive.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[#E5DAC8] flex items-center justify-between text-[9px] text-[#655A52]">
                    <span className="italic font-display">Mamina Teka</span>
                    <span className="font-mono-tabular font-semibold">Str. {page.pageNumber}</span>
                  </div>
                </div>
              </div>
            );
          }

          if (page.type === 'toc') {
            return (
              <div
                data-testid="a5-booklet-toc-page"
                className={`${spinePaddingClass} py-3 flex flex-col justify-between h-full bg-[#FFFEFA]`}
              >
                <div className="space-y-2">
                  <div className="border-b-2 border-[#DFD3C3] pb-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#9E3B24]">
                      Sadržaj knjižice po kategorijama
                    </span>
                    <h2 className="font-display text-lg font-bold text-[#231F1D]">
                      Kazalo recepata
                    </h2>
                  </div>

                  <div className="space-y-2">
                    {CATEGORIES.map((cat) => {
                      const catRecipes = selectedPrintRecipes
                        .map((r, idx) => ({ recipe: r, pageNo: idx + 4 }))
                        .filter((item) => item.recipe.category === cat.id);
                      if (catRecipes.length === 0) return null;
                      return (
                        <div
                          key={cat.id}
                          className="rounded-lg bg-[#FAF6F0] border border-[#E5DAC8] p-2"
                        >
                          <div className="text-[10px] font-bold text-[#9E3B24] border-b border-[#DFD3C3] pb-0.5 mb-1">
                            {cat.title}
                          </div>
                          <ul className="space-y-0.5 text-[10px]">
                            {catRecipes.map(({ recipe: r, pageNo }) => (
                              <li key={r.id} className="flex items-baseline justify-between gap-2">
                                <span className="truncate text-[#231F1D]">{r.title}</span>
                                <span className="font-mono-tabular font-bold text-[#9E3B24] shrink-0">
                                  Str. {pageNo}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-1.5 border-t border-[#EFE6D8] flex items-center justify-between text-[9px] text-[#7A7067]">
                  <span className="italic font-display">Mamina Teka</span>
                  <span className="font-mono-tabular font-semibold">Str. {page.pageNumber}</span>
                </div>
              </div>
            );
          }

          if (page.type === 'recipe' && typeof page.recipeIndex === 'number') {
            const recipe = selectedPrintRecipes[page.recipeIndex];
            if (recipe) {
              return (
                <div className={`${spinePaddingClass} py-2.5 h-full bg-[#FFFEFA]`}>
                  {renderCompactRecipeContent(recipe, page.recipeIndex, page.pageNumber, true)}
                </div>
              );
            }
          }

          if (page.type === 'notes') {
            return (
              <div
                data-testid="a5-booklet-notes-page"
                className={`${spinePaddingClass} py-3 flex flex-col justify-between h-full bg-[#FFFEFA]`}
              >
                <div className="space-y-3">
                  <div className="border-b-2 border-[#DFD3C3] pb-2">
                    <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#9E3B24]">
                      Prostor za nove obiteljske bilješke
                    </span>
                    <h2 className="font-display text-lg font-bold text-[#231F1D]">
                      Mamine zabilješke i kulinarske crtice
                    </h2>
                  </div>

                  <p className="font-handwriting text-sm text-[#5A4F47]">
                    Mjesto za dopisivanje novih obiteljskih trikova, datuma proslava i malih izmjena u receptima...
                  </p>

                  {/* Retro linije za rukopis */}
                  <div className="space-y-4 pt-2">
                    {Array.from({ length: 11 }).map((_, lineIdx) => (
                      <div
                        key={lineIdx}
                        className="border-b border-dashed border-[#CBBBA4] h-4"
                      />
                    ))}
                  </div>
                </div>

                <div className="pt-1.5 border-t border-[#EFE6D8] flex items-center justify-between text-[9px] text-[#7A7067]">
                  <span className="italic font-display">Mamina Teka</span>
                  <span className="font-mono-tabular font-semibold">Str. {page.pageNumber}</span>
                </div>
              </div>
            );
          }

          // Default / 'colophon' (Zadnja stranica / korica)
          return (
            <div
              data-testid="a5-booklet-colophon-page"
              className={`${spinePaddingClass} py-3 flex flex-col justify-between h-full bg-[#FAF6F0]`}
            >
              <div className="rounded-2xl border-2 border-[#CBBBA4] bg-[#FFFEFA] p-5 text-center flex flex-col justify-between h-full">
                <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#9E3B24]">
                  ✦ Zadnja korica • Obiteljska vinjeta ✦
                </div>

                <div className="space-y-3 my-auto">
                  <img
                    src="/icon.png"
                    alt="Mamina Teka pečat"
                    loading="eager"
                    decoding="sync"
                    className="w-12 h-12 rounded-xl mx-auto object-cover border border-[#DFD3C3]"
                  />
                  <h3 className="font-display text-lg font-bold text-[#231F1D]">
                    Kolofon i obiteljska vinjeta
                  </h3>
                  <p className="text-[11px] text-[#5A4F47] max-w-xs mx-auto leading-relaxed">
                    Digitalizirano i pripremljeno za obiteljski tisak u sklopu aplikacije{' '}
                    <strong>Mamina Teka</strong>.
                  </p>
                  <div className="inline-block rounded-xl bg-[#FAF6F0] border border-[#DFD3C3] px-3 py-1.5 text-[10px] font-mono-tabular text-[#9E3B24]">
                    Izdanje: {new Date().getFullYear()}. • Ukupno {bookletImposition.totalPages} A5 stranica
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E5DAC8] flex items-center justify-between text-[9px] text-[#655A52]">
                  <span>zrina.app</span>
                  <span className="font-mono-tabular font-semibold">
                    Str. {page.pageNumber} (Zadnja korica)
                  </span>
                </div>
              </div>
            </div>
          );
        };

        return (
          <div
            className="print-cookbook-modal fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdf-cookbook-title"
          >
            <div className="print-cookbook-shell w-full max-w-6xl rounded-3xl bg-[#FAF6F0] border border-[#DFD3C3] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
              {/* Top Toolbar (Hidden when printing) */}
              <div className="no-print flex flex-wrap items-center justify-between gap-4 px-5 sm:px-6 py-4 bg-[#F3ECE1] border-b border-[#DFD3C3] shrink-0">
                <div>
                  <span className="text-xs font-semibold text-[#9E3B24]">
                    Priprema nostalgične obiteljske kuharice za ispis i uvezivanje
                  </span>
                  <h2
                    id="pdf-cookbook-title"
                    className="font-display text-xl sm:text-2xl font-bold text-[#231F1D]"
                  >
                    PDF Kuharica „Mamina Teka” ({selectedPrintRecipes.length} recepata)
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Brzi preklopnik formata u alatnoj traci */}
                  <div
                    role="group"
                    aria-label="Odabir formata ispisa"
                    className="inline-flex rounded-xl bg-[#FAF6F0] p-1 border border-[#D5C7B4]"
                  >
                    <button
                      type="button"
                      data-testid="print-mode-tab-a4"
                      onClick={() => setPrintMode('a4-portrait')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        printMode === 'a4-portrait'
                          ? 'bg-[#9E3B24] text-white'
                          : 'text-[#5A4F47] hover:text-[#231F1D]'
                      }`}
                    >
                      A4 Registrator
                    </button>
                    <button
                      type="button"
                      data-testid="print-mode-tab-a5"
                      onClick={() => setPrintMode('a5-booklet')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        printMode === 'a5-booklet'
                          ? 'bg-[#9E3B24] text-white'
                          : 'text-[#5A4F47] hover:text-[#231F1D]'
                      }`}
                    >
                      A5 Knjižica (Tekica)
                    </button>
                  </div>

                  <button
                    type="button"
                    data-testid="print-cookbook-now-btn"
                    onClick={() => setShowFormatSelectorModal(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#9E3B24] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#842F1B] min-h-[44px] whitespace-nowrap cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Ispiši / Spremi PDF kuharicu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFormatSelectorModal(false);
                      setShowPrintBuilder(false);
                    }}
                    aria-label="Zatvori prikaz za print"
                    className="p-2 rounded-xl text-[#655A52] hover:bg-[#EAE0D1] min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="print-cookbook-scroll p-4 sm:p-8 overflow-y-auto flex-1 space-y-6">
                {/* Uputa za korisnika kod odabira A5 knjižice */}
                {printMode === 'a5-booklet' && (
                  <div
                    data-testid="a5-duplex-print-instruction"
                    className="no-print rounded-2xl bg-[#FFF7C2] border-2 border-[#D9B84A] p-4 sm:p-5 text-xs sm:text-sm text-[#2E2414] shadow-xs flex items-start gap-3"
                  >
                    <Printer className="w-5 h-5 text-[#9E3B24] shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold text-[#7A5210] mb-0.5">
                        Uputa za ispis A5 knjižice na presavinuti A4 papir (Pravilo četvorke — {bookletImposition.totalPages} A5 stranica / {bookletImposition.spreads.length / 2} A4 listova):
                      </strong>
                      <span>
                        Važno kod ispisa: U postavkama pisača odaberite &apos;Obostrani ispis&apos; (Duplex) s opcijom &apos;Okreni po kraćem rubu&apos; (Flip on short edge). Nakon printanja samo presavijte listove po sredini i zaklamajte u hrptu!
                      </span>
                    </div>
                  </div>
                )}

                {/* Selection Controls (Hidden when printing) */}
                <div className="no-print rounded-2xl bg-[#F3ECE1] border border-[#DFD3C3] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h3 className="text-sm font-bold text-[#231F1D]">
                      Odaberite recepte koje želite uvrstiti u uvezanu kuharicu:
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => selectAllForPrint(false)}
                        className="px-3 py-1.5 rounded-lg bg-[#FAF6F0] border border-[#D5C7B4] text-xs font-semibold text-[#231F1D] cursor-pointer"
                      >
                        Odaberi sve ({recipes.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => selectAllForPrint(true)}
                        className="px-3 py-1.5 rounded-lg bg-[#FAF6F0] border border-[#D5C7B4] text-xs font-semibold text-[#9E3B24] cursor-pointer"
                      >
                        Samo Mami najdraže
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-44 overflow-y-auto pr-1">
                    {recipes.map((r) => {
                      const checked = !!selectedIdsForPrint[r.id];
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => togglePrintRecipe(r.id)}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left text-xs font-semibold transition-colors cursor-pointer ${
                            checked
                              ? 'bg-white border-[#9E3B24] text-[#231F1D]'
                              : 'bg-[#FAF6F0]/60 border-[#DFD3C3] text-[#655A52]'
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                              checked ? 'bg-[#9E3B24] text-white' : 'border border-[#B8A896]'
                            }`}
                          >
                            {checked && <Check className="w-3 h-3" />}
                          </span>
                          <span className="truncate">{r.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ===========================================================================
                    NAČIN A: KLASIČNI A4 PRIJELOM (1 RECEPT = 1 USPRAVNA A4 STRANICA)
                    =========================================================================== */}
                {printMode === 'a4-portrait' ? (
                  <div
                    data-testid="print-layout-a4-portrait"
                    className="print-cookbook-pages space-y-8 text-[#1A1615]"
                  >
                    {/* STR. 1: SVEČANA NASLOVNICA */}
                    <div
                      data-testid="pdf-cookbook-cover-page"
                      className="print-page-break rounded-3xl bg-[#FAF6F0] border-2 border-[#CBBBA4] p-5 sm:p-8 shadow-md"
                    >
                      <div className="rounded-2xl border-4 border-double border-[#9E3B24]/75 bg-[#FFFEFA] p-6 sm:p-10 text-center space-y-6 relative overflow-hidden">
                        <div className="flex items-center justify-between text-[#9E3B24]/60 text-xs font-serif select-none">
                          <span>✦ ─── ❖ ─── ✦</span>
                          <span className="uppercase tracking-[0.22em] text-[10px] sm:text-xs font-bold text-[#9E3B24]">
                            Klasični A4 ispis (Registrator)
                          </span>
                          <span>✦ ─── ❖ ─── ✦</span>
                        </div>

                        <div className="space-y-1.5 pt-1">
                          <div className="inline-flex items-center gap-2 rounded-full bg-[#F3ECE1] border border-[#DFD3C3] px-4 py-1 text-xs font-bold text-[#7A542E]">
                            <BookOpen className="w-3.5 h-3.5 text-[#9E3B24]" />
                            <span>Obiteljska arhiva recepata</span>
                          </div>

                          <h1 className="font-display text-4xl sm:text-6xl font-bold text-[#231F1D] tracking-tight pt-1">
                            Mamina Teka
                          </h1>
                          <p className="font-display italic text-xl sm:text-2xl text-[#9E3B24]">
                            Obiteljska arhiva recepata
                          </p>
                          <p className="text-xs sm:text-sm font-medium text-[#5A4F47] max-w-lg mx-auto pt-1">
                            Kućna kuharica nastala prema obiteljskoj zbirci recepata
                          </p>
                        </div>

                        <div className="relative max-w-md mx-auto py-2">
                          <div className="bg-[#FAF6F0] p-3.5 pb-5 rounded-2xl shadow-lg border-2 border-[#DFD3C3] transform -rotate-1 mx-auto max-w-xs sm:max-w-sm">
                            <img src="/icon.png" alt="Mamina Teka" className="mx-auto w-40 h-40 rounded-2xl" />
                          </div>

                          {selectedPrintRecipes[0] && (
                            <div className="hidden sm:block absolute -bottom-2 -right-3 bg-[#FFFEFA] p-1.5 pb-2 rounded-xl shadow-xl border-2 border-[#D5C7B4] transform rotate-6 w-28">
                              <div className="mx-auto -mt-2.5 mb-1 w-10 h-2 rounded-xs bg-[#F2E3B6]/95 border border-[#D8C58E]" />
                              <img
                                src={resolvePrintableOriginalScan(
                                  selectedPrintRecipes[0],
                                  '/mockups/kiflice_rukopis.jpg'
                                )}
                                alt="Isječak iz mamine teke"
                                loading="eager"
                                decoding="sync"
                                className="w-full h-14 object-cover rounded-md border border-[#E5DAC8]"
                              />
                              <div className="font-handwriting text-[11px] font-bold text-[#3A281E] mt-1 leading-none">
                                Iz mamine teke 📝
                              </div>
                            </div>
                          )}
                        </div>

                        <blockquote className="max-w-xl mx-auto rounded-2xl bg-[#FAF6F0] border border-[#E2D6C3] p-4 sm:p-5 font-display italic text-xs sm:text-sm text-[#2F2621] leading-relaxed">
                          „Recepti prikupljani i čuvani desetljećima, spašeni od zaborava iz mamine originalne teke. Za sve nedjeljne ručkove, blagdane i mirise djetinjstva koji ostaju zauvijek.”
                        </blockquote>

                        <div className="pt-3 border-t border-[#E5DAC8] flex flex-wrap items-center justify-between gap-3 text-xs text-[#655A52]">
                          <div className="flex items-center gap-2">
                            <img
                              src="/icon.png"
                              alt="Pečat"
                              loading="eager"
                              decoding="sync"
                              className="w-6 h-6 rounded-md object-cover"
                            />
                            <span className="font-bold text-[#231F1D]">
                              Mamina Teka • Obiteljska arhiva recepata
                            </span>
                          </div>
                          <div className="font-mono-tabular font-semibold text-[#9E3B24]">
                            Str. 1 • Ukupno {selectedPrintRecipes.length} recepata
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* STR. 2: KAZALO RECEPATA (Sadržaj po kategorijama s brojevima stranica) */}
                    {selectedPrintRecipes.length > 0 && (
                      <div
                        data-testid="pdf-cookbook-toc"
                        className="print-page-break rounded-3xl bg-[#FFFEFA] border-2 border-[#DFD3C3] p-6 sm:p-8 shadow-xs space-y-5"
                      >
                        <div className="text-center border-b-2 border-[#DFD3C3] pb-4">
                          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9E3B24]">
                            Stranica 2 • Sadržaj po kategorijama
                          </span>
                          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#231F1D] mt-1">
                            Kazalo recepata
                          </h2>
                          <p className="text-xs text-[#5A4F47] mt-1">
                            Popis svih recepata složenih po policama s pripadajućim brojevima stranica
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {CATEGORIES.map((cat) => {
                            const catRecipes = selectedPrintRecipes
                              .map((r, idx) => ({ recipe: r, pageNumber: idx + 3 }))
                              .filter((item) => item.recipe.category === cat.id);
                            if (catRecipes.length === 0) return null;
                            return (
                              <div
                                key={cat.id}
                                className="rounded-2xl bg-[#FAF6F0] border border-[#E5DAC8] p-3.5 space-y-2"
                              >
                                <div className="flex items-center justify-between border-b border-[#DFD3C3] pb-1.5">
                                  <h3 className="font-display text-sm font-bold text-[#9E3B24]">
                                    {cat.title}
                                  </h3>
                                  <span className="text-[10px] font-mono-tabular font-bold text-[#655A52]">
                                    {catRecipes.length} recepata
                                  </span>
                                </div>
                                <ul className="space-y-1 text-xs">
                                  {catRecipes.map(({ recipe: r, pageNumber }) => (
                                    <li
                                      key={r.id}
                                      className="flex items-baseline justify-between gap-2 text-[#231F1D]"
                                    >
                                      <span className="font-medium truncate">{r.title}</span>
                                      <span className="font-mono-tabular font-bold text-[#9E3B24] shrink-0">
                                        Str. {pageNumber}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })}
                        </div>

                        <div className="pt-2 border-t border-[#EFE6D8] flex items-center justify-between text-[10px] text-[#7A7067]">
                          <span className="italic font-display">Mamina Teka</span>
                          <span className="font-mono-tabular font-semibold">Str. 2</span>
                        </div>
                      </div>
                    )}

                    {/* STR. 3+: SVAKI POJEDINAČNI RECEPT ZAUZIMA TOČNO JEDNU A4 STRANICU */}
                    {selectedPrintRecipes.map((r, rIdx) => (
                      <div
                        key={r.id}
                        data-testid="pdf-cookbook-recipe-page"
                        className="print-page-break rounded-3xl bg-[#FFFEFA] border-2 border-[#DFD3C3] p-5 sm:p-7 shadow-xs"
                      >
                        {renderCompactRecipeContent(r, rIdx, rIdx + 3, false)}
                      </div>
                    ))}
                  </div>
                ) : (
                  /* ===========================================================================
                     NAČIN B: A5 KNJIŽICA NA PRESAVINUTI A4 (BOOKLET IMPOSITION — PRAVILO ČETVORKE)
                     =========================================================================== */
                  <div
                    data-testid="print-layout-a5-booklet"
                    className="print-cookbook-pages space-y-8 text-[#1A1615]"
                  >
                    {bookletImposition.spreads.map((spread) => (
                      <div
                        key={`spread-${spread.spreadIndex}-${spread.sheetNumber}-${spread.side}`}
                        data-testid="a5-booklet-spread-sheet"
                        className="print-page-break rounded-2xl bg-[#FFFEFA] border-2 border-[#DFD3C3] p-3 sm:p-5 shadow-xs"
                      >
                        <div className="no-print flex items-center justify-between text-[11px] font-mono-tabular text-[#655A52] mb-2 pb-1.5 border-b border-[#EFE6D8]">
                          <span>
                            A4 Vodoravni list #{spread.sheetNumber} —{' '}
                            <strong>
                              {spread.side === 'front'
                                ? 'Prednja strana lista (Front)'
                                : 'Stražnja strana lista (Back)'}
                            </strong>
                          </span>
                          <span>
                            Lijevo: Str. {spread.leftPage.pageNumber} | Desno: Str.{' '}
                            {spread.rightPage.pageNumber}
                          </span>
                        </div>

                        {/* Fizički vodoravni A4 list podijeljen na dvije A5 stranice */}
                        <div className="grid grid-cols-2 gap-6 h-full min-h-[520px] items-stretch">
                          {renderBookletA5Page(spread.leftPage, 'left')}
                          {renderBookletA5Page(spread.rightPage, 'right')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* MODAL ZA ODABIR VRSTE ISPISA PRIJE PRINTANJA */}
            {showFormatSelectorModal && (
              <div
                data-testid="print-format-selection-modal"
                className="no-print fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
              >
                <div className="w-full max-w-xl rounded-3xl bg-[#FAF6F0] border-2 border-[#DFD3C3] shadow-2xl p-6 sm:p-7 space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#9E3B24]">
                        Odabir formata prije ispisa
                      </span>
                      <h3 className="font-display text-2xl font-bold text-[#231F1D] mt-0.5">
                        Kako želite ispisati Maminu Teku?
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowFormatSelectorModal(false)}
                      aria-label="Zatvori odabir formata"
                      className="p-2 rounded-xl text-[#655A52] hover:bg-[#EAE0D1] cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {/* Opcija A: Klasični A4 ispis (Registrator) */}
                    <button
                      type="button"
                      data-testid="select-format-a4-portrait"
                      onClick={() => setPrintMode('a4-portrait')}
                      className={`w-full text-left rounded-2xl border-2 p-4 transition-all cursor-pointer ${
                        printMode === 'a4-portrait'
                          ? 'border-[#9E3B24] bg-white shadow-sm'
                          : 'border-[#DFD3C3] bg-[#F3ECE1]/70 hover:bg-white/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-base sm:text-lg font-bold text-[#231F1D]">
                          Klasični A4 ispis (Registrator)
                        </span>
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                            printMode === 'a4-portrait'
                              ? 'border-[#9E3B24] bg-[#9E3B24] text-white'
                              : 'border-[#B8A896]'
                          }`}
                        >
                          {printMode === 'a4-portrait' && <Check className="w-3.5 h-3.5" />}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-[#5A4F47] mt-1 leading-relaxed">
                        1 recept = točno 1 uspravna A4 stranica. Idealno za umetanje u folije, registratore ili vješanje na hladnjak.
                      </p>
                    </button>

                    {/* Opcija B: Mala obiteljska Tekica (A5 knjižica) */}
                    <button
                      type="button"
                      data-testid="select-format-a5-booklet"
                      onClick={() => setPrintMode('a5-booklet')}
                      className={`w-full text-left rounded-2xl border-2 p-4 transition-all cursor-pointer ${
                        printMode === 'a5-booklet'
                          ? 'border-[#9E3B24] bg-white shadow-sm'
                          : 'border-[#DFD3C3] bg-[#F3ECE1]/70 hover:bg-white/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-base sm:text-lg font-bold text-[#231F1D]">
                          Mala obiteljska Tekica (A5 knjižica)
                        </span>
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                            printMode === 'a5-booklet'
                              ? 'border-[#9E3B24] bg-[#9E3B24] text-white'
                              : 'border-[#B8A896]'
                          }`}
                        >
                          {printMode === 'a5-booklet' && <Check className="w-3.5 h-3.5" />}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-[#5A4F47] mt-1 leading-relaxed">
                        Prava knjižica na presavijanje. Printa se obostrano na vodoravni A4 papir, presavije se po sredini i zaklama u hrptu.
                      </p>
                    </button>
                  </div>

                  {/* Uputa za korisnika u dijalogu ispisa kod odabira A5 knjižice */}
                  {printMode === 'a5-booklet' && (
                    <div
                      data-testid="modal-a5-duplex-warning"
                      className="rounded-2xl bg-[#FFF7C2] border border-[#D9B84A] p-3.5 text-xs text-[#2E2414] leading-relaxed"
                    >
                      Važno kod ispisa: U postavkama pisača odaberite &apos;Obostrani ispis&apos; (Duplex) s opcijom &apos;Okreni po kraćem rubu&apos; (Flip on short edge). Nakon printanja samo presavijte listove po sredini i zaklamajte u hrptu!
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowFormatSelectorModal(false)}
                      className="rounded-xl border border-[#DFD3C3] bg-[#F3ECE1] px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#231F1D] hover:bg-[#EAE0D1] min-h-[44px] cursor-pointer"
                    >
                      Pregledaj prijelom
                    </button>
                    <button
                      type="button"
                      data-testid="confirm-format-and-print-btn"
                      onClick={() => {
                        setShowFormatSelectorModal(false);
                        window.setTimeout(() => {
                          window.print();
                        }, 80);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#9E3B24] px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-[#842F1B] min-h-[44px] cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Pokreni ispis ({printMode === 'a5-booklet' ? 'A5 knjižica' : 'A4 registrator'})</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};
