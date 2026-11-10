import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Category } from '@/lib/api'
import { useWrite } from '@/lib/use-write'
import { Button, Label, Input } from '../ui'
import { ErrorState } from '@/components/primitives'
import { IconPicker } from './icon-picker'
import { ColorPicker } from './color-picker'

/** Classification metadata only; financial posting and category identity are untouched. */
export function CategoryAppearance({ category }: { category: Category }) {
  const { t } = useTranslation()
  const [icon, setIcon] = useState(category.icon ?? null)
  const [color, setColor] = useState(category.color ?? '#6B8E7A')
  const [name, setName] = useState(category.name)
  const write = useWrite()
  return (
    <form
      className="space-y-3 border-t pt-4"
      onSubmit={(event) => {
        event.preventDefault()
        const fullColor =
          color.length === 4
            ? '#' + [...color.slice(1)].map((part) => part + part).join('')
            : color
        write.mutate({
          path: '/categories/' + category.id,
          method: 'PUT',
          data: { name, icon, color: fullColor },
        })
      }}
    >
      <h3 className="text-sm font-medium">
        {t('spendingMigration:categoryAppearance')}
      </h3>
      <Label htmlFor={'category-name-' + category.id}>
        {t('wfCommon:name')}
      </Label>
      <Input
        id={'category-name-' + category.id}
        value={name}
        required
        onChange={(event) => setName(event.target.value)}
      />
      <div className="flex items-center gap-3">
        <IconPicker value={icon} onChange={setIcon} accent={color} />
        <ColorPicker value={color} onChange={setColor} />
        <Button disabled={write.isPending} size="sm" type="submit">
          {t('wfCommon:save')}
        </Button>
      </div>
      {write.isError && <ErrorState text={write.error.message} />}
      {write.isSuccess && (
        <p role="status" className="text-muted-foreground text-xs">
          {t('spendingMigration:saved')}
        </p>
      )}
    </form>
  )
}
