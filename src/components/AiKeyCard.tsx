import { useState } from 'react';
import { KeyRound, Info, Check, Trash2 } from 'lucide-react';
import { getUserGeminiKey, saveUserGeminiKey } from '../utils/userAiKey';

export function AiKeyCard() {
  const [value, setValue] = useState(getUserGeminiKey());
  const [saved, setSaved] = useState(Boolean(getUserGeminiKey()));
  const [showHelp, setShowHelp] = useState(false);

  const save = () => {
    saveUserGeminiKey(value);
    setSaved(Boolean(value.trim()));
  };

  const remove = () => {
    saveUserGeminiKey('');
    setValue('');
    setSaved(false);
  };

  return (
    <section className="rounded-3xl border border-[#DFD3C3] bg-white p-6 sm:p-8 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold text-[#655A52]">Pametno skeniranje recepata</span>
          <h2 className="font-display text-2xl font-bold text-[#231F1D] mt-1 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#9E3B24]" />
            Vaš Gemini API ključ
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          aria-expanded={showHelp}
          aria-label="Kako doći do API ključa"
          className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full border border-[#D5C7B4] bg-[#FAF6F0] text-[#9E3B24] hover:bg-[#EFE6D8] cursor-pointer"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>

      <p className="text-sm text-[#5A4F47] leading-relaxed">
        Za prepoznavanje rukopisa i izradu slika jela aplikacija koristi Googleov Gemini. Ključ je
        besplatan i ostaje samo na ovom uređaju. Ne spremamo ga na poslužitelj.
      </p>

      {showHelp && (
        <ol className="text-sm text-[#3A3330] bg-[#FAF7F2] border border-[#E2D6C3] rounded-2xl p-4 space-y-1.5 list-decimal list-inside">
          <li>
            Otvorite{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#9E3B24] underline"
            >
              aistudio.google.com/apikey
            </a>{' '}
            i prijavite se Google računom.
          </li>
          <li>Kliknite „Create API key”.</li>
          <li>Kopirajte ključ (počinje s „AIza…”).</li>
          <li>Zalijepite ga ovdje i pritisnite „Spremi”.</li>
          <li>Besplatna razina ima dnevno ograničenje. Ako se potroši, pričekajte sutra.</li>
        </ol>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          placeholder="AIza…"
          className="flex-1 rounded-xl border border-[#D5C7B4] bg-white px-4 py-2.5 text-sm min-h-[44px]"
        />
        <button
          type="button"
          onClick={save}
          disabled={!value.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#231F1D] px-4 py-2.5 text-sm font-semibold text-[#FAF6F0] hover:bg-[#3A3330] disabled:opacity-40 min-h-[44px] cursor-pointer"
        >
          {saved ? <Check className="w-4 h-4" /> : null}
          {saved ? 'Spremljeno' : 'Spremi'}
        </button>
        {saved && (
          <button
            type="button"
            onClick={remove}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5C7B4] px-4 py-2.5 text-sm font-semibold text-[#9E3B24] min-h-[44px] cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Ukloni
          </button>
        )}
      </div>
    </section>
  );
}
