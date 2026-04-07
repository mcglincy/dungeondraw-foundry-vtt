import { Dungeon } from "../dungeon.js";
import { regenerate } from "../generator.js";
import { GridPainterHelper } from "../GridPainterHelper.js";
import { Settings } from "../settings.js";
import { SNAP_MODES } from "../constants.js";
import {
  findDungeonEntryAndNote,
  createDungeonEntryAndNote,
} from "./dungeon-journal.js";
import { calculateStairGeometry } from "./shape-conversion.js";
import {
  handleDoorCompletion,
  handleSecretDoorCompletion,
  handleWindowCompletion,
  handleInteriorWallCompletion,
  handleInvisibleWallCompletion,
  handleStairsCompletion,
  handleThemePainterCompletion,
  handleRoomCompletion,
  handleRemoveCompletion,
} from "./drawing-completion.js";

// Tool state helpers
function isFreehand() {
  return game.activeDungeonDrawTool === "freehand";
}

function isGridPainter() {
  return game.activeDungeonDrawTool === "gridpainter";
}

function isThemePainterGrid() {
  return (
    game.activeDungeonDrawTool === "themepainter" &&
    game.dungeonDrawShapes?.themepainter === "grid"
  );
}

function isStairs() {
  return game.activeDungeonDrawTool === "stairs";
}

// Specialized mouse draw handlers
function onGridPainterMouseDraw(preview, event) {
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
  const now = Date.now();
  const temporary =
    now - preview._drawTime < preview.constructor.FREEHAND_SAMPLE_RATE;
  const snap = false;
  preview._addPoint(position, { snap, temporary });
  preview.refresh();
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
        case "window":
          data.shape.type =
            foundry.canvas.placeables.Drawing.SHAPE_TYPES.POLYGON;
          data.shape.points = [0, 0, 1, 0];
          data.bezierFactor = 0;
          break;
        case "interiorwall":
        case "invisiblewall": {
          const shapeMode =
            game.dungeonDrawShapes?.[game.activeDungeonDrawTool] || "line";
          if (shapeMode === "square") {
            data.shape.type =
              foundry.canvas.placeables.Drawing.SHAPE_TYPES.RECTANGLE;
            data.shape.width = strokeWidth + 1;
            data.shape.height = strokeWidth + 1;
          } else if (shapeMode === "ellipse") {
            data.shape.type =
              foundry.canvas.placeables.Drawing.SHAPE_TYPES.ELLIPSE;
            data.shape.width = strokeWidth + 1;
            data.shape.height = strokeWidth + 1;
          } else if (shapeMode === "polygon") {
            data.shape.type =
              foundry.canvas.placeables.Drawing.SHAPE_TYPES.POLYGON;
            data.shape.points = [0, 0, 1, 0];
            data.bezierFactor = 0;
          } else {
            // Default: line mode
            data.shape.type =
              foundry.canvas.placeables.Drawing.SHAPE_TYPES.POLYGON;
            data.shape.points = [0, 0, 1, 0];
            data.bezierFactor = 0;
          }
          break;
        }
        case "themepainter": {
          const shapeMode = game.dungeonDrawShapes?.themepainter || "polygon";
          if (shapeMode === "square") {
            data.shape.type =
              foundry.canvas.placeables.Drawing.SHAPE_TYPES.RECTANGLE;
            data.shape.width = strokeWidth + 1;
            data.shape.height = strokeWidth + 1;
          } else if (shapeMode === "ellipse") {
            data.shape.type =
              foundry.canvas.placeables.Drawing.SHAPE_TYPES.ELLIPSE;
            data.shape.width = strokeWidth + 1;
            data.shape.height = strokeWidth + 1;
          } else if (shapeMode === "grid") {
            // Grid mode uses same setup as gridpainter
            data.shape.type =
              foundry.canvas.placeables.Drawing.SHAPE_TYPES.RECTANGLE;
            data.shape.width = strokeWidth + 1;
            data.shape.height = strokeWidth + 1;
            data.strokeAlpha = 0.0;
            data.fillAlpha = 0.0;
          } else {
            // Default: polygon mode
            data.shape.type =
              foundry.canvas.placeables.Drawing.SHAPE_TYPES.POLYGON;
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
        case "window":
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
      const snapDest =
        Settings.snapToGrid() && game.dungeonDrawSnapActive && !event.shiftKey
          ? this._snapPoint(destination)
          : destination;
      preview._addPoint(snapDest, { snap: false, round: true });
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
  async _onDragLeftCancel(event) {
    // Clean up gridpainter/theme painter preview drawings on cancel
    const preview = event.interactionData?.preview;
    if (
      (isGridPainter() || isThemePainterGrid()) &&
      preview?.document?.flags?.gridPainterHelper?.gridDrawings?.length
    ) {
      const gridDrawings =
        preview.document.flags.gridPainterHelper.gridDrawings;
      // Clear immediately to prevent duplicate deletions from _onDragLeftDrop -> _onDragLeftCancel
      preview.document.flags.gridPainterHelper.gridDrawings = [];
      const drawings = await Promise.all(gridDrawings);
      const ids = drawings.map((d) => d.id).filter(Boolean);
      if (ids.length) {
        await game.scenes.current.deleteEmbeddedDocuments("Drawing", ids);
      }
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

    if (
      Settings.snapToGrid() &&
      game.dungeonDrawSnapActive &&
      !event.shiftKey
    ) {
      interaction.origin = this._snapPoint(interaction.origin);
    }

    // Create the preview object
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

    // Handle stairs phase 0 - just draw the line preview (no stairs indicator yet)
    if (
      isStairs() &&
      this.stairsPhase === 0 &&
      game.activeDungeonDrawMode === "add" &&
      drawingsState >= 1
    ) {
      preview._onMouseDraw(event);
      event.interactionData.drawingsState = 2;
      return;
    }

    if (drawingsState >= 1) {
      // Deal with freehand-tool and gridpainter-tool specific handling in DrawingShape
      if (isFreehand()) {
        onFreeHandMouseDraw(preview, event);
      } else if (isGridPainter() || isThemePainterGrid()) {
        onGridPainterMouseDraw(preview, event);
      } else {
        preview._onMouseDraw(event);
      }
      // easy single opcode
      const opcode = game.activeDungeonDrawMode + game.activeDungeonDrawTool;
      // Check if we should auto-complete (non-polygon tools or line-mode walls)
      const wallShapeMode =
        game.dungeonDrawShapes?.[game.activeDungeonDrawTool];
      const isLineMode =
        (opcode === "addinteriorwall" || opcode === "addinvisiblewall") &&
        (wallShapeMode === "line" || !wallShapeMode);
      const isNonPolygonWallMode =
        (opcode === "addinteriorwall" || opcode === "addinvisiblewall") &&
        (wallShapeMode === "square" || wallShapeMode === "ellipse");
      const themePainterShapeMode = game.dungeonDrawShapes?.themepainter;
      const isNonPolygonThemePainter =
        opcode === "addthemepainter" &&
        (themePainterShapeMode === "square" ||
          themePainterShapeMode === "ellipse" ||
          themePainterShapeMode === "grid");
      if (
        !preview.isPolygon ||
        isFreehand() ||
        opcode === "adddoor" ||
        isLineMode ||
        opcode === "addsecretdoor" ||
        opcode === "addwindow" ||
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

  /** Snap a point according to the current snap mode setting. */
  _snapPoint(point) {
    const M = CONST.GRID_SNAPPING_MODES;
    const snapMode = Settings.snapMode();
    let mode;
    if (snapMode === SNAP_MODES.VERTEX_CENTER) {
      mode = M.VERTEX | M.CENTER;
    } else if (snapMode === SNAP_MODES.VERTEX_MIDPOINT) {
      mode = M.VERTEX | M.SIDE_MIDPOINT;
    } else if (snapMode === SNAP_MODES.ALL) {
      mode = M.VERTEX | M.CENTER | M.SIDE_MIDPOINT;
    } else {
      mode = M.VERTEX;
    }
    return canvas.grid.getSnappedPoint({ x: point.x, y: point.y }, { mode });
  }

  _maybeSnappedRect(createData, shiftPressed) {
    if (Settings.snapToGrid() && game.dungeonDrawSnapActive && !shiftPressed) {
      const position = {
        x: createData.x + createData.shape.width,
        y: createData.y + createData.shape.height,
      };
      const snappedPoint = this._snapPoint(position);
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
    if (Settings.snapToGrid() && game.dungeonDrawSnapActive && !shiftPressed) {
      const position = {
        x: createData.shape.points[length - 2],
        y: createData.shape.points[length - 1],
      };
      const snappedPoint = this._snapPoint(position);
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
    if (
      Settings.snapToGrid() &&
      game.dungeonDrawSnapActive &&
      !event.shiftKey
    ) {
      interaction.destination = this._snapPoint(interaction.destination);
    }

    const { destination, origin, preview } = event.interactionData;
    let drawingsState = event.interactionData.drawingsState;

    // Recognize completed polygons (including polygon mode for walls/themepainter)
    const tool = game.activeDungeonDrawTool;
    const shapeMode = game.dungeonDrawShapes?.[tool];
    const isPolygonModeTool =
      tool === "polygon" ||
      (tool === "themepainter" && shapeMode === "polygon") ||
      ((tool === "interiorwall" || tool === "invisiblewall") &&
        shapeMode === "polygon");
    if (isPolygonModeTool && preview.isPolygon) {
      const length = preview.document.shape.points.length;
      const closedPolygon =
        length > 4 &&
        preview.document.shape.points[0] ==
          preview.document.shape.points[length - 2] &&
        preview.document.shape.points[1] ==
          preview.document.shape.points[length - 1];
      if (closedPolygon) {
        drawingsState = 2;
      }
    }

    const opcode = game.activeDungeonDrawMode + game.activeDungeonDrawTool;

    // Successful drawing completion
    if (drawingsState === 2 || game.activeDungeonDrawTool === "freehand") {
      // Create a new dungeon if we don't already have one
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

      // Build completion context
      const ctx = {
        event,
        preview,
        dungeon: this.dungeon,
        layer: this,
        data: preview.document.toObject(false),
        minDistance,
        completePolygon,
      };

      // Route to appropriate completion handler
      if (opcode === "adddoor") {
        await handleDoorCompletion(ctx);
      } else if (opcode === "addsecretdoor") {
        await handleSecretDoorCompletion(ctx);
      } else if (opcode === "addwindow") {
        await handleWindowCompletion(ctx);
      } else if (opcode === "addinteriorwall") {
        await handleInteriorWallCompletion(ctx);
      } else if (opcode === "addinvisiblewall") {
        await handleInvisibleWallCompletion(ctx);
      } else if (opcode === "addstairs") {
        const shouldReturn = await handleStairsCompletion(ctx);
        if (shouldReturn) return;
      } else if (opcode === "addthemepainter") {
        await handleThemePainterCompletion(ctx);
      } else if (minDistance || completePolygon) {
        // Room shapes and remove operations
        if (opcode.startsWith("add")) {
          await handleRoomCompletion(ctx, opcode);
        } else if (opcode.startsWith("remove")) {
          await handleRemoveCompletion(ctx, opcode);
        }
      }

      // GridPainter preview cleanup is handled by _onDragLeftCancel
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
