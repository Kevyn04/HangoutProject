import { Platform } from 'react-native';

// NOTE: not every screen is theme-aware yet — see "deferred" list in the
// dark-mode implementation plan (docs/plans/fancy-moseying-alpaca.md at time
// of writing). Screens not yet converted keep importing `AppColors` directly
// and will always render dark, regardless of the user's theme choice.

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  bgDeep: string;
  bgBase: string;
  bgMid: string;
  gradient: readonly [string, string, string];
  blobRed: string;
  blobPurple: string;
  red: string;
  redSubtle: string;
  redBorder: string;
  purple: string;
  purpleSubtle: string;
  text: string;
  textSub: string;
  textMuted: string;
  textGhost: string;
  card: string;
  cardFaint: string;
  border: string;
  borderFaint: string;
  borderLight: string;
  btnLight: string;
  btnLightText: string;
  tabActive: string;
  tabInactive: string;
  tabBarGradient: readonly [string, string];
  tabBarBorder: string;
  headerBg: string;
  headerBgAlt: string;
  headerBgEnter: string;
  headerTint: string;
  statusBarStyle: 'light' | 'dark';
}

// ── App design tokens ─────────────────────────────────────────────────────────
const dark: ThemeColors = {
  // Backgrounds
  bgDeep:       '#0b0b0f',
  bgBase:       '#120303',
  bgMid:        '#1a0808',
  // Gradient (LinearGradient colors array) — matches ScreenBackground's real gradient
  gradient:     ['#0f0305', '#120303', '#0a0208'],
  blobRed:      'rgba(220,38,38,0.055)',
  blobPurple:   'rgba(124,58,237,0.045)',
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
  tabBarGradient: ['rgba(10,2,4,0.96)', '#120303'],
  tabBarBorder:   'rgba(255,255,255,0.1)',
  // Navigation headers (Stack.Screen headerStyle/headerTintColor)
  headerBg:     '#1a0505',
  headerBgAlt:  '#0f0305',
  headerBgEnter:'#131a24',
  headerTint:   '#ffffff',
  // expo-status-bar style
  statusBarStyle: 'light',
};

const light: ThemeColors = {
  // Backgrounds — warm off-white, tinted toward the burgundy brand hue
  bgDeep:       '#faf5f4',
  bgBase:       '#fdf1ef',
  bgMid:        '#f7e8e6',
  gradient:     ['#fdf1ef', '#faf5f4', '#f7e8e6'],
  blobRed:      'rgba(220,38,38,0.06)',
  blobPurple:   'rgba(124,58,237,0.05)',
  // Brand — identical to dark for brand consistency
  red:          '#dc2626',
  redSubtle:    'rgba(220,38,38,0.1)',
  redBorder:    'rgba(220,38,38,0.5)',
  purple:       '#7c3aed',
  purpleSubtle: 'rgba(124,58,237,0.1)',
  // Text — dark burgundy-black, mirrors dark mode's white-at-opacity scale
  text:         '#1a0505',
  textSub:      'rgba(26,5,5,0.65)',
  textMuted:    'rgba(26,5,5,0.4)',
  textGhost:    'rgba(26,5,5,0.3)',
  // Surfaces
  card:         'rgba(26,5,5,0.04)',
  cardFaint:    'rgba(26,5,5,0.025)',
  border:       'rgba(26,5,5,0.1)',
  borderFaint:  'rgba(26,5,5,0.07)',
  borderLight:  'rgba(26,5,5,0.16)',
  // Buttons
  btnLight:     'rgba(26,5,5,0.06)',
  btnLightText: '#1a0505',
  // Tab bar
  tabActive:    '#dc2626',
  tabInactive:  'rgba(26,5,5,0.35)',
  tabBarGradient: ['rgba(255,255,255,0.96)', '#fdf1ef'],
  tabBarBorder:   'rgba(26,5,5,0.08)',
  // Navigation headers
  headerBg:     '#fdf1ef',
  headerBgAlt:  '#fdf1ef',
  headerBgEnter:'#f3f0ee',
  headerTint:   '#1a0505',
  // expo-status-bar style
  statusBarStyle: 'dark',
};

export const Themes: Record<ThemeMode, ThemeColors> = { dark, light };

// Non-theme-aware fallback — screens not yet migrated to useTheme() keep
// importing this and always render the dark palette (today's behavior).
export const AppColors = Themes.dark;

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
