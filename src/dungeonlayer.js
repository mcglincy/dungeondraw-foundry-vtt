import * as constants from "./constants.js";
import { Dungeon } from "./dungeon.js";
import * as geo from "./geo-utils.js";
import { regenerate } from "./generator.js";
import { GridPainterHelper } from "./GridPainterHelper.js";
import { Settings } from "./settings.js";

const FOLDER_NAME = "Dungeon Draw";

/**
 * Convert a rectangle to an array of wall segments.
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Width
 * @param {number} height - Height
 * @returns {Array} Array of [x1, y1, x2, y2] wall segments
 */
function rectangleToWallSegments(x, y, width, height) {
  return [
    [x, y, x + width, y],                           // top
    [x + width, y, x + width, y + height],          // right
    [x + width, y + height, x, y + height],         // bottom
    [x, y + height, x, y],                          // left
  ];
}

/**
 * Convert an ellipse to an array of wall segments using geo.ellipse.
 * @param {number} x - X position (top-left corner of bounding box)
 * @param {number} y - Y position (top-left corner of bounding box)
 * @param {number} width - Width
 * @param {number} height - Height
 * @returns {Array} Array of [x1, y1, x2, y2] wall segments
 */
function ellipseToWallSegments(x, y, width, height) {
  // geo.ellipse expects center coordinates
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const ellipsePoly = geo.ellipse(centerX, centerY, width, height);
  const coords = ellipsePoly.getExteriorRing().getCoordinates();

  const segments = [];
  for (let i = 0; i < coords.length - 1; i++) {
    segments.push([coords[i].x, coords[i].y, coords[i + 1].x, coords[i + 1].y]);
  }
  return segments;
}

/**
 * Convert polygon points to wall segments.
 * @param {Array} points - Array of [x, y] points
 * @returns {Array} Array of [x1, y1, x2, y2] wall segments
 */
function polygonToWallSegments(points) {
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    segments.push([points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]]);
  }
  return segments;
}

/**
 * Convert a rectangle to polygon points for theme areas.
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Width
 * @param {number} height - Height
 * @returns {Array} Array of [x, y] points forming a closed polygon
 */
function rectangleToPolygonPoints(x, y, width, height) {
  return [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
    [x, y], // close the polygon
  ];
}

/**
 * Convert an ellipse to polygon points for theme areas.
 * @param {number} x - X position (top-left corner of bounding box)
 * @param {number} y - Y position (top-left corner of bounding box)
 * @param {number} width - Width
 * @param {number} height - Height
 * @returns {Array} Array of [x, y] points
 */
function ellipseToPolygonPoints(x, y, width, height) {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const ellipsePoly = geo.ellipse(centerX, centerY, width, height);
  const coords = ellipsePoly.getExteriorRing().getCoordinates();
  return coords.map((c) => [c.x, c.y]);
}

function isFreehand() {
  return game.activeDungeonDrawTool === "freehand";
}

function isGridPainter() {
  return game.activeDungeonDrawTool === "gridpainter";
}

function isStairs() {
  return game.activeDungeonDrawTool === "stairs";
}

/**
 * Calculate stair trapezoid geometry from first edge and mouse position.
 * @param {Object} firstEdge - { x1, y1, x2, y2 } the first edge of the stairs
 * @param {Object} mousePos - { x, y } current mouse position
 * @returns {Object} - { x1, y1, x2, y2, x3, y3, x4, y4 } trapezoid corners
 */
function calculateStairGeometry(firstEdge, mousePos) {
  const { x1, y1, x2, y2 } = firstEdge;

  // First edge vector
  const edgeVec = { x: x2 - x1, y: y2 - y1 };
  const edgeLength = Math.sqrt(edgeVec.x ** 2 + edgeVec.y ** 2);

  if (edgeLength < 1) {
    return null;
  }

  // Perpendicular unit vector (rotated 90°)
  const perpVec = { x: -edgeVec.y / edgeLength, y: edgeVec.x / edgeLength };

  // Edge unit vector
  const edgeUnit = { x: edgeVec.x / edgeLength, y: edgeVec.y / edgeLength };

  // Mouse position relative to first edge start
  const mouseVec = { x: mousePos.x - x1, y: mousePos.y - y1 };

  // Perpendicular distance (stair length) - can be negative
  const perpDist = mouseVec.x * perpVec.x + mouseVec.y * perpVec.y;

  // Parallel position along edge (for width ratio)
  const parallelPos = mouseVec.x * edgeUnit.x + mouseVec.y * edgeUnit.y;

  // Calculate width ratio based on parallel position
  // At center of edge -> 5% width (minimum)
  // At edge endpoint -> 100% width (parallel lines)
  // Beyond edge -> >100% width (reverse taper)
  const edgeCenter = edgeLength / 2;
  const distFromCenter = Math.abs(parallelPos - edgeCenter);
  let widthRatio = Math.max(0.05, distFromCenter / edgeCenter);

  // If mouse is beyond the edge endpoints, allow wider second edge
  if (parallelPos < 0 || parallelPos > edgeLength) {
    const beyondDist =
      parallelPos < 0 ? -parallelPos : parallelPos - edgeLength;
    widthRatio = 1 + beyondDist / edgeLength;
  }

  // Calculate second edge
  const secondEdgeLength = edgeLength * widthRatio;

  // Second edge start (perpendicular from x1, y1)
  let x3 = x1 + perpVec.x * perpDist;
  let y3 = y1 + perpVec.y * perpDist;

  // Center the second edge relative to first edge
  const offset = (edgeLength - secondEdgeLength) / 2;
  x3 += edgeUnit.x * offset;
  y3 += edgeUnit.y * offset;

  // Second edge end
  const x4 = x3 + edgeUnit.x * secondEdgeLength;
  const y4 = y3 + edgeUnit.y * secondEdgeLength;

  return { x1, y1, x2, y2, x3, y3, x4, y4 };
}

function findDungeonEntryAndNote() {
  for (const note of canvas.scene.notes) {
    const journalEntry = game.journal.get(note.entryId);
    if (journalEntry) {
      const flag = journalEntry.getFlag(
        constants.MODULE_NAME,
        "dungeonVersion"
      );
      if (flag) {
        return { journalEntry, note };
      }
    }
  }
  return { journalEntry: null, note: null };
}

async function createDungeonEntryAndNote() {
  const journalEntry = await createDungeonEntry();
  const note = await createDungeonNote(journalEntry);
  return { journalEntry, note };
}

async function createDungeonEntry() {
  let folder = game.folders
    .filter((f) => f.type === "JournalEntry" && f.name === FOLDER_NAME)
    .pop();
  if (!folder) {
    folder = await Folder.create({
      name: FOLDER_NAME,
      type: "JournalEntry",
    });
  }

  const journalEntry = await JournalEntry.create({
    name: canvas.scene.name,
    folder: folder.id,
    flags: {
      "dungeon-draw": {
        // extract string constant somewhere
        dungeonVersion: "1.0",
      },
    },
  });
  return journalEntry;
}

async function createDungeonNote(journalEntry) {
  await canvas.scene.createEmbeddedDocuments("Note", [
    {
      entryId: journalEntry.id,
      fontSize: 20,
      icon: "icons/svg/cave.svg",
      iconSize: 32,
      textAnchor: 1,
      textColor: "#FFFFFF",
      x: 50,
      y: 50,
      iconTint: "",
      text: "Dungeon Draw",
      flags: {},
    },
  ]);
}

function onGridPainterMouseDraw(preview, event) {
  //add the grid space to the array in flags, check for dupes
  const { destination } = event.interactionData;
  const { i, j } = canvas.grid.getOffset(destination);

  if (!preview.document.flags.gridPainterHelper) {
    preview.document.flags.gridPainterHelper = new GridPainterHelper();
  }
  preview.document.flags.gridPainterHelper.onGridPainterMouseDraw(i, j);
}

function onFreeHandMouseDraw(preview, event) {
  const { destination } = event.interactionData;
  const position = destination;
  //TODO look into this. There's something strange here, preview._drawTime is never not undefined so snape is always false. IDK what temporary is really supposed to do tbh, but odd
  const now = Date.now();
  const temporary =
    now - preview._drawTime < preview.constructor.FREEHAND_SAMPLE_RATE;
  const snap = false;
  preview._addPoint(position, { snap, temporary });
  preview.refresh();
}

function createDataOffsetPoints(createData) {
  const offsetPoints = [];
  for (let i = 0; i <= createData.shape.points.length - 2; i += 2) {
    offsetPoints.push([
      createData.shape.points[i] + createData.x,
      createData.shape.points[i + 1] + createData.y,
    ]);
  }
  return offsetPoints;
}

/**
 * @extends {PlaceablesLayer}
 */
export class DungeonLayer extends foundry.canvas.layers.PlaceablesLayer {
  static LAYER_NAME = "dungeon";

  /** @inheritdoc */
  static documentName = "Drawing";

  constructor() {
    super();
    this.dungeon = null;
    // Stairs drawing state: 0 = not drawing, 1 = first edge defined, waiting for depth
    this.stairsPhase = 0;
    this.stairsFirstEdge = null;
    this.stairsPreview = null;
    // Bound handler for phase 1 mouse tracking
    this._stairsPhase1MouseMove = this._onStairsPhase1MouseMove.bind(this);
  }

  get documentCollection() {
    // avoid returning all Drawings in the scene, as we
    // don't want DungeonLayer to draw them during draw().
    // TODO: we need to stop re-using Drawing for the documentName.
    return null;
  }

  /** @inheritdoc */
  static get layerOptions() {
    return foundry.utils.mergeObject(super.layerOptions, {
      name: DungeonLayer.LAYER_NAME,
      controllableObjects: true,
      rotatableObjects: true,
      zIndex: -1, // under tiles and background image
    });
  }

  /**
   * Get initial data for a new drawing.
   * Start with some global defaults, apply user default config, then apply mandatory overrides per tool.
   * @param {Object} origin     The initial coordinate
   * @return {Object}           The new drawing data
   */
  _getNewDrawingData(origin) {
    // TODO: use our own defaults
    const defaults = game.settings.get(
      "core",
      foundry.canvas.layers.DrawingsLayer.DEFAULT_CONFIG_SETTING
    );
    const data = foundry.utils.deepClone(defaults);

    // Mandatory additions
    delete data._id;
    data.x = origin.x;
    data.y = origin.y;
    data.sort = Math.max(this.getMaxSort() + 1, 0);
    data.author = game.user.id;
    data.shape = {};
    data.interface = false;
    const strokeWidth = data.strokeWidth ?? 8;

    if (game.activeDungeonDrawMode === "add") {
      switch (game.activeDungeonDrawTool) {
        case "rectangle":
          data.shape.type =
            foundry.canvas.placeables.Drawing.SHAPE_TYPES.RECTANGLE;
          data.shape.width = strokeWidth + 1;
          data.shape.height = strokeWidth + 1;
          break;
        case "ellipse":
          data.shape.type =
            foundry.canvas.placeables.Drawing.SHAPE_TYPES.ELLIPSE;
          data.shape.width = strokeWidth + 1;
          data.shape.height = strokeWidth + 1;
          break;
        case "polygon":
        case "door":
        case "secretdoor":
          data.shape.type =
            foundry.canvas.placeables.Drawing.SHAPE_TYPES.POLYGON;
          data.shape.points = [0, 0, 1, 0];
          data.bezierFactor = 0;
          break;
        case "interiorwall":
        case "invisiblewall": {
          const shapeMode = game.dungeonDrawShapes?.[game.activeDungeonDrawTool] || "line";
          if (shapeMode === "square") {
            data.shape.type = foundry.canvas.placeables.Drawing.SHAPE_TYPES.RECTANGLE;
            data.shape.width = strokeWidth + 1;
            data.shape.height = strokeWidth + 1;
          } else if (shapeMode === "ellipse") {
            data.shape.type = foundry.canvas.placeables.Drawing.SHAPE_TYPES.ELLIPSE;
            data.shape.width = strokeWidth + 1;
            data.shape.height = strokeWidth + 1;
          } else if (shapeMode === "polygon") {
            data.shape.type = foundry.canvas.placeables.Drawing.SHAPE_TYPES.POLYGON;
            data.shape.points = [0, 0, 1, 0];
            data.bezierFactor = 0;
          } else {
            // Default: line mode
            data.shape.type = foundry.canvas.placeables.Drawing.SHAPE_TYPES.POLYGON;
            data.shape.points = [0, 0, 1, 0];
            data.bezierFactor = 0;
          }
          break;
        }
        case "themepainter": {
          const shapeMode = game.dungeonDrawShapes?.themepainter || "polygon";
          if (shapeMode === "square") {
            data.shape.type = foundry.canvas.placeables.Drawing.SHAPE_TYPES.RECTANGLE;
            data.shape.width = strokeWidth + 1;
            data.shape.height = strokeWidth + 1;
          } else if (shapeMode === "ellipse") {
            data.shape.type = foundry.canvas.placeables.Drawing.SHAPE_TYPES.ELLIPSE;
            data.shape.width = strokeWidth + 1;
            data.shape.height = strokeWidth + 1;
          } else {
            // Default: polygon mode
            data.shape.type = foundry.canvas.placeables.Drawing.SHAPE_TYPES.POLYGON;
            data.shape.points = [0, 0, 1, 0];
            data.bezierFactor = 0;
          }
          break;
        }
        case "stairs":
          data.shape.type =
            foundry.canvas.placeables.Drawing.SHAPE_TYPES.POLYGON;
          data.shape.points = [0, 0, 1, 0];
          data.bezierFactor = 0;
          data.strokeColor = "#444444";
          break;
        case "freehand":
          data.shape.type =
            foundry.canvas.placeables.Drawing.SHAPE_TYPES.POLYGON;
          data.shape.points = [0, 0, 1, 0];
          data.bezierFactor = data.bezierFactor ?? 0.5;
          break;
        case "gridpainter":
          // TODO: debug why flags aren't properly propagating to doc in v13
          // data.flags = { gridPainterHelper: new GridPainterHelper() };
          data.shape.type =
            foundry.canvas.placeables.Drawing.SHAPE_TYPES.RECTANGLE;
          data.shape.width = strokeWidth + 1;
          data.shape.height = strokeWidth + 1;
          data.strokeAlpha = 0.0;
          data.fillAlpha = 0.0;
      }
    } else if (game.activeDungeonDrawMode === "remove") {
      switch (game.activeDungeonDrawTool) {
        case "rectangle":
        case "interiorwall":
        case "door":
        case "secretdoor":
        case "invisiblewall":
        case "themepainter":
        case "stairs":
          data.shape.type =
            foundry.canvas.placeables.Drawing.SHAPE_TYPES.RECTANGLE;
          data.shape.width = strokeWidth + 1;
          data.shape.height = strokeWidth + 1;
          break;
        case "ellipse":
          data.shape.type =
            foundry.canvas.placeables.Drawing.SHAPE_TYPES.ELLIPSE;
          data.shape.width = strokeWidth + 1;
          data.shape.height = strokeWidth + 1;
          break;
        case "polygon":
          data.shape.type =
            foundry.canvas.placeables.Drawing.SHAPE_TYPES.POLYGON;
          data.shape.points = [0, 0, 1, 0];
          data.bezierFactor = 0;
          break;
        case "freehand":
          data.shape.type =
            foundry.canvas.placeables.Drawing.SHAPE_TYPES.POLYGON;
          data.shape.points = [0, 0, 1, 0];
          data.bezierFactor = data.bezierFactor ?? 0.5;
          break;
        case "gridpainter":
          // TODO: debug why flags aren't properly propagating to doc in v13
          // data.flags = { gridPainterHelper: new GridPainterHelper() };
          data.shape.type =
            foundry.canvas.placeables.Drawing.SHAPE_TYPES.RECTANGLE;
          data.shape.width = strokeWidth + 1;
          data.shape.height = strokeWidth + 1;
          data.strokeAlpha = 0.0;
          data.fillAlpha = 0.0;
      }
    }

    // Return the cleaned data
    return DrawingDocument.cleanData(data);
  }

  /** @override */
  async deleteAll() {
    if (!game.user.isGM) {
      throw new Error(`You do not have permission to clear all.`);
    }
    return Dialog.confirm({
      title: game.i18n.localize("DD.ButtonTitleClearAll"),
      content: `<p>${game.i18n.localize("DD.ClearAllDialogContent")}</p>`,
      yes: () => this.dungeon?.deleteAll(),
    });
  }

  async generate(config) {
    if (this.dungeon) {
      await this.dungeon.deleteAll();
    } else {
      await this.createNewDungeon();
    }
    await regenerate(this.dungeon, config);
  }

  async loadDungeon() {
    const { journalEntry, note } = findDungeonEntryAndNote();
    if (journalEntry) {
      this.dungeon = new Dungeon(journalEntry, note);
      await this.dungeon.loadFromJournalEntry();
      // add dungeon underneath any placeables or drawing preview
      // TODO: debug why this.preview container is getting rendered UNDER dungeon
      this.addChildAt(this.dungeon, 0);
    } else {
      // no journal entry and note found, so make sure dungeon is nulled on this layer
      this.dungeon = null;
    }
  }

  async createNewDungeon() {
    await createDungeonEntryAndNote();
    await this.loadDungeon();
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @override */
  async _onClickLeft(event) {
    const { preview, drawingsState, destination } = event.interactionData;

    // Handle stairs phase 1 finalization (third click)
    if (
      isStairs() &&
      this.stairsPhase === 1 &&
      game.activeDungeonDrawMode === "add"
    ) {
      const mousePos = destination || event.interactionData.origin;
      const stairGeom = calculateStairGeometry(this.stairsFirstEdge, mousePos);

      if (stairGeom) {
        // Create dungeon if needed
        if (!this.dungeon) {
          await this.createNewDungeon();
        }
        await this.dungeon.addStairs(stairGeom);
      }

      this._resetStairsState();
      return;
    }

    // Continue polygon point placement
    if (drawingsState >= 1 && preview && preview.isPolygon) {
      preview._addPoint(destination, { snap: !event.shiftKey, round: true });
      preview._chain = true; // Note that we are now in chain mode
      return preview.refresh();
    }
    super._onClickLeft(event);
  }

  /** @override */
  _onPointerMove(event) {
    // Handle stairs phase 1 preview update on mouse move
    if (
      isStairs() &&
      this.stairsPhase === 1 &&
      game.activeDungeonDrawMode === "add"
    ) {
      const pos = event.getLocalPosition(this);
      this._updateStairsPreview(pos);
    }
    super._onPointerMove(event);
  }

  /** @override */
  _onClickRight(event) {
    // Cancel stairs drawing on right-click
    if (this.stairsPhase === 1) {
      this._resetStairsState();
      return;
    }
    super._onClickRight(event);
  }

  /** @override */
  _onDragLeftCancel(event) {
    // Clean up stairs preview during phase 0 cancel
    if (isStairs() && this.stairsPhase === 0 && this.stairsPreview) {
      this.stairsPreview.clear();
    }
    super._onDragLeftCancel(event);
  }

  /** @override */
  _onClickLeft2(event) {
    const { drawingsState, preview } = event.interactionData;

    // Conclude polygon placement with double-click
    if (drawingsState >= 1 && preview.isPolygon) {
      event.interactionData.drawingsState = 2;
      return;
    }

    super._onClickLeft2(event);
  }

  /** @override */
  async _onDragLeftStart(event) {
    await super._onDragLeftStart(event);
    const interaction = event.interactionData;

    if (Settings.snapToGrid() && !event.shiftKey) {
      interaction.origin = this.getSnappedPoint(interaction.origin);
    }

    // We use a Drawing as our preview, but then on end-drag/completion,
    // update our single Dungeon instance.

    // Create the preview object
    // const cls = getDocumenddtClass$1("Drawing");
    const cls = CONFIG["Drawing"]?.documentClass;
    let document;
    try {
      document = new cls(this._getNewDrawingData(interaction.origin), {
        parent: canvas.scene,
      });
    } catch (e) {
      if (e instanceof foundry.data.validation.DataModelValidationError) {
        ui.notifications.error("DRAWING.JointValidationErrorUI", {
          localize: true,
        });
      }
      throw e;
    }
    const drawing = new this.constructor.placeableClass(document);
    drawing._fixedPoints = [0, 0];
    document._object = drawing;
    interaction.preview = this.preview.addChild(drawing);
    interaction.drawingsState = 1;
    drawing.draw();
  }

  /** @override */
  _onDragLeftMove(event) {
    const { preview, drawingsState } = event.interactionData;
    if (!preview || preview._destroyed) return;
    if (preview.parent === null) {
      // In theory this should never happen, but rarely does
      this.preview.addChild(preview);
    }

    // Handle stairs phase 1 (defining depth after first edge is set)
    if (
      isStairs() &&
      this.stairsPhase === 1 &&
      game.activeDungeonDrawMode === "add"
    ) {
      const { destination } = event.interactionData;
      this._updateStairsPreview(destination);
      return;
    }

    // Handle stairs phase 0 - show live preview while dragging first edge
    if (
      isStairs() &&
      this.stairsPhase === 0 &&
      game.activeDungeonDrawMode === "add" &&
      drawingsState >= 1
    ) {
      preview._onMouseDraw(event);
      event.interactionData.drawingsState = 2;
      const { origin, destination } = event.interactionData;
      const firstEdge = {
        x1: origin.x,
        y1: origin.y,
        x2: destination.x,
        y2: destination.y,
      };
      this._updateStairsPreviewPhase0(firstEdge);
      return;
    }

    if (drawingsState >= 1) {
      // Deal with freehand-tool and gridpainter-tool specific handling in DrawingShape
      if (isFreehand()) {
        onFreeHandMouseDraw(preview, event);
      } else if (isGridPainter()) {
        onGridPainterMouseDraw(preview, event);
      } else {
        preview._onMouseDraw(event);
      }
      // easy single opcode
      const opcode = game.activeDungeonDrawMode + game.activeDungeonDrawTool;
      // Check if we should auto-complete (non-polygon tools or line-mode walls)
      const wallShapeMode = game.dungeonDrawShapes?.[game.activeDungeonDrawTool];
      const isLineMode = (opcode === "addinteriorwall" || opcode === "addinvisiblewall") &&
                         (wallShapeMode === "line" || !wallShapeMode);
      const isNonPolygonWallMode = (opcode === "addinteriorwall" || opcode === "addinvisiblewall") &&
                                   (wallShapeMode === "square" || wallShapeMode === "ellipse");
      const themePainterShapeMode = game.dungeonDrawShapes?.themepainter;
      const isNonPolygonThemePainter = opcode === "addthemepainter" &&
                                       (themePainterShapeMode === "square" || themePainterShapeMode === "ellipse");
      if (
        !preview.isPolygon ||
        isFreehand() ||
        opcode === "adddoor" ||
        isLineMode ||
        opcode === "addsecretdoor" ||
        isNonPolygonWallMode ||
        isNonPolygonThemePainter ||
        opcode === "addgridpainter" ||
        opcode === "addstairs"
      ) {
        event.interactionData.drawingsState = 2;
      }
    }
  }

  /**
   * Draw stairs preview with the given geometry and alpha values.
   * @param {Object} stairGeom - Trapezoid geometry { x1, y1, x2, y2, x3, y3, x4, y4 }
   * @param {number} lineAlpha - Alpha for stair lines
   * @param {number} outlineAlpha - Alpha for trapezoid outline
   */
  _drawStairsPreview(stairGeom, lineAlpha, outlineAlpha) {
    if (!this.stairsPreview) {
      this.stairsPreview = new PIXI.Graphics();
      this.addChild(this.stairsPreview);
    }
    this.stairsPreview.clear();

    const { x1, y1, x2, y2, x3, y3, x4, y4 } = stairGeom;

    // Calculate line count based on perpendicular distance
    const perpDist = Math.sqrt((x3 - x1) ** 2 + (y3 - y1) ** 2);
    const lineSpacing = canvas.grid.size / 3;
    const lineCount = Math.max(2, Math.floor(perpDist / lineSpacing) + 1);

    // Draw stair lines
    this.stairsPreview.lineStyle({
      width: 2,
      color: 0x000000,
      alpha: lineAlpha,
    });
    for (let i = 0; i < lineCount; i++) {
      const t = lineCount > 1 ? i / (lineCount - 1) : 0;
      const startX = x1 + (x3 - x1) * t;
      const startY = y1 + (y3 - y1) * t;
      const endX = x2 + (x4 - x2) * t;
      const endY = y2 + (y4 - y2) * t;
      this.stairsPreview.moveTo(startX, startY);
      this.stairsPreview.lineTo(endX, endY);
    }

    // Draw trapezoid outline
    this.stairsPreview.lineStyle({
      width: 1,
      color: 0x0000ff,
      alpha: outlineAlpha,
    });
    this.stairsPreview.moveTo(x1, y1);
    this.stairsPreview.lineTo(x2, y2);
    this.stairsPreview.lineTo(x4, y4);
    this.stairsPreview.lineTo(x3, y3);
    this.stairsPreview.lineTo(x1, y1);
  }

  /**
   * Update stairs preview during phase 1 (depth selection).
   */
  _updateStairsPreview(mousePos) {
    if (!this.stairsFirstEdge) return;
    const stairGeom = calculateStairGeometry(this.stairsFirstEdge, mousePos);
    if (!stairGeom) return;
    this._drawStairsPreview(stairGeom, 0.8, 0.5);
  }

  /**
   * Update stairs preview during phase 0 (dragging first edge).
   * Shows preview with default depth so user can see stairs forming.
   */
  _updateStairsPreviewPhase0(firstEdge) {
    const { x1, y1, x2, y2 } = firstEdge;
    const edgeLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    if (edgeLength < 1) {
      if (this.stairsPreview) this.stairsPreview.clear();
      return;
    }

    // Create mock mouse position for parallel stairs at default depth
    const defaultDepth = canvas.grid.size;
    const perpVec = { x: -(y2 - y1) / edgeLength, y: (x2 - x1) / edgeLength };
    const mockMousePos = {
      x: x2 + perpVec.x * defaultDepth,
      y: y2 + perpVec.y * defaultDepth,
    };

    const stairGeom = calculateStairGeometry(firstEdge, mockMousePos);
    if (!stairGeom) return;
    this._drawStairsPreview(stairGeom, 0.5, 0.3);
  }

  /**
   * Handle mouse move during stairs phase 1 (canvas-level listener).
   */
  _onStairsPhase1MouseMove(event) {
    if (this.stairsPhase !== 1) return;
    const pos = event.getLocalPosition(this);
    this._updateStairsPreview(pos);
  }

  /**
   * Start listening for phase 1 mouse movement.
   */
  _startStairsPhase1() {
    this.stairsPhase = 1;
    canvas.stage.on("pointermove", this._stairsPhase1MouseMove);
  }

  /**
   * Clean up stairs drawing state
   */
  _resetStairsState() {
    // Remove phase 1 mouse listener if active
    canvas.stage.off("pointermove", this._stairsPhase1MouseMove);
    this.stairsPhase = 0;
    this.stairsFirstEdge = null;
    if (this.stairsPreview) {
      this.stairsPreview.destroy();
      this.stairsPreview = null;
    }
  }

  _maybeSnappedRect(createData, shiftPressed) {
    if (Settings.snapToGrid() && !shiftPressed) {
      const position = {
        x: createData.x + createData.shape.width,
        y: createData.y + createData.shape.height,
      };
      const snappedPoint = this.getSnappedPoint(position);
      createData.shape.height = snappedPoint.y - createData.y;
      createData.shape.width = snappedPoint.x - createData.x;
    }
    const rect = {
      x: createData.x,
      y: createData.y,
      height: createData.shape.height,
      width: createData.shape.width,
    };
    return rect;
  }

  _maybeSnapLastPoint(createData, shiftPressed) {
    const length = createData.shape.points.length;
    if (length === 0) {
      return;
    }
    if (Settings.snapToGrid() && !shiftPressed) {
      const position = {
        x: createData.shape.points[length - 2],
        y: createData.shape.points[length - 1],
      };
      const snappedPoint = this.getSnappedPoint(position);
      createData.shape.points[length - 2] = snappedPoint.x;
      createData.shape.points[length - 1] = snappedPoint.y;
    }
  }

  _autoClosePolygon(createData) {
    const length = createData.shape.points.length;
    if (
      length > 4 &&
      (createData.shape.points[0] !== createData.shape.points[length - 2] ||
        createData.shape.points[1] !== createData.shape.points[length - 1])
    ) {
      // auto-close the polygon
      createData.shape.points.push(
        createData.shape.points[0],
        createData.shape.points[1]
      );
    }
  }

  /** @override */
  async _onDragLeftDrop(event) {
    const interaction = event.interactionData;

    // Snap the destination to the grid
    if (Settings.snapToGrid() && !event.shiftKey) {
      interaction.destination = this.getSnappedPoint(interaction.destination);
    }

    // preview is of type Drawing.
    // Drawing.DrawingDocument.shape is shape data
    const { destination, origin, preview } = event.interactionData;
    let drawingsState = event.interactionData.drawingsState;

    // recognize completed polygons (including polygon mode for walls/themepainter)
    const tool = game.activeDungeonDrawTool;
    const shapeMode = game.dungeonDrawShapes?.[tool];
    const isPolygonModeTool = tool === "polygon" ||
      (tool === "themepainter" && shapeMode === "polygon") ||
      ((tool === "interiorwall" || tool === "invisiblewall") && shapeMode === "polygon");
    if (isPolygonModeTool && preview.isPolygon) {
      const length = preview.document.shape.points.length;
      const closedPolygon =
        length > 4 &&
        preview.document.shape.points[0] ==
          preview.document.shape.points[length - 2] &&
        preview.document.shape.points[1] ==
          preview.document.shape.points[length - 1];
      if (closedPolygon) {
        // advance the drawing state to finish it
        drawingsState = 2;
      }
    }

    // easy single opcode
    const opcode = game.activeDungeonDrawMode + game.activeDungeonDrawTool;

    // Successful drawing completion
    // TODO: why is freehand not properly advancing drawingsState?
    // TODO: verify this is still the case in v11
    if (drawingsState === 2 || game.activeDungeonDrawTool === "freehand") {
      // create a new dungeon if we don't already have one
      if (!this.dungeon) {
        await this.createNewDungeon();
      }
      const distance = Math.hypot(
        destination.x - origin.x,
        destination.y - origin.y
      );
      const minDistance = distance >= canvas.dimensions.size / 8;
      const completePolygon =
        preview.isPolygon && preview.document.shape.points.length > 4;

      // Clean up and DRY up these if/else blocks
      if (opcode === "adddoor") {
        event.interactionData.drawingsState = 0;
        // clone the shape data
        const data = preview.document.toObject(false);
        preview._chain = false;
        this._maybeSnapLastPoint(data, event.shiftKey);
        await this.dungeon.addDoor(
          data.x,
          data.y,
          data.x + data.shape.points[2],
          data.y + data.shape.points[3]
        );
      } else if (opcode === "addsecretdoor") {
        event.interactionData.drawingsState = 0;
        const data = preview.document.toObject(false);
        preview._chain = false;
        this._maybeSnapLastPoint(data, event.shiftKey);
        await this.dungeon.addSecretDoor(
          data.x,
          data.y,
          data.x + data.shape.points[2],
          data.y + data.shape.points[3]
        );
      } else if (opcode === "addinteriorwall") {
        event.interactionData.drawingsState = 0;
        const data = preview.document.toObject(false);
        preview._chain = false;
        const wallShapeMode = game.dungeonDrawShapes?.interiorwall || "line";

        if (wallShapeMode === "line") {
          this._maybeSnapLastPoint(data, event.shiftKey);
          await this.dungeon.addInteriorWall(
            data.x,
            data.y,
            data.x + data.shape.points[2],
            data.y + data.shape.points[3]
          );
        } else if (wallShapeMode === "square") {
          const rect = this._maybeSnappedRect(data, event.shiftKey);
          const segments = rectangleToWallSegments(rect.x, rect.y, rect.width, rect.height);
          for (const seg of segments) {
            await this.dungeon.addInteriorWall(seg[0], seg[1], seg[2], seg[3]);
          }
        } else if (wallShapeMode === "ellipse") {
          const rect = this._maybeSnappedRect(data, event.shiftKey);
          const segments = ellipseToWallSegments(rect.x, rect.y, rect.width, rect.height);
          for (const seg of segments) {
            await this.dungeon.addInteriorWall(seg[0], seg[1], seg[2], seg[3]);
          }
        } else if (wallShapeMode === "polygon") {
          const createData = this.constructor.placeableClass.normalizeShape(data);
          this._maybeSnapLastPoint(createData, event.shiftKey);
          this._autoClosePolygon(createData);
          const offsetPoints = createDataOffsetPoints(createData);
          const segments = polygonToWallSegments(offsetPoints);
          for (const seg of segments) {
            await this.dungeon.addInteriorWall(seg[0], seg[1], seg[2], seg[3]);
          }
        }
      } else if (opcode === "addinvisiblewall") {
        event.interactionData.drawingsState = 0;
        const data = preview.document.toObject(false);
        preview._chain = false;
        const wallShapeMode = game.dungeonDrawShapes?.invisiblewall || "line";

        if (wallShapeMode === "line") {
          this._maybeSnapLastPoint(data, event.shiftKey);
          await this.dungeon.addInvisibleWall(
            data.x,
            data.y,
            data.x + data.shape.points[2],
            data.y + data.shape.points[3]
          );
        } else if (wallShapeMode === "square") {
          const rect = this._maybeSnappedRect(data, event.shiftKey);
          const segments = rectangleToWallSegments(rect.x, rect.y, rect.width, rect.height);
          for (const seg of segments) {
            await this.dungeon.addInvisibleWall(seg[0], seg[1], seg[2], seg[3]);
          }
        } else if (wallShapeMode === "ellipse") {
          const rect = this._maybeSnappedRect(data, event.shiftKey);
          const segments = ellipseToWallSegments(rect.x, rect.y, rect.width, rect.height);
          for (const seg of segments) {
            await this.dungeon.addInvisibleWall(seg[0], seg[1], seg[2], seg[3]);
          }
        } else if (wallShapeMode === "polygon") {
          const createData = this.constructor.placeableClass.normalizeShape(data);
          this._maybeSnapLastPoint(createData, event.shiftKey);
          this._autoClosePolygon(createData);
          const offsetPoints = createDataOffsetPoints(createData);
          const segments = polygonToWallSegments(offsetPoints);
          for (const seg of segments) {
            await this.dungeon.addInvisibleWall(seg[0], seg[1], seg[2], seg[3]);
          }
        }
      } else if (opcode === "addstairs") {
        // Stairs has a two-phase drawing process
        if (this.stairsPhase === 0) {
          // Phase 0 -> 1: First edge defined, now wait for depth
          const data = preview.document.toObject(false);
          this._maybeSnapLastPoint(data, event.shiftKey);
          this.stairsFirstEdge = {
            x1: data.x,
            y1: data.y,
            x2: data.x + data.shape.points[2],
            y2: data.y + data.shape.points[3],
          };
          // Start phase 1 with canvas-level mouse tracking
          this._startStairsPhase1();
          // Cancel the line preview but keep stairs active
          this._onDragLeftCancel(event);
          // Immediately show phase 1 preview at current mouse position
          const mousePos =
            event.interactionData.destination || event.interactionData.origin;
          this._updateStairsPreview(mousePos);
          return;
        }
        // Phase 1 is handled in _onClickLeft
      } else if (opcode === "addthemepainter") {
        // Handle themepainter square/ellipse modes separately (polygon mode falls through to below)
        const themePainterShapeMode = game.dungeonDrawShapes?.themepainter || "polygon";
        if (themePainterShapeMode === "square" || themePainterShapeMode === "ellipse") {
          event.interactionData.drawingsState = 0;
          const data = preview.document.toObject(false);
          preview._chain = false;
          const rect = this._maybeSnappedRect(data, event.shiftKey);
          if (themePainterShapeMode === "square") {
            const offsetPoints = rectangleToPolygonPoints(rect.x, rect.y, rect.width, rect.height);
            await this.dungeon.addThemeArea(offsetPoints);
          } else {
            const offsetPoints = ellipseToPolygonPoints(rect.x, rect.y, rect.width, rect.height);
            await this.dungeon.addThemeArea(offsetPoints);
          }
        } else if (minDistance || completePolygon) {
          // Polygon mode - needs minDistance or completePolygon
          event.interactionData.drawingsState = 0;
          const data = preview.document.toObject(false);
          preview._chain = false;
          const createData = this.constructor.placeableClass.normalizeShape(data);
          this._maybeSnapLastPoint(createData, event.shiftKey);
          this._autoClosePolygon(createData);
          const offsetPoints = createDataOffsetPoints(createData);
          await this.dungeon.addThemeArea(offsetPoints);
        }
      } else if (minDistance || completePolygon) {
        event.interactionData.drawingsState = 0;
        const data = preview.document.toObject(false);
        preview._chain = false;
        // TODO: do we care about normalizing the shape? maybe for freehand curves/lines?
        const createData = this.constructor.placeableClass.normalizeShape(data);
        if (opcode === "addellipse") {
          const x = createData.x + createData.shape.width / 2;
          const y = createData.y + createData.shape.height / 2;
          await this.dungeon.addEllipse(
            x,
            y,
            createData.shape.width,
            createData.shape.height
          );
        } else if (opcode === "addfreehand") {
          this._maybeSnapLastPoint(createData, event.shiftKey);
          this._autoClosePolygon(createData);
          const offsetPoints = createDataOffsetPoints(createData);
          await this.dungeon.addPolygon(offsetPoints);
        } else if (opcode === "addpolygon") {
          this._maybeSnapLastPoint(createData, event.shiftKey);
          this._autoClosePolygon(createData);
          const offsetPoints = createDataOffsetPoints(createData);
          await this.dungeon.addPolygon(offsetPoints);
        } else if (opcode === "addrectangle") {
          const rect = this._maybeSnappedRect(createData, event.shiftKey);
          await this.dungeon.addRectangle(rect);
        } else if (opcode === "addgridpainter") {
          await this.dungeon.addGridPaintedArea(
            createData.flags.gridPainterHelper.paintedGeometry
          );
        } else if (opcode === "removedoor") {
          const rect = this._maybeSnappedRect(createData, event.shiftKey);
          // TODO: need to spam out methods to various different flavor deletions
          await this.dungeon.removeDoors(rect);
        } else if (opcode === "removeellipse") {
          const x = createData.x + createData.shape.width / 2;
          const y = createData.y + createData.shape.height / 2;
          await this.dungeon.removeEllipse(
            x,
            y,
            createData.shape.width,
            createData.shape.height
          );
        } else if (opcode === "removefreehand") {
          this._maybeSnapLastPoint(createData, event.shiftKey);
          this._autoClosePolygon(createData);
          const offsetPoints = createDataOffsetPoints(createData);
          await this.dungeon.removePolygon(offsetPoints);
        } else if (opcode === "removesecretdoor") {
          const rect = this._maybeSnappedRect(createData, event.shiftKey);
          await this.dungeon.removeSecretDoors(rect);
        } else if (opcode === "removeinteriorwall") {
          const rect = this._maybeSnappedRect(createData, event.shiftKey);
          await this.dungeon.removeInteriorWalls(rect);
        } else if (opcode === "removeinvisiblewall") {
          const rect = this._maybeSnappedRect(createData, event.shiftKey);
          await this.dungeon.removeInvisibleWalls(rect);
        } else if (opcode === "removepolygon") {
          this._maybeSnapLastPoint(createData, event.shiftKey);
          this._autoClosePolygon(createData);
          const offsetPoints = createDataOffsetPoints(createData);
          await this.dungeon.removePolygon(offsetPoints);
        } else if (opcode === "removerectangle") {
          const rect = this._maybeSnappedRect(createData, event.shiftKey);
          await this.dungeon.removeRectangle(rect);
        } else if (opcode === "removethemepainter") {
          const rect = this._maybeSnappedRect(createData, event.shiftKey);
          await this.dungeon.removeThemeAreas(rect);
        } else if (opcode === "removestairs") {
          const rect = this._maybeSnappedRect(createData, event.shiftKey);
          await this.dungeon.removeStairs(rect);
        } else if (opcode === "removegridpainter") {
          await this.dungeon.removeGridPaintedArea(
            createData.flags.gridPainterHelper.paintedGeometry
          );
        }
      }

      // Cancel the GridPainter Preview
      if (isGridPainter()) {
        const drawings = await Promise.all(
          preview.document.flags.gridPainterHelper.gridDrawings
        );

        const ids = drawings.map((drawing) => drawing.id);

        game.scenes.current.deleteEmbeddedDocuments("Drawing", ids);
      }
      // Cancel the preview
      return this._onDragLeftCancel(event);
    }

    // In-progress polygon
    if (drawingsState === 1 && preview.isPolygon) {
      event.preventDefault();
      if (preview._chain) {
        return;
      }
      return this._onClickLeft(event);
    }

    // Incomplete drawing
    return this._onDragLeftCancel(event);
  }
}
