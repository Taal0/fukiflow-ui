import { create } from 'zustand'

export type ToastTone = 'info' | 'success' | 'warn' | 'danger'

export interface ToastItem {
  id: string
  message: string
  tone: ToastTone
  /** ms; default 4000 */
  duration?: number
}

interface ToastState {
  toasts: ToastItem[]
  push: (message: string, tone?: ToastTone, duration?: number) => string
  dismiss: (id: string) => void
  update: (id: string, message: string) => void
}

let seq = 0

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (message, tone = 'info', duration = 4000) => {
    const id = `t_${Date.now()}_${++seq}`
    set((s) => ({
      toasts: [...s.toasts, { id, message, tone, duration }],
    }))
    return id
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  update: (id, message) =>
    set((s) => ({
      toasts: s.toasts.map((t) => (t.id === id ? { ...t, message } : t)),
    })),
}))

export function toast(
  message: string,
  tone: ToastTone = 'info',
  duration?: number,
) {
  return useToast.getState().push(message, tone, duration)
}

export function dismissToast(id: string) {
  useToast.getState().dismiss(id)
}

export function updateToast(id: string, message: string) {
  useToast.getState().update(id, message)
}
