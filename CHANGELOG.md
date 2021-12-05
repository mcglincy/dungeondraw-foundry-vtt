# 0.13.0
- Use rollup to package Dungeon Draw as a single minified js file. Saves ~200kb download size.
- Produce sourcemap to go along with js bundle.

# 0.12.1
- Allow the delete interior walls/door tool to also delete secret doors.
- Fix doorColor not saving on Config sheet.

# 0.12.0
- Add Secret Doors tool, along with config settings for how secret doors appear to either GM or players.
- Auto-close drawn polygons for the Add Polygon and Theme Painter tools. This makes drawing closed polygon much easier, and even lets you skip drawing the final line of the polygon (just double click at next-to-last vertex).
- Gracefully handle missing or misnamed texture files.
- Remove debug logging for theme painter tool.

# 0.11.1
- Change theme painter default to module.cavern theme.
- Start playing any video textures for background or floor.
- Fix case in cobblestone texture filename.
- Increase rectangle/polygon drawing line width for easier visibility.
- Fix parsing error when no custom themes have been defined.
- Add debug logging for theme painter tool.

# 0.11.0
- Add theme painter / eraser tool, that allows adding "theme areas" on top of the main map theme.
- Rename config window tabs: Map Config, Themes, Theme painter.
- Add current theme painter theme select to config window.
- Add optional background image to map config.
- Change default theme to 1.0 opacity doors.
- Fix bug with scene background color / grid settings not being applied.
- Fix exterior shadow oddities appearing for complicated geometry.

# 0.10.0
- Add "Save as Custom Theme" to config sheet.
- Move themes into separate sheet tab.
- Add ability to edit, copy, and delete custom themes.
- Split interior walls when adding an interior wall on top of a door (either via Add Interior Wall tool or Add Rectangle tool).
- Tone down interior shadow thickness.
- Tweak wall thickness for checkerboard and cobblestone themes.

# 0.9.0
- Adding a rectangle alongside an existing room/wall will now preserve the interior wall.
- Adding a door within an interior wall will now split the interior wall.
- Draw interior shadows for on all exterior walls, interior walls, and doors.
- Reorganize floor/shadow/wall render and graphics objects for better layering and to fix some shadow overlap issues.
- Set interior wall line cap to prevent obvious breaks/overlaps where walls join.
- Fix code typo causing render errors.
- Fix interior wall / door removal happening as two separate undo steps.

# 0.8.0
- Allow Trusted Players to use Dungeon Draw tools. NOTE: updating lighting walls and scene settings still needs GM permissions. You may also need to give Trusted Player owner permissions to GM-created dungeon Journal Entries to allow editing.
- Add new "Add Interior Walls" tool.
- Change Remove Doors tool to select and remove both doors and interior walls.
- Reorganize render graphics/layering/clipping so that interior shadows and walls look correct.
- Add blur to interior shadows.
- Add Metal Grid theme.
- Fix missing title for Add Polygon button.
- Fix release notes popup showing "#undefined".

# 0.7.1
- Fix "User X lacks permission to create Wall" errors appearing for players.
- Add Neon Blueprint theme.

# 0.7.0
- Themes!!! 16 new color and texture presets, available via a dropdown in the Configure/gear tool.
- Add floorTextureTint config setting.
- Show both textfield and color picker for all colors in the Configure window.

# 0.6.0
- NOTE: You will need to do a one-time manual delete of any scene walls created by earlier versions of Dungeon Draw!
- Add showing of release notes dialog to GM every time a new version is released.
- Mark created walls with a dungeonVersion flag, and only delete walls with that flag.
- Require GM or Assistant GM permissions to see dungeon drawing tools, since this permission level is also needed to delete/create walls.
- Set JournalEntry dungeonVersion flag as part of initial create rather than via a separate setFlag call.

# 0.5.0
- Make exterior and interior shadows configurable.
- Fill in any new config defaults when loading from JournalEntry.
- Fix bug where drawing on a newly-created scene could update the dungeon of the previous scene.

# 0.4.1
- Take scene padding into account for floor texture tiling.

# 0.4.0
- Add support for floor textures.
- Add door fill color and opacity.

# 0.3.1
- Fix reset defaults.
- Code refactoring.

# 0.3.0
- Dungeon is now persisted in a JournalEntry, tied to a scene via a Note.
- Redraw map on data changes for all connected clients.
- Dungeon config (colors, thickness) is now per dungeon/scene and persisted with the dungeon state.
- Add door shadows.
- Fix angled door drawing.
- Fix various bugs wrt wall recreation and client sync.

# 0.2.0
- Add rectangle and door deletion tools.
- Add polygon drawing tool.
- Switch to background graphics + BlurFilter for surrounding shadow.
- Add inner wall shadows for diagonal walls.
- Draw inner wall shadows as continuous lines where possible, to reduce visual overlaps or gaps.
- Partially fix diagonal-door-of-death bug.

# 0.1.0
- First release.