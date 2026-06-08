export default function HelpPage() {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-0 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 text-xs font-bold text-slate-950 shadow-lg shadow-sky-500/20">
                ?
              </span>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-400">
                Guide
              </p>
            </div>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
              What&apos;s new &amp; help guide
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Recent updates, then how to explore thermal hotspots from club flights.
            </p>
          </div>
          <a
            href="/"
            className="inline-flex shrink-0 items-center justify-center self-start rounded-full border border-slate-700 bg-slate-900/60 px-5 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-600/50 hover:bg-slate-800"
          >
            ← Back to map
          </a>
        </div>

        <div className="space-y-4">
          <section className="rounded-3xl border border-amber-500/25 bg-amber-500/5 p-5 shadow-xl backdrop-blur-sm sm:p-6">
            <h2 className="text-lg font-bold text-amber-300">What&apos;s new</h2>
            <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-300">
              <li>
                <strong className="text-slate-100">Live OGN traffic</strong> — enable{" "}
                <strong className="text-slate-100">Live OGN traffic</strong> in the map controls
                (bottom-right) to see gliders flying in your map view. Each glider appears as a
                streamlined top-down icon with its callsign (e.g. S2H, MG) floating beside it.
                Dark green = climbing, dark blue = level/cruise, dark orange = sinking. Click a
                glider for altitude, climb, speed, and last update. Live positions refresh every
                few seconds and are not saved to the Hotspots database. Data ©{" "}
                <a
                  href="https://www.glidernet.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:underline"
                >
                  Open Glider Network
                </a>
                .
              </li>
              <li>
                <strong className="text-slate-100">Header filters</strong> — Min occurs, Min fpm,
                Min ToL, and Min gain (ft) let you narrow hotspots by strength, height, and how
                repeatable they are.
              </li>
              <li>
                <strong className="text-slate-100">Thermal details</strong> — hotspot popups list
                individual thermals with start/end altitude, gain, duration in minutes, and climb
                rate.
              </li>
              <li>
                <strong className="text-slate-100">Climb calculation</strong> — average lift uses
                start altitude, end altitude, and elapsed time only.
              </li>
              <li>
                <strong className="text-slate-100">Club coverage</strong> — Fault Line Flyers and
                Chicago Glider Club WeGlide flights, with club and pilot filters.
              </li>
            </ul>
          </section>

          <section className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-xl backdrop-blur-sm sm:p-6">
            <h2 className="text-lg font-bold text-sky-300">Help guide — reading the map</h2>
            <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-300">
              <li>
                Each colored circle is a <strong className="text-slate-100">thermal hotspot</strong>{" "}
                — a place where multiple flights found lift. Bigger, brighter circles
                generally mean stronger average climb.
              </li>
              <li>
                <strong className="text-slate-100">Click a circle</strong> to open a popup with
                climb rate, top of lift, occurrence count, pilots, years, and a list of thermals
                with start/end altitude and duration in minutes.
              </li>
              <li>
                Use the map controls (bottom-right) to switch between street, satellite,
                topo, and dark basemaps; toggle historical hotspots; and turn{" "}
                <strong className="text-slate-100">Live OGN traffic</strong> on or off.
              </li>
              <li>
                Pinch or scroll to zoom. Drag to pan around the flying area.
              </li>
            </ul>
          </section>

          <section className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-xl backdrop-blur-sm sm:p-6">
            <h2 className="text-lg font-bold text-violet-300">Filtering hotspots</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Filters sit in the header bar. They combine — only hotspots matching every active
              filter stay on the map and in the list.
            </p>
            <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-300">
              <li>
                <strong className="text-slate-100">Year</strong> — limit hotspots to thermals
                recorded in one calendar year, or choose “All years”.
              </li>
              <li>
                <strong className="text-slate-100">Min occurs</strong> — minimum number of times
                pilots found lift at that spot. Default is 1 (show everything). Use 3 or 5 to
                focus on repeatable hotspots and hide one-off GPS noise.
              </li>
              <li>
                <strong className="text-slate-100">Min fpm</strong> — minimum average climb in
                feet per minute. Leave at 0 for no limit. Typical Midwest thermals might start
                around 150–250 fpm; higher values show only stronger lift.
              </li>
              <li>
                <strong className="text-slate-100">Min gain</strong> — minimum altitude gained in
                a single thermal at that hotspot (end altitude minus start, in feet). Leave at 0
                for no limit. Try 1500+ for strong climbs.
              </li>
              <li>
                <strong className="text-slate-100">Min ToL</strong> — minimum top-of-lift altitude
                in feet MSL (the highest point pilots climbed to in thermals at that hotspot).
                Leave at 0 for no limit. Useful to find high-base days or ignore low scratch lift
                near the field.
              </li>
              <li>
                <strong className="text-slate-100">Club or airport pills</strong> — tap a source
                to show only hotspots from pilots who flew under that club or airport. Tap again
                to turn it off.
              </li>
              <li>
                When a source is selected, its <strong className="text-slate-100">pilot pills</strong>{" "}
                appear below. Tap individual pilots to narrow further.
              </li>
              <li>
                Tap <strong className="text-slate-100">Clear</strong> to reset year, Min occurs,
                Min fpm, Min gain, Min ToL, source, and pilot filters.
              </li>
            </ul>
            <p className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2.5 text-xs leading-relaxed text-slate-400 sm:text-sm">
              <strong className="text-violet-200">Example:</strong> Year 2024, Min occurs 3,
              Min fpm 200, Min gain 1500, Min ToL 3500 — shows 2024 hotspots hit at least three times, averaging
              200+ fpm, with someone topping 3,500 ft MSL there.
            </p>
          </section>

          <section className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-xl backdrop-blur-sm sm:p-6">
            <h2 className="text-lg font-bold text-emerald-300">Live OGN traffic</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Hotspots can overlay real-time glider positions from the{" "}
              <strong className="text-slate-100">Open Glider Network (OGN)</strong>. This is
              separate from historical hotspot analysis — live tracks are shown only on the map
              and are not imported or stored.
            </p>
            <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-300">
              <li>
                Open map controls (bottom-right) and check{" "}
                <strong className="text-slate-100">Live OGN traffic</strong>. The status line
                shows how many gliders are in the current map view.
              </li>
              <li>
                Gliders appear as rotated sailplane icons with a{" "}
                <strong className="text-slate-100">callsign label</strong> beside them (e.g. S2H,
                MG). Anonymous aircraft show as <strong className="text-slate-100">?</strong> per
                OGN privacy rules.
              </li>
              <li>
                <strong className="text-slate-100">Color coding:</strong> dark green = climbing,
                dark blue = cruise/level, dark orange = sinking.
              </li>
              <li>
                Pan or zoom to load traffic for that area. Coverage depends on nearby OGN ground
                receivers — sparse regions may show few or no gliders.
              </li>
              <li>
                Click a glider icon for a popup with altitude, climb rate, ground speed, and last
                report time.
              </li>
            </ul>
            <p className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-xs leading-relaxed text-slate-400 sm:text-sm">
              Live data is provided under the OGN data usage policy (ODbL). Hotspots displays it
              for situational awareness only — it does not replace a certified traffic or
              collision-avoidance system.
            </p>
          </section>

          <section className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-xl backdrop-blur-sm sm:p-6">
            <h2 className="text-lg font-bold text-amber-300">List view</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Click <strong className="text-slate-100">List</strong> to open a scrollable hotspot
              list beside the map. Each row shows occurrences, pilots, climb rate, and top of lift.
              Selecting a row highlights that hotspot on the map — useful on smaller screens or
              when comparing climb rates side by side.
            </p>
          </section>

          <section className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-xl backdrop-blur-sm sm:p-6">
            <h2 className="text-lg font-bold text-emerald-300">Adding your own flights</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Use <strong className="text-slate-100">Upload IGC</strong> to add individual track
              files. The file must include standard <strong className="text-slate-100">HPLTPILOT</strong> and{" "}
              <strong className="text-slate-100">HFDTE</strong> headers — pilot name and year are
              read from the file only. Each valid upload is analyzed for thermals and merged into
              the hotspot map for that flight&apos;s year.
            </p>
          </section>

          <section className="rounded-3xl border border-slate-800/60 bg-slate-900/40 p-5 sm:p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Tips
            </h2>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-400">
              <li>Hotspot colors vary by pilot — similar hues often mean the same pilot dominated that lift.</li>
              <li>Year, Min occurs, Min fpm, Min gain, Min ToL, source, and pilot filters all apply together.</li>
              <li>The hotspot count in the header updates as you filter.</li>
              <li>On mobile, tap Filters in the header to expand the filter bar.</li>
              <li>
                Live OGN traffic and historical hotspots can be shown together or independently
                using the checkboxes in map controls.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
