import type { ReactNode } from 'react'

export function WorkspaceShell({
  toolbar,
  banner,
  gallery,
  rail,
  canvas,
  panel,
  status,
  tip,
}: {
  toolbar: ReactNode
  banner?: ReactNode
  tip?: ReactNode
  gallery: ReactNode
  rail: ReactNode
  canvas: ReactNode
  panel: ReactNode
  status: ReactNode
}) {
  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      {toolbar}
      {tip}
      {banner}
      <div className="flex min-h-0 flex-1">
        {gallery}
        {rail}
        <div className="relative flex min-w-0 flex-1 flex-col">{canvas}</div>
        {panel}
      </div>
      {status}
    </div>
  )
}
