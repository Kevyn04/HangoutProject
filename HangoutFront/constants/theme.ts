import { Platform } from 'react-native';

// ── App design tokens ─────────────────────────────────────────────────────────
export const AppColors = {
  // Backgrounds
  bgDeep:       '#0b0b0f',
  bgBase:       '#120303',
  bgMid:        '#1a0808',
  // Gradient (LinearGradient colors array)
  gradient:     ['#120303', '#3b0d0d', '#7a1f1f'] as const,
  // Brand
  red:          '#dc2626',
  redSubtle:    'rgba(220,38,38,0.15)',
  redBorder:    'rgba(220,38,38,0.6)',
  purple:       '#7c3aed',
  purpleSubtle: 'rgba(124,58,237,0.15)',
  // Text
  text:         '#ffffff',
  textSub:      'rgba(255,255,255,0.7)',
  textMuted:    'rgba(255,255,255,0.4)',
  textGhost:    'rgba(255,255,255,0.3)',
  // Surfaces
  card:         'rgba(255,255,255,0.07)',
  cardFaint:    'rgba(255,255,255,0.04)',
  border:       'rgba(255,255,255,0.12)',
  borderFaint:  'rgba(255,255,255,0.08)',
  borderLight:  'rgba(255,255,255,0.2)',
  // Buttons
  btnLight:     'rgba(255,255,255,0.92)',
  btnLightText: '#0b0b0f',
  // Tab bar
  tabActive:    '#dc2626',
  tabInactive:  'rgba(255,255,255,0.4)',
} as const;

export const AppSpacing = {
  radius:   14,
  radiusLg: 16,
  input:    48,
  pad:      24,
} as const;

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
