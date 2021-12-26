import TwoDDungeon from "2d-dungeon";
import * as dungeoneer from "dungeoneer";
import * as geo from "./geo-utils.js";
import * as ROT from "rot-js";

export const regenerate = async (dungeon, config = {}) => {
  try {
    switch (config.algorithm) {
      case "2d-dungeon":
        await generate2DDungeon(dungeon, config);
        break;
      case "rot-js-cellular":
        await generateRotJsCellular(dungeon, config);
        break;
      case "dungeoneer":
        await generateDungeoneer(dungeon, config);
        break;
    }  
  } catch (err) {
    console.error(err);
    ui.notifications.error("Error generating dungeon... please try again.");    
  }
};

const xOffset = () => {
  return (
    Math.ceil(
      (canvas.scene.data.width * canvas.scene.data.padding) /
        canvas.scene.data.grid
    ) * canvas.scene.data.grid
  );
};

const yOffset = () => {
  return (
    Math.ceil(
      (canvas.scene.data.height * canvas.scene.data.padding) /
        canvas.scene.data.grid
    ) * canvas.scene.data.grid
  );
};

/**
 *  rot.js Cellular Automata - http://ondras.github.io/rot.js/manual/#map/cellular
 */
export const generateRotJsCellular = async (dungeon, config) => {
  const scalingFactor = 1.0;
  const height = config.height * scalingFactor;
  const width = config.width * scalingFactor;
  const map = new ROT.Map.Cellular(width, height);
  map.randomize(0.5); // cells with 1/2 probability
  for (let i = 0; i < 4; i++) {
    map.create();
  }
  map.connect(null, 1);

  const gridSize = canvas.scene.data.grid / scalingFactor;
  const xOff = xOffset();
  const yOff = yOffset();
  let geometry;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (map._map[y][x]) {
        const oneSquare = {
          x: xOff + x * gridSize,
          y: yOff + y * gridSize,
          height: gridSize,
          width: gridSize,
        };
        const poly = geo.rectToPolygon(oneSquare);
        if (!geometry) {
          geometry = poly;
        } else {
          geometry = geo.union(geometry, poly);
        }
      }
    }
  }
  geometry = geo.simplify(geometry);
  if (config.smoothing) {
    for (let i = 0; i < config.smoothing; i++) {
      geometry = geo.smooth(geometry);
    }
  }
  const newState = dungeon.state().clone();
  newState.geometry = geometry;
  await dungeon.pushState(newState);
};

/**
 * 2D Dungeon - https://github.com/Prozi/dungeon-generator
 */
export const generate2DDungeon = async (dungeon, config) => {
  const height = config.height;
  const width = config.height;

  const map = new TwoDDungeon({
    max_iterations: 50,
    size: [width, height],
    rooms: {
      any: {
        min_size: [config.minRoomSize, config.minRoomSize],
        max_size: [config.maxRoomSize, config.maxRoomSize],
        max_exits: 4,
      }
    },
    min_corridor_length: 2,
    corridor_density: 0.5, //corridors per room
    symmetric_rooms: config.centerExits, // exits must be in the center of a wall if true
    interconnects: 1, //extra corridors to connect rooms and make circular paths. not 100% guaranteed
    // max_interconnect_length: 10,
    room_count: config.roomCount,
  });
  map.generate();

  const gridSize = canvas.scene.data.grid;
  const xOff = xOffset();
  const yOff = yOffset();
  let geometry;
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const isWall = map.walls.get([x, y]);
      if (isWall === false) {
        const oneSquare = {
          x: xOff + x * gridSize,
          y: yOff + y * gridSize,
          height: gridSize,
          width: gridSize,
        };
        const poly = geo.rectToPolygon(oneSquare);
        if (!geometry) {
          geometry = poly;
        } else {
          geometry = geo.union(geometry, poly);
        }
      }
    }
  }
  geometry = geo.simplify(geometry);

  // TODO: NaNs for the door coords?
  // for (let piece of twoDD.children) {
  //   for (let exit of piece.exits) {
  //     let {x, y, dest_piece} = exit; // local position of exit and piece it exits to
  //     const foo = piece.global_pos([x, y]); // [x, y] global pos of the exit
  //     console.log(foo);
  //   }
  // }

  const newState = dungeon.state().clone();
  newState.geometry = geometry;
  await dungeon.pushState(newState);
};

export const generateDungeoneer = async (dungeon, config) => {
  const map = dungeoneer.build({
    width: config.width,
    height: config.height,
  });
  const gridSize = canvas.scene.data.grid;
  const xOff = xOffset();
  const yOff =yOffset();
  let geometry;
  for (const row of map.tiles) {
    for (const cell of row) {
      if (cell.type === "floor" || cell.type === "door") {
        const oneSquare = {
          x: xOff + cell.x * gridSize,
          y: yOff + cell.y * gridSize,
          height: gridSize,
          width: gridSize,
        };
        const poly = geo.rectToPolygon(oneSquare);
        if (!geometry) {
          geometry = poly;
        } else {
          geometry = geo.union(geometry, poly);
        }
      }
    }
  }
  geometry = geo.simplify(geometry);
  const newState = dungeon.state().clone();
  newState.geometry = geometry;
  await dungeon.pushState(newState);
};
