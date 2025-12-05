# Exported CSS Themes and Styles

This folder contains the extracted CSS themes and style configurations from the Akordi Portal application.

## Files

### `globals.css`
The main CSS file containing:
- **Tailwind CSS imports** (`@import "tailwindcss"`)
- **CSS custom properties (variables)** for theming
- **Theme definitions** including:
  - Default light/dark theme
  - Cyberpunk theme
  - Nord theme
  - Dracula theme
  - Solarized theme
  - Windows 95 theme
  - Enterprise Slate theme
- **Custom scrollbar styles**
- **Base layer styles**

### `theme-provider.tsx`
React component for theme management:
- Theme context provider
- Available themes: `light`, `dark`, `cyberpunk`, `nord`, `dracula`, `solarized`, `win95`, `enterprise-slate`
- Theme persistence via `next-themes`

### `components.json`
Shadcn/UI configuration:
- Component style preferences
- Tailwind CSS configuration
- Path aliases

### `postcss.config.mjs`
PostCSS configuration for processing CSS.

## Theme CSS Variables

Each theme defines the following CSS variables:
- `--background` / `--foreground` - Main background and text colors
- `--card` / `--card-foreground` - Card component colors
- `--primary` / `--primary-foreground` - Primary action colors
- `--secondary` / `--secondary-foreground` - Secondary colors
- `--muted` / `--muted-foreground` - Muted/subtle colors
- `--accent` / `--accent-foreground` - Accent colors
- `--destructive` / `--destructive-foreground` - Error/danger colors
- `--border` / `--input` / `--ring` - Border and input colors
- `--chart-1` through `--chart-5` - Chart colors
- `--sidebar-*` - Sidebar component colors

## Usage

To use these themes in another project:

1. Copy `globals.css` to your project's styles directory
2. Import it in your main layout/app file
3. Use the `theme-provider.tsx` component to enable theme switching
4. Apply theme classes to your root HTML element (e.g., `class="dark"` or `class="cyberpunk"`)

## Exported on
December 5, 2025

