import Home from './_Home'

// Root route. Renders Home with no preselected conversation — the
// dynamic /c/<id>/page.tsx wrapper passes initialConvId for hydration
// when a user lands on a conv URL directly.
export default function Page() {
  return <Home />
}
