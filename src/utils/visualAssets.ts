import type { CategoryId } from './recipeLogic';

function svgToDataUri(svgString: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;
}

export type DishVisualPreset =
  | 'orehnjaca'
  | 'pita_jabuke'
  | 'goranski_nadjev'
  | 'cesnjovke_spek'
  | 'ajvar_zimnica'
  | 'vanilin_kiflice'
  | 'gulas_njoki'
  | 'pekmez_sljive'
  | 'custom_ai';

interface VariationTheme {
  bgStart: string;
  bgMid: string;
  bgEnd: string;
  tableTone: string;
  clothColor: string;
  plateFill: string;
  plateStroke: string;
  angleDeg: number;
  lightingLabel: string;
}

const VARIATION_THEMES: VariationTheme[] = [
  {
    bgStart: '#6E3522',
    bgMid: '#3E1E14',
    bgEnd: '#1E0F0A',
    tableTone: '#5C3A24',
    clothColor: '#F4EBE0',
    plateFill: '#FAF5EC',
    plateStroke: '#D5C3AA',
    angleDeg: 0,
    lightingLabel: 'Jutarnje svjetlo s prozora • 35mm',
  },
  {
    bgStart: '#4F5D3F',
    bgMid: '#2D3724',
    bgEnd: '#171D12',
    tableTone: '#6B442A',
    clothColor: '#EFE3D0',
    plateFill: '#FFFDF9',
    plateStroke: '#C8B499',
    angleDeg: -4,
    lightingLabel: 'Rustikalni stol u vrtu • Golden Hour',
  },
  {
    bgStart: '#7A4924',
    bgMid: '#472A14',
    bgEnd: '#241409',
    tableTone: '#4A2C18',
    clothColor: '#E8D5B7',
    plateFill: '#F7EFE2',
    plateStroke: '#BFA582',
    angleDeg: 4,
    lightingLabel: 'Topla obiteljska kuhinja • Makro detalj',
  },
  {
    bgStart: '#5E2B27',
    bgMid: '#381816',
    bgEnd: '#1C0B0A',
    tableTone: '#543420',
    clothColor: '#F7F0E6',
    plateFill: '#FDF9F1',
    plateStroke: '#D4BFA4',
    angleDeg: -2,
    lightingLabel: 'Blagdanski stolnjak • Meko bočno svjetlo',
  },
];

export function detectDishPresetFromText(
  title: string,
  category: CategoryId = 'kolaci',
  ingredients: string[] = []
): DishVisualPreset {
  const blob = `${title} ${ingredients.join(' ')}`
    .toLowerCase()
    .replace(/[čć]/g, 'c')
    .replace(/đ/g, 'd')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z');

  if (blob.includes('orehnjac') || blob.includes('makovnjac') || blob.includes('struc')) {
    return 'orehnjaca';
  }
  if (blob.includes('pita') && blob.includes('jabuk')) {
    return 'pita_jabuke';
  }
  if (blob.includes('nadjev') || blob.includes('hrge')) {
    return 'goranski_nadjev';
  }
  if (blob.includes('cesnjov') || blob.includes('kobasic') || blob.includes('spek') || blob.includes('pac')) {
    return 'cesnjovke_spek';
  }
  if (blob.includes('ajvar') || blob.includes('patlidz') || blob.includes('rog paprik')) {
    return 'ajvar_zimnica';
  }
  if (blob.includes('kiflic')) {
    return 'vanilin_kiflice';
  }
  if (blob.includes('gulas') || blob.includes('njok')) {
    return 'gulas_njoki';
  }
  if (blob.includes('pekmez') || blob.includes('sljiv') || blob.includes('bistric') || blob.includes('dzem')) {
    return 'pekmez_sljive';
  }

  switch (category) {
    case 'kolaci':
      return 'orehnjaca';
    case 'slano':
      return 'custom_ai';
    case 'mesarija':
      return 'cesnjovke_spek';
    case 'zimnica':
      return 'ajvar_zimnica';
    case 'tradicija':
      return 'vanilin_kiflice';
    default:
      return 'custom_ai';
  }
}

function renderDishCenterpieceSvg(preset: DishVisualPreset, variationIndex: number): string {
  const v = variationIndex % 4;
  switch (preset) {
    case 'orehnjaca':
      return `
        <!-- Dva bogata reda šnita domaće Orehnjače i Makovnjače s punim spiralnim nadjevom -->
        <g transform="translate(0, ${v === 1 ? -6 : 0})">
          <!-- Štruca Makovnjače (lijevo/gore) -->
          <path d="M210 230 C210 165 390 165 390 230 L390 285 C390 302 210 302 210 285 Z" fill="#D58A44" stroke="#8F511D" stroke-width="4"/>
          <path d="M225 235 C225 182 375 182 375 235 L375 278 L225 278 Z" fill="#F6E2BE"/>
          <!-- Gusti crni spiralni nadjev od maka -->
          <path d="M242 262 C242 204 358 204 358 262 C345 274 265 274 258 242 C258 218 338 218 338 248 C328 260 280 260 280 242" fill="none" stroke="#241F26" stroke-width="15" stroke-linecap="round"/>
          <!-- Šećer u prahu po vrhu -->
          <ellipse cx="300" cy="184" rx="70" ry="12" fill="#FFFFFF" opacity="0.72"/>

          <!-- Šnita Orehnjače u prvom planu (desno/dolje) -->
          <path d="M350 265 C350 198 545 198 545 265 L545 322 C545 340 350 340 350 322 Z" fill="#C97B36" stroke="#7E4416" stroke-width="4"/>
          <path d="M366 270 C366 214 529 214 529 270 L529 314 L366 314 Z" fill="#F8E7C8"/>
          <!-- Bogati smeđi spiralni nadjev od oraha s rumom -->
          <path d="M385 298 C385 236 510 236 510 298 C496 310 408 310 404 276 C404 250 488 250 488 282 C478 294 428 294 428 276" fill="none" stroke="#5A3219" stroke-width="16" stroke-linecap="round"/>
          <ellipse cx="448" cy="216" rx="74" ry="13" fill="#FFFFFF" opacity="0.78"/>

          <!-- Polovice oraha i zrnca maka na tanjuru -->
          <ellipse cx="245" cy="332" rx="18" ry="12" fill="#8C5327" stroke="#5A3219" stroke-width="2"/>
          <ellipse cx="275" cy="342" rx="16" ry="11" fill="#9E6031" stroke="#5A3219" stroke-width="2"/>
          <circle cx="555" cy="315" r="3" fill="#241F26"/>
          <circle cx="566" cy="322" r="2.5" fill="#241F26"/>
          <circle cx="548" cy="326" r="3" fill="#241F26"/>
        </g>
      `;

    case 'pita_jabuke':
      return `
        <!-- Kocke starinske lijene pite od jabuka s prhkim tijestom i sočnim nadjevom s cimetom -->
        <g transform="translate(0, ${v === 2 ? -5 : 0})">
          <!-- Donja kocka pite -->
          <polygon points="235,280 395,245 485,285 325,325" fill="#E6B66A" stroke="#9C6526" stroke-width="3"/>
          <!-- Debeli sloj ribanih jabuka s cimetom u sredini -->
          <polygon points="235,280 325,325 325,360 235,315" fill="#B86222"/>
          <polygon points="325,325 485,285 485,320 325,360" fill="#9E4F16"/>
          <!-- Donja prhka kora -->
          <polygon points="235,315 325,360 325,374 235,329" fill="#DEB068"/>
          <polygon points="325,360 485,320 485,334 325,374" fill="#CFA056"/>

          <!-- Druga kocka pite složena preko prve -->
          <g transform="translate(45, -48)">
            <polygon points="255,265 405,232 485,270 335,305" fill="#F0C77E" stroke="#A66D2B" stroke-width="3"/>
            <!-- Šećer u prahu posut po gornjoj kori -->
            <polygon points="275,264 395,238 462,268 342,296" fill="#FFFFFF" opacity="0.65"/>
            <polygon points="255,265 335,305 335,336 255,296" fill="#C46B27"/>
            <polygon points="335,305 485,270 485,301 335,336" fill="#AC581A"/>
            <!-- Rupice od vilice na gornjoj prhkoj kori -->
            <circle cx="330" cy="265" r="2.5" fill="#8C5219"/>
            <circle cx="355" cy="260" r="2.5" fill="#8C5219"/>
            <circle cx="380" cy="255" r="2.5" fill="#8C5219"/>
            <circle cx="350" cy="278" r="2.5" fill="#8C5219"/>
            <circle cx="375" cy="272" r="2.5" fill="#8C5219"/>
          </g>

          <!-- Crvena domaća jabuka i štapić cimeta sa strane -->
          <circle cx="555" cy="265" r="36" fill="#B83227" stroke="#7A1D15" stroke-width="3"/>
          <path d="M555 229 Q562 215 572 220" stroke="#4A5D23" stroke-width="4" fill="none"/>
          <line x1="195" y1="325" x2="255" y2="352" stroke="#7A3E18" stroke-width="9" stroke-linecap="round"/>
        </g>
      `;

    case 'goranski_nadjev':
      return `
        <!-- Uskršnji goranski nadjev (Hrge) narezan na debele šnite s kockicama šunke, kruha, jaja i mladog luka -->
        <g>
          <!-- Glavna štruca nadjeva u pozadini -->
          <path d="M215 235 C215 170 465 170 465 235 L465 290 C465 308 215 308 215 290 Z" fill="#D99B52" stroke="#8C5820" stroke-width="4"/>
          <!-- Dvije narezane šnite u prvom planu s mozaikom šunke, jaja i mladog luka -->
          <g transform="translate(65, 35)">
            <ellipse cx="320" cy="255" rx="95" ry="62" fill="#F4D590" stroke="#9E6728" stroke-width="5"/>
            <!-- Kockice dimljene šunke -->
            <rect x="275" y="232" width="22" height="16" rx="4" fill="#B84A39"/>
            <rect x="335" y="225" width="24" height="18" rx="4" fill="#C85A48"/>
            <rect x="305" y="262" width="26" height="17" rx="4" fill="#A63D2D"/>
            <rect x="355" y="258" width="20" height="15" rx="4" fill="#B84A39"/>
            <rect x="260" y="260" width="20" height="14" rx="4" fill="#C85A48"/>
            <!-- Kockice kruha -->
            <rect x="302" y="222" width="22" height="18" rx="4" fill="#FAE8C8"/>
            <rect x="282" y="250" width="18" height="15" rx="3" fill="#FAE8C8"/>
            <rect x="332" y="248" width="20" height="16" rx="3" fill="#FAE8C8"/>
            <!-- Zeleni kolutići mladog luka -->
            <circle cx="295" cy="245" r="6" fill="#3E7A2E"/>
            <circle cx="328" cy="242" r="5.5" fill="#4C8F3A"/>
            <circle cx="348" cy="276" r="6" fill="#3E7A2E"/>
            <circle cx="278" cy="278" r="5" fill="#4C8F3A"/>
            <circle cx="318" cy="285" r="5.5" fill="#3E7A2E"/>
          </g>
          <!-- Mladi luk i kuhano jaje uz rub tanjura -->
          <path d="M180 315 Q250 345 340 340" stroke="#3E7A2E" stroke-width="8" stroke-linecap="round" fill="none"/>
          <ellipse cx="535" cy="285" rx="28" ry="22" fill="#FFFFFF" stroke="#E5D5B5" stroke-width="3"/>
          <circle cx="535" cy="285" r="12" fill="#E89B25"/>
        </g>
      `;

    case 'cesnjovke_spek':
      return `
        <!-- Domaće dimljene češnjovke u paru i narezani dimljeni špek s glavicom domaćeg češnjaka -->
        <g>
          <!-- Komad dimljenog špeka (slanine) s redovima mesa i bijele slanine -->
          <polygon points="210,220 355,195 385,255 240,285" fill="#8C2D22" stroke="#541710" stroke-width="3"/>
          <polygon points="210,240 355,215 365,232 220,258" fill="#F5E6D3"/>
          <polygon points="225,262 370,237 378,250 233,275" fill="#F2DEC4"/>

          <!-- Par savijenih domaćih dimljenih češnjovki -->
          <path d="M275 305 C245 235 485 215 515 295 C528 330 465 352 405 335 C345 320 295 345 275 305 Z" fill="none" stroke="#8F281B" stroke-width="36" stroke-linecap="round"/>
          <path d="M275 305 C245 235 485 215 515 295 C528 330 465 352 405 335" fill="none" stroke="#B53B2A" stroke-width="14" stroke-linecap="round" opacity="0.65"/>

          <!-- Glavica domaćeg češnjaka, zrnca crnog papra i lovorov list -->
          <circle cx="545" cy="245" r="28" fill="#F7F0E4" stroke="#C9B89E" stroke-width="3"/>
          <path d="M535 220 Q545 245 532 270 M555 220 Q545 245 558 270" stroke="#C9B89E" stroke-width="2" fill="none"/>
          <ellipse cx="225" cy="318" rx="24" ry="11" transform="rotate(-25 225 318)" fill="#4A5D32"/>
          <circle cx="365" cy="348" r="4" fill="#1F1A18"/>
          <circle cx="382" cy="354" r="3.5" fill="#1F1A18"/>
          <circle cx="352" cy="356" r="4" fill="#1F1A18"/>
        </g>
      `;

    case 'ajvar_zimnica':
      return `
        <!-- Staklenka i zdjelica gustog crveno-narančastog Maminog pečenog ajvara uz pečenu rog papriku -->
        <g>
          <!-- Staklenka ajvara u pozadini -->
          <rect x="235" y="155" width="125" height="165" rx="22" fill="#D9481E" stroke="#F5E6D3" stroke-width="5"/>
          <rect x="248" y="135" width="99" height="22" rx="6" fill="#C88A2B" stroke="#8C5B12" stroke-width="3"/>
          <!-- Etiketa na staklenci -->
          <rect x="250" y="210" width="95" height="52" rx="6" fill="#FAF3E3" stroke="#C8A878" stroke-width="2"/>
          <line x1="265" y1="230" x2="330" y2="230" stroke="#8C2D19" stroke-width="3"/>
          <line x1="272" y1="246" x2="322" y2="246" stroke="#655A52" stroke-width="2"/>

          <!-- Rustikalna keramička zdjelica puna gustog pečenog ajvara u prvom planu -->
          <ellipse cx="435" cy="285" rx="105" ry="62" fill="#EDE0CC" stroke="#B8A284" stroke-width="5"/>
          <ellipse cx="435" cy="278" rx="90" ry="48" fill="#E04A1F"/>
          <path d="M375 275 Q435 245 495 278 Q435 305 375 275 Z" fill="#F26430" opacity="0.85"/>
          <path d="M405 272 Q435 258 468 274" stroke="#FF8A54" stroke-width="6" stroke-linecap="round" fill="none"/>

          <!-- Pečena crvena rog paprika sa strane -->
          <path d="M195 315 C225 295 295 315 325 348 C275 362 215 345 195 315 Z" fill="#B82518" stroke="#6E120A" stroke-width="3"/>
          <path d="M182 310 L202 318" stroke="#4A5D23" stroke-width="6" stroke-linecap="round"/>
        </g>
      `;

    case 'vanilin_kiflice':
      return `
        <!-- Božićne prhke vanilin kiflice u obliku potkovica bogato uvaljane u bijeli štaub šećer -->
        <g>
          <!-- Kiflica 1 (lijevo) -->
          <path d="M245 285 C225 225 325 205 345 265 C332 272 318 262 310 248 C295 230 265 240 272 268 C276 280 260 292 245 285 Z" fill="#FAF4E8" stroke="#D9C39E" stroke-width="4"/>
          <!-- Kiflica 2 (sredina dolje) -->
          <path d="M325 325 C315 260 425 250 435 312 C420 318 408 305 400 292 C388 272 355 278 358 306 C360 320 342 332 325 325 Z" fill="#FFFDF9" stroke="#DEC8A4" stroke-width="4"/>
          <!-- Kiflica 3 (desno) -->
          <path d="M415 278 C405 218 508 208 518 268 C504 274 492 262 484 248 C472 230 442 236 445 262 C448 275 430 285 415 278 Z" fill="#FAF4E8" stroke="#D9C39E" stroke-width="4"/>
          <!-- Kiflica 4 (vrh sredina) -->
          <path d="M335 235 C325 178 425 172 435 228 C420 234 408 222 400 208 C388 192 360 198 362 222 C364 235 348 242 335 235 Z" fill="#FFFFFF" stroke="#E2CEAE" stroke-width="4"/>

          <!-- Polovice oraha i oblak štaub šećera -->
          <ellipse cx="235" cy="322" rx="18" ry="12" fill="#8C5327"/>
          <ellipse cx="525" cy="315" rx="17" ry="11" fill="#9E6031"/>
          <circle cx="290" cy="310" r="2.5" fill="#FFFFFF"/>
          <circle cx="465" cy="305" r="3" fill="#FFFFFF"/>
          <circle cx="385" cy="260" r="2.5" fill="#FFFFFF"/>
        </g>
      `;

    case 'gulas_njoki':
      return `
        <!-- Duboki tanjur gustog tamnog junećeg gulaša s domaćim žutim krumpirovim njokima -->
        <g>
          <!-- Duboka rustikalna zdjela -->
          <ellipse cx="400" cy="272" rx="195" ry="112" fill="#F5ECE0" stroke="#C8B496" stroke-width="8"/>
          <!-- Gusti crveno-smeđi umak od gulaša -->
          <ellipse cx="400" cy="272" rx="162" ry="90" fill="#7A2414"/>
          <ellipse cx="395" cy="268" rx="145" ry="78" fill="#8E2D1B"/>

          <!-- Kocke mekane junetine u gulašu -->
          <rect x="315" y="235" width="38" height="28" rx="8" fill="#4F170D" stroke="#380E07" stroke-width="2"/>
          <rect x="395" y="222" width="42" height="30" rx="8" fill="#591B10" stroke="#380E07" stroke-width="2"/>
          <rect x="445" y="265" width="36" height="26" rx="8" fill="#4F170D" stroke="#380E07" stroke-width="2"/>
          <rect x="348" y="282" width="40" height="28" rx="8" fill="#591B10" stroke="#380E07" stroke-width="2"/>

          <!-- Domaći krumpirovi njoki s karakterističnim rebrima od vilice -->
          <g fill="#F4D382" stroke="#C99E42" stroke-width="2">
            <ellipse cx="295" cy="272" rx="22" ry="14" transform="rotate(-12 295 272)"/>
            <ellipse cx="368" cy="252" rx="23" ry="15" transform="rotate(15 368 252)"/>
            <ellipse cx="425" cy="292" rx="22" ry="14" transform="rotate(-8 425 292)"/>
            <ellipse cx="478" cy="242" rx="21" ry="14" transform="rotate(20 478 242)"/>
            <ellipse cx="318" cy="305" rx="20" ry="13"/>
          </g>

          <!-- Listići svježeg peršina i lovorov list -->
          <circle cx="385" cy="268" r="6" fill="#3E7A2E"/>
          <circle cx="412" cy="258" r="5" fill="#4C8F3A"/>
          <ellipse cx="495" cy="292" rx="20" ry="9" transform="rotate(25 495 292)" fill="#4A5D32"/>
        </g>
      `;

    case 'pekmez_sljive':
      return `
        <!-- Staklenka tamnog domaćeg pekmeza od šljiva bistrica iz pećnice i kriška kruha namazana pekmezom -->
        <g>
          <!-- Staklenka tamno-ljubičastog pekmeza od šljiva -->
          <rect x="235" y="150" width="128" height="170" rx="22" fill="#2D122B" stroke="#E8D8C3" stroke-width="5"/>
          <rect x="242" y="165" width="114" height="145" rx="16" fill="#3D173B"/>
          <!-- Karirani poklopac staklenke -->
          <rect x="245" y="130" width="108" height="24" rx="8" fill="#B83B2B" stroke="#7A2216" stroke-width="3"/>
          <rect x="252" y="208" width="94" height="50" rx="6" fill="#FAF3E3" stroke="#C8A878" stroke-width="2"/>
          <line x1="268" y1="228" x2="330" y2="228" stroke="#3D173B" stroke-width="3"/>
          <line x1="275" y1="244" x2="322" y2="244" stroke="#655A52" stroke-width="2"/>

          <!-- Šnita domaćeg kruha s maslacem i debelim slojem tamnog pekmeza od šljiva -->
          <path d="M385 275 C385 225 545 225 545 275 L535 335 C535 348 395 348 395 335 Z" fill="#D99B52" stroke="#8C5820" stroke-width="4"/>
          <path d="M398 280 C398 240 532 240 532 280 L524 326 L406 326 Z" fill="#F7E6C4"/>
          <!-- Sjajni tamni namaz od šljiva -->
          <path d="M412 285 C412 252 518 252 518 285 C515 315 415 318 412 285 Z" fill="#3B1238"/>
          <path d="M432 275 Q465 262 498 278" stroke="#7A3272" stroke-width="5" stroke-linecap="round" fill="none"/>

          <!-- Svježe plavo-ljubičaste šljive bistrice sa strane -->
          <ellipse cx="215" cy="318" rx="24" ry="30" transform="rotate(-18 215 318)" fill="#3F2459" stroke="#251336" stroke-width="3"/>
          <ellipse cx="262" cy="335" rx="28" ry="22" fill="#4B2C6B" stroke="#251336" stroke-width="3"/>
          <ellipse cx="262" cy="335" rx="18" ry="12" fill="#D98A2B"/>
        </g>
      `;

    default:
      return `
        <g>
          <ellipse cx="400" cy="272" rx="155" ry="92" fill="#D98A3C" stroke="#8C4F19" stroke-width="5"/>
          <ellipse cx="400" cy="264" rx="125" ry="70" fill="#F2B866"/>
          <circle cx="360" cy="255" r="24" fill="#FAF3E3" opacity="0.75"/>
          <circle cx="435" cy="272" r="20" fill="#FAF3E3" opacity="0.65"/>
        </g>
      `;
  }
}

/**
 * Generates a warm, high-craft AI dish illustration SVG data URI tailored to the exact Croatian recipe
 * and supports multiple visual variations (`variationIndex = 0, 1, 2, 3...`) when the user clicks
 * "Nova AI slika" (Ponovno generiraj AI sliku).
 */
export function generateAiDishVariationDataUri(
  title: string,
  category: CategoryId = 'kolaci',
  ingredients: string[] = [],
  variationIndex = 0,
  explicitPreset?: DishVisualPreset
): string {
  const preset = explicitPreset || detectDishPresetFromText(title, category, ingredients);
  const theme = VARIATION_THEMES[Math.abs(variationIndex) % VARIATION_THEMES.length];
  const safeTitle = (title || 'Domaći recept iz Mamine Teke')
    .slice(0, 48)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const centerpiece = renderDishCenterpieceSvg(preset, Math.abs(variationIndex));

  return svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 540" fill="none">
      <defs>
        <radialGradient id="aiWarmGlow_${variationIndex % 4}" cx="50%" cy="42%" r="65%">
          <stop offset="0%" stop-color="${theme.bgStart}"/>
          <stop offset="58%" stop-color="${theme.bgMid}"/>
          <stop offset="100%" stop-color="${theme.bgEnd}"/>
        </radialGradient>
        <linearGradient id="woodTable_${variationIndex % 4}" x1="0" y1="320" x2="800" y2="540" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${theme.tableTone}"/>
          <stop offset="100%" stop-color="#24140B"/>
        </linearGradient>
      </defs>

      <!-- Warm Nostalgic Kitchen Backdrop -->
      <rect width="800" height="540" fill="url(#aiWarmGlow_${variationIndex % 4})"/>

      <!-- Soft Window Sunlight Beams -->
      <circle cx="${variationIndex % 2 === 0 ? '140' : '660'}" cy="85" r="140" fill="#FFF6D6" opacity="0.14"/>
      <circle cx="400" cy="240" r="260" fill="#FFE7BA" opacity="0.08"/>

      <!-- Rustic Wooden Table Surface -->
      <path d="M0 335 L800 315 L800 540 L0 540 Z" fill="url(#woodTable_${variationIndex % 4})"/>

      <!-- Embroidered Linen Tablecloth Corner -->
      <path d="M40 375 L760 345 L790 540 L10 540 Z" fill="${theme.clothColor}" opacity="0.22"/>
      <line x1="55" y1="392" x2="745" y2="364" stroke="#B83B2B" stroke-width="3" stroke-dasharray="12 8" opacity="0.45"/>

      <!-- Plated Croatian Dish Centerpiece -->
      <g transform="rotate(${theme.angleDeg} 400 275)">
        <!-- Plate Shadow -->
        <ellipse cx="406" cy="294" rx="242" ry="138" fill="#120905" opacity="0.48"/>
        <!-- Vintage Ceramic Plate -->
        <ellipse cx="400" cy="278" rx="236" ry="134" fill="${theme.plateFill}" stroke="${theme.plateStroke}" stroke-width="8"/>
        <ellipse cx="400" cy="278" rx="198" ry="110" fill="none" stroke="${theme.plateStroke}" stroke-width="2" stroke-dasharray="8 6"/>

        ${centerpiece}
      </g>

      <!-- Subtle Culinary Caption Strip at Very Top for Visual Context -->
      <text x="400" y="42" text-anchor="middle" font-family="Georgia, serif" font-size="16" font-style="italic" fill="#F5E9D4" opacity="0.72">${safeTitle} • ${theme.lightingLabel}</text>
    </svg>
  `);
}

export function getDishIllustrationUri(
  preset: DishVisualPreset,
  title = '',
  variationIndex = 0
): string {
  return generateAiDishVariationDataUri(title, 'kolaci', [], variationIndex, preset);
}

/**
 * Offline-safe fallback image data URI if the browser is offline or external images are blocked.
 */
export function getOfflineFallbackDishUri(
  title = 'Domaći recept iz Mamine Teke',
  category: CategoryId = 'kolaci'
): string {
  return generateAiDishVariationDataUri(title, category, [], 0);
}

/**
 * Generates an authentic vintage lined Croatian notebook scan SVG ("Originalna teka")
 * showing Mom's cursive handwriting, underlined headers, and margin tips.
 * Uses standard Georgia/serif fonts so browser screenshot engines never stall waiting for external fonts.
 */
export function createManuscriptScanDataUri(params: {
  pageNumber: string;
  handwrittenTitle: string;
  lines: string[];
  marginNote?: string;
}): string {
  const escapedTitle = params.handwrittenTitle
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lineElements = params.lines
    .slice(0, 14)
    .map((line, idx) => {
      const y = 148 + idx * 38;
      const safeLine = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const isHeader = safeLine.endsWith(':');
      return `
        <text x="86" y="${y}" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="${isHeader ? '24' : '21'}" font-weight="${isHeader ? '700' : '500'}" fill="${isHeader ? '#1B3058' : '#243B67'}" transform="rotate(${idx % 2 === 0 ? -0.35 : 0.25} 300 ${y})">${safeLine}</text>
      `;
    })
    .join('\n');

  const safeMargin = (params.marginNote || 'Provjereno - uvijek uspije!')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const horizontalLines = Array.from({ length: 16 }, (_, i) => {
    const y = 120 + i * 38;
    return `<line x1="0" y1="${y}" x2="680" y2="${y}" stroke="#7B9BB2" stroke-width="1" opacity="0.42"/>`;
  }).join('\n');

  return svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 820" fill="none">
      <rect width="680" height="820" rx="12" fill="#FBF5E6"/>
      <circle cx="590" cy="110" r="85" fill="#E9D8B8" opacity="0.45"/>
      <circle cx="95" cy="710" r="110" fill="#EADAC0" opacity="0.4"/>
      <circle cx="540" cy="640" r="54" fill="none" stroke="#C89F70" stroke-width="4" opacity="0.28"/>
      ${horizontalLines}
      <line x1="68" y1="0" x2="68" y2="820" stroke="#C65B52" stroke-width="2" opacity="0.55"/>
      <text x="615" y="48" font-family="Georgia, serif" font-size="18" fill="#7D6B58">str. ${params.pageNumber}</text>
      <text x="86" y="88" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="31" font-weight="700" fill="#1B3058">${escapedTitle}</text>
      <path d="M84 98 Q260 93 450 100" stroke="#1B3058" stroke-width="2.5" fill="none" opacity="0.75"/>
      ${lineElements}
      <g transform="translate(88, 725) rotate(-1.5)">
        <rect x="-10" y="-28" width="520" height="46" rx="8" fill="#F4E6CE" stroke="#B5533C" stroke-width="1.5" stroke-dasharray="6 4"/>
        <text x="8" y="2" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="20" font-weight="700" fill="#9E3B24">Mamina napomena: ${safeMargin}</text>
      </g>
    </svg>
  `);
}

export function getDefaultIllustrationForCategory(category: CategoryId, title: string): string {
  switch (category) {
    case 'kolaci':
      return getDishIllustrationUri('orehnjaca', title);
    case 'slano':
      return getDishIllustrationUri('gulas_njoki', title);
    case 'mesarija':
      return getDishIllustrationUri('cesnjovke_spek', title);
    case 'zimnica':
      return getDishIllustrationUri('ajvar_zimnica', title);
    case 'tradicija':
      return getDishIllustrationUri('goranski_nadjev', title);
    default:
      return getDishIllustrationUri('custom_ai', title);
  }
}
