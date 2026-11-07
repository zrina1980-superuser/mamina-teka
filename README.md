# Mamina Teka

> **Pokreni aplikaciju:** [mamina-teka.zrina.app](https://mamina-teka.zrina.app/)

**Digitalni obiteljski spomenar maminih rukopisnih recepata** — progresivna web aplikacija (PWA) za očuvanje, pametnu digitalizaciju, kuhanje bez gašenja ekrana, obiteljsku sinkronizaciju i ispis uvezane obiteljske kuharice.

---

## Ključne značajke

- **Vizualni početni ekran (`HomeView.tsx`)**:
  - **Hero kartica „Mamin prijedlog dana”** — odmah ispod podnaslova prikazuje veliku fotografiju jela za danas (`Prijedlog za danas ☀️`), krupni serif naslov, vrijeme pripreme i animirani gumb **„🎲 Druga ideja”** za trenutni odabir drugog nasumičnog recepta iz Teke.
  - **Kompaktna tražilica s brojačem** — zaobljeno polje za pretragu po nazivu ili sastojku uz bedž s ukupnim brojem aktivnih recepata u trezoru.
  - **Vodoravni vizualni vrtuljci (`snap-x`)** — pregledni horizontalni redovi kartica s kvadratnim fotografijama jela za **„Zadnje upisano u Teku”** (zadnjih 5 recepata) i **„Mami najdraže (Favoriti)”**.
- **Pametna višestupanjska „Back” navigacija s pamćenjem pozicije skrolanja**:
  - Povratak iz otvorenog recepta vraća korisnika na točnu poziciju (`scrollY`) na kojoj je stao u popisu.
  - Sljedeći pritisak na *Back* vraća na vrh popisa, zatim na početni zaslon (*Teka*), a na vrhu početnog zaslona zahtijeva dvostruki pritisak za izlaz iz aplikacije uz obavijest.
- **Dvostruki prikaz svakog recepta**:
  - **Digitalni recept** — strukturirani pregled sastojaka s interaktivnim kvačicama, automatskim preračunavanjem mjera (`0.5×`, `1×`, `1.5×`, `2×`), preračunavanjem veličine protvana/kalupa i gumbom **„Očitaj s rukopisa”** za ponovno OCR očitavanje sastojaka izravno sa spremljene slike maminog rukopisa.
  - **Mamin izvornik (Rukopis)** — izvorna fotografija maminog rukopisa s ugrađenim povećalom (zoom `1×` do `3×`), prilagodbom kontrasta tinte i usporednim prikazom prijepisa.
- **Pametni skener rukopisa (Gemini Vision OCR)**:
  - Automatsko prepoznavanje hrvatskog kulinarskog rukopisa, regionalizama (*dag, žlica, šalica, prstohvat, kvasac, prašak za pecivo*) i strukturiranje u kategorije (**Kolači & Slatko**, **Slana kuhinja & Ručak**, **Mesarija & Sušiona**, **Zimnica & Špajza**, **Običaji & Tradicija**).
  - Generiranje sigurnog, kontekstualnog engleskog kulinarskog opisa (`englishImagePrompt`) s mogućnošću ručnog uređivanja prije ili poslije spremanja.
- **Generiranje ilustracija jela (Imagen 3 / Gemini)**:
  - Dinamičko dohvaćanje dostupnih modela (`ListModels`) i izravni REST `predict` poziv uz automatski *fallback* na mamin izvorni rukopis bez narušavanja korisničkog iskustva.
- **Izvoz i ispis PDF kuharice u dva formata (A4 Registrator & A5 Knjižica na presavijanje)**:
  - **Modal za odabir vrste ispisa prije printanja**:
    1. **Klasični A4 ispis (Registrator)** — *1 recept = točno 1 uspravna A4 stranica* (Str. 1 Svečana naslovnica, Str. 2 Kazalo recepata po kategorijama, Str. 3+ pojedinačni recepti).
    2. **Mala obiteljska Tekica (A5 knjižica)** — prava knjižica na presavijanje (*Booklet Imposition — Pravilo četvorke*). Printa se obostrano (*Duplex — Okreni po kraćem rubu*) na vodoravni A4 papir s točkastom linijom za savijanje, širim unutarnjim marginama uz hrbat, stranicama *"Mamine zabilješke i kulinarske crtice"* za popunu do višekratnika broja 4 i zadnjom koricom (*"Kolofon i obiteljska vinjeta"*).
  - **Kompaktni dvostupčani dizajn stranice recepta**: lijevi stupac (`35%` širine) za sastojke, desni stupac (`65%` širine) za numerirane korake pripreme, fotografija gotovog jela s nakošenom minijaturnom naljepnicom izvornog rukopisa (*"Iz mamine teke 📝"*) s efektom ljepljive trake te žuta kartica *"Mamina tajna"*.
- **Obiteljski trezor i dijeljenje pozivnicom (Family Vault Sync)**:
  - Lokalna baza podataka (**IndexedDB / Dexie**) radi 100% izvan mreže (*Offline-First*), a uz Google prijavu sinkronizira sve recepte, AI fotografije jela i izvorne skenove rukopisa u zajednički obiteljski trezor putem **Firebase Firestore** baze (optimizirano ispod 1 MB po dokumentu).
  - Trajno brisanje oglednih (mockup) recepata uz sinkronizaciju *tombstone* zapisa (`isDeleted: true`) u oblak kako se obrisani ogledni recepti nikada ne bi ponovno vraćali.

---

## Tehnološki stog

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide React
- **Lokalna pohrana (Offline-First)**: IndexedDB (`dexie`)
- **Oblak i sinkronizacija**: Firebase Authentication (Google Sign-In) & Cloud Firestore
- **Poslužitelj i AI integracija**: Node.js + Express (`server.ts`), `@google/genai` SDK i REST integracija za Gemini OCR i Imagen 3

---

## Pokretanje projekta

Potreban je Node.js 22.12 ili noviji. npm je podržani package manager.

1. Instalirajte ovisnosti:
   ```bash
   npm ci --legacy-peer-deps
   ```
2. Konfigurirajte varijable okruženja (prema `.env.example`):
   - `GEMINI_API_KEY` — API ključ za Google Gemini / Imagen servise.
3. Pokrenite razvojni poslužitelj (na portu `3000`):
   ```bash
   npm run dev
   ```
4. Pokrenite jedinične testove čiste domenske logike:
   ```bash
   npm test
   ```
5. Izgradite produkcijsku verziju:
   ```bash
   npm run build
   ```

Za lokalni produkcijski poslužitelj nakon builda postavite `NODE_ENV=production` pa pokrenite `npm start`. U PowerShellu: `$env:NODE_ENV="production"; npm start`.

## Dokumentacija

- [Arhitektura](./ARCHITECTURE.md)
- [Povijest promjena](./CHANGELOG.md)

## Licenca

Izvorni kod ovog projekta licenciran je pod MIT licencom; pogledaj [LICENSE](./LICENSE). Sadržaji i sredstva trećih strana ostaju pod svojim uvjetima korištenja.

## Neobavezna podrška

Ako ti je ovaj projekt bio koristan, možeš po želji podržati njegov daljnji razvoj na [Ko-fi](https://ko-fi.com/zrina).
