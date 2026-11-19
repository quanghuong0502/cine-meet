/**
 * Sizes that code needs as NUMBERS of CSS pixels: the width and height of a picture (next/image), a `sizes` hint, the `size` of an
 * avatar, a logo or a mascot. They are named here so no component writes a loose number (docs: .claude/rules/design-tokens.md).
 * Each one that has a twin in globals.css must equal it: `src/design-tokens.test.ts` compares them.
 */
export const PX = {
  /** = `--spacing-avatar`: the avatar in the account button, and a thumbnail in a list. */
  avatar: 40,
  /** The big avatar on the profile. */
  avatarLg: 64,
  /** = `--spacing-thumb`: the small picture of an item in a list (user and admin lists alike). */
  thumb: 56,
  /** = `--spacing-thumb-poster`: a movie poster in a list (user and admin lists alike). */
  thumbPoster: 64,
  /** = `--spacing-thumb-poster-lg`: the movie poster at the top of the appointment screen. */
  thumbPosterLg: 112,
  /** = `--spacing-swatch`: an image preview and the profile photo being uploaded. */
  swatch: 80,
  /** The logo (the two characters) in the app bar, and in the narrower admin bar. */
  logo: 48,
  logoCompact: 44,
  /** The mascot: while loading (compact, normal), on an empty or message screen, on the auth screens. */
  mascotXs: 80,
  mascotSm: 112,
  mascot: 140,
  mascotLg: 200,
  /** A poster in the strip of movies (a hint of the size it is drawn at), and the poster on the movie page (= `--spacing-poster`). */
  posterList: 128,
  poster: 136,
  /** = `--container-app`: the width of the user app column. */
  column: 672,
} as const;
