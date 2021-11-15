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