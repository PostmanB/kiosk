import { useMemo } from "react";

const ColorPalette = () => {
  const palette = useMemo(
    () =>
      [
        {
          title: "Márka - Rózsa",
          description: "Jellegzetes márka-akcentus CTA-khoz és kiemelésekhez.",
          items: [
            {
              label: "Brand",
              token: "--color-brand",
              tailwind: "text-brand / bg-brand",
              lightHex: "#d32752",
              darkHex: "#e6345a",
            },
          ],
        },
        {
          title: "Alap - Felület",
          description:
            "Alap felületi árnyalat kártyákhoz, mezőkhöz és hátterekhez.",
          items: [
            {
              label: "Primary",
              token: "--color-primary",
              tailwind: "text-primary / bg-primary",
              lightHex: "#f8fafc",
              darkHex: "#0f172a",
            },
          ],
        },
        {
          title: "Akcentus 1 - Leglágyabb semleges",
          description:
            "A legvilágosabb kiegészítő semleges; sötét módban a legsötétebb alap.",
          items: [
            {
              label: "Accent 1",
              token: "--color-accent-1",
              tailwind: "text-accent-1 / bg-accent-1",
              lightHex: "#f1f5f9",
              darkHex: "#111827",
            },
          ],
        },
        {
          title: "Akcentus 2 - Lágy semleges",
          description:
            "Másodlagos felületi árnyalat kártyákhoz és finom elválasztókhoz.",
          items: [
            {
              label: "Accent 2",
              token: "--color-accent-2",
              tailwind: "text-accent-2 / bg-accent-2",
              lightHex: "#e2e8f0",
              darkHex: "#1e293b",
            },
          ],
        },
        {
          title: "Akcentus 3 - Közepes semleges",
          description:
            "Középtónusú semleges, amely jól működik szegélyekhez és tompított hátterekhez.",
          items: [
            {
              label: "Accent 3",
              token: "--color-accent-3",
              tailwind: "text-accent-3 / bg-accent-3",
              lightHex: "#cbd5e1",
              darkHex: "#334155",
            },
          ],
        },
        {
          title: "Akcentus 4 - Mély semleges",
          description:
            "A legnagyobb kontrasztú semleges, ideális tipográfiához és ikonokhoz.",
          items: [
            {
              label: "Accent 4",
              token: "--color-accent-4",
              tailwind: "text-accent-4 / bg-accent-4",
              lightHex: "#94a3b8",
              darkHex: "#475569",
            },
          ],
        },
        {
          title: "Kontraszt - Szöveg",
          description:
            "Külön kontraszt token törzsszöveghez és alapvető ikonokhoz.",
          items: [
            {
              label: "Contrast",
              token: "--color-contrast",
              tailwind: "text-contrast / bg-contrast",
              lightHex: "#334155",
              darkHex: "#f8fafc",
            },
          ],
        },
      ] as const,
    []
  );

  const ColorSwatch = ({
    label,
    token,
    tailwind,
    lightHex,
    darkHex,
  }: {
    label: string;
    token: string;
    tailwind: string;
    lightHex: string;
    darkHex: string;
  }) => (
    <div className="flex flex-col gap-2 rounded-lg border border-accent-3/60 bg-primary/80 p-3 shadow-sm shadow-accent-4/20 transition-colors">
      <div
        className="h-16 w-full rounded-md border border-accent-4/60 shadow-inner shadow-accent-4/30"
        style={{ backgroundColor: `rgb(var(${token}))` }}
      />
      <div className="flex flex-col text-xs leading-tight text-contrast/75">
        <span className="font-semibold uppercase tracking-wide text-contrast">
          {label}
        </span>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <code className="font-mono text-[0.7rem] text-contrast/70">
            {token}
          </code>
          <span className="font-mono text-[0.7rem] text-contrast/60">
            Világos {lightHex}
          </span>
          <span className="font-mono text-[0.7rem] text-contrast/60">
            Sötét {darkHex}
          </span>
        </div>
        <span className="text-[0.65rem] uppercase tracking-wide text-contrast/60">
          Tailwind: {tailwind}
        </span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="color-palette-heading"
        className="rounded-2xl border border-accent-3/60 bg-accent-1/80 p-6 shadow-md shadow-accent-4/20 backdrop-blur-sm"
      >
        <div className="flex flex-col gap-2 pb-4">
          <h2
            id="color-palette-heading"
            className="text-lg font-semibold text-contrast"
          >
            Színpaletta
          </h2>
          <p className="text-sm text-contrast/80">
            Ezek a márka- és semleges tokenek a <code>src/style.css</code>{" "}
            fájlban élnek, és a <code>tailwind.config.ts</code> fájlon keresztül
            térképeződnek be a Tailwindbe. Használj olyan utilityket, mint a{" "}
            <code>text-brand</code>, <code>bg-primary</code> és{" "}
            <code>border-accent-3/60</code>; ezek automatikusan alkalmazkodnak a
            sötét módhoz.
          </p>
        </div>

        <div className="space-y-8">
          {palette.map((group) => (
            <div key={group.title} className="space-y-3">
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-semibold text-contrast">
                  {group.title}
                </h3>
                <p className="text-sm text-contrast/75">
                  {group.description}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => (
                  <ColorSwatch
                    key={item.token}
                    label={item.label}
                    token={item.token}
                    tailwind={item.tailwind}
                    lightHex={item.lightHex}
                    darkHex={item.darkHex}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default ColorPalette;
