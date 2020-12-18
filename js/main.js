import RwbApp from './rwb-app.js';

function createButton(text, width, height, margin = 0) {
  const button = document.createElement('button');
  button.innerText = text;
  button.style.display = 'block';
  button.style.border = '1px solid #000000';
  button.style.borderRadius = '5px';
  button.style.backgroundColor = '#e8e8e8';
  button.style.width = width;
  button.style.height = height;
  button.style.margin = margin;
  return button;
}

function startGame(muted = false) {
  document.getElementById('pregame-buttons').remove();
  const rwb = new RwbApp('game-holder', {
    gridCountX: 16,
    gridCountY: 16,
    muted,
  });
  rwb.init().catch((e) => {
    console.log('Failed to initialize app.');
    console.error(e);
  });
}

window.onload = () => {
  // Just being lazy here with the hardcoded initial screen...
  // Gets initial user-DOM interaction to bypass Chrome's forced-mute.
  const btn1 = createButton('Start', '200px', '50px', '50px');
  const btn2 = createButton('Start Muted', '200px', '50px', '50px');

  const divHolder = document.createElement('div');
  divHolder.id = 'pregame-buttons';
  divHolder.style.backgroundImage = 'url("./img/screen.png")';
  divHolder.style.backgroundSize = 'cover';
  divHolder.style.display = 'flex';
  divHolder.style.alignItems = 'center';
  divHolder.style.justifyContent = 'center';
  divHolder.style.width = '100vw';
  divHolder.style.height = '100vh';

  const divOverlay = document.createElement('div');
  divOverlay.style.padding = '80px';
  divOverlay.style.backgroundColor = 'rgba(48, 48, 48, 0.95)';

  // Stack elements.
  divHolder.appendChild(divOverlay);
  divOverlay.appendChild(btn1);
  divOverlay.appendChild(btn2);
  document.getElementById('game-holder').appendChild(divHolder);

  // Start game!
  btn1.addEventListener('click', () => {
    startGame();
  });
  btn2.addEventListener('click', () => {
    startGame(true);
  });
};
