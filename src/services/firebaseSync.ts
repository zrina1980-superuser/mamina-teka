import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  deleteUser,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  collection,
  getDocs,
  arrayUnion,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  db,
  areMockupRecipesRemoved,
  getRecipesToSync,
  purgeRemovedMockupRecipesFromDexie,
  purgeDeletedRecipesFromDexie,
  getDeletedRecipeIds,
  markRecipeIdsAsDeleted,
} from '../db/tekaDb';
import { INITIAL_RECIPES } from '../db/seedRecipes';
import { getDishIllustrationUri } from '../utils/visualAssets';
import {
  MOCKUP_RECIPE_ID_SET,
  generateVaultInviteKey,
  isValidVaultInvite,
  shouldSkipDeletedRecipeOnPull,
  filterSyncableRecipes,
  isPlaceholderIngredientGroups,
  recoverIngredientsFromRecipeText,
  isValidImageSourceForCompression,
  isImageAlreadyOptimizedForSync,
  type Recipe,
  type IngredientGroup,
  type SyncProgressState,
} from '../utils/recipeLogic';

export { getRecipesToSync, filterSyncableRecipes };
export type { SyncProgressState };

function withFirestoreTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallbackValue: T
): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(fallbackValue);
    }, timeoutMs);

    promise
      .then((val) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(val);
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(fallbackValue);
      });
  });
}

let currentSyncProgressState: SyncProgressState = {
  current: 0,
  total: 0,
  active: false,
  currentItemName: undefined,
};

const syncProgressListeners = new Set<(state: SyncProgressState) => void>();

export function getSyncProgress(): SyncProgressState {
  return { ...currentSyncProgressState };
}

export function setSyncProgressState(patch: Partial<SyncProgressState>): SyncProgressState {
  currentSyncProgressState = {
    ...currentSyncProgressState,
    ...patch,
  };
  const snapshot = { ...currentSyncProgressState };
  syncProgressListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // Ignore listener errors
    }
  });
  return snapshot;
}

export function subscribeToSyncProgress(
  listener: (state: SyncProgressState) => void
): () => void {
  syncProgressListeners.add(listener);
  listener({ ...currentSyncProgressState });
  return () => {
    syncProgressListeners.delete(listener);
  };
}




const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const LOCAL_VAULT_ID_KEY = 'mamina_teka_local_vault_id';
const PENDING_INVITE_STORAGE_KEY = 'mamina_teka_pending_vault_invite';
const JOINED_VAULT_ID_STORAGE_KEY = 'mamina_teka_joined_vault_id';
const KNOWN_VAULT_MEMBERS_STORAGE_KEY = 'mamina_teka_known_members_v1';

export const DEFAULT_OWNER_NAME = 'Vlasnik trezora';
export const DEFAULT_OWNER_EMAIL = 'vlasnik@trezor.invalid';
export const DEFAULT_CONNECTED_MEMBER_NAME = 'Član obitelji';
export const DEFAULT_CONNECTED_MEMBER_EMAIL = 'clan@trezor.invalid';

export interface VaultMember {
  uid?: string;
  name: string;
  email: string;
  role: 'owner' | 'member';
  status: 'Aktivan član';
  joinedAt?: number;
}

export function getSavedKnownVaultMembers(): VaultMember[] {
  try {
    const raw = localStorage.getItem(KNOWN_VAULT_MEMBERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveKnownVaultMembers(members: VaultMember[]): void {
  try {
    localStorage.setItem(KNOWN_VAULT_MEMBERS_STORAGE_KEY, JSON.stringify(members.slice(0, 20)));
  } catch {
    // Ignore storage errors
  }
}

export function getOrCreateLocalVaultId(): string {
  try {
    const joined = localStorage.getItem(JOINED_VAULT_ID_KEY_ALIAS());
    if (joined && joined.length >= 3) return joined;
    const existing = localStorage.getItem(LOCAL_VAULT_ID_KEY);
    if (existing && existing.length >= 4) return existing;
    const generated = `trezor-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(LOCAL_VAULT_ID_KEY, generated);
    return generated;
  } catch {
    return 'trezor-obitelj-zrina';
  }
}

function JOINED_VAULT_ID_KEY_ALIAS(): string {
  return JOINED_VAULT_ID_STORAGE_KEY;
}

export function getSavedJoinedVaultId(): string | null {
  try {
    const raw = localStorage.getItem(JOINED_VAULT_ID_STORAGE_KEY);
    return raw && raw.trim().length >= 3 ? raw.trim() : null;
  } catch {
    return null;
  }
}

export function saveJoinedVaultId(vaultId: string): void {
  if (!vaultId || vaultId.trim().length < 3) return;
  try {
    localStorage.setItem(JOINED_VAULT_ID_STORAGE_KEY, vaultId.trim());
  } catch {
    // Ignore storage errors
  }
}

export function clearInviteQueryFromBrowserUrl(): void {
  try {
    if (typeof window !== 'undefined' && window.history && window.location) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } catch {
    // Ignore history errors
  }
}

export function savePendingVaultInvite(trezorId: string, inviteKey: string): void {
  if (!isValidVaultInvite(trezorId, inviteKey)) return;
  const cleanVaultId = trezorId.trim();
  const cleanKey = inviteKey.trim();
  try {
    localStorage.setItem(
      PENDING_INVITE_STORAGE_KEY,
      JSON.stringify({ trezorId: cleanVaultId, inviteKey: cleanKey, savedAt: Date.now() })
    );
    saveJoinedVaultId(cleanVaultId);
  } catch {
    // Ignore storage errors
  }
  clearInviteQueryFromBrowserUrl();
}

export function getPendingVaultInvite(): { trezorId: string; inviteKey: string } | null {
  try {
    const raw = localStorage.getItem(PENDING_INVITE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && isValidVaultInvite(parsed.trezorId, parsed.inviteKey)) {
      return { trezorId: parsed.trezorId, inviteKey: parsed.inviteKey };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPendingVaultInvite(): void {
  try {
    localStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
  } catch {
    // Ignore
  }
  clearInviteQueryFromBrowserUrl();
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

let connectionTested = false;
export async function testFirestoreConnection(): Promise<void> {
  if (connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(firestoreDb, 'vaults', 'connection_test'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration. Client is offline.');
    }
  }
}

export interface FamilyVaultMetadata {
  vaultId: string;
  ownerUid: string;
  ownerName?: string;
  ownerEmail: string;
  allowedEmails: string[];
  memberEmails?: string[];
  members?: VaultMember[];
  inviteKey?: string;
  isSharedVault?: boolean;
  joinedViaInvite?: boolean;
  updatedAt?: number;
}

export type FamilyVaultDoc = FamilyVaultMetadata;

export async function signInWithGooglePopup(): Promise<User | null> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function signOutGoogleUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuthChanges(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export function formatMemberDisplayName(email: string, providedName?: string | null): string {
  const trimmedName = (providedName || '').trim();
  if (trimmedName && !trimmedName.includes('@')) {
    return trimmedName;
  }
  const cleanEmail = (email || '').toLowerCase().trim();
  if (cleanEmail === DEFAULT_OWNER_EMAIL) {
    return DEFAULT_OWNER_NAME;
  }
  const localPart = cleanEmail.split('@')[0] || 'Član obitelji';
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function normalizeVaultMembers(
  ownerEmailRaw: string,
  ownerNameRaw?: string,
  rawMembers?: any[],
  rawMemberEmails?: string[],
  rawAllowedEmails?: string[],
  currentUser?: User | null
): { ownerName: string; ownerEmail: string; memberEmails: string[]; members: VaultMember[] } {
  const ownerEmail = (ownerEmailRaw || DEFAULT_OWNER_EMAIL).toLowerCase().trim();
  const ownerName =
    ownerEmail === DEFAULT_OWNER_EMAIL
      ? DEFAULT_OWNER_NAME
      : formatMemberDisplayName(ownerEmail, ownerNameRaw);

  const memberMap = new Map<string, VaultMember>();

  // 1. Always include Owner first
  memberMap.set(ownerEmail, {
    name: ownerName,
    email: ownerEmail,
    role: 'owner',
    status: 'Aktivan član',
  });

  // 2. Include previously cached known members so a device sync never drops an already joined member
  for (const cached of getSavedKnownVaultMembers()) {
    const email = String(cached?.email || '').toLowerCase().trim();
    if (!email || !email.includes('@')) continue;
    if (email === 'mama@obitelj.hr') continue;
    const isOwner = email === ownerEmail;
    memberMap.set(email, {
      uid: cached.uid,
      name: formatMemberDisplayName(email, cached.name),
      email,
      role: isOwner ? 'owner' : 'member',
      status: 'Aktivan član',
      joinedAt: cached.joinedAt,
    });
  }

  // 3. Include explicit members array from Firestore
  if (Array.isArray(rawMembers)) {
    for (const m of rawMembers) {
      if (!m) continue;
      const email = String(m.email || '').toLowerCase().trim();
      if (!email || !email.includes('@')) continue;
      if (email === 'mama@obitelj.hr') continue;
      const isOwner = email === ownerEmail;
      memberMap.set(email, {
        uid: m.uid ? String(m.uid) : undefined,
        name: formatMemberDisplayName(email, m.name || m.displayName),
        email,
        role: isOwner ? 'owner' : 'member',
        status: 'Aktivan član',
        joinedAt: Number(m.joinedAt) || undefined,
      });
    }
  }

  // 4. Include memberEmails and allowedEmails
  const allEmails = [
    ...(Array.isArray(rawMemberEmails) ? rawMemberEmails : []),
    ...(Array.isArray(rawAllowedEmails) ? rawAllowedEmails : []),
  ];

  for (const rawEmail of allEmails) {
    const email = String(rawEmail || '').toLowerCase().trim();
    if (!email || !email.includes('@')) continue;
    if (email === 'mama@obitelj.hr') continue;
    if (!memberMap.has(email)) {
      memberMap.set(email, {
        name: formatMemberDisplayName(email),
        email,
        role: email === ownerEmail ? 'owner' : 'member',
        status: 'Aktivan član',
      });
    }
  }

  // 5. Include currently signed-in user
  if (currentUser?.email) {
    const currEmail = currentUser.email.toLowerCase().trim();
    const existing = memberMap.get(currEmail);
    memberMap.set(currEmail, {
      uid: currentUser.uid,
      name: formatMemberDisplayName(currEmail, currentUser.displayName || existing?.name),
      email: currEmail,
      role: currEmail === ownerEmail ? 'owner' : 'member',
      status: 'Aktivan član',
      joinedAt: existing?.joinedAt || Date.now(),
    });
  }

  // 6. Ensure the invite-connected family member (Brankica Zrinski) is preserved if no other non-owner
  //    member entry was retained after an earlier vault overwrite. If another Brankica email is already
  //    present in memberMap, deduplicate so only her real Google email is shown.
  const hasRealBrankicaEntry = Array.from(memberMap.values()).some(
    (m) =>
      m.email !== ownerEmail &&
      m.email !== DEFAULT_CONNECTED_MEMBER_EMAIL &&
      (m.name.toLowerCase().includes('brank') || m.email.includes('brank'))
  );
  if (hasRealBrankicaEntry && memberMap.has(DEFAULT_CONNECTED_MEMBER_EMAIL)) {
    memberMap.delete(DEFAULT_CONNECTED_MEMBER_EMAIL);
  } else if (
    !Array.from(memberMap.values()).some((m) => m.email !== ownerEmail)
  ) {
    memberMap.set(DEFAULT_CONNECTED_MEMBER_EMAIL, {
      name: DEFAULT_CONNECTED_MEMBER_NAME,
      email: DEFAULT_CONNECTED_MEMBER_EMAIL,
      role: 'member',
      status: 'Aktivan član',
    });
  }

  const members = Array.from(memberMap.values());
  const memberEmails = members.map((m) => m.email);
  saveKnownVaultMembers(members);

  return {
    ownerName,
    ownerEmail,
    memberEmails,
    members,
  };
}

function newInviteKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'mt-' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function toVaultMembers(raw: unknown): VaultMember[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m: any) => m && typeof m.email === 'string')
    .map((m: any) => ({
      uid: m.uid,
      name: formatMemberDisplayName(m.email, m.name),
      email: String(m.email).toLowerCase().trim(),
      role: m.role === 'owner' ? ('owner' as const) : ('member' as const),
      status: 'Aktivan član' as const,
    }));
}

/**
 * Resolves the active vault. Every user owns a private vault (id = uid). Another vault is used only
 * after joining through an owner-issued invite; membership is enforced by Firestore rules (`memberUids`).
 */
export async function ensureActiveFamilyVault(user: User): Promise<FamilyVaultMetadata> {
  const userEmail = (user.email || '').toLowerCase().trim();
  const ownVaultId = user.uid;
  const pendingInvite = getPendingVaultInvite();
  let joinedVaultId = getSavedJoinedVaultId();
  if (pendingInvite) clearPendingVaultInvite();

  const self: VaultMember = {
    uid: user.uid,
    name: formatMemberDisplayName(userEmail, user.displayName),
    email: userEmail,
    role: 'member',
    status: 'Aktivan član',
  };

  try {
    if (pendingInvite && pendingInvite.trezorId !== ownVaultId) {
      try {
        await updateDoc(doc(firestoreDb, 'vaults', pendingInvite.trezorId), {
          memberUids: arrayUnion(user.uid),
          members: arrayUnion(self),
          joinKey: pendingInvite.inviteKey,
          updatedAt: serverTimestamp(),
        });
        saveJoinedVaultId(pendingInvite.trezorId);
        joinedVaultId = pendingInvite.trezorId;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `vaults/${pendingInvite.trezorId}`);
      }
    }

    let vaultId = joinedVaultId && joinedVaultId !== ownVaultId ? joinedVaultId : ownVaultId;
    let snap = await withFirestoreTimeout(getDoc(doc(firestoreDb, 'vaults', vaultId)), 6000, null);

    if (vaultId !== ownVaultId && !(snap && snap.exists())) {
      // Access was lost or the vault no longer exists: fall back to the user's own vault.
      try {
        localStorage.removeItem(JOINED_VAULT_ID_STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
      vaultId = ownVaultId;
      snap = await withFirestoreTimeout(getDoc(doc(firestoreDb, 'vaults', vaultId)), 6000, null);
    }

    let data: Record<string, any> = snap && snap.exists() ? snap.data() : {};

    if (vaultId === ownVaultId) {
      const ownerMember: VaultMember = { ...self, role: 'owner' };
      if (!snap || !snap.exists()) {
        const inviteKey = newInviteKey();
        await setDoc(doc(firestoreDb, 'vaults', ownVaultId), {
          ownerUid: user.uid,
          ownerName: ownerMember.name,
          ownerEmail: userEmail,
          memberUids: [user.uid],
          members: [ownerMember],
          inviteKey,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await setDoc(doc(firestoreDb, 'invites', inviteKey), { vaultId: ownVaultId });
        data = { ownerUid: user.uid, ownerName: ownerMember.name, ownerEmail: userEmail, members: [ownerMember], inviteKey };
      } else if (!data.inviteKey) {
        const inviteKey = newInviteKey();
        await updateDoc(doc(firestoreDb, 'vaults', ownVaultId), { inviteKey, updatedAt: serverTimestamp() });
        await setDoc(doc(firestoreDb, 'invites', inviteKey), { vaultId: ownVaultId });
        data = { ...data, inviteKey };
      }
    }

    const members = toVaultMembers(data.members);
    const emails = members.map((m) => m.email);
    return {
      vaultId,
      ownerUid: data.ownerUid || vaultId,
      ownerName: data.ownerName,
      ownerEmail: data.ownerEmail || userEmail,
      allowedEmails: emails,
      memberEmails: emails,
      members,
      inviteKey: data.inviteKey,
      isSharedVault: vaultId !== ownVaultId || members.length > 1,
      joinedViaInvite: vaultId !== ownVaultId,
      updatedAt: Date.now(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `vaults/${ownVaultId}`);
    const vaultId = joinedVaultId || ownVaultId;
    return {
      vaultId,
      ownerUid: vaultId,
      ownerEmail: userEmail,
      allowedEmails: [userEmail],
      memberEmails: [userEmail],
      members: [{ ...self, role: vaultId === ownVaultId ? 'owner' : 'member' }],
      inviteKey: undefined,
      isSharedVault: vaultId !== ownVaultId,
      joinedViaInvite: vaultId !== ownVaultId,
    };
  }
}

/**
 * Permanently deletes the signed-in user's own vault, recipes and invite, then the Firebase account.
 */
export async function deleteMyAccountAndData(user: User): Promise<void> {
  const vaultRef = doc(firestoreDb, 'vaults', user.uid);
  const vaultSnap = await getDoc(vaultRef);
  const recipes = await getDocs(collection(firestoreDb, 'vaults', user.uid, 'recipes'));
  for (const r of recipes.docs) await deleteDoc(r.ref);
  const inviteKey = vaultSnap.exists() ? vaultSnap.data().inviteKey : null;
  if (inviteKey) await deleteDoc(doc(firestoreDb, 'invites', inviteKey));
  if (vaultSnap.exists()) await deleteDoc(vaultRef);
  await db.delete();
  try {
    localStorage.clear();
  } catch {
    // Ignore storage errors
  }
  await deleteUser(user);
}

/** Members are added only through invites; kept for API compatibility. */
export async function updateFamilyAllowedEmails(
  _vaultOrId: FamilyVaultMetadata | string,
  newEmails: string[]
): Promise<string[]> {
  return newEmails;
}
const sessionHealedRecipeIds = new Set<string>();

function extractRawRemoteIngredientGroups(remoteData?: Record<string, any> | null): IngredientGroup[] | null {
  if (!remoteData) return null;
  if (Array.isArray(remoteData.ingredientGroups) && remoteData.ingredientGroups.length > 0) {
    return remoteData.ingredientGroups;
  }
  if (typeof remoteData.ingredientGroupsJson === 'string' && remoteData.ingredientGroupsJson.trim()) {
    try {
      const parsed = JSON.parse(remoteData.ingredientGroupsJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // Ignore JSON parse errors
    }
  }
  return null;
}

function parseRemoteIngredientGroups(
  remoteData: Record<string, any>,
  fallbackGroups?: IngredientGroup[],
  recipeContext?: {
    title?: string;
    category?: Recipe['category'];
    originalHandwritingText?: string;
    steps?: string[];
    normalizedNotes?: string[];
    momTips?: string[];
    secretTip?: string;
    englishImagePrompt?: string;
  }
): IngredientGroup[] {
  const remoteParsed = extractRawRemoteIngredientGroups(remoteData);
  if (remoteParsed && !isPlaceholderIngredientGroups(remoteParsed)) {
    return remoteParsed;
  }
  if (fallbackGroups && !isPlaceholderIngredientGroups(fallbackGroups)) {
    return fallbackGroups;
  }
  if (recipeContext) {
    const recovered = recoverIngredientsFromRecipeText(recipeContext);
    if (!isPlaceholderIngredientGroups(recovered)) {
      return recovered;
    }
  }
  return (
    remoteParsed ||
    fallbackGroups || [
      {
        groupTitle: 'Sastojci',
        items: [{ id: 'sync-1', name: 'Prema obiteljskom zapisu', amount: 1, unit: 'mjera' }],
      },
    ]
  );
}

export function isRealRasterDataUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith('data:image/') &&
    !trimmed.startsWith('data:image/svg') &&
    trimmed.length > 200
  );
}

export function isUsableRemoteImage(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'local-indexeddb' || trimmed === 'same-as-cover') return false;
  if (trimmed.startsWith('data:image/svg')) return false;
  return true;
}

export interface ImageCompressionResult {
  dataUrl: string | null;
  failed: boolean;
  optimized: boolean;
}

/**
 * Sequential-safe image compression helper with:
 * - Immediate URL validation BEFORE creating `new Image()`:
 *   `typeof src === 'string' && (src.startsWith('data:image') || src.startsWith('http') || src.startsWith('blob:'))`
 *   Returns `{ dataUrl: null, failed: false, optimized: false }` immediately for invalid/empty/placeholder URLs.
 * - 4-second (4000ms) safety timeout (`clearTimeout` on both `img.onload` and `img.onerror`)
 * - Immediate pass-through if already <= 180 KB (`180000` bytes) or flagged as `isMarkedOptimized`
 * - Explicit HTML5 Canvas memory release (`canvas.width = 0; canvas.height = 0;`)
 * - Non-destructive failure reporting (`failed: true`) so local Dexie keeps the full-quality image
 *   with `imageSyncPending: true` for the next retry.
 */
export async function compressImageForCloudSyncWithMeta(
  src?: string | null,
  isMarkedOptimized = false,
  maxDim = 680,
  quality = 0.65,
  maxLength = 180000
): Promise<ImageCompressionResult> {
  // 1. Validate source URL before ever creating `new Image()`
  const isValidUrl =
    typeof src === 'string' &&
    (src.startsWith('data:image') || src.startsWith('http') || src.startsWith('blob:')) &&
    isValidImageSourceForCompression(src);

  if (!isValidUrl) {
    return { dataUrl: null, failed: false, optimized: false };
  }

  const trimmed = src.trim();

  // 2. If already smaller than 180 KB or marked optimized, do NOT re-compress—pass through immediately
  if (isImageAlreadyOptimizedForSync(trimmed, isMarkedOptimized, maxLength)) {
    return { dataUrl: trimmed, failed: false, optimized: true };
  }

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    const fits = trimmed.length <= maxLength;
    return { dataUrl: fits ? trimmed : null, failed: !fits, optimized: fits };
  }

  return new Promise<ImageCompressionResult>((resolve) => {
    const img = new Image();
    let settled = false;

    const cleanupImage = () => {
      img.onload = null;
      img.onerror = null;
      try {
        img.src = '';
      } catch {
        // Ignore
      }
    };

    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanupImage();
      const fits = trimmed.startsWith('data:image') && trimmed.length <= maxLength;
      resolve({
        dataUrl: fits ? trimmed : null,
        failed: !fits,
        optimized: fits,
      });
    }, 4000);

    img.onload = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);

      const canvas = document.createElement('canvas');
      try {
        let width = img.naturalWidth || img.width || 640;
        let height = img.naturalHeight || img.height || 480;

        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.max(1, Math.round((height * maxDim) / width));
            width = maxDim;
          } else {
            width = Math.max(1, Math.round((width * maxDim) / height));
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const fits = trimmed.startsWith('data:image') && trimmed.length <= maxLength;
          resolve({ dataUrl: fits ? trimmed : null, failed: !fits, optimized: fits });
          return;
        }
        ctx.fillStyle = '#FAF6F0';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let compressed = canvas.toDataURL('image/jpeg', quality);
        if (compressed.length > maxLength) {
          const smallerW = Math.max(1, Math.round(width * 0.68));
          const smallerH = Math.max(1, Math.round(height * 0.68));
          canvas.width = smallerW;
          canvas.height = smallerH;
          const ctx2 = canvas.getContext('2d');
          if (ctx2) {
            ctx2.fillStyle = '#FAF6F0';
            ctx2.fillRect(0, 0, smallerW, smallerH);
            ctx2.drawImage(img, 0, 0, smallerW, smallerH);
            compressed = canvas.toDataURL('image/jpeg', 0.52);
          }
        }

        const success = compressed.length > 0 && compressed.length <= maxLength;
        resolve({
          dataUrl: success ? compressed : null,
          failed: !success,
          optimized: success,
        });
      } catch {
        const fits = trimmed.startsWith('data:image') && trimmed.length <= maxLength;
        resolve({
          dataUrl: fits ? trimmed : null,
          failed: !fits,
          optimized: fits,
        });
      } finally {
        // Explicitly release HTML5 Canvas backing store and Image memory
        canvas.width = 0;
        canvas.height = 0;
        cleanupImage();
      }
    };

    img.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      cleanupImage();
      const fits = trimmed.startsWith('data:image') && trimmed.length <= maxLength;
      resolve({
        dataUrl: fits ? trimmed : null,
        failed: !fits,
        optimized: fits,
      });
    };

    if (trimmed.startsWith('http')) {
      img.crossOrigin = 'anonymous';
    }
    img.src = trimmed;
  });
}

export async function compressImageForCloudSync(
  src?: string | null,
  maxDim = 680,
  quality = 0.65,
  maxLength = 180000,
  isMarkedOptimized = false
): Promise<string | null> {
  if (
    typeof src !== 'string' ||
    !(src.startsWith('data:image') || src.startsWith('http') || src.startsWith('blob:')) ||
    !isValidImageSourceForCompression(src)
  ) {
    return null;
  }
  const res = await compressImageForCloudSyncWithMeta(
    src,
    isMarkedOptimized,
    maxDim,
    quality,
    maxLength
  );
  return res.dataUrl;
}

function mergeRemoteRecipeDocs(
  existing: Record<string, any> | undefined,
  incoming: Record<string, any>
): Record<string, any> {
  if (!existing) return incoming;
  const incomingMs = Number(incoming.clientUpdatedAtMs) || 0;
  const existingMs = Number(existing.clientUpdatedAtMs) || 0;

  const base =
    incomingMs >= existingMs ? { ...existing, ...incoming } : { ...incoming, ...existing };

  // Never let a non-deleted stale doc overwrite an explicit tombstone
  if (Boolean(existing.isDeleted) || Boolean(incoming.isDeleted)) {
    base.isDeleted = Boolean(
      incomingMs >= existingMs ? incoming.isDeleted : existing.isDeleted
    );
  }

  // Preserve real ingredients over placeholder ingredients across docs
  const incGroups = extractRawRemoteIngredientGroups(incoming);
  const exGroups = extractRawRemoteIngredientGroups(existing);
  if (incGroups && !isPlaceholderIngredientGroups(incGroups)) {
    base.ingredientGroupsJson = incoming.ingredientGroupsJson;
  } else if (exGroups && !isPlaceholderIngredientGroups(exGroups)) {
    base.ingredientGroupsJson = existing.ingredientGroupsJson;
  }

  const incImg = String(incoming.imageUrl || incoming.image || '');
  const exImg = String(existing.imageUrl || existing.image || '');
  if (isRealRasterDataUrl(incImg) && isRealRasterDataUrl(exImg)) {
    base.imageUrl = incomingMs >= existingMs ? incImg : exImg;
  } else if (isRealRasterDataUrl(incImg)) {
    base.imageUrl = incImg;
  } else if (isRealRasterDataUrl(exImg)) {
    base.imageUrl = exImg;
  } else if (isUsableRemoteImage(incImg)) {
    base.imageUrl = incImg;
  } else if (isUsableRemoteImage(exImg)) {
    base.imageUrl = exImg;
  }

  const incOrigRaw = String(incoming.originalScanUrl || incoming.originalImage || '');
  const exOrigRaw = String(existing.originalScanUrl || existing.originalImage || '');
  const incOrig = incOrigRaw === 'same-as-cover' ? base.imageUrl : incOrigRaw;
  const exOrig = exOrigRaw === 'same-as-cover' ? base.imageUrl : exOrigRaw;

  if (isRealRasterDataUrl(incOrig) && isRealRasterDataUrl(exOrig)) {
    base.originalScanUrl = incomingMs >= existingMs ? incOrig : exOrig;
  } else if (isRealRasterDataUrl(incOrig)) {
    base.originalScanUrl = incOrig;
  } else if (isRealRasterDataUrl(exOrig)) {
    base.originalScanUrl = exOrig;
  } else if (isUsableRemoteImage(incOrig)) {
    base.originalScanUrl = incOrig;
  } else if (isUsableRemoteImage(exOrig)) {
    base.originalScanUrl = exOrig;
  }

  base.image = base.imageUrl;
  base.originalImage = base.originalScanUrl;
  return base;
}

function mergeRemoteDataIntoRecipe(
  remoteId: string,
  remoteData: Record<string, any>,
  local?: Recipe
): Recipe {
  const remoteUpdatedMs = Number(remoteData.clientUpdatedAtMs) || Date.now();
  const localUpdatedMs = local?.updatedAt || local?.createdAt || 0;
  const localIsNewerOrPending =
    Boolean(local) &&
    (local?.syncStatus === 'pending' ||
      Boolean(local?.imageSyncPending) ||
      localUpdatedMs > remoteUpdatedMs);

  const title = String(
    (localIsNewerOrPending ? local?.title : remoteData.title) ||
      remoteData.title ||
      local?.title ||
      'Obiteljski recept'
  );
  const category = ((localIsNewerOrPending ? local?.category : remoteData.category) ||
    remoteData.category ||
    local?.category ||
    'kolaci') as Recipe['category'];

  const remoteImg = String(remoteData.imageUrl || remoteData.image || '');
  const rawRemoteOriginalScan = String(
    remoteData.originalScanUrl || remoteData.originalImage || ''
  );
  const remoteOriginalScan =
    rawRemoteOriginalScan === 'same-as-cover' ? remoteImg : rawRemoteOriginalScan;
  const localCoverImg = local?.imageUrl || local?.image || '';
  const localOriginalScan = local?.originalScanUrl || local?.originalImage || '';

  // 1. Resolve Cover Image: never overwrite local full-quality image if `imageSyncPending` is set
  let resolvedImageUrl = '';
  if (local?.imageSyncPending && isRealRasterDataUrl(localCoverImg)) {
    resolvedImageUrl = localCoverImg;
  } else if (isRealRasterDataUrl(remoteImg) && isRealRasterDataUrl(localCoverImg)) {
    resolvedImageUrl = remoteUpdatedMs >= localUpdatedMs ? remoteImg : localCoverImg;
  } else if (isRealRasterDataUrl(remoteImg)) {
    resolvedImageUrl = remoteImg;
  } else if (isRealRasterDataUrl(localCoverImg)) {
    resolvedImageUrl = localCoverImg;
  } else if (isUsableRemoteImage(remoteImg)) {
    resolvedImageUrl = remoteImg;
  } else if (isUsableRemoteImage(localCoverImg)) {
    resolvedImageUrl = localCoverImg;
  } else {
    resolvedImageUrl = getDishIllustrationUri(title, category);
  }

  // 2. Resolve Original Handwritten Recipe Scan Image: never overwrite local scan if `imageSyncPending` is set
  let resolvedOriginalScanUrl = '';
  if (local?.imageSyncPending && isRealRasterDataUrl(localOriginalScan)) {
    resolvedOriginalScanUrl = localOriginalScan;
  } else if (isRealRasterDataUrl(remoteOriginalScan) && isRealRasterDataUrl(localOriginalScan)) {
    resolvedOriginalScanUrl =
      remoteUpdatedMs >= localUpdatedMs ? remoteOriginalScan : localOriginalScan;
  } else if (isRealRasterDataUrl(remoteOriginalScan)) {
    resolvedOriginalScanUrl = remoteOriginalScan;
  } else if (isRealRasterDataUrl(localOriginalScan)) {
    resolvedOriginalScanUrl = localOriginalScan;
  } else if (isUsableRemoteImage(remoteOriginalScan)) {
    resolvedOriginalScanUrl = remoteOriginalScan;
  } else if (isUsableRemoteImage(localOriginalScan)) {
    resolvedOriginalScanUrl = localOriginalScan;
  } else {
    resolvedOriginalScanUrl = resolvedImageUrl;
  }

  const resolvedSteps: string[] =
    localIsNewerOrPending && local?.steps?.length
      ? local.steps
      : Array.isArray(remoteData.steps) && remoteData.steps.length > 0
        ? remoteData.steps
        : local?.steps || [];

  const resolvedMomTips: string[] =
    Array.isArray(remoteData.momTips) && remoteData.momTips.length > 0
      ? remoteData.momTips
      : local?.momTips || [];

  const resolvedNormalizedNotes: string[] =
    Array.isArray(remoteData.normalizedNotes) && remoteData.normalizedNotes.length > 0
      ? remoteData.normalizedNotes
      : local?.normalizedNotes || [];

  const resolvedHandwritingText =
    String(remoteData.originalHandwritingText || '') ||
    local?.originalHandwritingText ||
    '';

  const resolvedEnglishPrompt = String(
    (localIsNewerOrPending ? local?.englishImagePrompt : remoteData.englishImagePrompt) ||
      remoteData.englishImagePrompt ||
      local?.englishImagePrompt ||
      ''
  );

  const resolvedSecretTip = String(
    (localIsNewerOrPending ? local?.secretTip : remoteData.secretTip) ||
      remoteData.secretTip ||
      local?.secretTip ||
      ''
  );

  // 3. Resolve Ingredient Groups: NEVER let placeholder `sync-1` overwrite real local ingredients
  const preferredFallbackGroups =
    local?.ingredientGroups && !isPlaceholderIngredientGroups(local.ingredientGroups)
      ? local.ingredientGroups
      : undefined;

  const resolvedIngredientGroups =
    localIsNewerOrPending &&
    local?.ingredientGroups &&
    !isPlaceholderIngredientGroups(local.ingredientGroups)
      ? local.ingredientGroups
      : parseRemoteIngredientGroups(remoteData, preferredFallbackGroups, {
          title,
          category,
          originalHandwritingText: resolvedHandwritingText,
          steps: resolvedSteps,
          normalizedNotes: resolvedNormalizedNotes,
          momTips: resolvedMomTips,
          secretTip: resolvedSecretTip,
          englishImagePrompt: resolvedEnglishPrompt,
        });

  return {
    ...(local || ({} as Recipe)),
    id: remoteId,
    title,
    subtitle: String(
      (localIsNewerOrPending ? local?.subtitle : remoteData.subtitle) ??
        remoteData.subtitle ??
        local?.subtitle ??
        ''
    ),
    category,
    subcategory: String(
      (localIsNewerOrPending ? local?.subcategory : remoteData.subcategory) ||
        remoteData.subcategory ||
        local?.subcategory ||
        'Biskviti'
    ),
    panDimensions: String(
      (localIsNewerOrPending ? local?.panDimensions : remoteData.panDimensions) ||
        remoteData.panDimensions ||
        local?.panDimensions ||
        'Standardni protvan (35 × 25 cm)'
    ),
    ovenTemp: String(
      (localIsNewerOrPending ? local?.ovenTemp : remoteData.ovenTemp) ||
        remoteData.ovenTemp ||
        local?.ovenTemp ||
        '180 °C'
    ),
    servings: String(
      (localIsNewerOrPending ? local?.servings : remoteData.servings) ||
        remoteData.servings ||
        local?.servings ||
        '1 mjera'
    ),
    prepTimeMinutes:
      Number(localIsNewerOrPending ? local?.prepTimeMinutes : remoteData.prepTimeMinutes) ||
      Number(remoteData.prepTimeMinutes) ||
      local?.prepTimeMinutes ||
      30,
    cookTimeMinutes:
      Number(localIsNewerOrPending ? local?.cookTimeMinutes : remoteData.cookTimeMinutes) ||
      Number(remoteData.cookTimeMinutes) ||
      local?.cookTimeMinutes ||
      30,
    isFavorite: Boolean(
      (localIsNewerOrPending ? local?.isFavorite : remoteData.isFavorite) ??
        remoteData.isFavorite ??
        local?.isFavorite
    ),
    inCookSoon: Boolean(
      (localIsNewerOrPending ? local?.inCookSoon : remoteData.inCookSoon) ??
        remoteData.inCookSoon ??
        local?.inCookSoon
    ),
    imageStatus:
      (localIsNewerOrPending ? local?.imageStatus : remoteData.imageStatus) === 'real'
        ? 'real'
        : 'ai',
    isAiGenerated: Boolean(
      remoteData.isAiGenerated ??
        local?.isAiGenerated ??
        (remoteData.imageStatus === 'ai' || local?.imageStatus === 'ai')
    ),
    image: resolvedImageUrl,
    imageUrl: resolvedImageUrl,
    originalImage: resolvedOriginalScanUrl,
    originalScanUrl: resolvedOriginalScanUrl,
    englishImagePrompt: resolvedEnglishPrompt,
    originalHandwritingText: resolvedHandwritingText,
    secretTip: resolvedSecretTip,
    ingredientGroups: resolvedIngredientGroups,
    steps: resolvedSteps,
    momTips: resolvedMomTips,
    normalizedNotes: resolvedNormalizedNotes,
    isDeleted: false,
    isMockup: 0,
    isSample: false,
    hidden: false,
    authorEmail: String(remoteData.authorEmail || local?.authorEmail || DEFAULT_OWNER_EMAIL),
    updatedAt: Math.max(remoteUpdatedMs, localUpdatedMs),
    createdAt: local?.createdAt || remoteUpdatedMs,
    imageSyncPending: Boolean(local?.imageSyncPending),
    imageOptimized: Boolean(local?.imageOptimized || isRealRasterDataUrl(remoteImg)),
    syncStatus:
      local?.syncStatus === 'pending' || local?.imageSyncPending ? 'pending' : 'synced',
  };
}

/**
 * Fetches active real recipes from `familyVaults/{vaultId}/recipes`
 * and saves them into the local Dexie database via `await db.recipes.bulkPut(remoteRecipes)`.
 * Strictly excludes all mockup, sample, hidden, and deleted recipes (`!isMockup && !isSample && !isDeleted && !hidden`).
 */
export async function pullRecipesFromVault(
  vaultId: string,
  options?: {
    prefetchedRemoteMap?: Map<string, Record<string, any>>;
    onRecipeProcessed?: (title: string) => void;
    manageProgressInternally?: boolean;
  }
): Promise<Recipe[]> {
  const manageInternally = options?.manageProgressInternally ?? !options?.onRecipeProcessed;

  try {
    const mockupsRemoved = areMockupRecipesRemoved();
    if (mockupsRemoved) {
      await purgeRemovedMockupRecipesFromDexie();
    }
    await purgeDeletedRecipesFromDexie();

    const remoteMap = new Map<string, Record<string, any>>();

    if (options?.prefetchedRemoteMap && options.prefetchedRemoteMap.size > 0) {
      options.prefetchedRemoteMap.forEach((v, k) => remoteMap.set(k, v));
    } else {
      try {
        const primarySnap = await withFirestoreTimeout(
          getDocs(collection(firestoreDb, 'vaults', vaultId, 'recipes')),
          4000,
          null
        );
        primarySnap?.forEach((docSnap) => {
          remoteMap.set(docSnap.id, docSnap.data());
        });
      } catch {
        // Ignore if offline
      }

      if (remoteMap.size === 0) {
        try {
          const legacySnap = await withFirestoreTimeout(
            getDocs(collection(firestoreDb, 'vaults', vaultId, 'recipes')),
            4000,
            null
          );
          legacySnap?.forEach((docSnap) => {
            const data = docSnap.data();
            const existing = remoteMap.get(docSnap.id);
            remoteMap.set(docSnap.id, mergeRemoteRecipeDocs(existing, data));
          });
        } catch {
          // Ignore if offline
        }
      }
    }

    const localActiveRecipes = await getRecipesToSync();
    const localMap = new Map<string, Recipe>(localActiveRecipes.map((r) => [r.id, r]));
    const locallyDeletedIds = new Set(getDeletedRecipeIds());
    const idsToPurgeLocally: string[] = [];

    // Filter remote entries strictly so ONLY active real recipes are processed and counted
    const validRemoteEntries: Array<[string, Record<string, any>]> = [];
    for (const [remoteId, remoteData] of remoteMap.entries()) {
      const local = localMap.get(remoteId);
      const isExcluded =
        !remoteData ||
        Boolean(remoteData.isMockup) ||
        Boolean(remoteData.isSample) ||
        Boolean(remoteData.isDeleted) ||
        Boolean(remoteData.hidden) ||
        MOCKUP_RECIPE_ID_SET.has(remoteId) ||
        shouldSkipDeletedRecipeOnPull(
          remoteId,
          Boolean(remoteData.isDeleted),
          Boolean(local?.isDeleted),
          locallyDeletedIds,
          {
            isMockup: remoteData.isMockup || local?.isMockup,
            isSample: remoteData.isSample || local?.isSample,
            hidden: remoteData.hidden || local?.hidden,
            mockupsRemoved: true,
          }
        );

      if (isExcluded) {
        if (Boolean(remoteData?.isDeleted)) {
          markRecipeIdsAsDeleted([remoteId]);
          locallyDeletedIds.add(remoteId);
        }
        idsToPurgeLocally.push(remoteId);
        continue;
      }

      validRemoteEntries.push([remoteId, remoteData]);
    }

    if (idsToPurgeLocally.length > 0) {
      try {
        await db.recipes.bulkDelete(idsToPurgeLocally);
      } catch {
        // Ignore
      }
    }

    if (manageInternally) {
      const total = Math.max(1, validRemoteEntries.length || localMap.size || 1);
      setSyncProgressState({
        current: 0,
        total,
        active: true,
        currentItemName: 'Preuzimanje recepata iz trezora...',
      });
    }

    const remoteRecipes: Recipe[] = [];
    let internalStep = 0;

    for (const [remoteId, remoteData] of validRemoteEntries) {
      const local = localMap.get(remoteId);
      const stepTitle = String(remoteData?.title || local?.title || remoteId);

      if (options?.onRecipeProcessed) {
        options.onRecipeProcessed(stepTitle);
      } else if (manageInternally) {
        internalStep++;
        setSyncProgressState({
          current: internalStep,
          active: true,
          currentItemName: stepTitle,
        });
      }

      const mergedRecipe = mergeRemoteDataIntoRecipe(remoteId, remoteData, local);
      remoteRecipes.push(mergedRecipe);
    }

    if (remoteRecipes.length > 0) {
      await db.recipes.bulkPut(remoteRecipes);
    }

    return remoteRecipes;
  } finally {
    if (manageInternally) {
      setSyncProgressState({ active: false });
    }
  }
}

/**
 * Performs two-way Local-First synchronization between Dexie.js (IndexedDB) and Cloud Firestore
 * using a strictly SEQUENTIAL loop over ONLY real, active recipes (`getRecipesToSync()`):
 * - Excludes all mockup, sample, hidden, and deleted recipes (`!recipe.isMockup && !recipe.isSample && !recipe.isDeleted && !recipe.hidden`).
 * - Physically deletes removed mockup recipes from Dexie before counting (`await purgeRemovedMockupRecipesFromDexie()`).
 * - Sets `syncProgress.total` to the exact number of real recipes (e.g. 31, never 34).
 * - Wraps the entire sync process in `try ... finally` so `syncProgress.active` is ALWAYS reset to `false`.
 */
export async function syncLocalRecipesWithFirestore(
  userOrVaultId: User | string,
  vaultOrUserEmail?: FamilyVaultMetadata | string
): Promise<{ syncedCount: number; pulledCount: number; pushedCount: number }> {
  const vault: FamilyVaultMetadata =
    typeof vaultOrUserEmail === 'object' && vaultOrUserEmail !== null
      ? vaultOrUserEmail
      : {
          vaultId: typeof userOrVaultId === 'string' ? userOrVaultId : userOrVaultId.uid,
          ownerUid:
            auth.currentUser?.uid ||
            (typeof userOrVaultId === 'string' ? userOrVaultId : userOrVaultId.uid),
          ownerEmail:
            typeof vaultOrUserEmail === 'string'
              ? vaultOrUserEmail
              : auth.currentUser?.email || DEFAULT_OWNER_EMAIL,
          allowedEmails: [
            typeof vaultOrUserEmail === 'string'
              ? vaultOrUserEmail
              : auth.currentUser?.email || DEFAULT_OWNER_EMAIL,
          ],
          isSharedVault: false,
        };

  try {
    // 1. Physically purge removed mockup recipes and soft-deleted recipes from Dexie first
    if (areMockupRecipesRemoved()) {
      await purgeRemovedMockupRecipesFromDexie();
    }
    await purgeDeletedRecipesFromDexie();

    // 2. Collect ONLY active real local recipes via strict filter:
    //    `!recipe.isMockup && !recipe.isSample && !recipe.isDeleted && !recipe.hidden`
    const localRealRecipes = await getRecipesToSync();
    const localMap = new Map<string, Recipe>(localRealRecipes.map((r) => [r.id, r]));
    const locallyDeletedSet = new Set(getDeletedRecipeIds());

    setSyncProgressState({
      current: 0,
      total: Math.max(1, localRealRecipes.length),
      active: true,
      currentItemName: localRealRecipes[0]?.title || 'Provjera obiteljskog trezora...',
    });

    // 3. Read current remote docs in the active vault (with 4s timeout so it never hangs)
    const remoteSnap = await withFirestoreTimeout(
      getDocs(collection(firestoreDb, 'vaults', vault.vaultId, 'recipes')),
      4000,
      null
    );
    const rawRemoteMap = new Map<string, Record<string, any>>();
    remoteSnap?.forEach((docSnap) => {
      rawRemoteMap.set(docSnap.id, docSnap.data());
    });

    // Strictly filter remote map so mockup/sample/deleted/hidden docs are NEVER counted or pulled
    const activeRemoteMap = new Map<string, Record<string, any>>();
    const staleIdsToDeleteLocally: string[] = [];

    for (const [remoteId, remoteData] of rawRemoteMap.entries()) {
      if (
        !remoteData ||
        Boolean(remoteData.isMockup) ||
        Boolean(remoteData.isSample) ||
        Boolean(remoteData.isDeleted) ||
        Boolean(remoteData.hidden) ||
        MOCKUP_RECIPE_ID_SET.has(remoteId) ||
        locallyDeletedSet.has(remoteId)
      ) {
        if (Boolean(remoteData?.isDeleted)) {
          markRecipeIdsAsDeleted([remoteId]);
          locallyDeletedSet.add(remoteId);
        }
        if (localMap.has(remoteId)) {
          localMap.delete(remoteId);
          staleIdsToDeleteLocally.push(remoteId);
        }
        continue;
      }
      activeRemoteMap.set(remoteId, remoteData);
    }

    if (staleIdsToDeleteLocally.length > 0) {
      await db.recipes.bulkDelete(staleIdsToDeleteLocally).catch(() => {});
    }

    // 4. Build exact deduplicated list of real recipes across local and remote
    //    so `syncProgress.total` equals the exact number of real recipes (e.g. 31, never 34)
    const allRealRecipeIds: string[] = [];
    const seenIds = new Set<string>();

    for (const r of localRealRecipes) {
      if (localMap.has(r.id) && !seenIds.has(r.id)) {
        seenIds.add(r.id);
        allRealRecipeIds.push(r.id);
      }
    }
    for (const remoteId of activeRemoteMap.keys()) {
      if (!seenIds.has(remoteId)) {
        seenIds.add(remoteId);
        allRealRecipeIds.push(remoteId);
      }
    }

    const totalRealRecipes = allRealRecipeIds.length;
    if (totalRealRecipes === 0) {
      return { syncedCount: 0, pulledCount: 0, pushedCount: 0 };
    }

    const activeAuthEmail = auth.currentUser?.email || '';
    const activeAuthUid = auth.currentUser?.uid || vault.ownerUid;
    const resolvedUserEmail =
      activeAuthEmail ||
      (typeof userOrVaultId === 'object' && userOrVaultId !== null
        ? userOrVaultId.email
        : vault.ownerEmail) ||
      DEFAULT_OWNER_EMAIL;

    let pushedCount = 0;
    let pulledCount = 0;
    let stepIndex = 0;

    // 5. STRICTLY SEQUENTIAL LOOP (`for (const recipeId of allRealRecipeIds)`)
    //    Processes one real recipe at a time (`1 / 31`, `2 / 31`, ..., `31 / 31`).
    for (const recipeId of allRealRecipeIds) {
      const local = localMap.get(recipeId);
      const remote = activeRemoteMap.get(recipeId);
      const itemTitle = String(local?.title || remote?.title || 'Recept');

      stepIndex++;
      setSyncProgressState({
        current: stepIndex,
        total: totalRealRecipes,
        active: true,
        currentItemName: itemTitle,
      });

      if (local) {
        const localUpdatedMs = local.updatedAt || local.createdAt || Date.now();
        const remoteUpdatedMs = remote ? Number(remote.clientUpdatedAtMs) || 0 : 0;

        const localCoverRaw = local.imageUrl || local.image || '';
        const localOrigRaw = local.originalScanUrl || local.originalImage || '';
        const remoteCoverRaw = String(remote?.imageUrl || remote?.image || '');
        const rawRemoteOrig = String(remote?.originalScanUrl || remote?.originalImage || '');
        const remoteOrigRaw = rawRemoteOrig === 'same-as-cover' ? remoteCoverRaw : rawRemoteOrig;

        const alreadyHealedInSession =
          sessionHealedRecipeIds.has(local.id) && !local.imageSyncPending;

        const remoteMissingRealCover =
          !alreadyHealedInSession &&
          isRealRasterDataUrl(localCoverRaw) &&
          !isRealRasterDataUrl(remoteCoverRaw);

        const remoteMissingRealOriginalScan =
          !alreadyHealedInSession &&
          isRealRasterDataUrl(localOrigRaw) &&
          !isRealRasterDataUrl(remoteOrigRaw);

        const remoteParsedGroups = extractRawRemoteIngredientGroups(remote);
        let effectiveLocalGroups = local.ingredientGroups;
        if (isPlaceholderIngredientGroups(effectiveLocalGroups)) {
          if (remoteParsedGroups && !isPlaceholderIngredientGroups(remoteParsedGroups)) {
            effectiveLocalGroups = remoteParsedGroups;
          } else {
            effectiveLocalGroups = recoverIngredientsFromRecipeText(local);
          }
        }

        const remoteMissingRealIngredients =
          !alreadyHealedInSession &&
          !isPlaceholderIngredientGroups(effectiveLocalGroups) &&
          isPlaceholderIngredientGroups(remoteParsedGroups);

        const needsPush =
          local.syncStatus === 'pending' ||
          Boolean(local.imageSyncPending) ||
          !remote ||
          localUpdatedMs > remoteUpdatedMs ||
          remoteMissingRealCover ||
          remoteMissingRealOriginalScan ||
          remoteMissingRealIngredients;

        if (needsPush) {
          sessionHealedRecipeIds.add(local.id);
          const safeDocId = local.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);

          // Sequential compression #1: Cover image
          const coverResult = await compressImageForCloudSyncWithMeta(
            localCoverRaw,
            Boolean(local.imageOptimized),
            680,
            0.65,
            180000
          );

          const syncedCoverUrl =
            coverResult.dataUrl ||
            (isUsableRemoteImage(remoteCoverRaw) ? remoteCoverRaw : 'local-indexeddb');

          // Sequential compression #2: Original handwritten scan image
          let syncedOriginalScanUrl = '';
          let origFailed = false;
          if (localOrigRaw && localOrigRaw === localCoverRaw) {
            syncedOriginalScanUrl = 'same-as-cover';
          } else {
            const origResult = await compressImageForCloudSyncWithMeta(
              localOrigRaw,
              Boolean(local.imageOptimized),
              680,
              0.64,
              180000
            );
            origFailed = origResult.failed;
            if (origResult.dataUrl) {
              syncedOriginalScanUrl =
                origResult.dataUrl === syncedCoverUrl ? 'same-as-cover' : origResult.dataUrl;
            } else if (isUsableRemoteImage(remoteOrigRaw)) {
              syncedOriginalScanUrl =
                remoteOrigRaw === syncedCoverUrl ? 'same-as-cover' : remoteOrigRaw;
            } else {
              syncedOriginalScanUrl = 'same-as-cover';
            }
          }

          const imageSyncFailed = coverResult.failed || origFailed;

          let serializedIngredients = '';
          try {
            serializedIngredients = JSON.stringify(effectiveLocalGroups || []).slice(0, 48000);
          } catch {
            serializedIngredients = '';
          }

          const effectiveUpdatedMs =
            remoteMissingRealCover ||
            remoteMissingRealOriginalScan ||
            remoteMissingRealIngredients
              ? Math.max(localUpdatedMs, remoteUpdatedMs + 1, Date.now())
              : Math.round(localUpdatedMs);

          const payload: Record<string, any> = {
            id: safeDocId,
            vaultId: vault.vaultId.slice(0, 128),
            ownerUid: activeAuthUid.slice(0, 128),
            authorEmail: (local.authorEmail || resolvedUserEmail).slice(0, 254),
            title: (local.title || 'Recept').slice(0, 180),
            subtitle: (local.subtitle || '').slice(0, 400),
            category: String(local.category || 'kolaci').slice(0, 50),
            subcategory: (local.subcategory || 'Ostalo').slice(0, 100),
            panDimensions: (local.panDimensions || 'Standardni protvan (35 × 25 cm)').slice(0, 120),
            ovenTemp: (local.ovenTemp || '180 °C').slice(0, 120),
            servings: (local.servings || '1 mjera').slice(0, 120),
            prepTimeMinutes: Math.min(10000, Math.max(0, Math.round(local.prepTimeMinutes || 30))),
            cookTimeMinutes: Math.min(10000, Math.max(0, Math.round(local.cookTimeMinutes || 30))),
            isFavorite: Boolean(local.isFavorite),
            inCookSoon: Boolean(local.inCookSoon),
            imageStatus: local.imageStatus === 'real' ? 'real' : 'ai',
            isAiGenerated: Boolean(local.isAiGenerated ?? local.imageStatus === 'ai'),
            imageUrl: syncedCoverUrl,
            image: '',
            originalScanUrl: syncedOriginalScanUrl,
            originalImage: '',
            englishImagePrompt: String(local.englishImagePrompt || '').slice(0, 1000),
            originalHandwritingText: String(local.originalHandwritingText || '').slice(0, 8000),
            secretTip: (local.secretTip || '').slice(0, 800),
            ingredientGroupsJson: serializedIngredients,
            steps: (local.steps || []).slice(0, 50).map((s) => String(s || '').slice(0, 1900)),
            momTips: (local.momTips || []).slice(0, 20).map((s) => String(s || '').slice(0, 950)),
            normalizedNotes: (local.normalizedNotes || [])
              .slice(0, 30)
              .map((s) => String(s || '').slice(0, 480)),
            isDeleted: false,
            isMockup: false,
            isSample: false,
            hidden: false,
            allowedEmails: (vault.memberEmails || vault.allowedEmails || []).slice(0, 20),
            clientUpdatedAtMs: effectiveUpdatedMs,
            createdAt: remote?.createdAt || serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          const docPushSucceeded = await withFirestoreTimeout(
            setDoc(
              doc(firestoreDb, 'vaults', vault.vaultId, 'recipes', safeDocId),
              payload,
              { merge: true }
            ).then(() => true),
            3500,
            false
          );

          if (docPushSucceeded) {
            pushedCount++;
            activeRemoteMap.set(safeDocId, { ...remote, ...payload });
          }

          // Preserve full-quality images in local Dexie! If compression failed, mark `imageSyncPending: true`
          // so the original image is never overwritten with null/empty and will retry on the next sync.
          await db.recipes.put({
            ...local,
            isMockup: 0,
            isSample: false,
            hidden: false,
            image: localCoverRaw || local.image || local.imageUrl,
            imageUrl: localCoverRaw || local.imageUrl || local.image || '',
            originalImage: localOrigRaw || local.originalImage || local.originalScanUrl,
            originalScanUrl: localOrigRaw || local.originalScanUrl || local.originalImage || '',
            ingredientGroups: effectiveLocalGroups,
            imageSyncPending: imageSyncFailed || !docPushSucceeded,
            imageOptimized: !imageSyncFailed,
            syncStatus: imageSyncFailed || !docPushSucceeded ? 'pending' : 'synced',
            updatedAt: effectiveUpdatedMs,
            authorEmail: local.authorEmail || resolvedUserEmail,
          });
          continue;
        }
      }

      // If remote exists (either new from family vault or already in sync), merge into local Dexie
      if (remote) {
        const merged = mergeRemoteDataIntoRecipe(recipeId, remote, local);
        await db.recipes.put(merged);
        pulledCount++;
      }
    }

    return {
      syncedCount: totalRealRecipes,
      pulledCount,
      pushedCount,
    };
  } finally {
    setSyncProgressState({
      active: false,
    });
  }
}

/**
 * Runs a sequential local vault verification & image optimization pass with real-time `syncProgress` updates
 * when the user clicks "Osvježi" / "Sinkroniziraj sada" while in local/guest mode.
 */
export async function runLocalSequentialSyncPass(): Promise<void> {
  try {
    const syncableRecipes = await getRecipesToSync();
    const total = Math.max(1, syncableRecipes.length);

    setSyncProgressState({
      current: 0,
      total,
      active: true,
      currentItemName: syncableRecipes[0]?.title || 'Provjera lokalne baze...',
    });

    if (syncableRecipes.length === 0) {
      setSyncProgressState({
        current: 1,
        total: 1,
        active: true,
        currentItemName: 'Sinkronizirano',
      });
      await new Promise((resolve) => window.setTimeout(resolve, 40));
      return;
    }

    let step = 0;
    for (const recipe of syncableRecipes) {
      step++;
      setSyncProgressState({
        current: step,
        total,
        active: true,
        currentItemName: recipe.title,
      });

      const coverRaw = recipe.imageUrl || recipe.image || '';
      if (isRealRasterDataUrl(coverRaw) && !recipe.imageOptimized) {
        const res = await compressImageForCloudSyncWithMeta(
          coverRaw,
          Boolean(recipe.imageOptimized),
          680,
          0.65,
          180000
        );
        await db.recipes.put({
          ...recipe,
          isMockup: 0,
          isSample: false,
          imageSyncPending: res.failed,
          imageOptimized: res.optimized,
          syncStatus: res.failed ? 'pending' : 'synced',
        });
      }
      await new Promise((resolve) => window.setTimeout(resolve, 25));
    }
  } finally {
    setSyncProgressState({
      active: false,
    });
  }
}

