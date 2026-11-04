# Changelog — Mamina Teka

Sve značajne promjene, nadogradnje i ispravci u aplikaciji dokumentirani su u nastavku.

---

## [1.7.0] — Strogo filtriranje sinkronizacije (bez oglednih i obrisanih recepata), Fizičko brisanje oglednih recepata iz Dexieja, Sekvencijalna obrada slika i Vizualni brojač napretka

### Dodano
- **Reaktivno praćenje i vizualni brojač napretka sinkronizacije (`SyncProgressState` u `firebaseSync.ts` & `src/components/Header.tsx`)**:
  - Uvedeno globalno reaktivno stanje `syncProgress: { current, total, active, currentItemName }` koje se ažurira na svakom koraku sekvencijalne obrade (`syncProgress.current++`).
  - U padajućem izborniku profila (`Header.tsx`) i u sekciji obiteljskog trezora (`AboutAndPrintView.tsx`) prikazuje se animirana ikona `Loader2` (`animate-spin text-terracotta`), tekst `"Sinkronizacija u tijeku..."`, bedž s točnim brojačem `{syncProgress.current} / {syncProgress.total}` i tanka traka napretka (*progress bar*).
  - Po završetku u `finally` bloku status prelazi u `"🟢 Sinkronizirano"` i ponovno omogućuje gumb `"Osvježi"`.

### Ispravljeno
- **Strogo filtriranje recepata kod sinkronizacije — Push & Pull (`getRecipesToSync` & `filterSyncableRecipes` u `tekaDb.ts`, `database.ts`, `firebaseSync.ts`)**:
  - Isključeni svi ogledni, skriveni i obrisani recepti (`!recipe.isMockup && !recipe.isSample && !recipe.isDeleted && !recipe.hidden`).
  - Kada su ogledni recepti u postavkama označeni kao uklonjeni (`mamina_teka_mockups_removed_v1`), sinkronizacija ih nikada ne šalje u oblak niti ih pribraja u `syncProgress.total`, čime ukupan broj stavki točno odgovara broju stvarnih recepata korisnika (npr. točno 31 umjesto 34).
- **Fizičko brisanje uklonjenih oglednih recepata iz Dexie baze (`purgeRemovedMockupRecipesFromDexie` u `tekaDb.ts` & `database.ts`)**:
  - Klik na *"Ukloni ogledne recepte"* i pokretanje aplikacije/sinkronizacije uz aktivnu zastavicu `mamina_teka_mockups_removed_v1` fizički brišu ogledne recepte iz lokalne IndexedDB tablice (`await db.recipes.where('isMockup').equals(1).delete()` i `bulkDelete(MOCKUP_RECIPE_IDS)`), čime se sprječava da stari zapisi poput *"Pekmez od Bistrica Šljiva..."* blokiraju prvi korak sinkronizacije.
- **Zaštita od nevažećih URL-ova slika i sekvencijalna kompresija s 4s timeoutom (`compressImageForCloudSync` u `firebaseSync.ts`)**:
  - Prije kreiranja `new Image()` strogo se provjerava valjanost izvora (`typeof src === 'string' && (src.startsWith('data:image') || src.startsWith('http') || src.startsWith('blob:'))`). Za nevažeće, prazne ili lokalne placeholder URL-ove funkcija trenutačno vraća `null` i prelazi na idući korak bez čekanja timeouta.
  - Slike manje od **180 KB** ili označene kao optimizirane (`imageOptimized: true`) preskaču ponovnu kompresiju, a nakon svake obrade na HTML5 Canvasu oslobađa se memorija (`canvas.width = 0; canvas.height = 0;`).

---

## [1.6.0] — Vizualni redizajn početnog ekrana (HomeView), Višestupanjska Back navigacija s pamćenjem skrola, Trajno uklanjanje oglednih recepata i Popravak sinkronizacije sastojaka i slika rukopisa

### Dodano
- **Vizualni redizajn početnog ekrana (`src/components/HomeView.tsx`)**:
  - Uklonjeni redundantni tekstualni blokovi koji su duplicirali donju navigacijsku traku (*"Obiteljska arhiva / + Dodaj novu stranicu"*, tekstualne liste s točkicama za *"Kuhaj uskoro"* i *"Mami najdraže"*, te donji statički blok *"Daj ideju iz Teke"*).
  - **Hero element „Mamin prijedlog dana”**: velika vizualna kartica na vrhu početnog ekrana s fotografijom jela preko cijele širine, oznakom `"Prijedlog za danas ☀️"`, krupnim serif naslovom, vremenom pripreme i gumbom `"🎲 Druga ideja"` u gornjem desnom kutu za animirani odabir drugog nasumičnog recepta.
  - **Kompaktna tražilica s brojačem**: čisto, zaobljeno polje s placeholderom `"Pretraži recepte po nazivu ili sastojku..."` i bedžem s ukupnim brojem recepata s desne strane.
  - **Vodoravni vizualni vrtuljci (`overflow-x-auto snap-x`)**:
    1. `"Zadnje upisano u Teku"` — zadnjih 5 dodanih recepata s kvadratnom fotografijom jela, nazivom i kategorijom.
    2. `"Mami najdraže (Favoriti)"` — vodoravni niz kartica označenih favorita s fotografijama.
- **Višestupanjska „Back” navigacija s pamćenjem pozicije u popisu (`resolveBackNavigationStep` u `recipeLogic.ts` & `App.tsx`)**:
  - Otvaranje bilo kojeg recepta sprema aktivnu karticu, filtre i točnu vertikalnu poziciju skrolanja (`window.scrollY`) na stog navigacije (`navigationStackRef`).
  - Pritisak na *Back* u receptu vraća korisnika točno na mjesto u popisu gdje je stao; sljedeći *Back* vraća na vrh popisa (`scrollTo(0)`), zatim na početni zaslon (*Teka*), a na vrhu početnog zaslona prikazuje poruku `"Pritisni natrag (Back) još jednom za izlazak iz aplikacije"` prije stvarnog izlaza.
- **Automatska obnova sastojaka i gumb „Očitaj s rukopisa” (`recoverIngredientsFromRecipeText` u `recipeLogic.ts` & `RecipeDetailView.tsx`)**:
  - Automatska rekonstrukcija popisa sastojaka iz spremljenog prijepisa rukopisa (`originalHandwritingText`), koraka pripreme ili početne baze ako je recept u ranijoj sinkronizaciji dobio privremenu oznaku `"Prema obiteljskom zapisu"`.
  - Dodan gumb **"Očitaj s rukopisa"** uz zaglavlje *Popis sastojaka* koji jednim klikom ponovno šalje spremljenu sliku maminog rukopisa (`originalScanUrl`) na Gemini Vision OCR i obnavlja sve sastojke i gramaže.

### Ispravljeno
- **Prekoračenje Firestore limita od 1 MB i beskonačna petlja sinkronizacije (`firebaseSync.ts`)**:
  - Riješen problem u kojem su se u isti Firestore dokument spremale 4 zasebne base64 slike (`imageUrl`, `image`, `originalScanUrl`, `originalImage` -> ukupno ~1.16 MB > 1 MB Firestore limit), zbog čega je Firestore odbijao zapis originalne slike rukopisa i uzrokovao neprekidno vrtnju sinkronizacije na oba uređaja.
  - Sada se u Firestore spremaju isključivo komprimirani `imageUrl` i `originalScanUrl` (svaki do maks. `175 KB`, odnosno oznaka `'same-as-cover'` ako su identični), dok su duplicirana polja `image` i `originalImage` u oblaku prazna, čime dokument iznosi svega ~180–350 KB i sinkronizira izvorne rukopise na mamin mobitel u jednom prolazu.
- **Zaštita popisa sastojaka pri sinkronizaciji (`parseRemoteIngredientGroups` u `firebaseSync.ts`)**:
  - Spriječeno prepisivanje lokalnih sastojaka privremenim zapisom `sync-1 ("Prema obiteljskom zapisu")`.
- **Trajno brisanje 8 oglednih recepata (`tekaDb.ts`, `firebaseSync.ts`, `recipeLogic.ts`)**:
  - Brisanje oglednih recepata postavlja trajnu zastavicu `mamina_teka_mockups_removed_v1` i šalje *tombstone* zapise (`isDeleted: true`) u Firestore trezor, a `pullRecipesFromVault` više nikada ne poništava obrisane ID-jeve (`shouldSkipDeletedRecipeOnPull`), čime se ogledni recepti više nikada ne vraćaju nakon ponovnog ulaska u aplikaciju.

---

## [1.5.0] — Dva formata ispisa PDF kuharice (A4 Registrator & A5 Knjižica), Popravak prikaza AI slika u PDF-u i Sinkronizacija fotografija u obiteljskom trezoru

### Dodano
- **Modal za odabir vrste ispisa prije printanja (`AboutAndPrintView.tsx`)**:
  - Prije pokretanja `window.print()` korisnik bira između dva formata:
    1. **"Klasični A4 ispis (Registrator)"** — 1 recept = točno 1 uspravna A4 stranica (`@page { size: A4 portrait; margin: 10mm 12mm; }`).
    2. **"Mala obiteljska Tekica (A5 knjižica)"** — obostrani ispis na vodoravni A4 papir (`@page { size: A4 landscape; margin: 8mm 10mm; }`) za presavijanje po sredini i klamanje u hrptu.
- **Algoritam slaganja stranica za A5 knjižicu — *Booklet Imposition / Pravilo četvorke* (`buildA5BookletImposition` u `recipeLogic.ts`)**.
- **Kompaktni dvostupčani prijelom stranice recepta za PDF** s nakošenom naljepnicom izvornog rukopisa (**"Iz mamine teke 📝"**).

---

## [1.4.0] — Redizajn trake akcija, Dijeljenje obiteljske Teke putem pozivnice i Potpuni Dark Mode kontrast

### Dodano
- **Dijeljenje obiteljskog trezora putem linka pozivnice (`FamilySync`)** i **Kompaktna gornja traka akcija na receptu (`RecipeDetailView.tsx`)**.
