import { useEffect, useMemo, useState } from "react";
import { readEnv } from "../../lib/runtimeEnv";

type PinGateProps = {
  children: React.ReactNode;
};

export const PIN_UNLOCK_KEY = "kiosk_pin_unlocked_until";
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

const getStoredUnlockUntil = () => {
  if (typeof window === "undefined") {
    return 0;
  }

  const raw = localStorage.getItem(PIN_UNLOCK_KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? value : 0;
};

const normalizePin = (value: string) => value.replace(/\D/g, "").slice(0, 8);

const PinGate = ({ children }: PinGateProps) => {
  const configuredPin = useMemo(() => {
    const raw = readEnv("VITE_KIOSK_PIN");
    return raw?.trim() ?? "";
  }, []);

  if (!configuredPin) {
    throw new Error("Hiányzik a VITE_KIOSK_PIN. Adj meg egy 8 jegyű PIN-t.");
  }

  if (configuredPin.length !== 8 || /\D/.test(configuredPin)) {
    throw new Error("A VITE_KIOSK_PIN pontosan 8 jegyű kell legyen.");
  }

  const [unlocked, setUnlocked] = useState(() => {
    const unlockUntil = getStoredUnlockUntil();
    if (unlockUntil > Date.now()) {
      return true;
    }

    if (unlockUntil) {
      localStorage.removeItem(PIN_UNLOCK_KEY);
    }

    return false;
  });
  const [pinInput, setPinInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const lock = (reason?: string) => {
    localStorage.removeItem(PIN_UNLOCK_KEY);
    setUnlocked(false);
    setPinInput("");
    setError(reason ?? null);
  };

  useEffect(() => {
    if (!unlocked) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const resetTimer = () => {
      const unlockUntil = Date.now() + INACTIVITY_TIMEOUT_MS;
      localStorage.setItem(PIN_UNLOCK_KEY, String(unlockUntil));
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        lock("A munkamenet lejárt. Add meg újra a PIN-t.");
      }, INACTIVITY_TIMEOUT_MS);
    };

    resetTimer();

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((event) => window.addEventListener(event, resetTimer));

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetTimer));
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [unlocked]);

  const handleDigit = (digit: string) => {
    setError(null);
    setPinInput((current) => normalizePin(current + digit));
  };

  const handleBackspace = () => {
    setError(null);
    setPinInput((current) => current.slice(0, -1));
  };

  const handleClear = () => {
    setError(null);
    setPinInput("");
  };

  const handleVerify = () => {
    if (pinInput.length !== 8) {
      setError("Add meg a teljes 8 jegyű PIN-t.");
      return;
    }

    if (pinInput === configuredPin) {
      const unlockUntil = Date.now() + INACTIVITY_TIMEOUT_MS;
      localStorage.setItem(PIN_UNLOCK_KEY, String(unlockUntil));
      setUnlocked(true);
      setPinInput("");
      setError(null);
      return;
    }

    setError("Hibás PIN. Próbáld újra.");
    setPinInput("");
  };

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-primary text-contrast">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-12">
        <div className="rounded-3xl border border-accent-3/60 bg-accent-1/80 p-6 shadow-lg shadow-accent-4/20">
          <div className="space-y-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">
              Kioszk zárolva
            </p>
            <h1 className="text-2xl font-semibold text-contrast">PIN megadása</h1>
            <p className="text-sm text-contrast/70">
              8 jegyű hozzáférési kód szükséges.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <input
              className="w-full rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-3 text-center text-xl font-semibold tracking-[0.45em] text-contrast outline-none transition focus:border-brand/60"
              inputMode="numeric"
              pattern="\\d*"
              type="password"
              value={pinInput}
              onChange={(event) =>
                setPinInput(normalizePin(event.target.value))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleVerify();
                }
              }}
            />

            {error ? (
              <p className="text-center text-xs text-rose-400">{error}</p>
            ) : null}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <button
                key={digit}
                type="button"
                className="rounded-2xl border border-accent-3/60 bg-primary/70 py-4 text-lg font-semibold text-contrast transition hover:border-brand/40 hover:text-brand"
                onClick={() => handleDigit(digit)}
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              className="rounded-2xl border border-accent-3/60 bg-accent-2/70 py-4 text-sm font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/40 hover:text-brand"
              onClick={handleClear}
            >
              Törlés
            </button>
            <button
              type="button"
              className="rounded-2xl border border-accent-3/60 bg-primary/70 py-4 text-lg font-semibold text-contrast transition hover:border-brand/40 hover:text-brand"
              onClick={() => handleDigit("0")}
            >
              0
            </button>
            <button
              type="button"
              className="rounded-2xl border border-accent-3/60 bg-accent-2/70 py-4 text-sm font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/40 hover:text-brand"
              onClick={handleBackspace}
            >
              Vissza
            </button>
          </div>

          <button
            type="button"
            className="mt-5 w-full rounded-full bg-brand px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-md shadow-brand/40 transition hover:-translate-y-0.5 hover:shadow-lg"
            onClick={handleVerify}
          >
            Feloldás
          </button>
        </div>
      </div>
    </div>
  );
};

export default PinGate;



