# Orlune Shopify theme

Orlune is an editorial jewellery storefront theme for Shopify. It is built for
quiet, image-led merchandising with responsive sections, product discovery,
cart and checkout primitives, and accessible Theme Editor controls.

## Development

Install the [Shopify CLI](https://shopify.dev/docs/storefronts/themes/tools/cli),
authenticate to the development store, and run Theme Check before uploading:

```bash
shopify theme check --path . --output json --fail-level info
```

Use a development or unpublished theme for local preview. Never use a live
theme for development or QA.

## Theme structure

- `sections/` contains page and group-level sections.
- `blocks/` contains reusable Theme Blocks and product primitives.
- `snippets/` contains shared Liquid components such as cards, media, forms,
  buttons, and navigation.
- `assets/` contains local CSS, JavaScript, icons, and licensed third-party
  assets.
- `config/` contains Theme Editor settings and color schemes.
- `templates/` contains JSON templates for the storefront routes.

## Theme Editor guidance

Sections use page-width and responsive spacing tokens shared by the theme.
Images should be selected through Shopify image pickers, with empty states
using the role-appropriate Shopify placeholder. Product and collection sections
should use the shared product card and resource pickers rather than copied
markup.

The public setup documentation is available at
<https://ricizen-documents.vercel.app/>. Before publishing a listing, verify
that the documentation URL and public support contact form in the listing are
current.

## QA checklist

1. Validate JSON templates and run Theme Check.
2. Test homepage, collection, product, cart, search, blog, article, 404,
   password, and gift-card routes on desktop and mobile.
3. Check keyboard focus, reduced motion, image alt text, color contrast, and
   no horizontal overflow at the theme's mobile, tablet, and desktop bands.
4. Run Lighthouse against a populated development store before submission.
5. Package the theme with Shopify CLI and confirm that `config/settings_data.json`
   and `config/settings_schema.json` are present in the archive.

### Shopify Theme Store testing note

The Countdown timer section has an editor-only preview state. When the
`End date and time` setting is blank, sample digits render only in the Shopify
Theme Editor or visual preview; the storefront does not show a live countdown.
For live testing, enter a real event end time in ISO 8601 format, verify that
the values decrease, and verify the completion message or hidden state after
the event ends. The preview digits are not a promotion, scarcity, or urgency
claim.

## License and assets

Every image, video, font, and third-party library included in a distributed
theme must have a documented right to use. Local third-party assets should
retain their license notices.
