import RwbApp from './rwb-app.js';

window.onload = () => {
  const rwb = new RwbApp('game-holder', {
    gridCountX: 16,
    gridCountY: 16,
  });
  rwb.init().catch((e) => {
    console.log('Failed to initialize app.');
    console.error(e);
  });
};
