import { t as tr, ui } from '@/lib/i18n'
import { Monitor, Moon, Sun } from 'lucide-react'
import {
  fonts,
  palettes,
  themes,
  themeNames,
  chartPalettes,
  financialColors,
  resetAppearance,
  setPreferences,
  usePreferences,
  type Language,
} from '@/lib/preferences'
import { PageHeader, SectionHeader } from '@/components/primitives'
import { Button } from '@/components/ui/button'

export default function Appearance() {
  const preference = usePreferences()
  return (
    <div className="appearance-settings">
      <PageHeader
        title={tr('appearance:appearance_language_82890c')}
        description={tr(
          'appearance:make_this_workspace_comfortable_to_read_changes__327d41',
        )}
      >
        <Button variant="outline" onClick={resetAppearance}>
          {tr('appearance:reset_appearance_f5546d')}
        </Button>
      </PageHeader>
      <section>
        <SectionHeader title={tr('appearance:appearance_mode_411365')} />
        <div className="preference-grid">
          {(
            [
              ['dark', 'Dark', Moon],
              ['light', 'Light', Sun],
              ['system', 'System', Monitor],
            ] as const
          ).map(([mode, name, Icon]) => (
            <button
              key={mode}
              className="preference-choice"
              aria-pressed={preference.mode === mode}
              onClick={() => setPreferences({ mode })}
            >
              <Icon size={24} />
              {ui(name)}
            </button>
          ))}
        </div>
      </section>
      <section>
        <SectionHeader title={tr('appearance:color_theme')} />
        <div className="theme-grid">
          {themes.map((palette) => (
            <button
              className="theme-choice"
              key={palette}
              aria-pressed={preference.palette === palette}
              onClick={() => setPreferences({ palette })}
            >
              <span
                className="theme-preview"
                data-palette={palette}
                data-theme={document.documentElement.dataset.theme}
                data-chart-palette={preference.chartPalette}
                aria-hidden="true"
              >
                <aside>
                  <i />
                  <i />
                  <i />
                </aside>
                <main>
                  <small>{tr('appearance:preview_balance')}</small>
                  <b>R$ 12,345.67</b>
                  <svg viewBox="0 0 200 36" preserveAspectRatio="none">
                    <path
                      d="M0 30 L25 24 L45 28 L70 18 L90 21 L120 9 L145 14 L175 5 L200 8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                  <span className="chart-swatches">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <i key={i} style={{ background: `var(--chart-${i})` }} />
                    ))}
                  </span>
                </main>
              </span>
              <strong>{themeNames[palette]}</strong>
            </button>
          ))}
        </div>
        {!themes.includes(preference.palette as (typeof themes)[number]) && (
          <p className="metadata">
            {tr('appearance:legacy_theme')} {preference.palette}
          </p>
        )}
        <details className="financial-disclosure">
          <summary>{tr('appearance:legacy_palettes')}</summary>
          <div className="preference-grid">
            {palettes
              .filter((p) => !themes.includes(p as (typeof themes)[number]))
              .map((palette) => (
                <button
                  className="preference-choice"
                  key={palette}
                  aria-pressed={preference.palette === palette}
                  onClick={() => setPreferences({ palette })}
                >
                  {ui(palette)}
                </button>
              ))}
          </div>
        </details>
      </section>
      <section>
        <SectionHeader title={tr('appearance:charts')} />
        <div className="preference-grid">
          {chartPalettes.map((chartPalette) => (
            <button
              className="preference-choice"
              key={chartPalette}
              aria-pressed={preference.chartPalette === chartPalette}
              onClick={() => setPreferences({ chartPalette })}
            >
              <span
                className="chart-swatches"
                data-chart-palette={chartPalette}
                data-theme={document.documentElement.dataset.theme}
              >
                {[1, 2, 3, 4, 5].map((i) => (
                  <i key={i} style={{ background: `var(--chart-${i})` }} />
                ))}
              </span>
              {tr(`appearance:chart_${chartPalette}`)}
            </button>
          ))}
        </div>
      </section>
      <section>
        <SectionHeader
          title={tr('appearance:financial_colors')}
          detail={tr('appearance:financial_colors_help')}
        />
        <div className="preference-grid">
          {financialColors.map((financialColors) => (
            <button
              className="preference-choice"
              key={financialColors}
              aria-pressed={preference.financialColors === financialColors}
              onClick={() => setPreferences({ financialColors })}
            >
              {tr(`appearance:financial_${financialColors}`)}
            </button>
          ))}
        </div>
      </section>
      <section>
        <SectionHeader
          title={tr('appearance:font_family_54a184')}
          detail={tr(
            'appearance:all_fonts_are_bundled_locally_no_external_font_r_c5c2d7',
          )}
        />
        <div className="preference-grid">
          {Object.entries(fonts).map(([font, name]) => (
            <button
              className="preference-choice"
              key={font}
              aria-pressed={preference.font === font}
              onClick={() =>
                setPreferences({ font: font as keyof typeof fonts })
              }
              style={{
                fontFamily: `"${name}", ${['merriweather', 'serif'].includes(font) ? 'serif' : font === 'mono' ? 'monospace' : 'sans-serif'}`,
              }}
            >
              <span className="font-preview">
                {tr('appearance:aa_0123_577a5c')}
              </span>
              <span>
                {font === 'serif' ? tr('appearance:serif_label') : name}
              </span>
            </button>
          ))}
        </div>
      </section>
      <section>
        <SectionHeader
          title={tr('appearance:language_region_618d2c')}
          detail={tr(
            'appearance:language_changes_display_and_input_conventions_n_c4415a',
          )}
        />
        <label className="field">
          {' '}
          {tr('appearance:interface_language_9407e9')}{' '}
          <select
            value={preference.language}
            onChange={(event) =>
              setPreferences({ language: event.target.value as Language })
            }
          >
            <option value="en">{tr('appearance:english_649df0')}</option>
            <option value="pt-BR">
              {tr('appearance:portugu_s_brasil__d53cc7')}
            </option>
            <option value="es-419">
              {tr('appearance:espa_ol_latinoam_rica__3c419e')}
            </option>
          </select>
        </label>
        <p className="metadata">
          {tr(
            'appearance:demo_preferences_are_separate_from_your_normal_w_8daf47',
          )}
        </p>
      </section>
    </div>
  )
}
