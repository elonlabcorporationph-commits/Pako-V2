<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Application structure

- Keep customer order operations in server functions, authenticate staff actions with the Cloud role check, and store original/generated photos in private object storage; this keeps private data out of public reads and client code.
- Animate the uploaded sleigh flag with SVG displacement and CSS sway, keeping its lettering unmirrored; this preserves the original artwork while simulating wind in both flight directions.
- Call Meta's Llama API only from server code reading the MODEL_API_KEY secret, behind staff auth; new server logic uses server functions, not new Edge Functions.
- Route Christmas photo edits through Meta Muse using server-only MODEL_API_KEY, retrying once on 404/5xx and then falling back to the Lovable AI Gateway; public tests make one provider attempt per call so the browser can show each stage. Map legacy template indices explicitly to provider style IDs to preserve existing orders.
- Claim paid photo batches conditionally and save all settled results once; parallel renders must not overwrite sibling result slots.
- Paid-order rendering runs inside the staff verify server call (awaited, not fire-and-forget), because workerd may cancel unawaited work after the response.
- Keep the owner-requested homepage demo public and separate from private, token-checked paid order generation; demo calls never create orders.
- Share the existing slideshow player across homepage and checkout photo tests; available results can play with music without changing paid-order requirements or adding test-attempt quotas.
- Start checkout test styles concurrently and settle each slot independently; a slow or failed provider response must not delay starting sibling styles.
- Start premium video assembly when all five order results are available, using the shared local recorder; retain a manual audio-permission fallback and a separate download tap for mobile browsers.
- Keep phone installation manifest-only with public app icons and root head metadata; no app-shell service worker unless offline use is explicitly requested, preventing stale previews and private-photo caching.
- Draw portrait photo frames on a horizontally scrolling filmstrip through the shared canvas renderer and duration constant for preview and exported video; this keeps both outputs aligned while preserving the existing music source.
- Customer payments use pay_methods/pay_orders/pay_order_events, written only by server functions (PIN-checked for staff); receipts and uploaded QR codes stay in private storage behind short signed links.
