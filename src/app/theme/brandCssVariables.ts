import { designTokens } from './tokens';

// Legacy CSS and Leaflet HTML use the same values as MUI, including portaled UI.
const { brand, neutral } = designTokens.colors;
const rgb = [1, 3, 5].map(index => parseInt(brand[500].slice(index, index + 2), 16)).join(', ');
export const brandCssVariables = {
  '--primary': brand[500],
  '--primary-hover': brand[600],
  '--primary-active': brand[700],
  '--primary-light': brand[50],
  '--primary-border': brand[200],
  '--primary-contrast': neutral[0],
  '--primary-rgb': rgb,
};
