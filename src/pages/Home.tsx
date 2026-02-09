import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const supabaseTable = "kiosk_samples";

const bulletPoints = [
  {
    title: "Kezdd tisztán",
    description:
      "Cseréld be a márkaeszközöket, állítsd be az útvonalakat, és kösd be a közös providereket percek alatt.",
  },
  {
    title: "Dizájnrendszerre kész",
    description:
      "Használd a színtokeneket tipográfián, felületeken és szegélyeken az azonnali vizuális egységhez.",
  },
  {
    title: "Építs valódi funkciókat",
    description:
      "Adj hozzá adatlekérést, hitelesítést és domain logikát anélkül, hogy a toolokkal küzdenél.",
  },
];

const Home = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const handleSupabaseInsert = async () => {
    setIsSubmitting(true);
    setStatusMessage(null);

    const payload = {
      label: `Sample ${Math.floor(Math.random() * 10_000)}`,
      note: `Inserted at ${new Date().toISOString()}`,
    };

    const { data, error } = await supabase
      .from(supabaseTable)
      .insert(payload)
      .select("id,label,created_at")
      .single();

    if (error) {
      const tableMissing =
        error.message.toLowerCase().includes("does not exist") ||
        error.message.toLowerCase().includes("relation");
      const message = tableMissing
        ? `A(z) "${supabaseTable}" tábla nem található. Előbb hozd létre a Supabase-ben.`
        : error.message;

      setStatusMessage({ type: "error", text: message });
      setIsSubmitting(false);
      return;
    }

    setStatusMessage({
      type: "success",
      text: `Sor beszúrva: ${data.id} (${data.label}).`,
    });
    setIsSubmitting(false);
  };

  return (
    <section className="space-y-12">
      <header className="relative overflow-hidden rounded-3xl border border-accent-3/60 bg-accent-1/80 p-8 shadow-lg shadow-accent-4/20 transition-colors">
        <div className="relative z-10 space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand/15 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-brand">
            Gyors kezdéshez készítve
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-contrast sm:text-5xl sm:leading-tight">
            Indítsd a következő React-élményt egy palettával, amely minden állapothoz alkalmazkodik.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-contrast/80 sm:text-lg">
            Ez a starter kit a Vite-ot, a React Routert és a Tailwindet egy dinamikus színrendszerrel
            párosítja. Illeszd be a komponenseket egységes vizuális nyelvbe, és maradj szinkronban
            világos és sötét módban is.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/palette"
              className="inline-flex items-center justify-center rounded-full bg-brand px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-md shadow-brand/40 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              Színtokenek felfedezése
            </Link>
            <Link
              to="/features"
              className="inline-flex items-center justify-center rounded-full border border-brand/40 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-brand transition hover:bg-brand/10"
            >
              Funkciópéldák megtekintése
            </Link>
          </div>
          <button
            type="button"
            className="w-full rounded-3xl border border-brand/40 bg-brand/15 px-8 py-6 text-2xl font-extrabold uppercase tracking-[0.4em] text-brand shadow-lg shadow-brand/30 transition hover:-translate-y-1 hover:bg-brand/20 hover:shadow-xl sm:w-auto"
          >
            TESZT
          </button>
        </div>
        <div className="pointer-events-none absolute right-[-120px] top-[-120px] h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-160px] left-[-80px] h-72 w-72 rounded-full bg-brand/5 blur-3xl" />
      </header>

      <section className="grid gap-5 md:grid-cols-3">
        {bulletPoints.map((point) => (
          <article
            key={point.title}
            className="flex h-full flex-col gap-4 rounded-2xl border border-accent-3/60 bg-accent-2/70 p-6 shadow-sm shadow-accent-4/30 transition hover:border-brand/50 hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-contrast">{point.title}</h2>
            <p className="text-sm leading-relaxed text-contrast/80">{point.description}</p>
          </article>
        ))}
      </section>

      <section className="grid items-center gap-8 rounded-3xl border border-accent-3/60 bg-accent-1/80 p-8 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <h3 className="text-2xl font-semibold text-contrast">
            Harmónia komponensek, állapotok és témák között
          </h3>
          <p className="text-sm text-contrast/80">
            A szemantikus tokeneket, például a{" "}
            <code className="font-mono text-xs">--color-brand</code> és{" "}
            <code className="font-mono text-xs">--color-primary</code> értékeket közvetlenül a
            Tailwind utilitykhez kötjük. Használd például a{" "}
            <code className="font-mono text-xs">bg-accent-2</code>-t kártyákon vagy a{" "}
            <code className="font-mono text-xs">text-contrast</code>-ot szöveghez, és minden módban
            megmarad az olvashatóság.
          </p>
        </div>
        <div className="rounded-2xl border border-accent-3/60 bg-primary/70 p-6 text-sm text-contrast/80 shadow-inner shadow-accent-4/30">
          <h4 className="text-base font-semibold text-contrast">Gyors tipp</h4>
          <p className="mt-2">
            Kombináld a paletta utilityket áttetszőségi módosítókkal rétegekhez:{" "}
            <code className="font-mono text-xs">bg-brand/10</code>,{" "}
            <code className="font-mono text-xs">border-accent-4/60</code> és{" "}
            <code className="font-mono text-xs">text-contrast/70</code> extra hex kódok nélkül is
            mélységet adnak.
          </p>
        </div>
      </section>

      <section className="grid gap-6 rounded-3xl border border-accent-3/60 bg-accent-2/70 p-8 md:grid-cols-[1.3fr_1fr]">
        <div className="space-y-3">
          <h3 className="text-2xl font-semibold text-contrast">Supabase gyors teszt</h3>
          <p className="text-sm text-contrast/80">
            Érintsd meg a gombot, hogy beszúrj egy véletlen sort a{" "}
            <code className="font-mono text-xs">{supabaseTable}</code> táblába. Győződj meg róla, hogy a
            tábla létezik, és engedélyezi a beszúrást az anon kulcsnak.
          </p>
          {statusMessage ? (
            <p
              className={`text-sm ${
                statusMessage.type === "success" ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {statusMessage.text}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col justify-center gap-3 rounded-2xl border border-accent-3/60 bg-primary/70 p-6">
          <button
            type="button"
            onClick={handleSupabaseInsert}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-full bg-brand px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-md shadow-brand/40 transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Minta hozzáadása..." : "Véletlen sor hozzáadása"}
          </button>
          <p className="text-xs text-contrast/70">
            Ha táblahibát látsz, hozd létre a táblát a Supabase-ben, és próbáld újra.
          </p>
        </div>
      </section>
    </section>
  );
};

export default Home;
