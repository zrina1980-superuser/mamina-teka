# Arhitektura sustava — Mamina Teka by Zrina

Ovaj dokument opisuje arhitekturu, podatkovni tok, pohranu podataka, sustav tiska PDF kuharice, višestupanjsku navigaciju i AI integracije aplikacije **Mamina Teka by Zrina**.

---

## 1. Pregled arhitekture (Local-First + Cloud Sync + AI Proxy + Print Engine)

Aplikacija je izgrađena prema **Local-First (Offline-First)** načelu kako bi u kuhinji radila trenutačno i bez ovisnosti o internetskoj vezi, uz sinkronizaciju obiteljskog trezora u oblaku (uključujući kompresirane fotografije jela i skenove rukopisa ispod 1 MB limita), poslužiteljske AI rute i dvonamjenski sustav ispisa PDF kuharice.

```text
+-----------------------------------------------------------------------+
|                        KLIJENT (React 19 SPA / PWA)                   |
|                                                                       |
|  +--------------------+   +--------------------+   +---------------+  |
|  | UI Komponente      |   | Čista domenska     |   | Lokalna baza  |  |
|  | (HomeView, Recept, |<->| logika, Back stog  |<->| IndexedDB     |  |
|  |  Skener, Kuhanje,  |   | & Booklet (A4/A5)  |   | (Dexie.js:    |  |
|  |  PDF A4/A5 Print)  |   | (recipeLogic.ts)   |   |  src/db/)     |  |
|  +---------+----------+   +--------------------+   +-------+-------+  |
|            |                                               |          |
+------------|-----------------------------------------------|----------+
             | REST JSON (/api/*)                            | Firestore SDK
             v                                               v
+------------------------------------+     +----------------------------+
| POSLUŽITELJ (Express / server.ts)  |     | FIREBASE OBLAK             |
|                                    |     |                            |
| - POST /api/ocr-recipe             |     | - Firebase Auth (Google)   |
| - POST /api/translate-dish-prompt  |     | - Firestore (< 350 KB/doc):|
| - POST /api/generate-recipe-image  |     |   /familyVaults/{vaultId}  |
| - GET  /api/imagen-diagnostics     |     |   /familyVaults/.../recipes|
+-----------------+------------------+     +----------------------------+
                  |
                  v
+------------------------------------+
| GOOGLE GEMINI & IMAGEN API         |
| - Gemini Vision OCR & Prijevod     |
| - Imagen 3 (:predict / SDK)        |
+------------------------------------+
```

---

## 2. Struktura direktorija

```text
/
├── server.ts                        # Express poslužitelj, AI proxy rute i Vite middleware
├── firestore.rules                  # Sigurnosna pravila za obiteljske trezore u Firestoreu
├── firebase-blueprint.json          # Shema Firestore kolekcija i dokumenata
├── src/
│   ├── App.tsx                      # Glavni korijenski spremnik, višestupanjski Back stog i sinkronizacija
│   ├── index.css                    # Tailwind CSS v4 konfiguracija, @custom-variant dark i @media print
│   ├── db/
│   │   ├── tekaDb.ts                # Dexie (IndexedDB) shema, tombstone brisanje i obnova sastojaka
│   │   └── seedRecipes.ts           # Početni ogledni obiteljski recepti
│   ├── services/
│   │   ├── geminiVisionService.ts   # Klijentski servis za OCR rukopisa i generiranje AI slika
│   │   └── firebaseSync.ts          # Google prijava, sinkronizacija recepata/slika (<1MB) i članova trezora
│   ├── utils/
│   │   ├── recipeLogic.ts           # Čiste funkcije: skaliranje, Back stog, obnova sastojaka, A5 Booklet Imposition
│   │   └── recipeLogic.test.ts      # Jedinični testovi (node:test) za svu domensku, navigacijsku i ispisnu logiku
│   └── components/
│       ├── Header.tsx               # Fiksno zaglavlje i padajući izbornik profila s vizualnim brojačem sinkronizacije
│       ├── HomeView.tsx             # Vizualni početni zaslon: Hero prijedlog dana, kompaktna tražilica i vrtuljci
│       ├── RecipeDetailView.tsx     # Detaljni prikaz recepta, OCR obnova sastojaka, dijeljenje sa slikom i PDF
│       ├── EditRecipeModal.tsx      # Modal za cjelovito uređivanje postojećeg recepta i AI prompta
│       ├── ScanWizardModal.tsx      # 3-stupanjski čarobnjak za skeniranje maminog rukopisa
│       ├── CookingModeModal.tsx     # "Kreni kuhati" sučelje s krupnim slovima, tajmerima i Wake Lockom
│       └── AboutAndPrintView.tsx    # Obiteljski trezor, aktivni članovi, upravljanje oglednim receptima i A4/A5 PDF
```

---

## 3. Pohrana podataka, zaštita sastojaka i sinkronizacija obiteljskog trezora

### 3.1. Lokalna baza podataka i trajno uklanjanje oglednih recepata (`src/db/tekaDb.ts`)
- Temelji se na **Dexie.js** omotaču oko pregledničkog **IndexedDB-a**.
- **Trajno brisanje oglednih (mockup) recepata**:
  - Brisanjem oglednih recepata u *O Teki* zapisuje se lokalna zastavica `mamina_teka_mockups_removed_v1 = 'true'` te se za svaki ogledni recept sprema *tombstone* zapis (`isDeleted: true, syncStatus: 'pending'`) koji se sinkronizira u Firestore trezor.
  - Prilikom povlačenja recepata iz oblaka (`pullRecipesFromVault`), funkcija `shouldSkipDeletedRecipeOnPull` sprječava ponovno preuzimanje obrisanih oglednih recepata.

### 3.2. Sekvencijalna sinkronizacija slika (< 180 KB), oslobađanje RAM-a i vizualni brojač napretka (`src/services/firebaseSync.ts` & `src/components/Header.tsx`)
- **Sekvencijalna obrada bez zagušenja mobilnog RAM-a**:
  - Umjesto paralelnih `Promise.all` poziva, svi recepti i slike obrađuju se isključivo u sekvencijalnoj petlji (`for (const recipe of recipesToSync)`).
  - Učitavanje svake slike na HTML5 Canvas zaštićeno je timeoutom od **4 sekunde (`4000 ms`)** uz `clearTimeout` u `onload` i `onerror`. Nakon pretvorbe u JPEG, memorija canvasa se trenutačno oslobađa (`canvas.width = 0; canvas.height = 0;`).
  - Slike koje su već manje od **180 KB** ili imaju zastavicu `imageOptimized: true` preskaču ponovnu kompresiju (`isImageAlreadyOptimizedForSync`). Ako kompresija pojedine slike ne uspije, lokalna slika u Dexie bazi ostaje netaknuta u punoj kvaliteti uz oznaku `imageSyncPending: true`.
- **Reaktivni brojač napretka (`SyncProgressState`) i strogi `try ... finally` blok**:
  - Prije pokretanja sinkronizacije izračunava se ukupan broj koraka (`total`), a kroz petlju se ažurira `syncProgress.current++` i prikazuje u stvarnom vremenu u `Header.tsx` (`{syncProgress.current} / {syncProgress.total}` uz traku napretka). U `finally` bloku zastavice `isSyncing` i `syncProgress.active` garantirano se vraćaju na `false`, a status prelazi u `"🟢 Sinkronizirano"`.
- **Zaštita i samoiscjeljivanje popisa sastojaka (`isPlaceholderIngredientGroups` & `recoverIngredientsFromRecipeText`)**:
  - Sprječava da privremeni placeholder `sync-1 ("Prema obiteljskom zapisu")` prepiše stvarne lokalne sastojke. Ako je dokument u oblaku prethodno bio oštećen, sastojci se automatski rekonstruiraju iz `originalHandwritingText` i koraka pripreme ili putem gumba **„Očitaj s rukopisa”** (`POST /api/ocr-recipe`).

---

## 4. Višestupanjska „Back” navigacija i pamćenje pozicije skrolanja (`App.tsx` & `recipeLogic.ts`)

Funkcija `resolveBackNavigationStep` upravlja redoslijedom povratka pri pritisku na hardversku tipku *Back*, preglednički *Back* (`popstate`), rubnu gestu povlačenja ili gumb `[ ← ]`:
1. **`close-modal`**: Zatvara otvoreni modal (Način kuhanja, Skener rukopisa ili potvrdu brisanja).
2. **`close-recipe-restore-scroll`**: Zatvara prikaz detalja recepta i vraća prethodno aktivnu karticu, filtre i točnu poziciju skrolanja (`window.scrollY`) sa stoga `navigationStackRef`.
3. **`scroll-to-top`**: Ako je korisnik skrolao niže u popisu recepata (`scrollY > 120px`), vraća ga na početak popisa.
4. **`return-to-home`**: Iz bilo koje druge kartice (*Kategorije*, *Kuhaj uskoro*, *Favoriti*, *O Teki*) ili aktivne pretrage vraća na početni zaslon (*Teka*).
5. **`show-exit-toast` -> `exit-app`**: Na vrhu početnog zaslona prikazuje obavijest za dvostruki pritisak unutar 2.5 sekunde prije izlaska iz aplikacije.

---

## 5. Sustav izvoza i ispisa PDF kuharice (`AboutAndPrintView.tsx`, `recipeLogic.ts`, `index.css`)

- **Način A — Klasični A4 ispis (Registrator)**: `@page { size: A4 portrait; margin: 10mm 12mm; }`, 1 recept = 1 uspravna A4 stranica uz Svečanu naslovnicu i Kazalo recepata.
- **Način B — Mala obiteljska Tekica (A5 knjižica na presavinuti A4)**: `@page { size: A4 landscape; margin: 8mm 10mm; }`, algoritam *Booklet Imposition (Pravilo četvorke)* (`buildA5BookletImposition`) s popunom stranicama *"Mamine zabilješke i kulinarske crtice"* i zadnjom koricom *"Kolofon i obiteljska vinjeta"*.
