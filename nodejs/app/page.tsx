import Home from './_Home'
import { loadMagpieConfig } from '@/lib/config'

// Root route. Server-reads magpie.config.json so the in-bubble app name
// matches the rebrand on first paint (no hydration mismatch when a fork
// changes the name). force-dynamic so a config-file change picks up on
// the next request without a rebuild.
export const dynamic = 'force-dynamic'

export default function Page() {
  const { config, flags } = loadMagpieConfig()
  return (
    <Home
      appName={config.name}
      welcomeMessage={config.welcomeMessage}
      starterPrompts={config.starterPrompts}
      flags={flags}
    />
  )
}
