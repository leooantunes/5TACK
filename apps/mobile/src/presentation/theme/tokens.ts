/**
 * Design tokens do 5TACK — visual inspirado no HUD do CS2:
 * fundo grafite, laranja do lado T como destaque, azul do lado CT como secundário,
 * tipografia condensada em caixa alta e números monoespaçados de placar.
 */

export const colors = {
  bg: '#0A0D12',
  bgElevated: '#10151C',
  panel: '#141A23',
  panelHi: '#1B2330',
  border: '#232D3A',
  borderHi: '#36445A',

  text: '#E9EEF4',
  textDim: '#93A1B3',
  textMute: '#5E6B7D',

  accent: '#F2A03D', // laranja T-side
  accentDim: 'rgba(242,160,61,0.14)',
  accentText: '#140C02',
  ct: '#5EA2FF', // azul CT-side
  ctDim: 'rgba(94,162,255,0.14)',

  success: '#3FD98A',
  successDim: 'rgba(63,217,138,0.14)',
  danger: '#FF5A5A',
  dangerDim: 'rgba(255,90,90,0.14)',
  live: '#FF3B3B',
} as const;

export const roleColors = {
  STAR: '#F2C94C',
  ENTRY: '#FF7A45',
  SNIPER: '#3FD9C2',
  CLUTCHER: '#B98CFF',
  SUPPORT: '#5EA2FF',
} as const;

export const fonts = {
  display: 'Rajdhani_700Bold',
  heading: 'Rajdhani_600SemiBold',
  body: 'Rajdhani_500Medium',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 2, md: 4, lg: 8 } as const;
