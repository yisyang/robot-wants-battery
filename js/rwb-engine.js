import RandomSeeder from './random-seeder.js';

export default class RwbGameEngine {
  constructor(holderId, width, height, gridSizePx = 32) {
    this.height = height;
    this.width = width;
    this.gridSizePx = gridSizePx;
    this.gameHolderId = holderId;
    this.canvasId = `${holderId}-canvas`;
    this.canvas = null;
    this.gridCountX = Math.floor(width / gridSizePx) - 2;
    this.gridCountY = Math.floor(height / gridSizePx) - 2;
    this.isWaterTile = [];
    this.startLocation = {
      x: 3,
      y: 3,
    };
    this.endLocation = {
      x: this.gridCountX - 4,
      y: this.gridCountY - 4,
    };
    this.playerCount = 1;
    this.playerLocations = [];

    if (this.gridSizePx < 10) {
      throw Error('Error: Grid size too small to be playable! Please increase grid width/height.');
    }
    if (this.gridCountX < 10 || this.gridCountY < 10) {
      throw Error('Error: Grid count too few to be playable! Please increase canvas width/height.');
    }

    this.initCanvas();
    this.initButtons();
    this.reset();
    this.render();
  }

  static createButton(text, width, height) {
    const button = document.createElement('button');
    button.innerText = text;
    button.style.border = '1px solid #000000';
    button.style.borderRadius = '5px';
    button.style.backgroundColor = '#e8e8e8';
    button.style.width = width;
    button.style.height = height;

    return button;
  }

  initButtons() {
    const buttonStartGame = RwbGameEngine.createButton('Start Game', '100px', '50px');
    const buttonResetGame = RwbGameEngine.createButton('Reset Game', '100px', '50px');

    document.getElementById(this.gameHolderId).appendChild(buttonStartGame);
    document.getElementById(this.gameHolderId).appendChild(buttonResetGame);

    buttonStartGame.addEventListener('click', () => {
      this.render();
    });
    buttonResetGame.addEventListener('click', () => {
      this.reset();
    });
  }

  initCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = this.canvasId;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.zIndex = '99';
    this.canvas.style.position = 'relative';
    this.canvas.style.border = '1px solid #000000';

    document.getElementById(this.gameHolderId).appendChild(this.canvas);
  }

  render() {
    // const ctx = this.canvas.getContext('2d');
    // ctx.fillStyle = '#ff0000';
    // ctx.lineWidth = 10;
    //
    // // Wall
    // ctx.strokeRect(75, 140, 150, 110);
    //
    // // Door
    // ctx.fillRect(130, 190, 40, 60);
    //
    // // Roof
    // ctx.beginPath();
    // ctx.moveTo(50, 140);
    // ctx.lineTo(150, 60);
    // ctx.lineTo(250, 140);
    // ctx.closePath();
    // ctx.stroke();

  }

  reset(seedPhrase = null, waterTileChance = 0.1) {
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.width, this.height);

    if (seedPhrase === null) {
      seedPhrase = Math.random().toString();
    }
    const randomSeeder = new RandomSeeder(seedPhrase);

    // Compute water tiles.
    this.isWaterTile = [];
    for (let i = 0; i < this.gridCountX; i++) {
      this.isWaterTile[i] = [];
      for (let j = 0; j < this.gridCountY; j++) {
        this.isWaterTile[i][j] = randomSeeder.rand() < waterTileChance;
      }
    }

    // Hard-code start and end locations as non-water.
    this.isWaterTile[this.startLocation.x][this.startLocation.y] = false;
    this.isWaterTile[this.endLocation.x][this.endLocation.y] = false;

    // Draw map.
    const marginX = Math.floor((this.width - this.gridCountX * this.gridSizePx) / 2);
    const marginY = Math.floor((this.height - this.gridCountY * this.gridSizePx) / 2);

    // Fill base with water.
    ctx.fillStyle = '#3090ff';
    ctx.fillRect(0, 0, this.width, this.height);
    const gridInnerBorderPx = 1;
    const { gridSizePx } = this;
    const gridSizePxWoBorder = gridSizePx - 2 * gridInnerBorderPx;
    ctx.fillStyle = '#505050';
    // Border fix.
    ctx.fillRect(marginX - 1, marginY - 1, this.gridCountX * gridSizePx + 2, this.gridCountY * gridSizePx + 2);

    // Start drawing grids, assuming each square has 1px inner border.
    for (let i = 0; i < this.gridCountX; i++) {
      for (let j = 0; j < this.gridCountY; j++) {
        ctx.fillStyle = '#505050';
        const offsetX = marginX + i * gridSizePx;
        const offsetY = marginY + j * gridSizePx;
        ctx.fillRect(offsetX, offsetY, gridSizePx, gridSizePx);
        if (this.isWaterTile[i][j]) {
          ctx.fillStyle = '#3090ff';
          ctx.fillRect(offsetX + gridInnerBorderPx, offsetY + gridInnerBorderPx, gridSizePxWoBorder, gridSizePxWoBorder);
        } else {
          if ((i + j) % 2) {
            ctx.fillStyle = '#ffffff';
          } else {
            ctx.fillStyle = '#f0f0f0';
          }
          ctx.fillRect(offsetX + gridInnerBorderPx, offsetY + gridInnerBorderPx, gridSizePxWoBorder, gridSizePxWoBorder);
        }
      }
    }

    // Render start and end locations.
    const startImgOffsetX = marginX + this.startLocation.x * gridSizePx + gridInnerBorderPx;
    const startImgOffsetY = marginY + this.startLocation.y * gridSizePx + gridInnerBorderPx;
    const startImg = new Image();

    startImg.onload = () => {
      ctx.drawImage(startImg, startImgOffsetX, startImgOffsetY, gridSizePxWoBorder, gridSizePxWoBorder);
    };
    startImg.src = '/img/home.png';

    // Render start location
    const endImgOffsetX = marginX + this.endLocation.x * gridSizePx + gridInnerBorderPx;
    const endImgOffsetY = marginY + this.endLocation.y * gridSizePx + gridInnerBorderPx;
    const endImg = new Image();
    endImg.onload = () => {
      ctx.drawImage(endImg, endImgOffsetX, endImgOffsetY, gridSizePxWoBorder, gridSizePxWoBorder);
    };
    endImg.src = '/img/battery.png';
  }
}
