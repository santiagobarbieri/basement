export const COLOR_PRESETS = {
  chrome: { name: 'Chrome', colors: { contrast: '#eff5ff', shadow: '#10141b', primary: '#8795a8' } },
  gold: { name: 'Gold', colors: { contrast: '#fff3c2', shadow: '#392308', primary: '#c59a3b' } },
  platinum: { name: 'Platinum', colors: { contrast: '#fffaf0', shadow: '#3a3834', primary: '#c7c0b4' } },
  diamond: { name: 'Diamond', colors: { contrast: '#ffffff', shadow: '#193a52', primary: '#b8dced' } },
};

const material = (name, primary, shadow, contrast) => ({ name, colors: { primary, shadow, contrast } });
export const BRUSH_PRESETS = {
  cromo: COLOR_PRESETS,
  relief: {
    clay: material('Clay', '#ae6549', '#46271f', '#eac2a0'),
    porcelain: material('Porcelain', '#e1d9c9', '#726d63', '#fffaf0'),
    bronze: material('Bronze', '#97713c', '#34291c', '#dcc08a'),
    obsidian: material('Obsidian', '#34313b', '#100e16', '#92909c'),
  },
  sand: {
    iron: material('Iron', '#4b4c50', '#18191c', '#a3a5aa'),
    magnetite: material('Magnetite', '#27282b', '#090a0c', '#73777c'),
    ochre: material('Ochre sand', '#bc914f', '#594025', '#ead1a0'),
    copper: material('Copper', '#b9754b', '#482a20', '#f0bc91'),
  },
  crayon: {
    red: material('Carmine', '#d94350', '#721c30', '#ff9d99'),
    blue: material('Blue', '#376dcc', '#193b7e', '#9dc3ff'),
    yellow: material('Yellow', '#ecc443', '#997028', '#fff0a4'),
    green: material('Green', '#459964', '#205036', '#a9de96'),
  },
  cement: {
    grey: material('Grey cement', '#96958f', '#4a4945', '#d4d2c9'),
    white: material('White cement', '#d8d5ca', '#8a877f', '#fffdf2'),
    graphite: material('Graphite', '#55575a', '#242629', '#a1a4a7'),
    terracotta: material('Terracotta', '#ad7159', '#58392f', '#dfb69a'),
  },
  dust: {
    chalk: material('Chalk', '#e2ded3', '#98948a', '#fffdf5'),
    charcoal: material('Charcoal', '#383634', '#131211', '#89847e'),
    earth: material('Earth', '#92704c', '#42301f', '#cfb18a'),
    pigment: material('Blue pigment', '#567db4', '#273d62', '#b8d5ef'),
  },
};
export const presetsForBrush = brush => BRUSH_PRESETS[brush] || COLOR_PRESETS;
