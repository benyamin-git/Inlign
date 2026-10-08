export type ButtonVariant = 'filled' | 'tonal' | 'text' | 'destructive'

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  filled: 'bg-primary text-on-primary hover:bg-primary/90 active:bg-primary/80',
  tonal:
    'bg-secondary-container text-on-secondary-container hover:bg-secondary-container/90 active:bg-secondary-container/80',
  text: 'text-primary hover:bg-primary/10 active:bg-primary/15',
  destructive: 'bg-loss/10 text-loss hover:bg-loss/15 active:bg-loss/20',
}
