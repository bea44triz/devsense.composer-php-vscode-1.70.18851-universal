import { BottomNav } from './BottomNav'

interface AppShellProps {
  children: React.ReactNode
  /** Pass true on screens that have their own sticky header (adds top padding) */
  hasHeader?: boolean
}

/**
 * Wraps each page with the persistent bottom navigation and correct
 * body padding so content never sits behind the nav bar.
 */
export function AppShell({ children, hasHeader = true }: AppShellProps) {
  return (
    <>
      <div className={`min-h-screen flex flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] ${hasHeader ? '' : 'pt-0'}`}>
        {children}
      </div>
      <BottomNav />
    </>
  )
}
