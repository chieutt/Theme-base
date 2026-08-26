---
name: shopify-section-builder
description: Build or modify Shopify theme sections, Theme Blocks, block schemas, reusable Liquid components, and responsive section architecture. Use for any implementation or refactor involving section files, block kernels, product cards, forms, inputs, newsletters, section appearance/backgrounds, section padding, or shared responsive behavior in a Shopify theme.
---

# Shopify Section Builder

Build sections, blocks, and components from the existing theme system instead of creating isolated implementations. Preserve merchant usability, reuse established primitives, and validate the result with `section-editor-standards` before delivery.

## Required workflow

1. Read the repository `AGENTS.md` completely and obey its branch, preview, and QA rules.
2. If `.codegraph/` exists, use CodeGraph before grep or broad file reads to locate existing blocks, schemas, snippets, components, CSS, and call sites.
3. Inventory relevant implementations before editing. Search in this order:
   - matching Block Kernel;
   - reusable component or snippet;
   - compatible schema and shared styles;
   - comparable sections that can be extended.
4. Choose `Reuse -> Extend -> Create new`. Do not create a parallel implementation when an existing primitive can satisfy the requirement.
5. Implement the smallest coherent change while preserving existing merchant data and unrelated behavior.
6. Load and follow `section-editor-standards` for the final architecture and Theme Editor audit.
7. Run validation and runtime QA at the depth required by `AGENTS.md`. Report untested checks explicitly.

## Empty, carousel, and preview-state contract

Empty states are production behavior, not decorative fallbacks:

- Use `media-placeholder` / `placeholder_svg_tag` with the placeholder that
  matches the role: sequence `product-1`, `product-2`, etc. for products;
  collection placeholders for collections; use `image` only for generic media
  such as a video without a suitable Shopify illustration.
- Do not emit misleading fallback merchant copy where a Theme Block is absent.
  Render the block when configured; otherwise omit it. Use skeleton content only
  for a deliberate editor/storefront empty state.
- Give placeholder media an intentional component surface when it needs to be
  distinguishable from the selected section scheme. Do not change the styling of
  a real selected image to solve a placeholder-only problem.
- When a carousel has no merchant items, render more items than the visible
  desktop capacity (normally columns + 2). Preserve footer/pagination behavior
  for that skeleton state. When real item count is at or below the visible count,
  hide navigators and `View all` rather than presenting inert controls.
- Skeleton slides must carry every data attribute and structural class used by
  the real slide. A carousel controller must receive the same slide count and
  dimensions in empty and populated states.
- Repeated skeleton items must use the same reveal group/item contract as real
  items, with a `75ms` stagger. In Swiper, reveal an inner wrapper rather than
  the slide so animation transforms never compete with Swiper.
- Keep responsive slides-per-view consistent across Liquid, CSS, and JavaScript.
  Use a fractional mobile preview only when the component is intentionally
  carousel-based and overflows; otherwise use the configured integral column
  count.

## Shared UI contracts

- Use global `btn-*` classes and `button-arrow` / `currentColor` icons for
  shared button variants. Section CSS may place a button, but must not recreate
  its shared hover, icon, gap, underline, focus, or color behavior.
- Use the shared `carousel-navigator__arrow` component for every carousel
  previous/next control. Its size, icon scale, edge placement, disabled state,
  reveal-on-hover/focus behavior, focus ring, and hover surface belong in
  `assets/component-carousel-navigator.css`. A section may only provide its
  Swiper/data hooks and an intentional `--carousel-navigator-top` placement;
  it must not duplicate or override the component's visual or hover rules.
- Product titles inherit the theme Product cards font family. A section may
  tailor size, line-height, or layout locally, but must not substitute a
  different font-family contract.
- Reuse the common modal/drawer interaction model: backdrop, close control,
  drag handle where applicable, body scroll locking, focus handling, and mobile
  motion. A new dialog should extend this contract instead of approximating it.
- Ordinary document-flow sections use the global reveal system on a section
  wrapper/group. Carousels, slideshows, tabs, drawers, and dialogs animate from
  their own active/open lifecycle; never attach global reveal transforms to a
  Swiper-owned wrapper or slide.

## Block architecture

Treat these primitives as Block Kernels:

- Heading
- Subheading
- Text
- Button
- Image

Use `Block Kernel -> Extend -> Custom Block`.

- Reuse the existing render path, schema shape, classes, tokens, responsive behavior, and accessibility semantics for the same block type.
- Keep settings schemas consistent across all instances of a block type. Do not rename IDs, change types, alter defaults, or introduce equivalent settings in only one section without an explicit custom requirement.
- Extend a kernel only with the minimum additional settings required by the request.
- Do not duplicate a kernel as a new block merely to change placement or local styling.
- Keep shared Block Kernel CSS centralized in `base.css`. Put only genuinely section-specific layout rules in the section stylesheet.
- Preserve Theme Editor block attributes and selection behavior.

## Section and block eligibility

Treat Theme Editor placement as a product constraint, not an open-ended catalogue. A merchant must only be offered sections and blocks that the current surface can render safely and meaningfully.

### Section placement

- Every new or deliberately refactored section must declare `enabled_on` with its intended template or section-group surface. Prefer an allow-list over a broad `disabled_on` deny-list.
- Use `templates: ["index"]` for home-only editorial composition. Add another template only when the section has a verified, supported use there.
- Use `groups: ["header"]`, `groups: ["footer"]`, or `groups: ["custom.overlay"]` for group-owned sections. Do not make a footer component generally available in a page template, and do not allow page sections such as slideshows inside header/footer groups.
- Sections that source their items from a merchant resource picker (for example a Blog or Collection) do not also expose generic manually-created item blocks for the same content.
- Existing saved placement is data: inspect JSON configs before changing scope, preserve valid active instances, and migrate only with an explicit plan.

### Block allow-lists

- A section's `blocks` array is an explicit allow-list of blocks that its Liquid actually renders. Do not use `@theme` in a curated composition merely to make Add block available.
- `@theme` is permitted only in a documented generic composition surface, such as a purpose-built Group or Custom Liquid container. It is not a substitute for defining a section's item model.
- Use `@app` only in a deliberately designed extension slot. Set a limit of one when more than one app block would break the layout, animation, or accessible reading order.
- The same rule applies recursively to nested Theme Blocks. A scene, slide, or content card must declare only the kernels it supports.
- Shopify Theme Block schemas cannot declare `max_blocks` or per-child `limit`. Do not add unsupported limits to simulate cardinality. Record this as an intentional WARN and enforce the child type allow-list; plan a local-block/static migration only when its active JSON impact is approved.
- Shopify rejects a section that mixes **local section block definitions** with static Theme Blocks. This does not prohibit static Theme Blocks alongside an explicit direct Theme Block allow-list: use a direct reference such as `{ "type": "testimonial" }` for a curated dynamic item stream. A direct Theme Block reference must contain only `type`; adding local-block properties such as `name`, `settings`, or `limit` makes it a local section block and invalidates that mixed schema. Keep `@theme` only for a documented generic composition surface, never as a shortcut for curated Add block menus.

### Fixed versus repeatable blocks

- Fixed visual slots use `static: true`; they are not included in `block_order`, and they do not appear in Add block. Examples: a section's fixed label/heading/text/button slots, or Footer's newsletter and signature.
- A repeatable item is a dedicated custom block with an intentional upper cap. Give it a `limit` when a section also offers other block types; use `max_blocks` for the total cap.
- For a fixed content stack, allow at most one Label, Heading, Text, and Button (or Button group) per slot. An exception must document its semantic roles: Editorial slide has two Label slots (eyebrow and specification), so its explicit Label limit is two. Use Spacer only where the layout intentionally supports it, normally at most two or three times.
- Choose repeat limits from layout capacity, interaction, animation duration, and editor usability. Do not set a high arbitrary maximum merely because Shopify permits it. Document the reason when a section exceeds six repeated items.
- A section needing an ordered editorial grid must use a purpose-specific item block (for example `instagram-gallery-image`) plus any unique card block (for example `instagram-gallery-content` with `limit: 1`); do not let generic typography blocks enter the image-item stream.

### Eligibility audit

Before adding or refactoring a section/block, record:

1. the allowed template/group surfaces;
2. every rendered static slot and its `static` identifier;
3. each dynamic block type, its minimum expected useful count, and hard cap;
4. the exact Add block list at both section and nested-block level;
5. empty, duplicate, reorder, remove, and Theme Editor selection behavior.

After the change, inspect active template/group JSON for undeclared block types, static blocks incorrectly present in `block_order`, and allowed blocks that cannot be added in the Theme Editor. Skip dormant/hidden sections unless the task explicitly includes them.

## Theme Editor schema naming contract

Treat setting labels as part of the merchant-facing design system. The same
concept must use the same setting ID, label, group, unit, option labels, and
help text wherever its behavior is equivalent. Reuse the existing contract;
do not create a near-synonym for a setting that already exists.

- Preserve existing setting IDs in shipped sections. Normalize labels only when
  the current task touches that schema and the change is backward-compatible;
  do not bulk-rename saved merchant data without an explicit migration.
- Use a `Content` group only for settings owned by the section itself. When
  content is represented by Theme Blocks, omit section-level fallback content
  settings and configure it through the relevant block instead.
- Use these group names and ordering where applicable: `Layout`, `Appearance`,
  `Section padding`. Keep `Appearance` at section level and keep `Section
  padding` last.

### Settings schema order and merchant UX

Order a section's settings by the decisions a merchant makes, not by template
implementation order:

1. **Data source** — a product, collection, blog, or other primary resource
   picker comes first when it determines the rest of the section.
2. **Content** — only for content owned by the section. Omit this group when
   Theme Blocks own the content.
3. **Layout** — section width, visual layout, column/item count, position,
   alignment, image ratio, carousel, and responsive layout controls.
4. **Section-specific behavior** — only when needed, for controls such as a
   cart action, autoplay, or interaction that do not belong to Layout.
5. **Appearance** — always at section level. Order its settings as `Color
   scheme`, `Background color`, then any opt-in custom-background toggle,
   background image, mobile image, position, overlay, and opacity controls.
6. **Section padding** — always the final group, with `Top padding` followed
   by `Bottom padding`.

Keep dependent controls immediately after the setting that enables them,
desktop controls before their mobile equivalents, and never split the
Appearance group or place padding between Appearance settings. Preserve this
sequence when extending an existing section unless a resource picker must
remain first for clarity.

| Concept | Canonical ID | Canonical label |
| --- | --- | --- |
| Section width | `section_width` | `Section width` |
| Desktop grid columns | `columns_desktop` | `Desktop columns` |
| Mobile grid columns | `columns_mobile` | `Mobile columns` |
| Desktop carousel capacity | `slides_per_view_desktop` | `Desktop items per view` |
| Mobile carousel capacity | `slides_per_view_mobile` | `Mobile items per view` |
| Desktop column gap | `column_gap_desktop` | `Desktop column gap` |
| Mobile column gap | `column_gap_mobile` | `Mobile column gap` |
| Desktop row gap | `row_gap_desktop` | `Desktop row gap` |
| Mobile row gap | `row_gap_mobile` | `Mobile row gap` |
| Color scheme | `color_scheme` | `Color scheme` |
| Background override | `background_color` | `Background color` |
| Top padding | `padding_top` | `Top padding` |
| Bottom padding | `padding_bottom` | `Bottom padding` |
| Heading size | `heading_size` | `Heading size` |
| Text size | `text_size` | `Text size` |
| Label size | `label_size` | `Label size` |
| Icon size | `icon_size` | `Icon size` |
| Heading element | `heading_tag` | `HTML Tag` |
| Legacy heading element | `html_tag` | `HTML Tag` |
| Autoplay | `autoplay` | `Autoplay` |
| Autoplay timing | `autoplay_delay` | `Autoplay interval` |
| Button label | `button_label` | `Button label` |
| Button link | `button_link` | `Button link` |
| Button external target | `button_open_in_new_tab` | `Open link in new tab` |
| Content alignment | `content_alignment` | `Content alignment` |
| Content position | `content_position` | `Content position` |
| Image alternative text | `image_alt` | `Alt text` |
| Mobile image | `mobile_image` | `Mobile image` |
| Image overlay color | `overlay_color` | `Overlay color` |
| Image overlay opacity | `overlay_opacity` | `Overlay opacity` |
| Open external target | `open_in_new_tab` | `Open link in new tab` |
| Repeated-item gap | `item_gap` | `Item gap` |
| Mobile custom size | `font_size_mobile` | `Mobile size` |
| Mobile width | `width_mobile` | `Mobile width` |
| Product count | `products_to_show` | `Product count` |
| Pagination visibility | `show_pagination` | `Show pagination` |
| Product-count visibility | `show_product_count` | `Show product count` |
| View-all copy | `view_all_label` | `View all label` |
| Text color | `text_color` | `Text color` |

Write merchant-facing labels in sentence case, with `HTML Tag` as the canonical
project-specific exception. Capitalize proper nouns and acronyms: use `HTML Tag`,
`URL`, `SEO`, `FAQ`, and `Instagram`; never `HTML tag`. Put the device qualifier first (`Desktop image
ratio`, `Mobile image ratio`). Use singular nouns for one value and plural only
for a real collection. Keep action labels verb-led (`Show pagination`, `Open
link in new tab`). Do not mix labels with implementation language such as
`Heading SEO` when the control only selects an HTML element.

Keep responsive grammar in `Device + noun` order: `Mobile image`, `Mobile size`,
and `Mobile width`; never `Image mobile`, `Image (mobile)`, `Size mobile`, or
`Width mobile`. Use the full property noun: `Text color`, `Overlay opacity`,
`Top padding`, and `Bottom padding`; never shorten these to `Text`, `Opacity`,
`Top`, or `Bottom` when the setting controls that property. Use `Open link in
new tab` without an article and use `Show …` for visibility checkboxes.

Do not assume that identical IDs always mean identical behavior. During audit,
compare setting ID, type, owner, options, default, and implementation together:

- If behavior is equivalent, use the same ID, type, label, options, and help
  text.
- If the owner needs qualification, keep the canonical noun and qualify it,
  such as `Panel color scheme` or `Desktop drawer width`.
- If behavior differs materially, use a specific ID in new work instead of
  overloading a generic ID such as `image`, `style`, `title`, or `alignment`.
- Keep shipped IDs stable. A label-only normalization is safe; changing an ID
  requires an explicit saved-data migration.
- Translation keys count as labels. Compare their resolved English copy with
  literal labels and reuse the canonical translation key when one exists.

Do not use ambiguous labels such as `Desktop columns / items`. A grid exposes
`columns`; a carousel exposes `items per view`. Qualify a label with the owned
element when the setting is not section-wide, for example `Desktop image
ratio`, `Mobile content alignment`, or `Desktop drawer width`.

For paired responsive settings, keep device order and vocabulary identical:
`Desktop …`, then `Tablet …` when needed, then `Mobile …`. Use matching option
labels (`Page width` / `Full width`, `Small` / `Medium` / `Large`, and so on)
unless the underlying behavior genuinely differs. Before completing any schema
change, compare the setting against all sections with the same component role;
record an intentional exception in code only when it is functionally distinct.

For a schema-label audit, inspect both section settings and Theme Block settings,
group findings by `ID + type`, then classify every mismatch as: exact equivalent,
context-qualified equivalent, or true semantic difference. Also compare option
labels, units, defaults, `info`, and `visible_if`; matching top-level labels alone
is not sufficient. Search the entire repository for every changed setting ID so
a new label variant cannot be introduced in one section unnoticed.

## Component architecture

Treat Product Card, Form, Input, Newsletter, and other repeated UI patterns as reusable components.

- Inspect existing snippets, custom elements, assets, and render calls before creating a component.
- Reuse the existing component when its public contract is sufficient.
- Extend its contract when the new behavior is broadly compatible.
- Create a new component only when reuse or extension would create conflicting semantics or excessive conditionals.
- Keep shared states consistent: default, hover, focus, active, disabled, loading, error, empty, and long-content behavior.

## `base.css` architecture

Treat `base.css` as the stable foundation and shared primitive layer, not as a
dumping ground for every section. Use this ownership order:

1. reset and element normalization;
2. global design-token contracts and color-scheme variables;
3. document defaults, accessibility, focus, reduced-motion, and no-JavaScript
   behavior;
4. layout primitives such as page width, stack, grid, media, and scroll helpers;
5. typography and Block Kernel primitives;
6. reusable component primitives such as buttons, inputs, forms, cards, drawers,
   and shared interaction states;
7. narrowly named utilities and their responsive variants;
8. global responsive refinements.

Keep these rules outside `base.css`:

- section-specific composition, decorative art, and one-off positioning;
- selectors owned by only one section when they are not a reusable primitive;
- JavaScript-library styles that already have a dedicated asset;
- generated or Shopify-managed compiled assets;
- speculative utilities with no current consumer.

Use custom properties as component contracts. Let sections set variables such as
spacing, color, size, ratio, or alignment while shared primitives consume them.
Prefer changing a variable at a breakpoint over repeating the complete rule.

Keep selector specificity intentionally low. Prefer classes and `:where()` for
foundational selectors, and use attributes/classes for explicit states. Avoid
element chains, IDs, broad `!important`, and selectors tied to accidental Liquid
nesting. Preserve visible focus and progressive enhancement while doing so.

Use container queries when a reusable component must respond to its own available
width. Use viewport queries for page-level device bands. Do not replace a clear
viewport rule with a container query merely because the feature is available.

Use cascade layers only after inspecting the theme's existing cascade model. If
layers are adopted, keep a fixed, documented order such as `reset`, `base`,
`components`, `utilities`, and `overrides`; do not dynamically reverse layer
precedence by viewport. Avoid a partial migration that makes layered rules lose
to unlayered legacy CSS.

Keep authored CSS readable and organized by ownership even when the production
pipeline concatenates or minifies it. A large compiled bundle is an output
artifact, not a model for placing all source rules in one file.

When auditing `base.css`, classify every candidate rule before moving or deleting
it:

- keep it when multiple sections/components consume the same public primitive;
- move it to the owning section asset when its behavior is local;
- move it to a component asset when the component is reusable but independently
  loadable;
- delete it only after verifying that Liquid, JavaScript, Theme Editor rendering,
  dynamic state classes, and app integrations do not reference it.

Learn from reference themes at the architectural level only. Do not copy their
class prefixes, compiled ordering, legacy breakpoint variants, or component CSS
wholesale. Reconcile useful patterns with Spinel's current contracts first.

## Section architecture

Use the Shopify section wrapper as the highest-level page region. Do not render a nested `<section>` inside a section.

Use this hierarchy:

```text
Shopify section wrapper
└── Content container
    ├── Components
    └── Blocks
```

Use a semantic element other than `<section>` for inner wrappers when needed. Avoid section-to-section nesting disguised as a component abstraction.

## Appearance contract

- Keep the `Appearance` settings structure consistent across sections.
- Place `Color scheme` and optional `Background color` at section level.
- Leave the background override blank by default so the selected color scheme supplies the background.
- When a background override is selected, override only the section background; keep the remaining scheme tokens active.
- Apply the effective background to `#shopify-section-{{ section.id }}` so it spans the full Shopify section width. Do not limit it to an inner page-width container.

## Section padding contract

Use one `Section padding` group with:

- `Top padding`
- `Bottom padding`

Treat the desktop setting as the source value and scale it in CSS:

```text
Desktop: 1x
Tablet: 0.75x
Mobile: 0.5x
```

For example, `80px` becomes `60px` on tablet and `40px` on mobile. Do not add separate breakpoint settings unless the user explicitly requires independent control.

Prefer CSS custom properties for the source values and `calc()` for responsive scaling.

## Canonical breakpoints

Use Spinel's core device bands for new or deliberately normalized work. These
bands come from the current theme's device visibility utilities, responsive
layer order, container rules, and repeated typography/layout queries:

| Device | Range | Preferred query |
| --- | --- | --- |
| Mobile | `0px`–`767.98px` | `@media (max-width: 767.98px)` |
| Tablet | `768px`–`1149.98px` | `@media (min-width: 768px) and (max-width: 1149.98px)` |
| Desktop | `1150px` and wider | `@media (min-width: 1150px)` |

Treat these additional Spinel thresholds as scoped enhancements, not new
top-level device bands:

- Use `576px` only when a compact-mobile layout genuinely needs a second step.
- Use `1024px` for wide-tablet or component-level layout changes inside the
  tablet band; do not relabel it as the global desktop boundary.
- Use `1400px` or `1440px` for large-desktop spacing, container, header, or
  composition refinements.
- Use `1600px` and `1920px` only for explicitly extra-wide compositions such as
  richer mega-menu grids; do not make ordinary sections depend on them.

Do not classify `pointer`, `hover`, `prefers-reduced-motion`, `forced-colors`,
`scripting`, or `print` media features as viewport breakpoints. Combine them
with a width query only when the interaction or accessibility behavior requires
it.

Use one boundary spelling consistently in new code: `767.98px`, `768px`,
`1149.98px`, and `1150px`. Do not introduce nearby variants unless an existing
component contract specifically depends on them.

Do not silently rewrite unrelated legacy breakpoints. When modifying an existing
shared component, reconcile its current behavior with this contract and keep the
change scoped unless the user requests a migration.

## Motion and reveal contract

Audit the current motion implementation before adding animation:

1. Find the global reveal controller, shared motion CSS/tokens, and the nearest
   section or component with comparable behavior.
2. Reuse the existing lifecycle and API; extend it only when the current contract
   cannot express the required layout. Create a new global controller only when
   no suitable implementation exists.
3. Integrate motion only into sections that are active or explicitly requested.
   Do not animate every `.shopify-block` automatically.

For ordinary document-flow sections, the section owns the reveal direction:

- Mark the section-owned wrapper with the existing opt-in reveal attribute.
- Set direction, distance, scale, and responsive overrides in the owning section
  stylesheet through the shared motion custom properties.
- Derive direction from composition: opposing columns may enter toward the
  composition, while stacked or centered mobile layouts normally use fade-up.
- Do not add direction settings to Heading, Label, Text, Button, Image, or other
  Block Kernels. This prevents nested or conflicting motion when the same block
  is reused in different layouts.
- For repeated siblings, reveal the parent as a group and apply a consistent
  stagger. Use `75ms` as the Spinel default unless the component already defines
  another timing contract.

Interactive components with their own state lifecycle stay independent from the
global scroll-reveal controller. Slideshow, carousel, tab, drawer, and modal
content must animate from their active/open/close state, not viewport entry.
Preserve their existing reset and replay behavior. In particular, Editorial
slideshow blocks use the slide-active lifecycle, fade-up in block order with a
`75ms` stagger, and reset while inactive; do not add global reveal attributes to
those blocks.

All motion implementations must:

- keep content visible when JavaScript is unavailable or fails;
- honor `prefers-reduced-motion: reduce` without hiding content;
- avoid animating layout properties when opacity and transform are sufficient;
- prevent transform conflicts with Swiper or other libraries by revealing the
  correct wrapper/group rather than a library-owned transform node;
- handle Theme Editor section load/unload/reorder and block selection without
  duplicated observers, stale hidden states, or selected blocks remaining hidden;
- be verified at desktop and mobile widths, including initial pending state,
  completed visible state, repeated-item stagger, and component replay behavior.

## Completion gate

Before reporting completion, confirm:

- an existing kernel/component was reused or the reason for creating a new one is documented;
- same-type block schemas remain compatible;
- shared kernel CSS is not duplicated outside `base.css`;
- no nested `<section>` was introduced;
- background reaches the full Shopify section wrapper;
- padding and breakpoints follow this contract;
- motion was audited for reuse, assigned to the correct section or component
  lifecycle, and does not conflict with Block Kernels or library transforms;
- Theme Editor add, remove, reorder, duplicate, select, save, and re-render behavior was tested when affected;
- storefront responsive, keyboard, focus, empty-content, long-content, and reduced-motion behavior was tested when affected;
- `section-editor-standards` audit and repository-required checks pass, or failures are reported as blockers.

## Shopify design mini-gate

Apply this short design review whenever creating a section or materially
changing an existing section. It is intentionally a decision gate, not a
requirement to reread a longer design document.

### 1. Purpose and page role

- Name the section's single primary outcome: introduce, inspire, browse,
  compare, build trust, or convert.
- Verify that it adds a distinct customer decision or story beat rather than
  duplicating a nearby section with the same content and CTA.
- When the section is editorial, provide a relevant route to product or
  collection discovery where that route supports the story.

### 2. Merchant setup and resilience

- Defaults and empty states must be launch-credible; use role-appropriate
  Shopify outline placeholders and never misleading fallback copy.
- Confirm short, long, missing, translated, and reordered content preserve a
  valid composition.
- Expose only merchant controls that materially affect the outcome. Keep data
  source ownership singular: resource-picker sections do not also create manual
  versions of that same resource.

### 3. Customer clarity and cohesion

- Reuse the global typography, scheme, button, icon, navigator, card, and
  motion contracts. Local styling may compose them, never fork them.
- Check every foreground, overlay, and control against the selected scheme;
  do not hard-code a contrast fix that fails another scheme.
- Keep one obvious primary action and avoid decorative motion or controls that
  compete with it.

### 4. Responsive, accessible interaction

- Test the real composition at mobile, tablet, and desktop bands, including no
  overflow, clipping, obscured fixed controls, or action overlap.
- Preserve DOM/keyboard order; provide labels for icon-only controls and
  visible focus states.
- Honour reduced motion and keep content reachable when JavaScript or animation
  fails.

### 5. Release evidence

- Record the section's purpose, empty state, responsive result, and any known
  exception in the final handoff.
- For a homepage change, also assess whether it improves the overall narrative
  and conversion cadence instead of making the page denser or slower.
- Run Theme Check and the proportional Theme Editor/storefront QA before
  approval.

## Shopify platform schema gate

Apply this compact platform gate to every new or materially changed section or
Theme Block schema. It complements the local architecture contract; it does not
replace it. Authoritative references are Shopify's [Input
settings](https://shopify.dev/docs/storefronts/themes/architecture/settings/input-settings)
and [Section schema](https://shopify.dev/docs/storefronts/themes/architecture/sections/section-schema)
documentation.

### 1. Valid schema and stable identifiers

- A section has exactly one top-level `{% schema %}` tag containing valid JSON;
  never nest it inside Liquid control flow.
- Use only Shopify-supported schema attributes. Keep every section block `name`
  and `type` unique within that section, and every setting `id` unique within
  its owning section or block.
- Treat existing setting IDs, block types, static IDs, defaults, and JSON block
  order as persisted merchant data. Do not rename or repurpose them without a
  migration audit.

### 2. Intentional input controls

- Every input setting needs an appropriate native `type`, stable `id`, clear
  `label`, and a safe default when Shopify requires or the composition depends
  on one. Use sidebar settings only for non-value headings, paragraphs, and
  separators.
- Use resource pickers for resource ownership (`product`, `collection`, `blog`,
  `article`, `image_picker`, and their list variants); do not approximate a
  picker with free text or duplicate picker-owned content as manual item blocks.
- Use text-bearing settings (`text`, `textarea`, `richtext`,
  `inline_richtext`, `html`) only for merchant-facing content that should be
  translatable. Reserve `liquid` for language-neutral integration/configuration
  values, never customer copy.
- A `range` must have numeric `min`, `max`, and `default`; choose a `step` that
  evenly spans the range and a meaningful `unit`. Verify defaults land exactly
  on a permitted step.
- Use `visible_if` only for supported input/sidebar setting types and only for
  values available within the same schema owner. It cannot depend on runtime
  objects or resolved dynamic-source data. Hidden controls must not be the sole
  way to preserve a required structural value.

### 3. Scope, presets, and capacity

- Define an explicit `enabled_on` allow-list whenever a section belongs only to
  selected templates or groups. Use `disabled_on` only where a concise
  exception list is genuinely safer than an allow-list.
- A section that merchants can add through the Theme Editor needs a valid
  preset. Presets may only reference block types the schema defines and must
  remain compatible with the current block/static composition.
- Set both global `max_blocks` and per-type `limit` intentionally. Limits must
  cover the existing active JSON count and the smallest permitted composition
  must still render a credible empty/placeholder state.
- Add `@app` only at a deliberate extension point with a rendered, styled, and
  tested slot. Never expose it merely because Shopify supports app blocks.

### 4. Render and editor integrity

- Render each local block on a persistent, visible wrapper carrying
  `{{ block.shopify_attributes }}`. Selection, reorder, and save/reload must
  continue to target the correct DOM node.
- Do not rely on literal block IDs in Liquid or JavaScript. Use block type,
  iteration order, or merchant data deliberately so duplicate/reordered blocks
  remain functional.
- Validate the exact changed schema in a development upload before handoff:
  Add section, Add block, duplicate, reorder, remove, save/reload, and Theme
  Editor block selection. Treat Shopify schema/upload errors as correctness
  blockers, not warnings.

## Shopify section modularity gate

Apply this gate before choosing a Section, Theme Block, or static role. It
implements Shopify's [Sections best practices](https://shopify.dev/docs/storefronts/themes/architecture/sections/best-practices)
alongside this theme's eligibility contract.

### 1. Choose the correct level of composition

- Use a **section** when the merchant must add, remove, duplicate, reorder, or
  independently configure a page/group-level story beat. Section settings own
  the whole composition: data source, layout, appearance, background,
  responsive behavior, and section padding.
- Use a **block** only for content that is semantically part of one owning
  section. A block owns one repeatable item or a deliberately editable local
  role; it must not recreate section-wide layout, appearance, or data-source
  controls.
- Use a **static block** for a fixed, position-sensitive, merchant-editable
  role. Use a dynamic block for repeatable items. Do not make singleton roles
  reorderable merely for convenience.
- Create a separate section instead of a block when the element must be placed
  independently in a template or section group, or needs its own full-width
  appearance/padding/data source.

### 2. Template and group responsibility

- The default content for a resource page belongs in its main template section
  (for example, product, collection, article, cart, or search). Supporting
  sections must not compete to own that page object's canonical content.
- Dynamic template/group sections must have a complete preset and a deliberate
  `enabled_on` allow-list. This gives merchants safe add/remove/reorder freedom
  only where the section is designed to work.
- Static sections/groups are intentionally not removable through the editor;
  document that status and do not add a preset solely to make them appear in
  Add section.
- Keep header, footer, overlay, and template eligibility mutually explicit.
  A template storytelling section must not be addable to a footer/header group,
  and a group-only system section must not be addable to arbitrary templates.

### 3. Composition safety and merchant freedom

- The default preset must render a coherent result, and all allowed
  add/remove/duplicate/reorder paths must remain coherent. If a role is needed
  for the structure, make it static or render a credible empty state.
- Curated compositions use an explicit block allow-list; never expose `@theme`
  as a shortcut for a fixed arrangement. Expose `@app` only as a deliberate,
  rendered extension slot.
- Keep data-source ownership singular. A section backed by a collection, blog,
  product, or article picker derives its cards from that resource instead of
  offering manually-created duplicates of the same cards.
- Before narrowing placement, allow-lists, limits, or static roles, compare the
  active JSON instances. Preserve existing IDs, order, and settings, and plan a
  migration whenever the new contract would invalidate them.

### 4. Modularity QA

- Verify that the intended section can be added, duplicated, reordered,
  removed, saved, and reloaded in its allowed template/group.
- Verify that it cannot be added in forbidden groups/templates, that its Add
  block menu exposes only rendered block types, and that duplicate/reordered
  blocks keep working.
- For main template sections, also verify the page's default resource content
  remains available without supplemental editorial sections.
