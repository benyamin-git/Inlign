export type ButtonVariant = 'filled' | 'tonal' | 'text'

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  filled: 'bg-primary text-on-primary hover:bg-primary/90 active:bg-primary/80',
  tonal:
    'bg-secondary-container text-on-secondary-container hover:bg-secondary-container/90 active:bg-secondary-container/80',
  text: 'text-primary hover:bg-primary/10 active:bg-primary/15',
}
