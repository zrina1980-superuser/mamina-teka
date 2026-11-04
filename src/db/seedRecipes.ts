import type { Recipe } from '../utils/recipeLogic';
import { getDishIllustrationUri, createManuscriptScanDataUri } from '../utils/visualAssets';

export interface SampleManuscript {
  id: string;
  label: string;
  era: string;
  scanDataUri: string;
  rawHandwritingText: string;
}

export const SAMPLE_MANUSCRIPTS: SampleManuscript[] = [
  {
    id: 'sample-manuscript-1',
    label: 'Stranica 42: Starinski Čupavci na čaše (Rukopis iz 1984.)',
    era: 'Bilježnica s plavim koricama, 1984.',
    scanDataUri: createManuscriptScanDataUri({
      pageNumber: '42',
      handwrittenTitle: 'Mekani Čupavci (na čaše)',
      lines: [
        'Biskvit:',
        '- 3 jaja i 10 deka šećera (pjenasto umutiti)',
        '- 1 čaša od kiselog mlijeka mlijeka',
        '- pola čaše ulja (oko 1 dcl)',
        '- 30 deka glatkog brašna i jedan prašak za pecivo',
        'Čokoladni umak:',
        '- frtalj kile maslaca (25 deka)',
        '- 20 deka čokolade za kuhanje i 2 dcl mlijeka',
        '- frtalj kile kokosa za valjanje',
        'Postupak:',
        'Peci biskvit u srednjem protvanu na umjerenoj vatri oko 25 minuta.',
        'Ohladi 15 minuta, izreži na kocke, umači u toplu čokoladu.',
      ],
      marginNote: 'Ne otvaraj pećnicu prvih 15 min da biskvit ne padne!',
    }),
    rawHandwritingText: `Mekani Čupavci (na čaše)
Biskvit:
- 3 jaja i 10 deka šećera
- 1 čaša od kiselog mlijeka mlijeka
- 1 dcl ulja
- 30 deka glatkog brašna i jedan prašak za pecivo
- soli na vrh noža
Čokoladni umak i posip:
- frtalj kile maslaca
- 20 deka čokolade za kuhanje
- 2 dcl mlijeka
- frtalj kile kokosovog brašna
Postupak:
1. Pjenasto izraditi jaja sa šećerom, dodati mlijeko i ulje pa lagano umiješati brašno i prašak za pecivo.
2. Izliti u srednji protvan i peći na umjerenoj vatri 25 minuta dok lijepo ne porumeni.
3. Pustiti da se biskvit hladi 15 minuta pa ga narezati na jednake kocke.
4. Na tihoj vatri otopiti maslac, čokoladu i mlijeko (kuhati 5 minuta dok se ne poveže) pa svaku kocku umočiti u čokoladu i uvaljati u kokos.
Savjet: Ne otvaraj pećnicu prvih 15 minuta da biskvit ostane prozračan!`,
  },
  {
    id: 'sample-manuscript-2',
    label: 'Stranica 78: Domaći Pac za Šunku i Plećku (Djedova bilješka)',
    era: 'Zimska bilježnica za kolinje, 1979.',
    scanDataUri: createManuscriptScanDataUri({
      pageNumber: '78',
      handwrittenTitle: 'Suhi i mokri pac za plećku (na 10 kg mesa)',
      lines: [
        'Sastojci za pac (na 10 kila mesa):',
        '- tri frtalja kile krupne morske soli (75 deka)',
        '- 5 deka crnog papra u zrnu i mljevenog',
        '- 15 deka domaćeg češnjaka (zgnječenog)',
        '- 2 deka slatke crvene paprike',
        '- 1 šaka lovorovog lista i grančica ružmarina',
        'Postupak:',
        'Meso dobro utrljati solju i češnjakom. Složiti u drvenu',
        'kacu. Okretati meso svakih 5 dana kroz ukupno 21 dan.',
        'Nakon paca oprati u mlakoj vodi i sušiti na zraku 12 sati.',
      ],
      marginNote: 'Češnjak obavezno domaći ozimi, nikako kupovni kineski!',
    }),
    rawHandwritingText: `Suhi i mokri pac za plećku (na 10 kg mesa)
Začini na 10 kg mesa:
- tri frtalja kile krupne morske soli
- 5 deka crnog papra (pola mljeveni, pola u zrnu)
- 15 deka domaćeg češnjaka
- 2 deka slatke paprike
- 1 šaka lovorovog lista
Postupak:
1. Ohlađene plećke i špek temeljito natrljati mješavinom krupne soli, papra i zgnječenog češnjaka.
2. Posložiti gusto u posudu za pac, posuti lovorom i ostaviti u hladnoj prostoriji.
3. Meso preslagivati i prelijevati vlastitim sokom svakih 120 minuta prvog dana, a zatim okretati svakih nekoliko dana kroz 3 tjedna.
4. Prije odlaska u sušionu isprati mlakom vodom i ostaviti na propuhu 12 sati da se površina posuši prije hladnog dima.
Savjet: Češnjak mora biti domaći ozimi, a temperatura u podrumu između 4 i 8 °C.`,
  },
];

const RAW_INITIAL_RECIPES: Recipe[] = [
  {
    id: 'orehnjaca-makovnjaca',
    title: 'Mamina Orehnjača i Makovnjača',
    subtitle: 'Mekano dizano tijesto koje se ne puca i bogati nadjev na frtalj kile oraha i maka',
    category: 'kolaci',
    subcategory: 'Dizana tijesta',
    isFavorite: true,
    inCookSoon: true,
    cookSoonNote: 'Za nedjeljni obiteljski ručak',
    prepTimeMinutes: 90,
    cookTimeMinutes: 45,
    servings: '2 velike štruce (24 šnite)',
    panDimensions: 'Veliki duboki protvan za 2 štruce (36 × 26 cm)',
    ovenTemp: 'Umjerena vatra (~180 °C, bez ventilatora)',
    secretTip: 'Nikad ne otvaraj pećnicu prvih 20 minuta! U ohlađene orahe obavezno umiješaj čvrsti snijeg od 2 bjelanjka da se kora nikada ne odvoji od nadjeva.',
    voiceMemoTranscript: '„Kad zamijesiš dizano tijesto, zdjela i brašno moraju biti topli, a mlijeko za orahe neka zakipi s rumom da nadjev bude sočan i drugi dan.”',
    cookingLogs: [
      {
        id: 'log-om-1',
        dateLabel: 'Uskrs 2026.',
        note: 'Pečeno za Uskrs – ispalo vrhunski, nadjev od oraha bio je izuzetno sočan. Drugi put peći 5 minuta kraće na donjoj rešetki.',
        author: 'Mama',
      },
      {
        id: 'log-om-2',
        dateLabel: 'Božić 2025.',
        note: 'Radili duplu mjeru (4 štruce), stavili 28% manje šećera u nadjev i bilo je taman po našem ukusu.',
        author: 'Zrina',
      },
    ],
    imageStatus: 'ai',
    isAiGenerated: true,
    image: getDishIllustrationUri('orehnjaca', 'Mamina Orehnjača i Makovnjača'),
    imageUrl: getDishIllustrationUri('orehnjaca', 'Mamina Orehnjača i Makovnjača'),
    originalScanUrl: createManuscriptScanDataUri({
      pageNumber: '12',
      handwrittenTitle: 'Orehnjača i Makovnjača (Blagdanska)',
      lines: [
        'Tijesto:',
        '- pol kile glatkog brašna (prosijati u toplu zdjelu)',
        '- 1 kocka svježeg kvasca + 2,5 dcl mlakog mlijeka',
        '- 8 deka šećera, 8 deka otopljenog maslaca',
        '- 3 žumanjka, ribana korica limuna, soli na vrh noža',
        'Nadjev od oraha:',
        '- frtalj kile mljevenih oraha + 15 deka šećera',
        '- 1,5 dcl kipućeg mlijeka, 2 žlice ruma, snijeg od 2 bjelanjka',
        'Nadjev od maka:',
        '- frtalj kile mljevenog maka + 15 deka šećera + 2 dcl mlijeka',
        'Peći na umjerenoj vatri (180 °C) oko 45 minuta.',
      ],
      marginNote: 'U kuhinji mora biti toplo i bez propuha dok se tijesto diže!',
    }),
    originalHandwritingText:
      'Pol kile glatkog brašna, 1 kocka kvasca u 2,5 dcl mlakog mlijeka, 8 deka šećera, 8 deka maslaca, 3 žumanjka, soli na vrh noža. Nadjev: frtalj kile oraha i frtalj kile maka pofuriti vrućim mlijekom. Peći na umjerenoj vatri (~180 °C).',
    ingredientGroups: [
      {
        groupTitle: 'Dizano tijesto (za 2 štruce)',
        items: [
          { id: 'om-1', name: 'glatko pšenično brašno (tip 550)', amount: 500, unit: 'g', originalMeasure: 'pol kile' },
          { id: 'om-2', name: 'svježi kvasac (1 kocka)', amount: 40, unit: 'g', originalMeasure: '1 kocka' },
          { id: 'om-3', name: 'mlako punomasno mlijeko', amount: 250, unit: 'ml', originalMeasure: '2,5 dcl' },
          { id: 'om-4', name: 'šećer', amount: 80, unit: 'g', originalMeasure: '8 deka' },
          { id: 'om-5', name: 'otopljeni maslac', amount: 80, unit: 'g', originalMeasure: '8 deka' },
          { id: 'om-6', name: 'domaći žumanjci', amount: 3, unit: 'kom' },
          { id: 'om-7', name: 'naribana korica 1 neprskanog limuna', amount: 1, unit: 'kom' },
          { id: 'om-8', name: 'sol', amount: 2, unit: 'g', originalMeasure: 'na vrh noža' },
        ],
      },
      {
        groupTitle: 'Nadjev od oraha (1. štruca)',
        items: [
          { id: 'om-9', name: 'mljeveni orasi', amount: 250, unit: 'g', originalMeasure: 'frtalj kile' },
          { id: 'om-10', name: 'šećer', amount: 150, unit: 'g', originalMeasure: '15 deka' },
          { id: 'om-11', name: 'kipuće mlijeko za pofuriti orahe', amount: 150, unit: 'ml', originalMeasure: '1,5 dcl' },
          { id: 'om-12', name: 'domaći rum', amount: 2, unit: 'žlice' },
          { id: 'om-13', name: 'vanilin šećer', amount: 10, unit: 'g', originalMeasure: '1 vanilin' },
          { id: 'om-14', name: 'čvrsti snijeg od bjelanjaka', amount: 2, unit: 'kom' },
        ],
      },
      {
        groupTitle: 'Nadjev od maka (2. štruca)',
        items: [
          { id: 'om-15', name: 'svježe mljeveni mak', amount: 250, unit: 'g', originalMeasure: 'frtalj kile' },
          { id: 'om-16', name: 'šećer', amount: 150, unit: 'g', originalMeasure: '15 deka' },
          { id: 'om-17', name: 'kipuće mlijeko', amount: 200, unit: 'ml', originalMeasure: '2 dcl' },
          { id: 'om-18', name: 'maslac u vrući mak', amount: 25, unit: 'g' },
          { id: 'om-19', name: 'cimet u prahu', amount: 1, unit: 'žličica' },
        ],
      },
    ],
    steps: [
      'U lončiću zagrij mlijeko da bude ugodno mlako. Razmrvi svježi kvasac sa žličicom šećera i žličicom brašna pa ostavi 15 minuta na toplom dok se zapjeni.',
      'U toplu zdjelu prosij brašno, dodaj sol, šećer, koricu limuna, žumanjke, otopljeni maslac i dignuti kvasac. Mijesi kuhačom ili rukom 10 minuta dok se tijesto ne počne odvajati od stijenki.',
      'Pokrij zdjelu čistom kuhinjskom krpom i ostavi tijesto da se diže 45 minuta na toplom mjestu bez propuha dok ne udvostruči volumen.',
      'Dok se tijesto diže, pripremi nadjeve: orahe i mak zasebno prelij kipućim mlijekom, dodaj šećer i arome, pa u ohlađeni nadjev lagano umiješaj snijeg od bjelanjaka.',
      'Podijeli tijesto na dva dijela, razvaljaj na pobrašnjenom stolnjaku na debljinu prsta, premaži nadjevom do rubova i čvrsto zarolaj. Ostavi u protvanu još 20 minuta prije pečenja.',
      'Premaži štruce razmućenim bjelanjkom s malo ulja i peci u zagrijanoj pećnici na 180 °C 45 minuta. Ako gornja korica prebrzo tamni, nakon 25 minuta pokrij papirom za pečenje.',
    ],
    momTips: [
      'Da štruca nikada ne pukne i da se kora ne odvoji od nadjeva, u ohlađene orahe obavezno umiješaj čvrsti snijeg od bjelanjaka i prije pečenja probodi štrucu čačkalicom na par mjesta.',
      'Brašno i zdjelu zimi uvijek malo ugrij blizu peći prije nego što kreneš mijesiti.',
    ],
    normalizedNotes: [
      'pol kile brašna → 500 g',
      'frtalj kile oraha/maka → 250 g',
      '15 deka šećera → 150 g',
      '2,5 dcl mlijeka → 250 ml',
      'na umjerenoj vatri → ~180 °C',
    ],
    syncStatus: 'synced',
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 12,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 12,
    isDeleted: false,
    authorEmail: 'mama@obitelj.hr',
  },
  {
    id: 'starinska-pita-jabuke',
    title: 'Starinska Lijena Pita od Jabuka',
    subtitle: 'Prhko tijesto s domaćom masti ili maslacem i sočnim ribanim jabukama s cimetom',
    category: 'kolaci',
    subcategory: 'Pite',
    isFavorite: true,
    inCookSoon: false,
    prepTimeMinutes: 35,
    cookTimeMinutes: 40,
    servings: '1 standardni protvan (20 kocki)',
    panDimensions: 'Standardni obiteljski protvan (35 × 25 cm)',
    ovenTemp: 'Umjerena vatra (~185 °C)',
    secretTip: 'S 200 g domaće svinjske masti umjesto maslaca tijesto je najprhkije i topi se u ustima! Donju koru obavezno pospi žlicom mljevenih oraha da upiju sok od jabuka.',
    cookingLogs: [
      {
        id: 'log-pj-1',
        dateLabel: 'Listopad 2026.',
        note: 'Korištene domaće jabuke Idared iz voćnjaka, nije trebalo uopće cijediti sok.',
        author: 'Mama',
      },
    ],
    imageStatus: 'ai',
    isAiGenerated: true,
    image: getDishIllustrationUri('pita_jabuke', 'Starinska Lijena Pita od Jabuka'),
    imageUrl: getDishIllustrationUri('pita_jabuke', 'Starinska Lijena Pita od Jabuka'),
    originalScanUrl: createManuscriptScanDataUri({
      pageNumber: '19',
      handwrittenTitle: 'Lijena pita od jabuka (prhka)',
      lines: [
        'Prhko tijesto:',
        '- pol kile brašna (pola oštro, pola glatko)',
        '- frtalj kile maslaca ili 20 deka domaće masti',
        '- 15 deka šećera i jedan prašak za pecivo',
        '- 2 cijela jaja i 3 žlice kiselog vrhnja',
        'Nadjev:',
        '- 1,5 kila kiselih jabuka (idared ili zlatni delišes)',
        '- 10 deka šećera, 1 vanilin i žličica cimeta',
        'Peci na umjerenoj vatri (185 °C) oko 40 minuta do zlatne boje.',
      ],
      marginNote: 'S domaćom svinjskom masti tijesto je najprhkije i topi se u ustima!',
    }),
    originalHandwritingText:
      'Pol kile brašna, frtalj kile maslaca, 15 deka šećera, jedan prašak za pecivo, 2 jaja, 3 žlice vrhnja. Nadjev: 1,5 kg ribanih jabuka s cimetom.',
    ingredientGroups: [
      {
        groupTitle: 'Prhko tijesto',
        items: [
          { id: 'pj-1', name: 'brašno (250 g oštrog + 250 g glatkog)', amount: 500, unit: 'g', originalMeasure: 'pol kile' },
          { id: 'pj-2', name: 'hladni maslac (ili 200 g domaće masti)', amount: 250, unit: 'g', originalMeasure: 'frtalj kile' },
          { id: 'pj-3', name: 'šećer u prahu', amount: 150, unit: 'g', originalMeasure: '15 deka' },
          { id: 'pj-4', name: 'prašak za pecivo', amount: 12, unit: 'g', originalMeasure: 'jedan prašak' },
          { id: 'pj-5', name: 'jaja', amount: 2, unit: 'kom' },
          { id: 'pj-6', name: 'čvrsto kiselo vrhnje', amount: 3, unit: 'žlice' },
        ],
      },
      {
        groupTitle: 'Sočni nadjev od jabuka',
        items: [
          { id: 'pj-7', name: 'kiselkaste jabuke (naribane)', amount: 1500, unit: 'g', originalMeasure: '1,5 kila' },
          { id: 'pj-8', name: 'šećer', amount: 100, unit: 'g', originalMeasure: '10 deka' },
          { id: 'pj-9', name: 'mljeveni cimet', amount: 2, unit: 'žličice' },
          { id: 'pj-10', name: 'krušne mrvice ili mljeveni orasi (za posip po donjoj kori)', amount: 2, unit: 'žlice' },
        ],
      },
    ],
    steps: [
      'U prosijano brašno s praškom za pecivo brzo prstima utrljaj hladni maslac pa dodaj šećer, jaja i kiselo vrhnje. Zamijesi glatko tijesto, podijeli na 2 dijela i ostavi u hladnjaku 30 minuta.',
      'Jabuke oguli, naribaj na krupni ribež i pirjaj na srednjoj vatri 10 minuta sa šećerom i cimetom dok višak tekućine ne ispari.',
      'Razvaljaj prvu polovicu tijesta na veličinu protvana, nabockaj vilicom i pospi s 2 žlice krušnih mrvica ili oraha kako donja kora ne bi bila gnjecava.',
      'Rasporedi prohlađene jabuke, preklopi drugom korom (ili naribaj ohlađeno tijesto) i peci na 185 °C 40 minuta dok korica ne postane zlatno-smeđa.',
    ],
    momTips: [
      'Prije nego što staviš jabuke na donju koru, pospi je žlicom-dvije mljevenih oraha ili prezli — one upiju sav višak soka.',
    ],
    normalizedNotes: [
      'pol kile brašna → 500 g',
      'frtalj kile maslaca → 250 g',
      'jedan prašak → 12 g (1 vrećica)',
    ],
    syncStatus: 'synced',
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 9,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 9,
    isDeleted: false,
    authorEmail: 'mama@obitelj.hr',
  },
  {
    id: 'uskrsnji-goranski-nadjev',
    title: 'Uskršnji Goranski Nadjev (Hrge)',
    subtitle: 'Tradicionalni obiteljski blagdanski nadjev sa šunkom, domaćim jajima i mladim lukom',
    category: 'tradicija',
    subcategory: 'Uskršnji goranski nadev',
    isFavorite: true,
    inCookSoon: true,
    cookSoonNote: 'Obavezno za blagdanski doručak',
    prepTimeMinutes: 40,
    cookTimeMinutes: 60,
    servings: '8 do 10 porcija (2 štruce u krpi)',
    panDimensions: 'Platnena kuhinjska krpa (zavezana špagom) ili kalup 30 × 12 cm',
    ovenTemp: 'Kuhano u vodi ili pečeno na umjerenoj vatri (~180 °C)',
    secretTip: 'Kad se nadjev skuha u krpi, izvadi ga i pritisni daskom za rezanje 20 minuta dok je još topao — tada se reže na savršene šnite koje se ne mrve!',
    cookingLogs: [
      {
        id: 'log-gn-1',
        dateLabel: 'Uskrs 2026.',
        note: 'Kuhano u platnenoj salveti točno 60 minuta, dodali malo više mladog luka i dimljene vratine.',
        author: 'Mama',
      },
    ],
    imageStatus: 'ai',
    isAiGenerated: true,
    image: getDishIllustrationUri('goranski_nadjev', 'Uskršnji Goranski Nadjev'),
    imageUrl: getDishIllustrationUri('goranski_nadjev', 'Uskršnji Goranski Nadjev'),
    originalScanUrl: createManuscriptScanDataUri({
      pageNumber: '5',
      handwrittenTitle: 'Goranski Uskršnji Nadev (Bakin recept)',
      lines: [
        'Sastojci:',
        '- pol kile starog domaćeg kruha (narezati na kockice)',
        '- 40 deka kuhane dimljene šunke ili špeka',
        '- 10 domaćih jaja (8 umutiti + 2 žumanjka)',
        '- 1 vezica mladog luka (sitno nasjeckati)',
        '- 1 žličica soli i dosta svježe mljevenog papra',
        'Postupak:',
        'Kruh i šunku pomiješati s lukom i prelijati jajima.',
        'Pustiti da stoji 30 minuta da kruh upije jaja.',
        'Zaviti u vlažnu platnenu krpu i kuhati 60 minuta.',
      ],
      marginNote: 'Krpu zaveži špagom s obje strane kao bombon da nadev drži oblik!',
    }),
    originalHandwritingText:
      'Pol kile starog kruha na kockice, 40 deka dimljene šunke, 10 domaćih jaja, vezica mladog luka, sol i papar. Kuhati u platnenoj krpi 60 minuta.',
    ingredientGroups: [
      {
        groupTitle: 'Smjesa za goranski nadjev',
        items: [
          { id: 'gn-1', name: 'bijeli kruh od prethodnog dana (narezan na kockice)', amount: 500, unit: 'g', originalMeasure: 'pol kile' },
          { id: 'gn-2', name: 'kuhana dimljena šunka, vratina ili domaći špek', amount: 400, unit: 'g', originalMeasure: '40 deka' },
          { id: 'gn-3', name: 'domaća jaja', amount: 10, unit: 'kom' },
          { id: 'gn-4', name: 'mladi luk s perima (sitno narezan)', amount: 1, unit: 'vezica' },
          { id: 'gn-5', name: 'svježe mljeveni crni papar', amount: 1.5, unit: 'žličica' },
          { id: 'gn-6', name: 'sol (oprezno jer je šunka slana)', amount: 1, unit: 'žličica' },
        ],
      },
    ],
    steps: [
      'Kruh nareži na sitne kockice (oko 1 cm) i ostavi na zraku 30 minuta da se blago prosuši kako se u kuhanju ne bi pretvorio u kašu.',
      'Dimljenu šunku i malo špeka nareži na sitne kockice pa kratko poprži 5 minuta na tavi da zamiriše, a mladi luk sitno nasjeckaj.',
      'U velikoj zdjeli pjenasto izmuti jaja sa soli i dosta crnog papra, pa dodaj kruh, ohlađenu šunku i mladi luk. Sve nježno promiješaj i ostavi 30 minuta da kruh ravnomjerno upije jaja.',
      'Čistu platnenu salvetu ili kuhinjsku krpu namoči u vodu, dobro ocijedi i pospi krušnim mrvicama. Oblikuj čvrstu štrucu, zaveži krajeve kuhinjskom špagom i kuhaj u kipućoj slanoj vodi 60 minuta (ili peci u kalupu 45 minuta na 180 °C).',
    ],
    momTips: [
      'Kad se nadjev skuha u krpi, izvadi ga i pritisni daskom za rezanje 20 minuta dok je još topao — tada se reže na savršene šnite koje se ne mrve.',
    ],
    normalizedNotes: [
      'pol kile starog kruha → 500 g',
      '40 deka dimljene šunke → 400 g',
    ],
    syncStatus: 'synced',
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
    isDeleted: false,
    authorEmail: 'mama@obitelj.hr',
  },
  {
    id: 'domace-cesnjovke-pac',
    title: 'Domaće Češnjovke i Pac za Špek',
    subtitle: 'Točni obiteljski omjeri soli, papra, slatke paprike i vode od domaćeg češnjaka na 10 kg mesa',
    category: 'mesarija',
    subcategory: 'Češnjovke',
    isFavorite: true,
    inCookSoon: false,
    prepTimeMinutes: 120,
    cookTimeMinutes: 0,
    servings: 'Mjera na 10 kg mljevenog mesa',
    panDimensions: 'Tanka svinjska crijeva (fi 32–34 mm) + drvena kaca za pac',
    ovenTemp: 'Hladni dim bukve i graba (16–20 °C)',
    secretTip: 'U kobasice ide isključivo procijeđena voda od zgnječenog domaćeg češnjaka kroz gazu — tako meso oko češnjaka nikada neće pozeleniti niti biti gorko!',
    cookingLogs: [
      {
        id: 'log-cs-1',
        dateLabel: 'Prosinac 2025.',
        note: 'Točno 2% soli (200 g na 10 kg) i 3 dcl vode od domaćeg češnjaka. Tri hladna dima bukve s malo graba.',
        author: 'Obiteljska sušiona',
      },
    ],
    imageStatus: 'ai',
    isAiGenerated: true,
    image: getDishIllustrationUri('cesnjovke_spek', 'Domaće Češnjovke i Pac za Špek'),
    imageUrl: getDishIllustrationUri('cesnjovke_spek', 'Domaće Češnjovke i Pac za Špek'),
    originalScanUrl: createManuscriptScanDataUri({
      pageNumber: '74',
      handwrittenTitle: 'Domaće Češnjovke (mjera na 10 kg)',
      lines: [
        'Omjer mesa i začina na 10 kila:',
        '- 7 kila svinjske lopatice i vrata + 3 kile masnijeg obreska',
        '- 20 deka soli (točno 2% na težinu mesa!)',
        '- 4 deka crnog papra (svježe mljevenog)',
        '- 6 deka slatke crvene paprike + 2 deka ljute',
        '- 15 deka domaćeg češnjaka (prokuhanog u 3 dcl vode i procijeđenog)',
        '- 1 dcl bijelog vina (graševina) za miris i boju',
        'Mijesiti dok se smjesa ne lijepi za ruku, puniti u tanka crijeva.',
      ],
      marginNote: 'U kobasice ide samo procijeđena voda od češnjaka da ne pozelene oko zrna!',
    }),
    originalHandwritingText:
      'Na 10 kila mesa: 20 deka soli, 4 deka crnog papra, 6 deka slatke paprike, 2 deka ljute, 15 deka češnjaka u 3 dcl vode, 1 dcl bijelog vina.',
    ingredientGroups: [
      {
        groupTitle: 'Smjesa za domaće češnjovke (na 10 kg)',
        items: [
          { id: 'cs-1', name: 'svinjska lopatica i vrat (mljeveno na šajbu 8 mm)', amount: 7000, unit: 'g', originalMeasure: '7 kila' },
          { id: 'cs-2', name: 'čvrsta leđna slanina / masniji obrezak', amount: 3000, unit: 'g', originalMeasure: '3 kile' },
          { id: 'cs-3', name: 'kuhinjska sol (točno 2%)', amount: 200, unit: 'g', originalMeasure: '20 deka' },
          { id: 'cs-4', name: 'svježe mljeveni crni papar', amount: 40, unit: 'g', originalMeasure: '4 deka' },
          { id: 'cs-5', name: 'domaća slatka mljevena paprika', amount: 60, unit: 'g', originalMeasure: '6 deka' },
          { id: 'cs-6', name: 'ljuta tucana ili mljevena paprika', amount: 20, unit: 'g', originalMeasure: '2 deka' },
          { id: 'cs-7', name: 'očišćeni domaći češnjak (zgnječen u 300 ml tople vode)', amount: 150, unit: 'g', originalMeasure: '15 deka u 3 dcl vode' },
          { id: 'cs-8', name: 'suho bijelo vino', amount: 100, unit: 'ml', originalMeasure: '1 dcl' },
        ],
      },
      {
        groupTitle: 'Suhi pac za špek i plećku (na 10 kg)',
        items: [
          { id: 'cs-9', name: 'krupna morska sol', amount: 750, unit: 'g', originalMeasure: 'tri frtalja kile' },
          { id: 'cs-10', name: 'crni papar u zrnu i tucani', amount: 50, unit: 'g', originalMeasure: '5 deka' },
          { id: 'cs-11', name: 'domaći češnjak', amount: 150, unit: 'g', originalMeasure: '15 deka' },
          { id: 'cs-12', name: 'lovorov list', amount: 15, unit: 'listova', originalMeasure: '1 šaka' },
        ],
      },
    ],
    steps: [
      'Češnjak očisti, zgnječi ili usitni pa prelij s 300 ml mlake vode i ostavi da odstoji 60 minuta. Prije dodavanja u meso procijedi kroz gustu gazu tako da u smjesu uđe samo aromatični sok bez komadića češnjaka.',
      'Ohlađeno meso (na 2–4 °C) samelji na šajbu 8 mm, dodaj sol, papar, slatku i ljutu papriku, bijelo vino i procijeđenu vodu od češnjaka.',
      'Mijesi smjesu rukama najmanje 25 minuta dok meso ne postane kompaktno i ljepljivo te se odvoji od stijenke posude. Isprobaj slanost tako da ispečeš malu pljeskavicu na tavi 5 minuta.',
      'Napuni u dobro oprana svinjska crijeva bez zračnih džepova, probodi iglom ako se pojavi mjehurić zraka i ostavi obješeno na štapovima 24 sata da se kobasice ocijede i stegnu prije prvog hladnog dima.',
    ],
    momTips: [
      'Ako u kobasice staviš samo procijeđeni sok od češnjaka umjesto komadića, meso oko češnjaka nikada neće pozeleniti ni poprimiti gorak okus pri duljem sušenju.',
    ],
    normalizedNotes: [
      '20 deka soli → 200 g (2% na 10 kg)',
      '15 deka češnjaka u 3 dcl vode → 150 g u 300 ml vode',
      'tri frtalja kile krupne soli → 750 g',
    ],
    syncStatus: 'synced',
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 6,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 6,
    isDeleted: false,
    authorEmail: 'mama@obitelj.hr',
  },
  {
    id: 'mamin-peceni-ajvar',
    title: 'Mamin Pečeni Ajvar iz Špajze',
    subtitle: 'Pravi domaći ajvar od pečenih crvenih rog paprika i patlidžana koji se maže kao maslac',
    category: 'zimnica',
    subcategory: 'Ajvar',
    isFavorite: false,
    inCookSoon: false,
    prepTimeMinutes: 90,
    cookTimeMinutes: 150,
    servings: '12 staklenki od 370 ml',
    panDimensions: 'Široki lonac za ukuhavanje (15 L) + 12 staklenki od 370 ml',
    ovenTemp: 'Sterilizacija staklenki na tihoj vatri (100 °C)',
    secretTip: 'Tajna gustog ajvara koji uopće ne prska po štednjaku je da se oguljena pečena paprika cijedi u mrežici cijelu noć prije mljevenja!',
    cookingLogs: [],
    imageStatus: 'ai',
    isAiGenerated: true,
    image: getDishIllustrationUri('ajvar_zimnica', 'Mamin Pečeni Ajvar iz Špajze'),
    imageUrl: getDishIllustrationUri('ajvar_zimnica', 'Mamin Pečeni Ajvar iz Špajze'),
    originalScanUrl: createManuscriptScanDataUri({
      pageNumber: '61',
      handwrittenTitle: 'Domaći Pečeni Ajvar (Mamina mjera)',
      lines: [
        'Sastojci za jednu turu:',
        '- 10 kila mesnatih crvenih rog paprika',
        '- 3 kile patlidžana',
        '- tri frtalja litre suncokretovog ulja (7,5 dcl)',
        '- 1 čaša od kiselog mlijeka jabučnog octa (2 dcl)',
        '- 10 deka soli i 3 žlice šećera',
        'Postupak:',
        'Paprike i patlidžane ispeći, oguliti i cijediti 8 sati u mrežici.',
        'Samljeti i kuhati uz stalno miješanje 150 minuta dok',
        'kuhača ne ostavi čist trag po dnu lonca.',
      ],
      marginNote: 'Tajna gustog ajvara bez prskanja je da se pečena paprika cijedi cijelu noć!',
    }),
    originalHandwritingText:
      '10 kila rog paprike, 3 kile patlidžana, 7,5 dcl ulja, 1 čaša od kiselog mlijeka octa, 10 deka soli, 3 žlice šećera. Cijediti preko noći i kuhati 2,5 sata.',
    ingredientGroups: [
      {
        groupTitle: 'Povrće i začini (za 12 staklenki)',
        items: [
          { id: 'aj-1', name: 'crvene mesnate rog paprike', amount: 10000, unit: 'g', originalMeasure: '10 kila' },
          { id: 'aj-2', name: 'mladi patlidžani', amount: 3000, unit: 'g', originalMeasure: '3 kile' },
          { id: 'aj-3', name: 'suncokretovo ulje', amount: 750, unit: 'ml', originalMeasure: '7,5 dcl' },
          { id: 'aj-4', name: 'blagi jabučni ili alkoholni ocat', amount: 200, unit: 'ml', originalMeasure: '1 čaša od kiselog mlijeka' },
          { id: 'aj-5', name: 'sol', amount: 100, unit: 'g', originalMeasure: '10 deka' },
          { id: 'aj-6', name: 'šećer', amount: 45, unit: 'g', originalMeasure: '3 žlice' },
          { id: 'aj-7', name: 'ljuti feferon (po želji)', amount: 2, unit: 'kom' },
        ],
      },
    ],
    steps: [
      'Paprike i patlidžane ispeci na ploči štednjaka ili u pećnici na 220 °C 30 minuta. Pečene paprike odmah stavi u poklopljeni lonac 20 minuta da se lakše ogule.',
      'Oguli kožicu, očisti sjemenke i stavi povrće u mrežastu vreću ili cjedilo da se cijedi najmanje 8 sati (najbolje preko noći).',
      'Ocijeđene paprike i patlidžane samelji na mašinu za meso. U široki lonac ulij polovicu ulja, dodaj mljeveno povrće i kuhaj na umjerenoj vatri 120 minuta uz stalno miješanje drvenom kuhačom.',
      'Postupno dolijevaj preostalo ulje, ocat, sol i šećer pa kuhaj još 30 minuta dok se iza kuhače ne vidi čisto dno lonca. Vrući ajvar puni u vruće staklenke zagrijane u pećnici na 100 °C.',
    ],
    momTips: [
      'Kada kuhačom povučeš crtu po dnu lonca i ostane čisti "put" koji se ne zatvara odmah, ajvar je gotov i neće se kvariti cijelu zimu.',
    ],
    normalizedNotes: [
      '7,5 dcl ulja → 750 ml',
      '1 čaša od kiselog mlijeka octa → 200 ml',
      '10 deka soli → 100 g',
    ],
    syncStatus: 'synced',
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
    isDeleted: false,
    authorEmail: 'mama@obitelj.hr',
  },
  {
    id: 'bozicne-vanilin-kiflice',
    title: 'Božićne Vanilin Kiflice s Orasima',
    subtitle: 'Najprhkiji sitni kolačići iz limene kutije koji su svakim danom sve mekši',
    category: 'tradicija',
    subcategory: 'Božićni klasici',
    isFavorite: false,
    inCookSoon: true,
    cookSoonNote: 'Može se ispeći tjedan dana ranije u limenu kutiju',
    prepTimeMinutes: 45,
    cookTimeMinutes: 12,
    servings: '60 prhkih kiflica (2 velika lima)',
    panDimensions: '2 velika plitka lima od pećnice (40 × 35 cm)',
    ovenTemp: 'Umjerena vatra (~175 °C)',
    secretTip: 'Prave vanilin kiflice rade se bez jaja i bez praška za pecivo! Uvaljaj ih u štaub šećer točno 3 minute nakon vađenja iz pećnice dok su još tople, ali više ne pucaju.',
    cookingLogs: [],
    imageStatus: 'ai',
    isAiGenerated: true,
    image: getDishIllustrationUri('vanilin_kiflice', 'Božićne Vanilin Kiflice s Orasima'),
    imageUrl: getDishIllustrationUri('vanilin_kiflice', 'Božićne Vanilin Kiflice s Orasima'),
    originalScanUrl: createManuscriptScanDataUri({
      pageNumber: '33',
      handwrittenTitle: 'Prhke Vanilin Kiflice s orasima',
      lines: [
        'Tijesto (bez jaja - najprhkije!):',
        '- 30 deka glatkog brašna',
        '- frtalj kile hladnog maslaca (25 deka)',
        '- 12 deka sitno mljevenih oraha',
        '- 7 deka šećera u prahu i 1 vanilin šećer',
        'Za valjanje:',
        '- 15 deka štaub šećera + 2 vanilin šećera',
        'Peci kratko na 175 °C samo 12 minuta - moraju ostati svijetle!',
      ],
      marginNote: 'Uvaljaj ih u šećer nakon 3 minute kad se tek malo prohlade da ne pucaju.',
    }),
    originalHandwritingText:
      '30 deka glatkog brašna, frtalj kile maslaca, 12 deka mljevenih oraha, 7 deka štaub šećera. Peći na 175 °C 12 minuta da ostanu bijele.',
    ingredientGroups: [
      {
        groupTitle: 'Tijesto za kiflice',
        items: [
          { id: 'vk-1', name: 'glatko pšenično brašno', amount: 300, unit: 'g', originalMeasure: '30 deka' },
          { id: 'vk-2', name: 'hladni maslac narezan na listiće', amount: 250, unit: 'g', originalMeasure: 'frtalj kile' },
          { id: 'vk-3', name: 'fino mljeveni orasi', amount: 120, unit: 'g', originalMeasure: '12 deka' },
          { id: 'vk-4', name: 'šećer u prahu', amount: 70, unit: 'g', originalMeasure: '7 deka' },
          { id: 'vk-5', name: 'vanilin šećer', amount: 10, unit: 'g', originalMeasure: '1 vanilin' },
        ],
      },
      {
        groupTitle: 'Posip za valjanje',
        items: [
          { id: 'vk-6', name: 'šećer u prahu (štaub šećer)', amount: 150, unit: 'g', originalMeasure: '15 deka' },
          { id: 'vk-7', name: 'vanilin šećer', amount: 20, unit: 'g', originalMeasure: '2 vrećice' },
        ],
      },
    ],
    steps: [
      'Brzo zamijesi glatko brašno, hladni maslac, mljevene orahe i šećer u prahu. Nemoj predugo mijesiti rukama da se maslac ne otopi. Zamotaj u foliju i stavi u hladnjak 30 minuta.',
      'Od ohlađenog tijesta oblikuj dugačke valjuške, reži komadiće veličine oraha i dlanovima oblikuj male potkovice (kiflice).',
      'Posloži na lim obložen papirom za pečenje i peci u zagrijanoj pećnici na 175 °C 12 minuta. Kiflice moraju ostati svijetle, tek lagano rumene na samim vrhovima.',
      'Pusti ih na limu točno 3 minute da se malo učvrste, pa još tople pažljivo uvaljaj u mješavinu šećera u prahu i vanilin šećera.',
    ],
    momTips: [
      'Prave vanilin kiflice rade se bez jaja i bez praška za pecivo — tako zadrže fini oblik i tope se čim ih staviš u usta.',
    ],
    normalizedNotes: [
      '30 deka brašna → 300 g',
      'frtalj kile maslaca → 250 g',
      '12 deka oraha → 120 g',
    ],
    syncStatus: 'synced',
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 4,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 4,
    isDeleted: false,
    authorEmail: 'mama@obitelj.hr',
  },
  {
    id: 'domaci-gulas-njoki',
    title: 'Gulaš s Domaćim Njokima na Žlicu',
    subtitle: 'Sporo krčkani juneći gulaš na luku i mekani mamini krumpirovi njoki',
    category: 'slano',
    subcategory: 'Glavna jela',
    isFavorite: false,
    inCookSoon: false,
    prepTimeMinutes: 40,
    cookTimeMinutes: 120,
    servings: '6 obilnih porcija',
    panDimensions: 'Duboki teški lonac s debelim dnom (5 L)',
    ovenTemp: 'Na štednjaku (na tihoj vatri / lagano krčkanje)',
    secretTip: 'Gulaš se nikad ne zgušnjava brašnom! Gustoću mu daje crveni luk kojeg dinstaš polako s prstohvatom soli i malo tople vode dok se potpuno ne pretvori u kremu.',
    cookingLogs: [],
    imageStatus: 'ai',
    isAiGenerated: true,
    image: getDishIllustrationUri('gulas_njoki', 'Gulaš s Domaćim Njokima na Žlicu'),
    imageUrl: getDishIllustrationUri('gulas_njoki', 'Gulaš s Domaćim Njokima na Žlicu'),
    originalScanUrl: createManuscriptScanDataUri({
      pageNumber: '27',
      handwrittenTitle: 'Juneći gulaš i domaći njoki',
      lines: [
        'Za gulaš:',
        '- tri frtalja kile juneće koljenice (75 deka)',
        '- pol kile crvenog luka (koliko mesa, skoro toliko luka!)',
        '- 1 dcl crnog vina, lovor, slatka paprika, žličica koncentrata',
        'Za domaće njoke:',
        '- tri frtalja kile bijelog krumpira (u ljusci skuhanog)',
        '- 25 deka oštrog brašna, 1 jaje i 3 deka maslaca',
        'Krčkati gulaš poklopljeno 120 minuta na tihoj vatri.',
      ],
      marginNote: 'Luk dinstaj strpljivo s malo vode dok se potpuno ne pretvori u kremu!',
    }),
    originalHandwritingText:
      '75 deka juneće koljenice, pol kile luka, 1 dcl crnog vina. Njoki: 75 deka krumpira u ljusci, 25 deka oštrog brašna, 1 jaje, 3 deka maslaca.',
    ingredientGroups: [
      {
        groupTitle: 'Juneći gulaš',
        items: [
          { id: 'gnj-1', name: 'juneća koljenica ili vrat (narezano na kocke)', amount: 750, unit: 'g', originalMeasure: 'tri frtalja kile' },
          { id: 'gnj-2', name: 'crveni luk (sitno sjeckan)', amount: 500, unit: 'g', originalMeasure: 'pol kile' },
          { id: 'gnj-3', name: 'domaća svinjska mast ili ulje', amount: 2, unit: 'žlice' },
          { id: 'gnj-4', name: 'slatka mljevena crvena paprika', amount: 2, unit: 'žličice' },
          { id: 'gnj-5', name: 'crno vino', amount: 100, unit: 'ml', originalMeasure: '1 dcl' },
          { id: 'gnj-6', name: 'lovorov list', amount: 2, unit: 'lista' },
        ],
      },
      {
        groupTitle: 'Mamini krumpirovi njoki',
        items: [
          { id: 'gnj-7', name: 'stari bijeli krumpir (kuhan u ljusci)', amount: 750, unit: 'g', originalMeasure: 'tri frtalja kile' },
          { id: 'gnj-8', name: 'oštro brašno', amount: 250, unit: 'g', originalMeasure: 'frtalj kile' },
          { id: 'gnj-9', name: 'maslac', amount: 30, unit: 'g', originalMeasure: '3 deka' },
          { id: 'gnj-10', name: 'jaje', amount: 1, unit: 'kom' },
        ],
      },
    ],
    steps: [
      'Na masti uz prstohvat soli strpljivo pirjaj sitno nasjeckani crveni luk 25 minuta uz podlijevanje s po žlicom tople vode dok se luk potpuno ne otopi u gustu zlatnu bazu.',
      'Dodaj kocke junetine, zapeci ih sa svih strana 10 minuta, umiješaj slatku papriku, lovor i crno vino pa pirjaj poklopljeno na laganoj vatri 120 minuta uz povremeno podlijevanje temeljcem.',
      'Za njoke: krumpir skuhaj u ljusci 35 minuta, oguli dok je topao, protisni kroz prešu, dodaj maslac, sol, jaje i oštro brašno te brzo zamijesi mekano tijesto.',
      'Oblikuj valjuške, reži njoke i kuhaj ih u kipućoj slanoj vodi 4 minute dok ne isplivaju na površinu, pa ih odmah spoji s gustim umakom od gulaša.',
    ],
    momTips: [
      'Gulaš se nikad ne zgušnjava brašnom — gustoću mu daje luk koji je dinstan polako i strpljivo.',
    ],
    normalizedNotes: [
      'tri frtalja kile junetine/krumpira → 750 g',
      'pol kile luka → 500 g',
      '1 dcl crnog vina → 100 ml',
    ],
    syncStatus: 'synced',
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    isDeleted: false,
    authorEmail: 'mama@obitelj.hr',
  },
  {
    id: 'pekmez-sljive-pecnica',
    title: 'Pekmez od Bistrica Šljiva iz Pećnice',
    subtitle: 'Tamni, gusti domaći pekmez s koricom limuna i kapljicom ruma bez miješanja i prskanja',
    category: 'zimnica',
    subcategory: 'Pekmezi',
    isFavorite: false,
    inCookSoon: false,
    prepTimeMinutes: 30,
    cookTimeMinutes: 180,
    servings: '6 staklenki od 450 ml',
    panDimensions: 'Duboki emajlirani protvan (38 × 26 × 6 cm)',
    ovenTemp: 'Umjerena do jača vatra (190 °C)',
    secretTip: 'Zbog pola deci jabučnog octa kojeg preliješ preko šljiva i šećera na samom početku, pekmez se uopće ne prima za dno protvana i ne moraš ga miješati prvih 90 minuta!',
    cookingLogs: [],
    imageStatus: 'ai',
    isAiGenerated: true,
    image: getDishIllustrationUri('pekmez_sljive', 'Pekmez od Bistrica Šljiva iz Pećnice'),
    imageUrl: getDishIllustrationUri('pekmez_sljive', 'Pekmez od Bistrica Šljiva iz Pećnice'),
    originalScanUrl: createManuscriptScanDataUri({
      pageNumber: '64',
      handwrittenTitle: 'Pekmez od šljiva bistrica iz pećnice',
      lines: [
        'Sastojci:',
        '- 4 kile zrelih šljiva bistrica (očišćenih od koštica)',
        '- pol kile šećera (ili manje ako su šljive jako slatke)',
        '- pola deci jabučnog octa (da se ne lijepi za dno)',
        '- 1 dcl domaćeg ruma i 1 žličica cimeta pred kraj',
        'Postupak:',
        'Složiti šljive i šećer u duboki protvan, politi octom.',
        'Peći u pećnici na 190 °C oko 180 minuta, promiješati tek',
        'svakih 45 minuta.',
      ],
      marginNote: 'Zbog žlice octa na početku pekmez se uopće ne prima za dno protvana!',
    }),
    originalHandwritingText:
      '4 kile zrelih šljiva bistrica, pol kile šećera, pola deci octa, 1 dcl ruma, žličica cimeta. Peći u pećnici na 190 °C 3 sata.',
    ingredientGroups: [
      {
        groupTitle: 'Za jedan duboki protvan',
        items: [
          { id: 'ps-1', name: 'zrele šljive bistrice (bez koštica, prepolovljene)', amount: 4000, unit: 'g', originalMeasure: '4 kile' },
          { id: 'ps-2', name: 'šećer', amount: 500, unit: 'g', originalMeasure: 'pol kile' },
          { id: 'ps-3', name: 'jabučni ocat', amount: 50, unit: 'ml', originalMeasure: 'pola deci' },
          { id: 'ps-4', name: 'domaći rum', amount: 100, unit: 'ml', originalMeasure: '1 dcl' },
          { id: 'ps-5', name: 'mljeveni cimet', amount: 1, unit: 'žličica' },
        ],
      },
    ],
    steps: [
      'Šljive operi, prepolovi, izvadi koštice i složi u duboki emajlirani protvan naizmjence posipajući šećerom. Prelij s 50 ml jabučnog octa i nemoj uopće miješati.',
      'Stavi u pećnicu zagrijanu na 190 °C i peci prvih 90 minuta bez diranja dok šljive ne puste sok i ne počnu se karamelizirati.',
      'Nakon toga lagano promiješaj kuhačom svakih 30 minuta kroz idućih 60 minuta dok pekmez ne postane taman i gust.',
      'Pred sam kraj umiješaj rum i cimet, peci još 15 minuta i vrući pekmez ulij u sterilizirane staklenke.',
    ],
    momTips: [
      'Nikad ne miješaj šljive prvih sat i pol dok su u pećnici — octena kiselina na dnu spriječit će zagorijevanje.',
    ],
    normalizedNotes: [
      'pol kile šećera → 500 g',
      'pola deci octa → 50 ml',
      '1 dcl ruma → 100 ml',
    ],
    syncStatus: 'synced',
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    isDeleted: false,
    isMockup: 1,
    isSample: true,
    authorEmail: 'mama@obitelj.hr',
  },
];

export const INITIAL_RECIPES: Recipe[] = RAW_INITIAL_RECIPES.map((r) => ({
  ...r,
  isMockup: 1,
  isSample: true,
}));

