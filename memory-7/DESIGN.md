# Sekai Picture frontend direction

## Product thesis

Sekai Picture is a private wallpaper archive, not a generic admin dashboard. The interface treats each image as an owned media asset: find it, understand it, open it, save it, download it, or give it better metadata.

## Visual system

- Canvas: near-black `#121212`; sidebar: black; content surfaces: `#181818` and `#1f1f1f`.
- Accent: `#1ed760`, reserved for primary actions, active states, selection, and upload affordances.
- Typography: compact white hierarchy, muted metadata, large display titles only at meaningful entry points.
- Shape language: small concentric radii for cards and panels; pill controls for actions and tags.
- Imagery: use the real imported wallpaper archive from `uploads/wallpapers/sekai-import/`; CSS adds crop, contrast, and neutral edge treatment, never a substitute hero background.

## Page roles

- `home.html`: featured archive entry point, recent heat, search/filter, batch organization, and wallpaper cards.
- `dashboard.html`: collection signals and next actions, using the same media language instead of unrelated charts.
- `upload.html`: metadata-first intake flow with drag/drop preview and category creation beside it.
- `login.html` / `register.html`: focused return path into the archive, with the local anime imagery kept as the emotional brand layer.

## Motion contract

The focal moment is the archive image waking up as a layered memory card: the wallpaper sits in the back plane, constellation rings and metadata sit in a nearer plane, and pointer movement bends the scene around X/Y axes. Small archive particles, orbit rings, and upload scan lines run as bounded 2D loops to keep the still image feeling alive. Supporting motion covers staggered reveal, upload preview confirmation, submit loading, and lightbox entrance. All motion is native Web Animations API with `prefers-reduced-motion` fallback.

## Interaction contract

Every wallpaper card exposes a keyboard-focusable large-preview action, a download action, metadata editing, favorite state, and batch selection. Lightbox closes with the explicit close button, backdrop, or Escape and returns focus to the originating card.

## Asset provenance

Shipping raster imagery is sourced from the repository-local imported archive at `uploads/wallpapers/sekai-import/` and the existing local payment image at `src/main/resources/static/images/wechat-pay-sekai.jpg`. No remote image dependency is introduced by this visual pass.
