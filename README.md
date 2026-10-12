# kmoji.world studio

Free-form emoji drawing with Apple emoji artwork, color matching, spacing, layers, photo backdrops, zoom and pan, editable project downloads, and browser autosaving.

## Develop

Use Node 24. Run npm ci, then npm run dev. Run npm test and npm run build to validate.

## Hosting

In Settings → Pages, select GitHub Actions as the publishing source and set the custom domain to kmoji.world. Pushes to main deploy automatically. Configure domain DNS according to GitHub Pages documentation, then enable HTTPS.

## Student work

Autosaves remain on the same browser and domain. Use Save / Open → Download project to transfer work between computers or preserve it independently. Existing drafts on the prior chatgpt.site domain do not automatically transfer. Open their downloaded projects on this site.

## Attribution

Apple emoji artwork and upstream metadata credits are in public/emoji/ATTRIBUTION.txt and LICENSE.txt. UI CSS license is in vendor/.
