import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ConflictDialogProps {
  open: boolean
  onTakeServer: () => void
  onKeepMine: () => void
}

export function ConflictDialog({
  open,
  onTakeServer,
  onKeepMine,
}: ConflictDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Must choose — closing without action is not allowed.
        if (!next) return
      }}
    >
      <DialogContent
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogTitle>Kayıt çakışması</DialogTitle>
        <DialogDescription>
          Sunucuda daha yeni bir kayıt var. Yerel değişiklikleriniz hâlâ
          görünüyor — bir seçim yapın.
        </DialogDescription>
        <div className="mt-4 flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className="justify-start"
            onClick={onTakeServer}
          >
            <span className="flex flex-col items-start gap-0.5 text-left">
              <span>Sunucuyu al</span>
              <span className="text-[length:var(--text-meta)] font-normal text-[var(--color-ink-muted)]">
                Yerel değişiklikler silinir; sunucudaki sürüm yüklenir
              </span>
            </span>
          </Button>
          <Button
            type="button"
            variant="default"
            className="justify-start"
            onClick={onKeepMine}
          >
            <span className="flex flex-col items-start gap-0.5 text-left">
              <span>Benimkini yaz</span>
              <span className="text-[length:var(--text-meta)] font-normal text-white/80">
                Yerel sürüm sunucuya yazılır
              </span>
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
