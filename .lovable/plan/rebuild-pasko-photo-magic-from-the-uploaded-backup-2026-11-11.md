# Rebuild Pasko Photo Magic from the uploaded backup

## User-facing changes
- Replace the current simplified site with the backup's storefront, order creation, package/template selection, payment instructions/proof, order status/downloads, tracking, support/legal pages, and staff dashboard.
- Keep the uploaded prices and flow, but omit the backup's sample payment recipient numbers so no placeholder account details are shown as real.
- Recreate staff sign-in and server-checked admin access; roles remain in a separate protected table.
- Carry over the provided imagery, templates, audio, and installable-app assets where available.

## Technical implementation
- Keep this project's TanStack Start setup and pinned framework versions; adapt the archive's routes, components, and server functions instead of replacing the project scaffold.
- Use Lovable Cloud for order/payment/settings/gallery data, auth, and private customer uploads. Create the schema with explicit grants and RLS, and keep privileged access inside server functions.
- Preserve the Replicate image-generation integration and scheduled cleanup endpoint contract. Provider credentials, imported customer/account records, uploaded order data, existing external schedules, and live payment recipient details remain pending unless supplied/configured.
- Recreate source content routes with unique metadata and retain the existing publishing URL until safe verification is complete.

## Verification and handoff
- Check route rendering, end-to-end public order/payment/tracking paths, role-checked staff views, tests, and current preview diagnostics.
- Report missing exports/provider settings as concrete remaining actions; do not claim data migration, production generation, payment, or full migration is verified when blocked.
