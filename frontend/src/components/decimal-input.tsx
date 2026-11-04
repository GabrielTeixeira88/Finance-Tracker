import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
} from 'react'
import { t } from '@/lib/i18n'
import { localizeDecimal, parseLocalizedDecimal } from '@/lib/localized-number'
import { usePreferences } from '@/lib/preferences'

/** Visible locale text and canonical exact value are deliberately separate. */
export function DecimalInput({
  value,
  defaultValue,
  onChange,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const { language } = usePreferences()
  const input = useRef<HTMLInputElement>(null)
  const initial = String(value ?? defaultValue ?? '')
  const [editing, setEditing] = useState({
    canonical: initial,
    text: localizeDecimal(initial),
    locale: language,
  })
  const canonical = value === undefined ? editing.canonical : String(value)
  const text =
    canonical === editing.canonical && editing.locale === language
      ? editing.text
      : localizeDecimal(canonical)
  useEffect(() => {
    const form = input.current?.form
    const reset = () => {
      if (value === undefined) {
        const canonical = String(defaultValue ?? '')
        setEditing({
          canonical,
          text: localizeDecimal(canonical, language),
          locale: language,
        })
        input.current?.setCustomValidity('')
      }
    }
    form?.addEventListener('reset', reset)
    return () => form?.removeEventListener('reset', reset)
  }, [value, defaultValue, language])
  return (
    <input
      {...props}
      ref={input}
      inputMode="decimal"
      value={text}
      data-exact-decimal={canonical}
      onChange={(event) => {
        const raw = event.target.value
        let next: string
        try {
          next = raw.trim() ? parseLocalizedDecimal(raw) : ''
          event.target.setCustomValidity('')
        } catch {
          next = `INVALID:${raw}`
          event.target.setCustomValidity(t('labels:invalid_localized_number'))
        }
        setEditing({ canonical: next, text: raw, locale: language })
        if (onChange) {
          const target = Object.create(event.target) as HTMLInputElement
          Object.defineProperty(target, 'value', { value: next })
          onChange({
            ...event,
            target,
            currentTarget: target,
          } as ChangeEvent<HTMLInputElement>)
        }
      }}
    />
  )
}
