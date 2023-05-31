# 2.0.1

- Mark v11 only for latest release.

# 2.0.0

- Foundry v11 compatibility.

# 1.2.2

- Fix module.json to remove v10 warnings (by @TooPick).
- Fix dependabot security warnings.

# 1.2.1

- Tweak per-theme invisibleWall thicknesses.

# 1.2.0

- Implement new visual style for invisible walls (as windows).
- Draw invisible walls into the door graphics/layer, so they appear on top of regular walls.
- Expose various settings for invisible walls.
- Style invisible walls / windows for premade themes.
- Use secret agent icon for secret doors tool, to match Foundry walls icon.

# 1.1.1

- Rebuild with latest code.

# 1.1.0

- Remove "Background Image" config setting, since Foundry v10 scene background now appears under Dungeon Draw layer.
- Split exterior walls around overlapping hidden walls (thus allowing "windows" for outdoor building maps).
- Add Xenomorph theme.

# 1.0.1

- **PLEASE BACK UP YOUR WORLD DATA BEFORE UPGRADING TO THIS VERSION OF DUNGEON DRAW!!!**
- Foundry v10 compatibility. Note that Dungeon Draw 1.0.1+ will only be v10+ compatible.
- Persist dungeon data in JournalEntry flag instead of either content/page.
- Migrate any existing dungeon draw data to flag storage.
- Add invisible wall tool and config fields, by @pbtura.

# 1.0.0

- Whoops, this should not have been released.

# 0.25.0

- Add wallSidesTexture and wallSidesTextureTint settings for 3dcanvas.
- Check wall flag data when deciding whether to delete/recreate walls.

# 0.24.1

- Fix clear all dialog title.

# 0.24.0

- Embed theme config info with each theme-painted area in the Dungeon Draw journal entry. This means any custom theme area will be properly visible to all players.

# 0.23.3

- Ditch radio for add/remove in favor of clickable div button.
- Fix bug where add toggle button is on but the mode is actually remove.

# 0.23.2

- Split exterior walls around overlapping doors.

# 0.23.1

- Only create or delete walls that need to change. This means opened doors will not be recreated and closed for each dungeon change.

# 0.23.0

- Reorganize drawing tools into a new tool window and add/remove toggle.
- Start playing & looping any webm video used for wall or floor texture.
- Fix 0.22.0 and 0.22.1 earlier github release borkage.

# 0.22.1

- Add missing button text.

# 0.22.0

- Reorganize drawing tools into a new tool window and add/remove toggle.

# 0.21.1p

- Handle missing texture files more gracefully.

# 0.21.0

- Add ellipse tool.

# 0.20.0

- Add ctrl-z/ctrl-y (cmd-z/cmd-y) keybindings for undo and redo.

# 0.19.1

- Fix missing import template html file.
- Don't show changelog popup at startup.

# 0.19.0

- Add custom themes import checkbox to control wipe vs. merge.

# 0.18.0

- Japanese localization by BrotherSharper.
- Add setting for whether to show Dungeon Draw controls to trusted players.
- Make 3D Canvas setting world-scoped rather than client-scoped.

# 0.17.0

- Add "match base walls" theme setting, defaulting to true.
- Add floor opacity and texture rotation settings.
- Check for invalid/unhandleable shapes before attempting to add them to the map.
- Show error notifications for invalid shapes or other problems when adding geometry to the map.

# 0.16.2

- Change wall creation to create new walls as a single step before deleting old ones.
- Only show 3D fields on config and theme sheets if 3D module setting is enabled.

# 0.16.1

- Fix bug when generating dungeon on a new scene without a preexisting dungeon.

# 0.16.0

- Add new "magic wand" dungeon generator tool, along with 3 different generator algorithms. Woo!!!
- Go back to single save-to-background file name per scene.

# 0.15.2

- Write saved background images to unique filenames each save.
- Fix possible synchronization bug when deleting then saving dungeon.

# 0.15.1

- Fix yet another "Save to Scene Background" offset bug wrt grid size rounding.

# 0.15.0

- New "Draw Freehand" tool.
- Handle SHIFT keypress changes for latest v9 Foundry.
- Fix yet another "Save to Scene Background" offset bug.

# 0.14.2

- Show various 3D settings on Config and Theme sheets.

# 0.14.1

- Fix "Save to Scene Background" offset and padding bugs.

# 0.14.0

- Add snap to grid, with module setting to turn on/off. Hold shift to disable.
- Add support for 3D Canvas module wall flags, with module setting to turn on/off.
- Add "Save to Scene Background" button, useful for setting a 3D Canvas floor.
- Change renderer to use Pixi.js polygon texture fill for floor and wall textures, rather than manually creating Sprites. This should allow small (e.g., 100x100px) textures to be performant.
- Only show delete-all button to GM.
- Improve Clear button confirmation dialog text.

# 0.13.1

- Fix bug where custom themes wouldn't get defaults for new config settings.

# 0.13.0

- Make Dungeon Draw compatible with Foundry v9.
- Add config settings for wall texture and wall texture tint.
- Add config setting for door line thickness, separate from wall thickness.
- Update Wood Planks theme to use a wall texture.
- Move "Save new Custom Theme" to themes tab.
- Project tooling: use rollup to package Dungeon Draw as a minified js bundle. Saves ~200kb download size.
- Project tooling: add prettier, eslint, and presubmit checks.

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
