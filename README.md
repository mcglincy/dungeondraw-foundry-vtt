# Dungeon Draw

A dungeon-drawing module for Foundry VTT.

![Latest Release Download Count](https://img.shields.io/github/downloads/mcglincy/dungeondraw-foundry-vtt/latest/module.zip)

![Screen Shot 2021-11-28 at 8 25 49 PM](https://user-images.githubusercontent.com/189172/143799176-d798823d-a990-4ff9-b660-763dbfd0082a.png)

## Tools

- Generate a Dungeon - Let Dungeon Draw make the map for you!
- Add rectangle - Draw a rectangular room or corridor.
- Remove rectangle - Remove rooms/corridors, or remove inner chunks of rooms.
- Add polygon - Draw a polygon; works like Foundry's polygon Drawing tool.
- Add interior wall - Draw a new interior wall.
- Add door - Draw a new door.
- Add secret door - Draw a new secret door.
- Remove interior walls and doors - Remove all interior walls and doors within a rectangle you draw.
- Theme painter - Select a theme in Config > Theme Painter, then "paint" it as a polygon on top of the map's main theme.
- Theme eraser - Remove all painted theme polygons within a rectangle you draw.
- Undo - Undoes last change.
- Redo - Redoes next change.
- Config - Change various scene-specific drawing values: floor and wall color, wall width, optional background or floor texture, etc. Also edit/copy/delete custom themes, and select the active theme for the theme painter tool.
- Delete all - Nuke everything on the current dungeon/scene.

## Themes

![DungeonDraw-themes](https://user-images.githubusercontent.com/189172/142654535-cd797a63-c2b3-4c7a-8613-fa6b49baca33.jpg)

## How it works

- New dungeon-drawing layer under the Foundry background layer.
- Players need at least Trusted Player permission to see and use the new Dungeon Draw scene tools. GM or Assistant DM permission will allow Dungeon Draw to automatically update lighting walls, as well as update scene settings (background color, grid) from theme selection.
- Saved as a JournalEntry in a "Dungeon Draw" folder.
  - Map note in the upper left links the current scene to the JournalEntry.
  - JournalEntry and Note are created as soon as you start drawing a new dungeon.
  - To delete: delete the Note and/or the JournalEntry.
  - For Trusted Player: to allow editing, you may need to them as the owner of Journal Entries that were previously created by the GM.

## Using floor and wall textures

If you choose a floor texture it will be used in preference to the floor fill color.

Dungeon Draw currently assumes square texture files.

Want some good floor textures? Check out this free Texture Pack 3 from Forgotten Adventures: https://www.patreon.com/posts/texture-pack-3-24886718

## Dungeon Generators

Dungeon Draw includes a magic wand tool to make a dungeon map for you, along with several dungeon generation algorithms.

- [2D-Dungeon](https://github.com/Prozi/dungeon-generator) by Prozi / domas2x
- [Dungeoneer](https://github.com/LucianBuzzo/dungeoneer) by Lucian Buzzo
- [Rot.js cellular automata](https://github.com/ondras/rot.js) by Ondřej Žára

## Known issues

- Sometimes generating a rot.js cave system with smoothing can cause errors. I'm still debugging this, but in the meantime you can just retry - it usually succeeds after an attempt or two.
- Dungeon Draw isn't compatible with a scene background image (which will cover up the dungeon map). Dungeon Draw's map layer is below Foundry's normal background layer. This lets you use placeable background tiles as you'd expect (they appear on top of the dungeon map), but also means a scene background image appears on top of the dungeon map, too. As a workaround, you can specify a background image in the Dungeon Draw config for the particular scene, which will show your background below the dungeon map.
- Simultaneous map editors can trample each other's changes and cause save errors. It's best to stick to one map-maker at a time (either the GM or a single player).

## Credits

- Floor textures by
  - [llexandro](https://www.deviantart.com/llexandro/gallery/54632558/sci-fi-textures) (free to use for everything).
  - [João Paulo](https://3dtextures.me/about/) under CC0.
  - [the3rdsequence](https://www.the3rdsequence.com/texturedb/) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
