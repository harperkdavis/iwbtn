const TILE_TYPES = {
  NONE: -1,
  BLOCK: 0,
  SPIKE: 1,
  HALF: 2,
  MOVING_PLATFORM: 3,
}

class TileData {

  constructor(type = TILE_TYPES.NONE, isStatic = false, prop = {}, events = {}) {
    this.type = type;
    this.isStatic = isStatic;
    this.prop = prop;
    this.events = events;
  }

}

class MapTile {

  constructor(data, x, y) {
    this.data = data;
    this.x = x;
    this.y = y;
  }

}

class ActiveMapTile {

  constructor(mt) {
    this.mt = mt;
    this.offX = 0;
    this.offY = 0;
    this.local = {};
  }

}


function withinTile(mapTile, x, y) {
  switch(mapTile.data.type) {
    case TILE_TYPES.BLOCK:
      return (x > mapTile.x && x < mapTile.x + 1 && y > mapTile.y && y < mapTile.y + 1);
    case TILE_TYPES.SPIKE:
      switch (mapTile.data.prop.dir) {
        default:
        case 0:
          return (x > mapTile.x + lerp(0.5, 0, y - mapTile.y) && x < mapTile.x + 1 - lerp(0.5, 0, y - mapTile.y) && y > mapTile.y && y < mapTile.y + 1);
        case 1:
          return (x > mapTile.x && x < mapTile.x + 1 && y > mapTile.y + lerp(0, 0.5, x - mapTile.x) && y < mapTile.y + 1 - lerp(0, 0.5, x - mapTile.x));
        case 2:
          return (x > mapTile.x + lerp(0, 0.5, y - mapTile.y) && x < mapTile.x + 1 - lerp(0, 0.5, y - mapTile.y) && y > mapTile.y && y < mapTile.y + 1);
        case 3:
          return (x > mapTile.x && x < mapTile.x + 1 && y > mapTile.y + lerp(0.5, 0, x - mapTile.x) && y < mapTile.y + 1 - lerp(0.5, 0, x - mapTile.x));
      }
  }
}

class Button {

  constructor(text, x, y, w, h, click) {
    this.text = text;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.animation = 0;
    this.click = click;
    this.visible = true;
  }

  testClick() {
    if (isWithin(mouseX, mouseY, this.x, this.y, this.w, this.h)) {
      this.animation = 1;
      this.click();
    }
  }

  update() {
    this.animation = lerp(this.animation, 0, 0.1);
  }

  draw() {
    if (!this.visible) return;
    strokeWeight(1);

    noStroke();
    fill(isWithin(mouseX, mouseY, this.x, this.y, this.w, this.h) ? 230 : 240);
    rect(this.x, this.y, this.w, this.h);

    noStroke();
    fill(220);
    rect(this.x, this.y, this.w * this.animation, this.h);

    stroke(0);
    noFill();
    rect(this.x, this.y, this.w, this.h);

    noStroke();
    fill(0);
    textStyle(NORMAL);
    textAlign(CENTER, CENTER);
    textSize(this.h / 1.5);
    text(this.text, this.x + this.w / 2, this.y + this.h / 2);
  }

  hide() {
    this.visible = false;
  }

  show() {
    this.visible = true;
  }
}

const LOCAL_STORAGE_KEY = 'IWBTN';
const VERSION = '0.1.0';

const MAP_OFFSET_X = 20;
const MAP_OFFSET_Y = 20;
const MAP_WIDTH = 30;
const MAP_HEIGHT = 25;

let TILE_SIZE = 30;

let TIME_SCALE = 1.0;

let GRAVITY = 0.015;
let MAX_GRAVITY = 0.2;
let PLAYER_SPEED = 0.2;
let JUMP_HEIGHT = 0.2;

const DEATH_MESSAGES = ["So soon?", 
"That was close!", 
"So close, yet so very far.", 
"Maybe if you just tried not dying?", 
"Just jump better!", 
"I got it on my first try.", 
"Why is this such a struggle for you?", 
"You seem angry. Is that just me?", 
"This might be too hard for you.", 
"C'mon, this is so easy!", 
"Get better.", 
"Soooo bad.", 
"A monkey could play better than you.", 
"Are these messages annoying?", 
"You know you're not supposed to die, right?",
"Helpful tip: press Z or space to jump!",
"Maybe it's time for a break?",
"Stop dying so much!",
"I don't see how this is so hard.",
"You'll get it next time! /s",
"Is this your first time on a computer?",
"This is hard to watch.",
"Don't get mad, it's just a game bro.",
"Oooh, that was pretty bad.",
"You suck.",
"You'll never be THE NATHAN at this rate...",
"Don't even try anymore.",
];
let deathMessage = 0;

let keys = {};

const EPIC_PRO_MODE = true;

let inEditor = true;


let game = {
  savePoint: 0,
  deaths: 0,
};

let player = {
  posX: 0, posY: 0, velX: 0, velY: 0,
  inpVelLeft: 0, inpVelRight: 0,
  jumps: 2,
  dead: false,
  time: 0,
}

let replay = {
  recording: false,
  playing: false,
  timeScale: 1,
  time: 0,
  data: [],
}

let mapData = [];
let map = [];

let buttons = [];
let brush = undefined;

const BRUSH_PRESETS = [
  undefined,
  new TileData(TILE_TYPES.BLOCK, true, {}, {}),
  new TileData(TILE_TYPES.SPIKE, true, {dir: 0}, {}),
  new TileData(TILE_TYPES.HALF, true, {}, {}),
  new TileData(TILE_TYPES.MOVING_PLATFORM, false, {time: 80, distance: 5, dir: 0}, {})
]

let propInput;

let currentLevel = 0;
let nathanImage;

let scaledGridImage;
let staticLevelImage;

function setup() {
  createCanvas(windowWidth, windowHeight);
  

  nathanImage = loadImage('https://i.imgur.com/3CuLCRI.png');

  if (localStorage.getItem(LOCAL_STORAGE_KEY) != undefined) {
    loadGame();
  } else {
    reset();
    saveGame();
  }

  mapData = [];

  for (let i = 0; i < 10; i++) {
    mapData.push(new MapTile(new TileData(TILE_TYPES.BLOCK, true, {}, {}), i, 10));
  }

  reset();
  windowResized();
}


function reset() {
  restart();

  game.savePoint = 0;
  game.deaths = 0;

  loadLevel();
}

function restart() {
  player = {
    posX: 0, posY: 0, velX: 0, velY: 0,
    inpVelLeft: 0, inpVelRight: 0,
    jumps: 2,
    dead: false,
    time: 0,
  }
  game.deaths += 1;
}

function saveGame() {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(game));
}

function loadGame() {
  game = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY));
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  TILE_SIZE = min((height - MAP_OFFSET_Y * 2) / MAP_HEIGHT, (width - MAP_OFFSET_X * 2) / MAP_WIDTH);

  if (scaledGridImage != undefined) {
    scaledGridImage.remove();
  }

  scaledGridImage = createGraphics(TILE_SIZE * MAP_WIDTH + 1, TILE_SIZE * MAP_HEIGHT + 1);

  scaledGridImage.stroke(240);
  for (let x = 0; x <= MAP_WIDTH; x++) {
    scaledGridImage.line(x * TILE_SIZE, 0, x * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
  }
  for (let y = 0; y <= MAP_HEIGHT; y++) {
    scaledGridImage.line(0, y * TILE_SIZE, MAP_WIDTH * TILE_SIZE, y * TILE_SIZE);
  }

  drawLevelStatic();

  buttons = [
    new Button('Normal Speed', MAP_OFFSET_X * 2 + MAP_WIDTH * TILE_SIZE, MAP_OFFSET_Y + 750, 140, 20, function() {TIME_SCALE = 1}),
    new Button('Half Speed', MAP_OFFSET_X * 2 + MAP_WIDTH * TILE_SIZE, MAP_OFFSET_Y + 780, 140, 20, function() {TIME_SCALE = 0.5}),
    new Button('Slow-Motion', MAP_OFFSET_X * 2 + MAP_WIDTH * TILE_SIZE, MAP_OFFSET_Y + 810, 140, 20, function() {TIME_SCALE = 0.1}),
    new Button('Super-Slow-Motion', MAP_OFFSET_X * 2 + MAP_WIDTH * TILE_SIZE, MAP_OFFSET_Y + 840, 140, 20, function() {TIME_SCALE = 0.05}),
    new Button('Don\'t even bother', MAP_OFFSET_X * 2 + MAP_WIDTH * TILE_SIZE, MAP_OFFSET_Y + 870, 140, 20, function() {TIME_SCALE = 0.01}),
    new Button('Force Redraw', MAP_OFFSET_X * 2 + MAP_WIDTH * TILE_SIZE + 410, MAP_OFFSET_Y + 40 + 0, 140, 20, function() {drawLevelStatic()}),
    new Button('1: None', MAP_OFFSET_X * 2 + MAP_WIDTH * TILE_SIZE + 410, MAP_OFFSET_Y + 40 + 200, 140, 20, function() {setBrush(-1)}),
    new Button('2: Block', MAP_OFFSET_X * 2 + MAP_WIDTH * TILE_SIZE + 410, MAP_OFFSET_Y + 40 + 230, 140, 20, function() {setBrush(0)}),
    new Button('3: Spike', MAP_OFFSET_X * 2 + MAP_WIDTH * TILE_SIZE + 410, MAP_OFFSET_Y + 40 + 260, 140, 20, function() {setBrush(1)}),
    new Button('4: Half', MAP_OFFSET_X * 2 + MAP_WIDTH * TILE_SIZE + 410, MAP_OFFSET_Y + 40 + 290, 140, 20, function() {setBrush(2)}),
    new Button('5: Platform', MAP_OFFSET_X * 2 + MAP_WIDTH * TILE_SIZE + 410, MAP_OFFSET_Y + 40 + 320, 140, 20, function() {setBrush(3)}),
  ];
  
  removeElements();
  
  propInput = createInput('{}');  
  propInput.position(MAP_OFFSET_X * 2 + MAP_WIDTH * TILE_SIZE + 10, 300);
  propInput.size(380);
}

function loadLevel() {
  map = [];

  for (let tile of mapData) {
    map.push(new ActiveMapTile({...tile}));
  }
}

function drawLevelStatic() {
  if (staticLevelImage != undefined) {
    staticLevelImage.remove();
  }
  staticLevelImage = createGraphics(TILE_SIZE * MAP_WIDTH + 1, TILE_SIZE * MAP_HEIGHT + 1);
  for (let tile of mapData) {
    if (tile.data.type != TILE_TYPES.NONE && tile.data.isStatic) {
      drawMapTileGraphics(staticLevelImage, tile);
    }
  }
}

function keyPressed() {
  if (document.activeElement != propInput.elt) {
    keys[keyCode] = 0;
  }
}

function keyReleased() {
  keys[keyCode] = -1;
}

function mousePressed() {
  for (let btn of buttons) {
    btn.testClick();
  }
}

function mouseReleased() {
  if (inEditor) {
    drawLevelStatic();
  }
}

function setBrush(br) {
  brush = {...BRUSH_PRESETS[br + 1]};
  propInput.value(JSON.stringify(brush.prop));
}

function update() {

  Object.keys(keys).forEach(key => {
    if (keys[key] >= 0) {
      keys[key] += 1;
    }
  });

  if (EPIC_PRO_MODE && keys[ENTER] == 1) {
    inEditor = !inEditor;
    replay.recording = false;
    replay.playing = false;
    if (!inEditor) {
      loadLevel();
      drawLevelStatic();
      restart();
    }
  }

  
  for (let btn of buttons) {
    btn.update();
  }

  if (!inEditor) {
    updateGame();
  } else {
    updateEditor();
  }

}

function updateEditor() {
  if (mouseIsPressed && mouseButton == LEFT && inEditor && isWithin(mouseX, mouseY, MAP_OFFSET_X, MAP_OFFSET_Y, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE)) {
    let tmX = floor((mouseX - MAP_OFFSET_X) / TILE_SIZE) + (keys['D'.charCodeAt(0)] >= 1 ? 0.5 : 0) + (keys['A'.charCodeAt(0)] >= 1 ? -0.5 : 0);
    let tmY = floor((mouseY - MAP_OFFSET_Y) / TILE_SIZE) + (keys['S'.charCodeAt(0)] >= 1 ? 0.5 : 0) + (keys['W'.charCodeAt(0)] >= 1 ? -0.5 : 0);
    mapData = mapData.filter(tile => {
      return !(floor(tile.x) == tmX && floor(tile.y) == tmY);
    });

    if (brush != undefined) {
      mapData.push(new MapTile({...brush}, tmX, tmY));
    }
  }
  try {
    brush.prop = JSON.parse(propInput.value());
  } catch(e) {};

  for (let i = 1; i < 10; i++) {
    if (keys[(i.toString()).charCodeAt(0)] == 1) {
      setBrush(i - 2);
    }
  }

  if (keys['R'.charCodeAt(0)] == 1) {
    if (brush.prop.dir != undefined) {
      brush.prop.dir = (brush.prop.dir + 1) % 4;
      propInput.value(JSON.stringify(brush.prop));
    } else {
      brush.prop.dir = 1;
      propInput.value(JSON.stringify(brush.prop));
    }
  }
}

function updateGame() {
  const DELTA_TIME = (60 / (frameRate())) * TIME_SCALE;

  for (let tile of map) {
    //if (tile.mt.data.type == MOVING_PLATFORM) {
    //  tile.offX;
    //}
  }

  if (keys['R'.charCodeAt(0)] == 1) {
    replay.recording = false;
    replay.playing = false;
    restart();
  }

  if (keys['O'.charCodeAt(0)] == 1) {
    replay.recording = true;
    replay.playing = false;
    replay.data = [];
    replay.timeScale = TIME_SCALE;
    restart();
  }

  if (keys['P'.charCodeAt(0)] == 1) {
    replay.recording = false;
    replay.playing = true;
    replay.time = 0;
    restart();
  }

  if (keys['K'.charCodeAt(0)] == 1) {
    replay.recording = false;
  }

  if (keys['L'.charCodeAt(0)] == 1) {
    replay.playing = false;
  }

  if (replay.recording) {
    replay.data.push({t: player.time, p: {...player}});
    if (keys['I'.charCodeAt(0)] == 1) {
      replay.data = [...replay.data.slice(0, max(replay.data.length - 30, 1))];
      player = {...replay.data[replay.data.length - 1].p};
    }
  }

  if (!player.dead) {
    if (!replay.playing) {
      let tickResult = runTick(DELTA_TIME, player, keys, map);
      player = tickResult.player;
      map = tickResult.map;
    } else {
      let index = -1;
      for (let i = 0; i < replay.data.length; i++) {
        if (replay.time < replay.data[i].t) {
          index = i - 1;
          break;
        }
      }
      if (index != -1) {
        index = max(min(index, replay.data.length - 1), 0);
        player = {...replay.data[index].p};
      }
      replay.time += DELTA_TIME;
      
    }
    
    if (player.dead) {
      deathMessage = floor(random(0, DEATH_MESSAGES.length));
      player.velY *= -0.25;
      player.velY -= 0.05;
      player.velX *= -1;
    }
  } else {
    player.posX += player.velX;
    player.posY += player.velY;
    player.velY += GRAVITY / 4;
  }
}


function runTick(deltaTime, mPrev, mKeys, mapState) {
  let newMap = [...mapState];
  let newInpVelLeft = lerp(mPrev['inpVelLeft'], (mKeys[LEFT_ARROW] >= 1 || mKeys['A'.charCodeAt(0)] >= 1) ? 1 : 0, 0.5);
  let newInpVelRight = lerp(mPrev['inpVelRight'], (mKeys[RIGHT_ARROW] >= 1 || mKeys['D'.charCodeAt(0)] >= 1) ? 1 : 0, 0.5);
  let inputSpeed = (newInpVelRight - newInpVelLeft) * PLAYER_SPEED * 0.5;
  let dragForce = Math.sign(mPrev['velX']) * min(max(pow(mPrev['velX'] / PLAYER_SPEED, 2), 0), abs(mPrev['velX']));

  const accX = inputSpeed - dragForce;
  const accY = GRAVITY * (mPrev['velY'] < 0 && (mKeys[' '.charCodeAt(0)] >= 1 || mKeys['Z'.charCodeAt(0)] >= 1) ? 0.5 : 1);

  let newVelX = mPrev['velX'] + accX * deltaTime;
  let newVelY = mPrev['velY'] + accY * deltaTime;

  if (newVelY > MAX_GRAVITY) {
    newVelY = MAX_GRAVITY;
  }

  let newJumps = mPrev['jumps'];
  
  if ((mKeys[' '.charCodeAt(0)] == 1 || mKeys['Z'.charCodeAt(0)] == 1) && mPrev['jumps'] > 0) {
    newVelY -= JUMP_HEIGHT + mPrev['velY'];
    newJumps -= 1;
  }

  let newPosX = mPrev['posX'] + (mPrev['velX'] + newVelX) / 2 * deltaTime; 
  let newPosY = mPrev['posY'] + (mPrev['velY'] + newVelY) / 2 * deltaTime;

  let movX = Math.sign(newPosX - mPrev['posX']);
  let movY = Math.sign(newPosY - mPrev['posY']);

  function getMovingPlatformDist(time, data) {
    let iter = floor(time  / (data.prop.time));
    if (iter % 2 == 0) {
      return ((time % data.prop.time) / (data.prop.time)) * data.prop.distance;
    } else {
      return (1 - (time % data.prop.time) / (data.prop.time)) * data.prop.distance;
    }
  }

  for (let tile of newMap) {
    if (tile.mt.data.type == TILE_TYPES.MOVING_PLATFORM) {
      tile.offX = getMovingPlatformDist(mPrev['time'] + deltaTime, tile.mt.data);
    }
  }
  
  const COLLISION_MARGIN = 0.001;

  function runXCollision() {
    for (let tile of newMap) {
      if (isWithin(tile.mt.x + tile.offX, tile.mt.y + tile.offY, newPosX - 2, newPosY - 2, 4, 4)) {
        if (tile.mt.data.type == TILE_TYPES.BLOCK) {
          if (intersectRect(newPosX - 0.25, mPrev['posY'] - 0.5, 0.5, 0.5, tile.mt.x + tile.offX - COLLISION_MARGIN, tile.mt.y + tile.offY, 1 + 2 * COLLISION_MARGIN, 1)) {
            if (movX > 0) {
              newPosX = tile.mt.x + tile.offX - 0.25 - COLLISION_MARGIN;
              newVelX = 0;
            } else if (movX < 0) {
              newPosX = tile.mt.x + tile.offX + 1 + 0.25 + COLLISION_MARGIN;
              newVelX = 0;
            }
          }
        }
      }
    }
  }
  
  function runYCollision() {
    for (let tile of newMap) {
      if (isWithin(tile.mt.x + tile.offX, tile.mt.y + tile.offY, newPosX - 2, newPosY - 2, 4, 4)) {
        if (tile.mt.data.type == TILE_TYPES.BLOCK) {
          if (intersectRect(newPosX - 0.25, newPosY - 0.5, 0.5, 0.5, tile.mt.x + tile.offX, tile.mt.y + tile.offY, 1, 1)) {
            if (movY > 0) {
              newPosY = tile.mt.y + tile.offY - COLLISION_MARGIN;
              newVelY = 0;
              newJumps = 2;
            } else if (movY < 0) {
              newPosY = tile.mt.y + tile.offY + 1 + 0.5 + COLLISION_MARGIN;
              newVelY = 0;
            }
          }
        } else if (tile.mt.data.type == TILE_TYPES.HALF || tile.mt.data.type == TILE_TYPES.MOVING_PLATFORM) {
          if (newVelY >= 0 && mPrev['posY'] < tile.mt.y + tile.offY && newPosY > tile.mt.y + tile.offY && newPosX + 0.25 > tile.mt.x + tile.offX && newPosX - 0.25 < tile.mt.x + tile.offX + 1) {
              newPosY = tile.mt.y + tile.offY - COLLISION_MARGIN;
              newVelY = 0;
              newJumps = 2;
              if (tile.mt.data.type == TILE_TYPES.MOVING_PLATFORM) {
                newPosX += (getMovingPlatformDist(mPrev['time'] + deltaTime, tile.mt.data) - getMovingPlatformDist(mPrev['time'], tile.mt.data)) / deltaTime;
                runXCollision();
              }
          }
        }
      }
    }
  }
  
  runXCollision();
  runYCollision();
  

  let newDead = mPrev['dead'];
  const offsets = [{x: -0.25, y: -0.5}, {x: 0.25, y: -0.5}, {x: -0.25, y: 0.0}, {x: 0.25, y: 0.0}];

  for (let tile of newMap) {
    if (isWithin(tile.mt.x, tile.mt.y, newPosX - 2, newPosY - 2, 4, 4)) {
      if (tile.mt.data.type == TILE_TYPES.SPIKE) {
        for (let off of offsets) {
          if (withinTile(tile.mt, newPosX + off.x, newPosY + off.y)) {
            newDead = true;
          }
        }
      }
    }
  }

  let newTime = mPrev['time'] + deltaTime;

  return {player: {
    posX: newPosX,
    posY: newPosY,
    velX: newVelX,
    velY: newVelY,
    inpVelLeft: newInpVelLeft,
    inpVelRight: newInpVelRight,
    jumps: newJumps,
    dead: newDead,
    time: newTime,
  }, map: newMap};
}

function drawTile(tileData, x, y) {
  switch (tileData.type) {
    case TILE_TYPES.BLOCK:
      stroke(0);
      fill(200);
      rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      break;
    case TILE_TYPES.SPIKE:
      stroke(0);
      fill(230);
      switch (tileData.prop.dir) {
        default:
        case 0:
          triangle(x * TILE_SIZE, y * TILE_SIZE + TILE_SIZE, x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE, x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE + TILE_SIZE);
          break;
        case 1:
          triangle(x * TILE_SIZE, y * TILE_SIZE, x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE + TILE_SIZE / 2, x * TILE_SIZE, y * TILE_SIZE + TILE_SIZE);
          break;
        case 2:
          triangle(x * TILE_SIZE, y * TILE_SIZE, x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE, x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE);
          break;
        case 3:
          triangle(x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE, x * TILE_SIZE, y * TILE_SIZE + TILE_SIZE / 2, x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE + TILE_SIZE);
          break;
      }
      break;
    case TILE_TYPES.HALF:
      stroke(0);
      fill(150);
      rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, 0.5 * TILE_SIZE);
      break;
    case TILE_TYPES.MOVING_PLATFORM:
      stroke(0);
      fill(160, 150, 140);
      rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, 0.5 * TILE_SIZE);
      break;
  }
}

function drawTileGraphics(graphics, tileData, x, y) {
  switch (tileData.type) {
    case TILE_TYPES.BLOCK:
      graphics.stroke(0);
      graphics.fill(200);
      graphics.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      break;
    case TILE_TYPES.SPIKE:
      graphics.stroke(0);
      graphics.fill(230);
      switch (tileData.prop.dir) {
        default:
        case 0:
          graphics.triangle(x * TILE_SIZE, y * TILE_SIZE + TILE_SIZE, x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE, x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE + TILE_SIZE);
          break;
        case 1:
          graphics.triangle(x * TILE_SIZE, y * TILE_SIZE, x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE + TILE_SIZE / 2, x * TILE_SIZE, y * TILE_SIZE + TILE_SIZE);
          break;
        case 2:
          graphics.triangle(x * TILE_SIZE, y * TILE_SIZE, x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE, x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE);
          break;
        case 3:
          graphics.triangle(x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE, x * TILE_SIZE, y * TILE_SIZE + TILE_SIZE / 2, x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE + TILE_SIZE);
          break;
      }
      break;
    case TILE_TYPES.HALF:
      graphics.stroke(0);
      graphics.fill(150);
      graphics.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, 0.5 * TILE_SIZE);
      break;
  }
}

function drawMapTile(mapTile, offX = 0, offY = 0) {
  drawTile(mapTile.data, mapTile.x + offX, mapTile.y + offY);
}

function drawMapTileGraphics(graphics, mapTile, offX = 0, offY = 0) {
  drawTileGraphics(graphics, mapTile.data, mapTile.x + offX, mapTile.y + offY);
}

function drawGame() {
  push();
  translate(MAP_OFFSET_X, MAP_OFFSET_Y);
  image(scaledGridImage, 0, 0);
  image(staticLevelImage, 0, 0);
  
  for (let tile of map) {
    if (tile.mt.data.type != TILE_TYPES.NONE && !tile.mt.data.isStatic) {
      drawMapTile(tile.mt, tile.offX, tile.offY);
    }
  }

  if (player.dead) {
    noStroke();
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(128);
    textStyle(BOLD);
    text("#" + game.deaths, MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2 - 32 + sin(millis() * 0.002) * 20);

    
    textStyle(ITALIC);
    textSize(32);
    fill(0);
    rect(MAP_WIDTH * TILE_SIZE / 2 - textWidth(DEATH_MESSAGES[deathMessage]) / 2 - 20, MAP_HEIGHT * TILE_SIZE / 2 + 40 + sin(millis() * 0.002) * 20, textWidth(DEATH_MESSAGES[deathMessage]) + 40, 46);

    fill(255);
    text(DEATH_MESSAGES[deathMessage], MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2 + 64 + sin(millis() * 0.002) * 20);

    tint(255, 0, 0);
  } else {
    tint(255);
  }
  image(nathanImage, player.posX * TILE_SIZE - TILE_SIZE / 4, player.posY * TILE_SIZE - TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE / 2);

  pop();

  fill(0);
  noStroke();
  textSize(16);
  textAlign(LEFT, TOP);

  if (replay.playing) {
    text("playing", 10, 10);
  } else if (replay.recording) {
    text("recording", 10, 10);
  } else {
    text("vcr not doing anything", 10, 10);
  }

  noStroke();
  fill(0, 100);
  rect(0, 0, width, MAP_OFFSET_Y);
  rect(0, MAP_OFFSET_Y, MAP_OFFSET_X, height);
  rect(MAP_OFFSET_X + MAP_WIDTH * TILE_SIZE, MAP_OFFSET_Y, width, height);
  rect(MAP_OFFSET_X, MAP_OFFSET_Y + MAP_HEIGHT * TILE_SIZE, MAP_WIDTH * TILE_SIZE, height);
}

function drawEditor() {

  push();
  translate(MAP_OFFSET_X, MAP_OFFSET_Y);
  image(scaledGridImage, 0, 0);
  image(staticLevelImage, 0, 0);

  for (let tile of mapData) {
    if (tile.data.type != TILE_TYPES.NONE && !tile.data.isStatic) {
      drawMapTile(tile);
    }
  }


  if (isWithin(mouseX, mouseY, MAP_OFFSET_X, MAP_OFFSET_Y, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE)) {
    stroke(0);
    strokeWeight(3);
    noFill();
    let tmX = floor((mouseX - MAP_OFFSET_X) / TILE_SIZE) + (keys['D'.charCodeAt(0)] >= 1 ? 0.5 : 0) + (keys['A'.charCodeAt(0)] >= 1 ? -0.5 : 0);
    let tmY = floor((mouseY - MAP_OFFSET_Y) / TILE_SIZE) + (keys['S'.charCodeAt(0)] >= 1 ? 0.5 : 0) + (keys['W'.charCodeAt(0)] >= 1 ? -0.5 : 0);
    rect(tmX * TILE_SIZE, tmY * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    strokeWeight(1);

    if (brush != undefined) {
      drawTile(brush, tmX, tmY);
    }
  }
  strokeWeight(1);
  pop();

  push();
  translate(MAP_OFFSET_X * 2 + MAP_WIDTH * TILE_SIZE, MAP_OFFSET_Y);

  textAlign(LEFT, TOP);
  fill(200, 210, 230);
  stroke(0);
  rect(0, 40, 400, 700);
  
  noStroke();
  fill(0);
  textSize(16);
  textStyle(NORMAL);
  if (brush != undefined) {
    Object.keys(TILE_TYPES).forEach((key) => {
      if (TILE_TYPES[key] == brush.type) {
        text("Brush: " + key, 5, 45);
      }
    });
  } else {
    text("No Brush", 5, 45);
  }

  fill(250);
  stroke(0);
  rect(1 * TILE_SIZE, 2 * TILE_SIZE, 5 * TILE_SIZE, 5 * TILE_SIZE);

  if (brush != undefined) {
    drawTile(brush, 3, 4);
  }

  fill(0);
  noStroke();
  text("properties", 10, 260);

  pop();
}

function draw() {
  if (frameRate() > 0) {
    update();
  }
  background(250);
  fill(0);

  if (inEditor) {
    drawEditor();
  } else {
    drawGame();
  }
  
  for (let btn of buttons) {
    btn.draw();
  }

  fill(0);
  textAlign(LEFT, TOP);
  textSize(32);
  textStyle(BOLD);
  text("I WANNA BE THE NATHAN", MAP_OFFSET_X * 2 + MAP_WIDTH * TILE_SIZE, MAP_OFFSET_Y);
  
}

function isWithin(x, y, rx, ry, rw, rh) {
  return (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh);
}

function ccw(A,B,C) {
    return (C.y-A.y) * (B.x-A.x) > (B.y-A.y) * (C.x-A.x)
}

function intersect(A,B,C,D) {
    return ccw(A,C,D) != ccw(B,C,D) && ccw(A,B,C) != ccw(A,B,D);
}

function intersectPoint(x1, y1, x2, y2, x3, y3, x4, y4) {

  // Check if none of the lines are of length 0
    if ((x1 === x2 && y1 === y2) || (x3 === x4 && y3 === y4)) {
        return false
    }

    denominator = ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1))

  // Lines are parallel
    if (denominator === 0) {
        return false
    }

    let ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator
    let ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator

  // is the intersection along the segments
    if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
        return false
    }

  // Return a object with the x and y coordinates of the intersection
    let x = x1 + ua * (x2 - x1)
    let y = y1 + ua * (y2 - y1)

    return {x, y}
}

function sqr(x) { return x * x }
function dist2(v, w) { return sqr(v.x - w.x) + sqr(v.y - w.y) }

function distToSegmentSquared(p, v, w) {
  var l2 = dist2(v, w);
  if (l2 == 0) return dist2(p, v);
  var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist2(p, { x: v.x + t * (w.x - v.x),
                    y: v.y + t * (w.y - v.y) });
}
function distToSegment(p, v, w) { return Math.sqrt(distToSegmentSquared(p, v, w)); }

function intersectRect(r1x, r1y, r1w, r1h, r2x, r2y, r2w, r2h) {
  return !(r2x >= r1x + r1w || r2x + r2w <= r1x || r2y >= r1y + r1h || r2y + r2h <= r1y);
}