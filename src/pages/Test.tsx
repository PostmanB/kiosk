const summaryBlocks = [
  {
    title: "Dokumentáció helyőrző",
    description:
      "Linkeld ide a dizájnrendszeredet és az API dokumentációt. Tartsd egységesen az elrendezést és a palettát akcentus felületekkel.",
  },
  {
    title: "Komponens-könyvtár",
    description:
      "Mutasd be az újrahasznosítható elemeket olyan kártyákkal, amelyek öröklik a paletta tokeneket. Kombináld a text-contrastot a bg-accent-* rétegekkel a mélységhez.",
  },
  {
    title: "Támogatás",
    description:
      "Cseréld le ezt a tartalmat GYIK-ra vagy elérhetőségekre. A paletta gondoskodik arról, hogy a címsorok, szövegek és gombok olvashatóak maradjanak.",
  },
];

const Test = () => {
  return (
    <section className="space-y-10">
      <header className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-contrast sm:text-4xl">
          Helyőrző útvonal, csiszolt megjelenés.
        </h1>
        <p className="max-w-2xl text-base text-contrast/80">
          Ez az oldal készen áll funkciók, árazás, dokumentáció vagy bármi következő befogadására. Amikor
          kibővíted, támaszkodj a paletta utilitykre, hogy a tipográfia, felületek és kiemelések mindkét
          témában tudatosan összeálljanak.
        </p>
      </header>

      <div className="rounded-3xl border border-brand/40 bg-brand/15 p-6 text-sm text-contrast shadow-inner shadow-brand/30">
        <p>
          Tipp: párosítsd a <code className="font-mono text-xs">bg-brand/15</code> réteget a{" "}
          <code className="font-mono text-xs">border-brand/40</code> szegéllyel, hogy kiemeld a tartalmat
          anélkül, hogy túlterhelnéd az elrendezést. A gombok maradhatnak erősek a{" "}
          <code className="font-mono text-xs">bg-brand</code> használatával, a semleges törzsszöveg pedig
          alapértelmezetten legyen <code className="font-mono text-xs">text-contrast</code>.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {summaryBlocks.map((block) => (
          <article
            key={block.title}
            className="flex h-full flex-col gap-3 rounded-2xl border border-accent-3/50 bg-accent-2/70 p-6 shadow-sm shadow-accent-4/30"
          >
            <h2 className="text-lg font-semibold text-contrast">{block.title}</h2>
            <p className="text-sm text-contrast/80">{block.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default Test;
