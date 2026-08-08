import { useNavigate } from 'react-router-dom'
import { Segmented } from '@/components/ui/segmented'
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
    <Segmented
      ariaLabel="Rol"
      value={value}
      size={size}
      className={className}
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
  )
}
