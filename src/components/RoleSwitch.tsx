import { useNavigate } from 'react-router-dom'
import { Segmented } from '@/components/ui/segmented'
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip'
import {
  type WorkspaceRole,
  useSession,
} from '@/store/session'

const ROLE_OPTIONS: { value: WorkspaceRole; label: string }[] = [
  { value: 'translator', label: 'Çevirmen' },
  { value: 'letterer', label: 'Letterer' },
]

interface RoleSwitchProps {
  value: WorkspaceRole
  /** When set, switching navigates to the matching workspace for this chapter. */
  chapterSlug?: string | null
  size?: 'sm' | 'md'
  className?: string
}

export function RoleSwitch({
  value,
  chapterSlug,
  size = 'sm',
  className,
}: RoleSwitchProps) {
  const navigate = useNavigate()
  const setWorkspaceRole = useSession((s) => s.setWorkspaceRole)

  return (
    <TooltipProvider delayDuration={350}>
      <Tooltip
        side="bottom"
        label="Çevirmen: metni yazar, sırayı düzeltir, kaçırılanı işaretler. Letterer: dizgiyi, fontu ve temizliği düzeltir."
      >
        <span className={className}>
          <Segmented
            ariaLabel="Rol"
            value={value}
            size={size}
            onChange={(role) => {
              setWorkspaceRole(role)
              if (!chapterSlug) return
              navigate(
                role === 'translator'
                  ? `/translate/${chapterSlug}`
                  : `/edit/${chapterSlug}`,
              )
            }}
            options={ROLE_OPTIONS}
          />
        </span>
      </Tooltip>
    </TooltipProvider>
  )
}
