import RwbGameEngine from './rwb-engine.js';

window.onload = () => {
  const rwb = new RwbGameEngine({
    holderDivId: 'game-holder',
    gridCountX: 16,
    gridCountY: 16,
  });
};
