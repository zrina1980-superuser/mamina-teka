import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { auth, deleteMyAccountAndData } from '../services/firebaseSync';

export function DeleteAccountCard() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const user = auth.currentUser;
  if (!user) return null;

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      await deleteMyAccountAndData(user);
      window.location.reload();
    } catch (e: any) {
      setBusy(false);
      setError(
        e?.code === 'auth/requires-recent-login'
          ? 'Zbog sigurnosti se odjavite, ponovno prijavite i pokušajte opet.'
          : 'Brisanje nije uspjelo. Pokušajte ponovno.'
      );
    }
  };

  return (
    <section className="rounded-3xl border border-[#DFD3C3] bg-white p-6 sm:p-8 space-y-3">
      <h2 className="font-display text-xl font-bold text-[#231F1D]">Privatnost i brisanje podataka</h2>
      <p className="text-sm text-[#5A4F47] leading-relaxed">
        Vaši recepti pohranjeni su u vašem privatnom trezoru i vidljivi su samo vama i članovima koje
        pozovete. Možete ih u svakom trenutku trajno obrisati zajedno s računom.
      </p>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-[#D5C7B4] px-4 py-2.5 text-sm font-semibold text-[#9E3B24] min-h-[44px] cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          Obriši račun i sve podatke
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[#231F1D]">Ovo se ne može poništiti.</span>
          <button
            type="button"
            disabled={busy}
            onClick={run}
            className="rounded-xl bg-[#9E3B24] px-4 py-2.5 text-sm font-semibold text-white min-h-[44px] disabled:opacity-50 cursor-pointer"
          >
            {busy ? 'Brišem…' : 'Da, obriši sve'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-xl border border-[#D5C7B4] px-4 py-2.5 text-sm font-semibold min-h-[44px] cursor-pointer"
          >
            Odustani
          </button>
        </div>
      )}
      {error && <p className="text-sm text-[#9E3B24]">{error}</p>}
    </section>
  );
}
