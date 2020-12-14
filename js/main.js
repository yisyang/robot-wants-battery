import RwbApp from './rwb-app.js';

window.onload = () => {
  const rwb = new RwbApp('game-holder', {
    gridCountX: 16,
    gridCountY: 16,
  });
};
