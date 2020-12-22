import RwbApp from './rwb-app';

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
    gridCountX: 20,
    gridCountY: 20,
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
  const btn1 = createButton('Play', '200px', '50px', '50px auto');
  const btn2 = createButton('Play Muted', '200px', '50px', '50px auto');

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
  divOverlay.style.textAlign = 'center';
  divOverlay.style.color = '#ffffff';
  divOverlay.style.fontSize = '30px';
  divOverlay.innerText = 'Robot Wants Battery';

  const divDisclaimer = document.createElement('div');
  divDisclaimer.style.fontSize = '12px';
  divDisclaimer.innerText = 'Disclaimer: PAC-MAN is a trademark of Bandai Namco Entertainment Inc.\n'
  + 'Robot Wants Battery is not affiliated with Bandai Namco Entertainment Inc. \n'
  + 'Some of the sounds in this game are remakes of the original PAC-MAN game, \n'
  + 'and are available to download from: https://scratch.mit.edu/projects/134538654/';

  // Stack elements.
  divHolder.appendChild(divOverlay);
  divOverlay.appendChild(btn1);
  divOverlay.appendChild(btn2);
  divOverlay.appendChild(divDisclaimer);
  document.getElementById('game-holder').appendChild(divHolder);

  // Start game!
  btn1.addEventListener('click', () => {
    startGame();
  });
  btn2.addEventListener('click', () => {
    startGame(true);
  });
};
