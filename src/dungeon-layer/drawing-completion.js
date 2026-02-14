import {
  rectangleToWallSegments,
  polygonToWallSegments,
  rectangleToPolygonPoints,
  ellipseToPolygonPoints,
  createDataOffsetPoints,
} from "./shape-conversion.js";

/**
 * @typedef {Object} CompletionContext
 * @property {Object} event - The drag event
 * @property {Object} preview - The preview drawing
 * @property {Object} dungeon - The dungeon instance
 * @property {Object} layer - The DungeonLayer instance
 * @property {Object} data - Preview document data (toObject)
 * @property {boolean} minDistance - Whether minimum distance threshold was met
 * @property {boolean} completePolygon - Whether polygon is complete
 */

/**
 * Handle door drawing completion.
 * @param {CompletionContext} ctx
 */
export async function handleDoorCompletion(ctx) {
  ctx.event.interactionData.drawingsState = 0;
  ctx.preview._chain = false;
  ctx.layer._maybeSnapLastPoint(ctx.data, ctx.event.shiftKey);
  await ctx.dungeon.addDoor(
    ctx.data.x,
    ctx.data.y,
    ctx.data.x + ctx.data.shape.points[2],
    ctx.data.y + ctx.data.shape.points[3]
  );
}

/**
 * Handle secret door drawing completion.
 * @param {CompletionContext} ctx
 */
export async function handleSecretDoorCompletion(ctx) {
  ctx.event.interactionData.drawingsState = 0;
  ctx.preview._chain = false;
  ctx.layer._maybeSnapLastPoint(ctx.data, ctx.event.shiftKey);
  await ctx.dungeon.addSecretDoor(
    ctx.data.x,
    ctx.data.y,
    ctx.data.x + ctx.data.shape.points[2],
    ctx.data.y + ctx.data.shape.points[3]
  );
}

/**
 * Handle window drawing completion.
 * @param {CompletionContext} ctx
 */
export async function handleWindowCompletion(ctx) {
  ctx.event.interactionData.drawingsState = 0;
  ctx.preview._chain = false;
  ctx.layer._maybeSnapLastPoint(ctx.data, ctx.event.shiftKey);
  await ctx.dungeon.addWindow(
    ctx.data.x,
    ctx.data.y,
    ctx.data.x + ctx.data.shape.points[2],
    ctx.data.y + ctx.data.shape.points[3]
  );
}

/**
 * Handle interior wall drawing completion (line/square/ellipse/polygon modes).
 * @param {CompletionContext} ctx
 */
export async function handleInteriorWallCompletion(ctx) {
  ctx.event.interactionData.drawingsState = 0;
  ctx.preview._chain = false;
  const wallShapeMode = game.dungeonDrawShapes?.interiorwall || "line";

  if (wallShapeMode === "line") {
    ctx.layer._maybeSnapLastPoint(ctx.data, ctx.event.shiftKey);
    await ctx.dungeon.addInteriorWall(
      ctx.data.x,
      ctx.data.y,
      ctx.data.x + ctx.data.shape.points[2],
      ctx.data.y + ctx.data.shape.points[3]
    );
  } else if (wallShapeMode === "square") {
    const rect = ctx.layer._maybeSnappedRect(ctx.data, ctx.event.shiftKey);
    const segments = rectangleToWallSegments(
      rect.x,
      rect.y,
      rect.width,
      rect.height
    );
    await ctx.dungeon.addInteriorWallSegments(segments);
  } else if (wallShapeMode === "ellipse") {
    // Use shape method for smooth rendering with dense points
    const rect = ctx.layer._maybeSnappedRect(ctx.data, ctx.event.shiftKey);
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    await ctx.dungeon.addInteriorWallEllipse(
      centerX,
      centerY,
      rect.width,
      rect.height
    );
  } else if (wallShapeMode === "polygon") {
    const createData = ctx.layer.constructor.placeableClass.normalizeShape(
      ctx.data
    );
    ctx.layer._maybeSnapLastPoint(createData, ctx.event.shiftKey);
    ctx.layer._autoClosePolygon(createData);
    const offsetPoints = createDataOffsetPoints(createData);
    const segments = polygonToWallSegments(offsetPoints);
    await ctx.dungeon.addInteriorWallSegments(segments);
  }
}

/**
 * Handle invisible wall drawing completion (line/square/ellipse/polygon modes).
 * @param {CompletionContext} ctx
 */
export async function handleInvisibleWallCompletion(ctx) {
  ctx.event.interactionData.drawingsState = 0;
  ctx.preview._chain = false;
  const wallShapeMode = game.dungeonDrawShapes?.invisiblewall || "line";

  if (wallShapeMode === "line") {
    ctx.layer._maybeSnapLastPoint(ctx.data, ctx.event.shiftKey);
    await ctx.dungeon.addInvisibleWall(
      ctx.data.x,
      ctx.data.y,
      ctx.data.x + ctx.data.shape.points[2],
      ctx.data.y + ctx.data.shape.points[3]
    );
  } else if (wallShapeMode === "square") {
    const rect = ctx.layer._maybeSnappedRect(ctx.data, ctx.event.shiftKey);
    const segments = rectangleToWallSegments(
      rect.x,
      rect.y,
      rect.width,
      rect.height
    );
    await ctx.dungeon.addInvisibleWallSegments(segments);
  } else if (wallShapeMode === "ellipse") {
    // Use shape method for smooth rendering with dense points
    const rect = ctx.layer._maybeSnappedRect(ctx.data, ctx.event.shiftKey);
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    await ctx.dungeon.addInvisibleWallEllipse(
      centerX,
      centerY,
      rect.width,
      rect.height
    );
  } else if (wallShapeMode === "polygon") {
    const createData = ctx.layer.constructor.placeableClass.normalizeShape(
      ctx.data
    );
    ctx.layer._maybeSnapLastPoint(createData, ctx.event.shiftKey);
    ctx.layer._autoClosePolygon(createData);
    const offsetPoints = createDataOffsetPoints(createData);
    const segments = polygonToWallSegments(offsetPoints);
    await ctx.dungeon.addInvisibleWallSegments(segments);
  }
}

/**
 * Handle stairs drawing completion (phase 0 -> 1 transition).
 * Returns true if stairs phase 1 was started (caller should return early).
 * @param {CompletionContext} ctx
 * @returns {boolean} True if phase 1 started and caller should return
 */
export async function handleStairsCompletion(ctx) {
  // Stairs has a two-phase drawing process
  if (ctx.layer.stairsPhase === 0) {
    // Phase 0 -> 1: First edge defined, now wait for depth
    ctx.layer._maybeSnapLastPoint(ctx.data, ctx.event.shiftKey);
    ctx.layer.stairsFirstEdge = {
      x1: ctx.data.x,
      y1: ctx.data.y,
      x2: ctx.data.x + ctx.data.shape.points[2],
      y2: ctx.data.y + ctx.data.shape.points[3],
    };
    // Start phase 1 with canvas-level mouse tracking
    ctx.layer._startStairsPhase1();
    // Cancel the line preview but keep stairs active
    ctx.layer._onDragLeftCancel(ctx.event);
    // Immediately show phase 1 preview at current mouse position
    const mousePos =
      ctx.event.interactionData.destination || ctx.event.interactionData.origin;
    ctx.layer._updateStairsPreview(mousePos);
    return true; // Signal caller to return early
  }
  // Phase 1 is handled in _onClickLeft
  return false;
}

/**
 * Handle theme painter drawing completion (square/ellipse/grid/polygon modes).
 * @param {CompletionContext} ctx
 * @returns {boolean} True if handled, false if polygon mode needs minDistance/completePolygon check
 */
export async function handleThemePainterCompletion(ctx) {
  const themePainterShapeMode =
    game.dungeonDrawShapes?.themepainter || "polygon";

  if (
    themePainterShapeMode === "square" ||
    themePainterShapeMode === "ellipse"
  ) {
    ctx.event.interactionData.drawingsState = 0;
    ctx.preview._chain = false;
    const rect = ctx.layer._maybeSnappedRect(ctx.data, ctx.event.shiftKey);
    if (themePainterShapeMode === "square") {
      const offsetPoints = rectangleToPolygonPoints(
        rect.x,
        rect.y,
        rect.width,
        rect.height
      );
      await ctx.dungeon.addThemeArea(offsetPoints);
    } else {
      const offsetPoints = ellipseToPolygonPoints(
        rect.x,
        rect.y,
        rect.width,
        rect.height
      );
      await ctx.dungeon.addThemeArea(offsetPoints);
    }
    return true;
  } else if (themePainterShapeMode === "grid") {
    // Grid mode - use painted geometry from grid painter helper
    ctx.event.interactionData.drawingsState = 0;
    ctx.preview._chain = false;
    await ctx.dungeon.addThemeAreaFromGeometry(
      ctx.preview.document.flags.gridPainterHelper.paintedGeometry
    );
    return true;
  } else if (ctx.minDistance || ctx.completePolygon) {
    // Polygon mode - needs minDistance or completePolygon
    ctx.event.interactionData.drawingsState = 0;
    ctx.preview._chain = false;
    const createData = ctx.layer.constructor.placeableClass.normalizeShape(
      ctx.data
    );
    ctx.layer._maybeSnapLastPoint(createData, ctx.event.shiftKey);
    ctx.layer._autoClosePolygon(createData);
    const offsetPoints = createDataOffsetPoints(createData);
    await ctx.dungeon.addThemeArea(offsetPoints);
    return true;
  }
  return false;
}

/**
 * Handle room drawing completion (rectangle/ellipse/polygon/freehand/gridpainter).
 * @param {CompletionContext} ctx
 * @param {string} opcode - The operation code (e.g., "addrectangle")
 */
export async function handleRoomCompletion(ctx, opcode) {
  ctx.event.interactionData.drawingsState = 0;
  ctx.preview._chain = false;
  const createData = ctx.layer.constructor.placeableClass.normalizeShape(
    ctx.data
  );

  if (opcode === "addellipse") {
    const x = createData.x + createData.shape.width / 2;
    const y = createData.y + createData.shape.height / 2;
    await ctx.dungeon.addEllipse(
      x,
      y,
      createData.shape.width,
      createData.shape.height
    );
  } else if (opcode === "addfreehand") {
    ctx.layer._maybeSnapLastPoint(createData, ctx.event.shiftKey);
    ctx.layer._autoClosePolygon(createData);
    const offsetPoints = createDataOffsetPoints(createData);
    await ctx.dungeon.addPolygon(offsetPoints);
  } else if (opcode === "addpolygon") {
    ctx.layer._maybeSnapLastPoint(createData, ctx.event.shiftKey);
    ctx.layer._autoClosePolygon(createData);
    const offsetPoints = createDataOffsetPoints(createData);
    await ctx.dungeon.addPolygon(offsetPoints);
  } else if (opcode === "addrectangle") {
    const rect = ctx.layer._maybeSnappedRect(createData, ctx.event.shiftKey);
    await ctx.dungeon.addRectangle(rect);
  } else if (opcode === "addgridpainter") {
    await ctx.dungeon.addGridPaintedArea(
      createData.flags.gridPainterHelper.paintedGeometry
    );
  }
}

/**
 * Handle remove operations completion.
 * @param {CompletionContext} ctx
 * @param {string} opcode - The operation code (e.g., "removerectangle")
 */
export async function handleRemoveCompletion(ctx, opcode) {
  ctx.event.interactionData.drawingsState = 0;
  ctx.preview._chain = false;
  const createData = ctx.layer.constructor.placeableClass.normalizeShape(
    ctx.data
  );

  if (opcode === "removedoor") {
    const rect = ctx.layer._maybeSnappedRect(createData, ctx.event.shiftKey);
    await ctx.dungeon.removeDoors(rect);
  } else if (opcode === "removeellipse") {
    const x = createData.x + createData.shape.width / 2;
    const y = createData.y + createData.shape.height / 2;
    await ctx.dungeon.removeEllipse(
      x,
      y,
      createData.shape.width,
      createData.shape.height
    );
  } else if (opcode === "removefreehand") {
    ctx.layer._maybeSnapLastPoint(createData, ctx.event.shiftKey);
    ctx.layer._autoClosePolygon(createData);
    const offsetPoints = createDataOffsetPoints(createData);
    await ctx.dungeon.removePolygon(offsetPoints);
  } else if (opcode === "removesecretdoor") {
    const rect = ctx.layer._maybeSnappedRect(createData, ctx.event.shiftKey);
    await ctx.dungeon.removeSecretDoors(rect);
  } else if (opcode === "removewindow") {
    const rect = ctx.layer._maybeSnappedRect(createData, ctx.event.shiftKey);
    await ctx.dungeon.removeWindows(rect);
  } else if (opcode === "removeinteriorwall") {
    const rect = ctx.layer._maybeSnappedRect(createData, ctx.event.shiftKey);
    await ctx.dungeon.removeInteriorWalls(rect);
  } else if (opcode === "removeinvisiblewall") {
    const rect = ctx.layer._maybeSnappedRect(createData, ctx.event.shiftKey);
    await ctx.dungeon.removeInvisibleWalls(rect);
  } else if (opcode === "removepolygon") {
    ctx.layer._maybeSnapLastPoint(createData, ctx.event.shiftKey);
    ctx.layer._autoClosePolygon(createData);
    const offsetPoints = createDataOffsetPoints(createData);
    await ctx.dungeon.removePolygon(offsetPoints);
  } else if (opcode === "removerectangle") {
    const rect = ctx.layer._maybeSnappedRect(createData, ctx.event.shiftKey);
    await ctx.dungeon.removeRectangle(rect);
  } else if (opcode === "removethemepainter") {
    const rect = ctx.layer._maybeSnappedRect(createData, ctx.event.shiftKey);
    await ctx.dungeon.removeThemeAreas(rect);
  } else if (opcode === "removestairs") {
    const rect = ctx.layer._maybeSnappedRect(createData, ctx.event.shiftKey);
    await ctx.dungeon.removeStairs(rect);
  } else if (opcode === "removegridpainter") {
    await ctx.dungeon.removeGridPaintedArea(
      createData.flags.gridPainterHelper.paintedGeometry
    );
  }
}
