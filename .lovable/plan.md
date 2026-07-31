## Goal
Remove the `/presentation` page and all its code from the project.

## Current State
- `src/pages/Presentation.tsx` exists as a 532-line standalone slide deck component.
- `src/App.tsx` registers a route at `/presentation` that renders it.
- The page is not linked from the main navigation (`AppLayout`), so removal only affects direct `/presentation` traffic.

## Steps

1. **Remove the route** from `src/App.tsx`
   - Delete the `import Presentation from "./pages/Presentation";` line.
   - Delete the `<Route path="/presentation" element={<Presentation />} />` line.

2. **Delete the page file**
   - Remove `src/pages/Presentation.tsx`.

3. **Verify**
   - Run the build/typecheck to ensure no orphaned imports or references remain.
   - Confirm `/presentation` returns the 404 page.

## Out of Scope
- No navigation or landing-page changes (the page was already unlinked).
- No backend/edge-function changes.