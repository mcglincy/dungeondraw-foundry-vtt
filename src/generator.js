// import { Dungeon } from "./dungeon.js";
import TwoDDungeon from "2d-dungeon";
//import foo = require('foo');
import * as dungeoneer from "dungeoneer";
//import { generate } from '@halftheopposite/dungeon';
import * as geo from "./geo-utils.js";

export const regenerate = async (dungeon, config = {}) => {
  // await generateTwoDDungeon(dungeon, config);
  await generateDungeoneer(dungeon, config);
};

/**
 * 2D Dungeon - https://github.com/Prozi/dungeon-generator
 */
export const generateTwoDDungeon = async (dungeon, config) => {
  const height = config.height;
  const width = config.height;
  const gridSize = canvas.scene.data.grid;
  const xOffset =
    Math.ceil(
      (canvas.scene.data.width * canvas.scene.data.padding) /
        canvas.scene.data.grid
    ) * canvas.scene.data.grid;
  const yOffset =
    Math.ceil(
      (canvas.scene.data.height * canvas.scene.data.padding) /
        canvas.scene.data.grid
    ) * canvas.scene.data.grid;

  let twoDD = new TwoDDungeon({
    max_iterations: 50,
    size: [width, height],
    //seed: 'abcd', //omit for generated seed
    rooms: {
      initial: {
        min_size: [3, 3],
        max_size: [3, 3],
        max_exits: 1,
        //position: [0, 0] //OPTIONAL pos of initial room
      },
      any: {
        min_size: [2, 2],
        max_size: [5, 5],
        max_exits: 4,
      },
    },
    max_corridor_length: 6,
    min_corridor_length: 2,
    corridor_density: 0.5, //corridors per room
    symmetric_rooms: false, // exits must be in the center of a wall if true
    interconnects: 1, //extra corridors to connect rooms and make circular paths. not 100% guaranteed
    max_interconnect_length: 10,
    room_count: 10,
  });
  twoDD.generate();

  let geometry;
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const isWall = twoDD.walls.get([x, y]);
      if (isWall === false) {
        const oneSquare = {
          x: xOffset + x * gridSize,
          y: yOffset + y * gridSize,
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
  const gridSize = canvas.scene.data.grid;
  const xOffset =
    Math.ceil(
      (canvas.scene.data.width * canvas.scene.data.padding) /
        canvas.scene.data.grid
    ) * canvas.scene.data.grid;
  const yOffset =
    Math.ceil(
      (canvas.scene.data.height * canvas.scene.data.padding) /
        canvas.scene.data.grid
    ) * canvas.scene.data.grid;

  const d = dungeoneer.build({
    width: config.width,
    height: config.height,
  });

  let geometry;
  for (const row of d.tiles) {
    for (const cell of row) {
      if (cell.type === "floor" || cell.type === "door") {
        const oneSquare = {
          x: xOffset + cell.x * gridSize,
          y: yOffset + cell.y * gridSize,
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
  geometry = geo.expandGeometry(geometry, 0);
  const newState = dungeon.state().clone();
  newState.geometry = geometry;
  await dungeon.pushState(newState);
};
