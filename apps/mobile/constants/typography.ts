// Design-system typography tokens — Plus Jakarta Sans
// lineHeight values are converted from multipliers to px (fontSize × multiplier)
// letterSpacing values are converted from em to px (fontSize × em value)

export const font = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

export const type = {
  displayLg: {
    fontFamily: font.bold,
    fontSize: 40,
    lineHeight: 44,       // 40 × 1.1
    letterSpacing: -0.8,  // -0.02em × 40
  },
  headlineLg: {
    fontFamily: font.bold,
    fontSize: 28,
    lineHeight: 34,       // 28 × 1.2
  },
  headlineMd: {
    fontFamily: font.semiBold,
    fontSize: 20,
    lineHeight: 26,       // 20 × 1.3
  },
  bodyLg: {
    fontFamily: font.regular,
    fontSize: 16,
    lineHeight: 26,       // 16 × 1.6
  },
  bodySm: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 21,       // 14 × 1.5
  },
  labelCaps: {
    fontFamily: font.bold,
    fontSize: 12,
    lineHeight: 12,       // 12 × 1
    letterSpacing: 1.2,   // 0.1em × 12
    textTransform: 'uppercase' as const,
  },
  metadata: {
    fontFamily: font.medium,
    fontSize: 13,
    lineHeight: 18,       // 13 × 1.4
  },
} as const;
