/**
 * Centralized color theme for the CLI interface.
 *
 * Design: Minimal Mono with Cyan accent
 * - High contrast for readability
 * - Single accent color (cyan) for focus/active states
 * - Green reserved for success/completion
 * - Grayscale for hierarchy
 */

export const theme = {
  // === SPEAKERS ===
  // Distinct colors that work on both light and dark backgrounds
  speaker1: "cyan",
  speaker2: "magenta",

  // === ACCENT ===
  // Primary accent for active/focus states, progress indicators
  accent: "cyan",

  // === STATUS ===
  // Success states (completed, winner)
  success: "green",
  // Dimmed/inactive elements
  dim: "gray",

  // === BORDERS ===
  // Active/in-progress panels
  borderActive: "cyan",
  // Completed panels
  borderComplete: "green",
  // Inactive/default panels
  borderDefault: "gray",

  // === TEXT ===
  // Primary text
  text: "white",
  // Secondary/muted text (use dimColor prop instead when possible)
  textMuted: "gray",
} as const;

// Type for theme keys
export type ThemeColor = typeof theme[keyof typeof theme];
