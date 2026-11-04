import express from 'express';
import path from 'path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import {
  buildAuthenticDishImagePrompt,
  buildRegeneratedAiPrompt,
  mapVisionOcrResponseToRecipe,
  type CategoryId,
  type VisionOcrStructuredOutput,
} from './src/utils/recipeLogic.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '25mb' }));

// Public version: each user brings their own Gemini key, sent per request and never stored.
const keyStore = new AsyncLocalStorage<string>();

app.use((req, _res, next) => {
  const raw = req.headers['x-gemini-key'];
  const key = (Array.isArray(raw) ? raw[0] : raw || '').trim();
  if (/^[\w-]{20,80}$/.test(key)) keyStore.run(key, next);
  else next();
});

function getUserApiKey(): string {
  return keyStore.getStore() || '';
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = getUserApiKey();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isRateLimitOrQuotaError(err: any): boolean {
  const status = err?.status || err?.code || err?.error?.code;
  const msg = String(err?.message || err?.error?.message || '').toLowerCase();
  return (
    status === 429 ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota')
  );
}

const QUOTA_EXCEEDED_MESSAGE =
  'Iskorišten je besplatni dnevni limit Gemini API-ja. Molimo pokušajte ponovo sutra ili postavite novi API ključ.';

app.post('/api/ocr-recipe', async (req, res) => {
  try {
    const { imagesBase64 = [], rawHandwritingText = '' } = req.body || {};

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Za skeniranje recepata unesite svoj besplatni Gemini API ključ (zaslon „O Teki” → Vaš Gemini API ključ).',
      });
      return;
    }

    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

    if (Array.isArray(imagesBase64)) {
      for (const img of imagesBase64.slice(0, 4)) {
        if (typeof img !== 'string' || !img.trim()) continue;
        // Support both data:image/...;base64,... and raw base64 strings
        if (img.startsWith('data:image/')) {
          const commaIndex = img.indexOf(',');
          if (commaIndex !== -1) {
            const meta = img.slice(0, commaIndex);
            const base64Data = img.slice(commaIndex + 1).trim();
            const mimeMatch = meta.match(/data:(image\/[a-zA-Z0-9+.-]+);base64/i);
            // Send raster images directly to Gemini Vision
            if (mimeMatch && base64Data && !mimeMatch[1].includes('svg')) {
              parts.push({
                inlineData: {
                  mimeType: mimeMatch[1],
                  data: base64Data,
                },
              });
            }
          }
        } else if (img.length > 100) {
          parts.push({
            inlineData: {
              mimeType: 'image/jpeg',
              data: img.trim(),
            },
          });
        }
      }
    }

    const cleanText = typeof rawHandwritingText === 'string' ? rawHandwritingText.trim() : '';

    if (parts.length === 0 && cleanText.length === 0) {
      res.status(400).json({
        error:
          'Nije priložena čitljiva fotografija recepta niti tekst. Molimo slikajte stranicu kamerom ili odaberite sliku iz galerije.',
      });
      return;
    }

    parts.push({
      text: `Ti si stručni kulinarski arhivist za obiteljsku aplikaciju "Mamina Teka by Zrina".
Pažljivo pročitaj priloženu fotografiju stvarnog rukopisa recepta (i/ili priloženi prijepis ako postoji) na hrvatskom jeziku i vrati TOČAN strukturirani JSON prema onome što stvarno piše na slici. Ne izmišljaj sastojke niti recepte koji nisu na slici!

OBAVEZNA PRAVILA ZA ČITANJE RUKOPISA:
1. "title": Pročitaj stvarni naziv jela sa slike (npr. "Krekeri od kukuruznog brašna").
2. "category": Odaberi točno jednu od 5 glavnih polica:
   - "Kolači & Slatko"
   - "Slana kuhinja & Ručak"
   - "Mesarija & Sušiona"
   - "Zimnica & Špajza"
   - "Tradicija & Blagdani"
3. "subcategory": Odredi točnu podvrstu jela (npr. "Slani prilozi i grickalice", "Biskviti", "Pite", "Dizana tijesta", "Glavna jela", "Juhe", "Variva", "Češnjovke", "Pekmezi", "Ajvar", "Božićni klasici", itd.).
4. "oven": Objekt { "temperature": "...", "notes": "..." } (npr. { "temperature": "150 °C", "notes": "dok ne porumene" }). Ako piše "umjerena vatra", stavi "~180 °C", a za "tiha vatra" stavi "~150 °C".
5. "panSize": Navedena ili procijenjena veličina lima/protvana/kalupa (npr. "Veliki plitki lim od pećnice (40 × 35 cm)" ili "Srednji protvan (30 × 20 cm)").
6. "prepTime" i "cookTime": Vrijeme pripreme i vrijeme pečenja/kuhanja u minutama (brojevi).
7. "ingredients": Polje svih sastojaka sa slike. Svaki sastojak ima:
   - "phase": Faza pripreme (npr. "Smjesa", "Tijesto", "Krema", "Nadjev", "Glazura")
   - "name": Točan naziv sastojka sa slike (npr. "kukuruzno brašno za palentu", "sjemenke suncokreta, sezama i lana", "ulje", "voda", "sol")
   - "amount": Količina sa slike ili preračunata u standardnu mjeru (npr. "2 dl", "250 g", "1 žličica")
   - "originalAmount": Izvorna mjera točno kako piše u rukopisu (npr. "2 dl", "frtalj kile", "15 deka")
8. "instructions": Niz koračnih uputa (korak po korak) točno prema tekstu sa slike.
9. "momSecret": Napomene s dna stranice ili margine ako postoje (npr. "blago rumeni i mirišljavi, suhi").
10. "englishImagePrompt": Fotorealističan opis tog konkretnog gotovog jela na engleskom jeziku za generiranje slike, koji dinamički sastavljaš isključivo na temelju:
   - Naziva jela ("title")
   - Kategorije ("category" — ako je kategorija "Kolači & Slatko", STROGO JE ZABRANJENO spominjati meso, kobasice, špek, slaninu ili češnjak, čak i ako se u pripremi spominje "oblikuj tijesto u kobasicu/valjak"!)
   - Popisa stvarnih sastojaka ("ingredients").
   - Nikada ne vraćaj generičke opise za neko drugo jelo (npr. krekere za orehnjaču ili gulaš u zdjeli za suhe kolače). Opiši točno kako izgleda ovo gotovo domaće jelo posluženo na stolu, uz prirodno osvjetljenje ("soft natural window lighting, shot on 35mm lens, authentic homemade food photography").

${cleanText ? `Dodatni tekst / bilješka uz sliku:\n${cleanText}` : ''}`,
    });

    const ocrSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        subtitle: { type: Type.STRING },
        category: {
          type: Type.STRING,
          description:
            'Jedna od 5 polica: Kolači & Slatko, Slana kuhinja & Ručak, Mesarija & Sušiona, Zimnica & Špajza, Tradicija & Blagdani',
        },
        subcategory: { type: Type.STRING },
        oven: {
          type: Type.OBJECT,
          properties: {
            temperature: { type: Type.STRING },
            notes: { type: Type.STRING },
          },
          required: ['temperature'],
        },
        panSize: { type: Type.STRING },
        prepTime: { type: Type.INTEGER },
        cookTime: { type: Type.INTEGER },
        servings: { type: Type.STRING },
        ingredients: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              phase: { type: Type.STRING },
              name: { type: Type.STRING },
              amount: { type: Type.STRING },
              originalAmount: { type: Type.STRING },
            },
            required: ['phase', 'name', 'amount'],
          },
        },
        instructions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        momSecret: { type: Type.STRING },
        englishImagePrompt: { type: Type.STRING },
      },
      required: [
        'title',
        'category',
        'subcategory',
        'oven',
        'panSize',
        'prepTime',
        'cookTime',
        'ingredients',
        'instructions',
        'momSecret',
        'englishImagePrompt',
      ],
    };

    const candidateOcrModels = ['gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-3.8-flash'];
    let jsonText = '';
    let usedModel = candidateOcrModels[0];
    let lastModelErr: any = null;

    for (const modelName of candidateOcrModels) {
      try {
        usedModel = modelName;
        const geminiPromise = ai.models.generateContent({
          model: modelName,
          contents: { parts },
          config: {
            responseMimeType: 'application/json',
            responseSchema: ocrSchema,
            temperature: 0.1,
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () =>
              reject(
                new Error(
                  `Isteklo je vrijeme čekanja (45 s) na obradu rukopisa modelom ${modelName}.`
                )
              ),
            45000
          );
        });

        const response = await Promise.race([geminiPromise, timeoutPromise]);
        jsonText = response.text?.trim() || '';
        if (jsonText) break;
      } catch (mErr: any) {
        lastModelErr = mErr;
        if (isRateLimitOrQuotaError(mErr)) {
          throw mErr;
        }
      }
    }

    if (!jsonText) {
      if (lastModelErr) throw lastModelErr;
      res.status(422).json({
        error:
          'Model nije uspio pročitati tekst sa slike. Pokušajte s jasnijom ili osvjetljenijom fotografijom.',
      });
      return;
    }

    const aiParsed = JSON.parse(jsonText) as VisionOcrStructuredOutput;
    const mappedRecipe = mapVisionOcrResponseToRecipe(aiParsed, cleanText);

    res.json({
      source: usedModel,
      ocr: aiParsed,
      recipe: mappedRecipe,
    });

  } catch (err: any) {
    console.error('Gemini Vision OCR error:', err);
    if (isRateLimitOrQuotaError(err)) {
      res.status(429).json({
        code: 429,
        error: QUOTA_EXCEEDED_MESSAGE,
      });
      return;
    }
    res.status(422).json({
      error:
        err?.message ||
        'Obrada rukopisa pomoću Gemini 3.8 Flash modela nije uspjela. Provjerite fotografiju i pokušajte ponovno.',
    });
  }
});

interface DiscoveredImageModel {
  name: string;
  supportedGenerationMethods: string[];
}

const UNSUPPORTED_IMAGE_KEY_MESSAGE =
  'Generiranje slika trenutačno nije podržano za ovaj API ključ. Koristi se izvorni rukopis.';

/**
 * Dinamički prevodi hrvatski naziv jela, kategoriju i stvarne sastojke u fotorealističan
 * engleski opis za generiranje slike pomoću Gemini 3.8 Flash modela (bez statičkih keyword matchera).
 */
async function generateDynamicEnglishPromptWithLlm(
  ai: GoogleGenAI | null,
  title: string,
  category: CategoryId,
  ingredients: string[]
): Promise<string> {
  const fallback = buildAuthenticDishImagePrompt(title, ingredients, category).englishPrompt;
  if (!ai) return fallback;

  const categoryLabels: Record<CategoryId, string> = {
    kolaci: 'Kolači & Slatko (Sweet cake, pastry, cookies, or dessert)',
    slano: 'Slana kuhinja & Ručak (Savory dish, meal, or savory pastry)',
    mesarija: 'Mesarija & Sušiona (Cured meats and artisan sausages)',
    zimnica: 'Zimnica & Špajza (Winter preserves, jams, relishes in glass jars)',
    tradicija: 'Tradicija & Blagdani (Traditional Croatian festive holiday dish)',
  };

  const strictCategoryRule =
    category === 'kolaci'
      ? 'STRICT RULE: This dish is a SWEET DESSERT / CAKE / COOKIE ("Kolači & Slatko"). You are STRICTLY FORBIDDEN from mentioning meat, pork, sausages, bacon, garlic, or savory stews—even if dough is shaped into a log/roll!'
      : 'STRICT RULE: Describe only the finished dish based on the exact title and ingredients provided. Do not place dry baked goods into a soup bowl.';

  try {
    const resp = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Write a single concise, photorealistic English food photography prompt (25 to 45 words) for the following Croatian family recipe:
- Dish Title: "${title}"
- Category: ${categoryLabels[category] || categoryLabels.kolaci}
- Actual Ingredients: ${ingredients.slice(0, 12).join(', ') || 'traditional homemade ingredients'}

${strictCategoryRule}
Include: authentic homemade presentation on a vintage plate, wooden board, or platter, soft natural window lighting, shot on 35mm lens. Output ONLY the plain English prompt text without quotes or markdown.`,
      config: {
        temperature: 0.25,
      },
    });
    const text = resp.text?.trim().replace(/^["']|["']$/g, '');
    if (text && text.length > 15) {
      return text;
    }
  } catch (err: any) {
    console.warn('[LLM Prompt Translator] Fallback to structured builder:', err?.message || err);
  }
  return fallback;
}

async function listAvailableImageModels(apiKey: string): Promise<DiscoveredImageModel[]> {
  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listRes = await fetch(listUrl);
    if (!listRes.ok) {
      console.warn(`[ListModels] HTTP ${listRes.status} pri dohvaćanju popisa modela.`);
      return [];
    }
    const listData = await listRes.json();
    const allModels: any[] = Array.isArray(listData?.models) ? listData.models : [];

    const imageModels: DiscoveredImageModel[] = allModels
      .filter((m) => {
        const name = String(m?.name || '').toLowerCase();
        const displayName = String(m?.displayName || '').toLowerCase();
        return (
          name.includes('imagen') ||
          name.includes('image') ||
          displayName.includes('imagen') ||
          displayName.includes('image')
        );
      })
      .map((m) => ({
        name: String(m.name),
        supportedGenerationMethods: Array.isArray(m.supportedGenerationMethods)
          ? m.supportedGenerationMethods.map(String)
          : [],
      }));

    console.log(
      '[ListModels] Pronađeni image/imagen modeli za ovaj API ključ:',
      JSON.stringify(imageModels, null, 2)
    );
    return imageModels;
  } catch (err: any) {
    console.warn('[ListModels] Greška pri provjeri dostupnih modela:', err?.message || err);
    return [];
  }
}

async function tryPredictRestCall(
  modelName: string,
  prompt: string,
  apiKey: string
): Promise<string | null> {
  const normalizedModel = modelName.startsWith('models/') ? modelName : `models/${modelName}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/${normalizedModel}:predict?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: '4:3',
        outputOptions: {
          mimeType: 'image/jpeg',
        },
      },
    }),
  });

  if (res.status === 429) {
    const err: any = new Error(QUOTA_EXCEEDED_MESSAGE);
    err.status = 429;
    throw err;
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.warn(
      `[Imagen REST :predict] ${normalizedModel} nije uspio (HTTP ${res.status}): ${errText.slice(0, 200)}`
    );
    return null;
  }

  const responseData = await res.json();
  const base64Image = responseData?.predictions?.[0]?.bytesBase64Encoded;
  if (typeof base64Image === 'string' && base64Image.length > 0) {
    return `data:image/jpeg;base64,${base64Image}`;
  }
  return null;
}

async function trySdkGenerateImagesCall(
  ai: GoogleGenAI,
  modelName: string,
  prompt: string
): Promise<string | null> {
  const shortModel = modelName.replace(/^models\//, '');
  try {
    const response = await ai.models.generateImages({
      model: shortModel,
      prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '4:3',
      },
    });
    const base64Image = response?.generatedImages?.[0]?.image?.imageBytes;
    if (typeof base64Image === 'string' && base64Image.length > 0) {
      return `data:image/jpeg;base64,${base64Image}`;
    }
    return null;
  } catch (err: any) {
    if (isRateLimitOrQuotaError(err)) {
      throw err;
    }
    console.warn(
      `[SDK generateImages] ${shortModel} nije uspio: ${err?.message || String(err)}`
    );
    return null;
  }
}

async function tryGenerateContentImageCall(
  ai: GoogleGenAI,
  modelName: string,
  prompt: string
): Promise<string | null> {
  const shortModel = modelName.replace(/^models\//, '');
  try {
    const response = await ai.models.generateContent({
      model: shortModel,
      contents: {
        parts: [{ text: prompt }],
      },
    });
    for (const part of response?.candidates?.[0]?.content?.parts || []) {
      if (part?.inlineData?.data) {
        const mime = part.inlineData.mimeType || 'image/jpeg';
        return `data:${mime};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (err: any) {
    if (isRateLimitOrQuotaError(err)) {
      throw err;
    }
    console.warn(
      `[SDK generateContent image] ${shortModel} nije uspio: ${err?.message || String(err)}`
    );
    return null;
  }
}

/**
 * Dijagnostička ruta za provjeru dostupnih image/imagen modela i metoda na trenutnom API ključu
 */
app.get('/api/image-models-diagnostic', async (_req, res) => {
  const API_KEY = getUserApiKey();
  if (!API_KEY) {
    res.json({ availableImageModels: [], error: 'Nedostaje Gemini API ključ' });
    return;
  }
  const models = await listAvailableImageModels(API_KEY);
  res.json({ availableImageModels: models });
});

/**
 * Ruta za dinamičko prevođenje naziva jela, kategorije i sastojaka u fotorealističan engleski prompt pomoću LLM-a
 */
app.post('/api/translate-dish-prompt', async (req, res) => {
  try {
    const {
      title = 'Domaći recept iz Mamine Teke',
      ingredients = [],
      category = 'kolaci',
    } = req.body || {};

    const safeCategory: CategoryId = ['kolaci', 'slano', 'mesarija', 'zimnica', 'tradicija'].includes(category)
      ? category
      : 'kolaci';
    const safeIngredients = Array.isArray(ingredients) ? ingredients.map(String) : [];
    const ai = getGeminiClient();

    const englishPrompt = await generateDynamicEnglishPromptWithLlm(
      ai,
      String(title || '').trim(),
      safeCategory,
      safeIngredients
    );

    res.json({ englishPrompt });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Greška pri generiranju engleskog opisa.' });
  }
});

/**
 * KORAK B (Generiranje slike):
 * 1. Koristi ručno uređeni engleski prompt (`englishPrompt`) ako ga je korisnik upisao/izmijenio,
 *    ili poziva kratki LLM prompt (`gemini-3.8-flash`) koji prevodi stvarni naziv jela, kategoriju i sastojke
 *    u fotorealističan opis na engleskom.
 * 2. Dinamički dohvaća popis modela putem `GET .../v1beta/models?key=${API_KEY}` (ListModels)
 *    te isprobava dostupne Imagen / Gemini slikovne modele.
 */
app.post('/api/generate-recipe-image', async (req, res) => {
  try {
    const {
      title = 'Domaći recept iz Mamine Teke',
      ingredients = [],
      steps = [],
      category = 'kolaci',
      variationIndex = 0,
      englishPrompt: clientEnglishPrompt,
      forceTranslatePrompt = false,
    } = req.body || {};

    const safeCategory: CategoryId = ['kolaci', 'slano', 'mesarija', 'zimnica', 'tradicija'].includes(category)
      ? category
      : 'kolaci';

    const safeIngredients = Array.isArray(ingredients) ? ingredients.map(String) : [];
    const safeSteps = Array.isArray(steps) ? steps.map(String) : [];
    const safeVariation = Number(variationIndex) || 0;

    const API_KEY = getUserApiKey();
    const ai = getGeminiClient();

    const trimmedClientPrompt =
      typeof clientEnglishPrompt === 'string' ? clientEnglishPrompt.trim() : '';

    let baseEnglishPrompt: string;
    if (trimmedClientPrompt.length > 0 && !forceTranslatePrompt) {
      baseEnglishPrompt = trimmedClientPrompt;
    } else {
      baseEnglishPrompt = await generateDynamicEnglishPromptWithLlm(
        ai,
        String(title || '').trim(),
        safeCategory,
        safeIngredients
      );
    }

    const prompt =
      safeVariation > 0
        ? buildRegeneratedAiPrompt(
            title,
            safeIngredients,
            safeCategory,
            safeVariation,
            safeSteps,
            baseEnglishPrompt
          )
        : baseEnglishPrompt;

    if (!API_KEY || !ai) {
      res.json({
        source: 'manuscript-fallback',
        unsupported: true,
        infoMessage: UNSUPPORTED_IMAGE_KEY_MESSAGE,
        imageDataUrl: null,
        englishPrompt: baseEnglishPrompt,
        isAiGenerated: false,
      });
      return;
    }

    // 1. DINAMIČKA PROVJERA MODELA (ListModels)
    const discoveredModels = await listAvailableImageModels(API_KEY);
    const triedPredictModels = new Set<string>();
    const triedSdkModels = new Set<string>();

    // Najprije isprobaj sve dinamički pronađene modele koji podržavaju 'predict'
    for (const modelInfo of discoveredModels) {
      if (modelInfo.supportedGenerationMethods.includes('predict')) {
        triedPredictModels.add(modelInfo.name);
        const imgDataUrl = await tryPredictRestCall(modelInfo.name, prompt, API_KEY);
        if (imgDataUrl) {
          res.json({
            source: modelInfo.name,
            imageDataUrl: imgDataUrl,
            englishPrompt: prompt,
            isAiGenerated: true,
          });
          return;
        }
      }
    }

    // 2. POKUŠAJ S PROVJERENIM MODELIMA REDOM:
    // a) models/imagen-3.0-generate-002 i models/imagen-3.0-generate-001 preko :predict
    const fallbackPredictCandidates = [
      'models/imagen-3.0-generate-002',
      'models/imagen-3.0-generate-001',
    ];
    for (const candidate of fallbackPredictCandidates) {
      if (!triedPredictModels.has(candidate)) {
        triedPredictModels.add(candidate);
        const imgDataUrl = await tryPredictRestCall(candidate, prompt, API_KEY);
        if (imgDataUrl) {
          res.json({
            source: candidate,
            imageDataUrl: imgDataUrl,
            englishPrompt: prompt,
            isAiGenerated: true,
          });
          return;
        }
      }
    }

    // b) Službena metoda iz @google/genai SDK-a: ai.models.generateImages({ model: 'imagen-3.0-generate-002', prompt })
    //    + models/imagen-3.0-generate-001 + svi imagen modeli iz ListModels
    const sdkCandidates = [
      'imagen-3.0-generate-002',
      'imagen-3.0-generate-001',
      ...discoveredModels
        .filter((m) => m.name.toLowerCase().includes('imagen'))
        .map((m) => m.name.replace(/^models\//, '')),
    ];

    for (const sdkModel of sdkCandidates) {
      if (!triedSdkModels.has(sdkModel)) {
        triedSdkModels.add(sdkModel);
        const imgDataUrl = await trySdkGenerateImagesCall(ai, sdkModel, prompt);
        if (imgDataUrl) {
          res.json({
            source: `sdk:${sdkModel}`,
            imageDataUrl: imgDataUrl,
            englishPrompt: prompt,
            isAiGenerated: true,
          });
          return;
        }
      }
    }

    // c) Ako u ListModels postoji slikovni model koji podržava generateContent (npr. gemini-*-image*), isprobaj ga
    for (const modelInfo of discoveredModels) {
      if (modelInfo.supportedGenerationMethods.includes('generateContent')) {
        const imgDataUrl = await tryGenerateContentImageCall(ai, modelInfo.name, prompt);
        if (imgDataUrl) {
          res.json({
            source: modelInfo.name,
            imageDataUrl: imgDataUrl,
            englishPrompt: prompt,
            isAiGenerated: true,
          });
          return;
        }
      }
    }

    // 3. DISKRETAN PRIKAZ I BEZ RUŠENJA KORISNIČKOG ISKUSTVA:
    // Nijedan Imagen model nije dostupan za ovaj API ključ/regiju -> zadrži izvorni rukopis
    res.json({
      source: 'manuscript-fallback',
      unsupported: true,
      infoMessage: UNSUPPORTED_IMAGE_KEY_MESSAGE,
      availableImageModels: discoveredModels,
      imageDataUrl: null,
      englishPrompt: prompt,
      isAiGenerated: false,
    });
  } catch (err: any) {
    if (isRateLimitOrQuotaError(err)) {
      res.status(429).json({
        source: 'manuscript-fallback',
        code: 429,
        rateLimited: true,
        error: QUOTA_EXCEEDED_MESSAGE,
        infoMessage: QUOTA_EXCEEDED_MESSAGE,
        imageDataUrl: null,
        englishPrompt: '',
        isAiGenerated: false,
      });
      return;
    }

    console.warn('Imagen fallback na izvorni rukopis:', err?.message || err);
    res.json({
      source: 'manuscript-fallback',
      unsupported: true,
      infoMessage: UNSUPPORTED_IMAGE_KEY_MESSAGE,
      imageDataUrl: null,
      englishPrompt: '',
      isAiGenerated: false,
    });
  }
});

async function startServer() {
  const port = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Mamina Teka by Zrina server running on http://0.0.0.0:${port}`);
  });
}

startServer();
