# Dungeon Draw

A dungeon-drawing module for Foundry VTT. 

![Latest Release Download Count](https://img.shields.io/github/downloads/mcglincy/dungeondraw-foundry-vtt/latest/module.zip)

![Screen Shot 2021-11-08 at 9 55 54 PM](https://user-images.githubusercontent.com/189172/140859282-ca8e78bc-0d9c-4c06-8b0d-e6d876a8cb5f.png)

## Tools

* Add rectangle - Draw a rectangular room or corridor.
* Remove rectangle - Remove rooms/corridors, or remove inner chunks of rooms.
* Add polygon - Draw a polygon; works like Foundry's polygon Drawing tool.
* Add interior wall - Draw a new interior wall.
* Add door - Draw a new door.
* Remove interior walls and doors - Remove all interior walls and doors within a rectangle you draw.
* Theme painter - Select a theme in Config > Theme Painter, then "paint" it as a polygon on top of the map's main theme.
* Theme eraser - Remove all painted theme polygons within a rectangle you draw.
* Undo - Undoes last change.
* Redo - Redoes next change.
* Config - Change various scene-specific drawing values: floor and wall color, wall width, optional background or floor texture, etc. Also edit/copy/delete custom themes, and select the active theme for the theme painter tool.
* Delete all - Nuke everything on the current dungeon/scene.


## Themes
![DungeonDraw-themes](https://user-images.githubusercontent.com/189172/142654535-cd797a63-c2b3-4c7a-8613-fa6b49baca33.jpg)


## How it works

* New dungeon-drawing layer under the Foundry background layer.
* Players need at least Trusted Player permission to see and use the new Dungeon Draw scene tools. GM or Assistant DM permission will allow Dungeon Draw to automatically update lighting walls, as well as update scene settings (background color, grid) from theme selection.
* Saved as a JournalEntry in a "Dungeon Draw" folder.
  * Map note in the upper left links the current scene to the JournalEntry.
  * JournalEntry and Note are created as soon as you start drawing a new dungeon.
  * To delete: delete the Note and/or the JournalEntry. 
  * For Trusted Player: to allow editing, you may need to them as the owner of Journal Entries that were previously created by the GM.


## Using floor textures

If you choose a floor texture it will be used in preference to the floor fill color.

Dungeon Draw currently assumes square texture files.

Some care needs to be taken when choosing texture files and sizes. Using larger texture files (e.g., 400x400, 600x600, etc) will cause fewer texture sprites and should perform better. Conversely, using a 50x50 texture on a big map can make your browser crawl.

Want some good floor textures? Check out this free Texture Pack 3 from Forgotten Adventures: https://www.patreon.com/posts/texture-pack-3-24886718


## Known issues

* Simultaneous map editors can trample each other's changes and cause save errors. It's best to stick to one map-maker at a time (either the GM or a single player).
* The geometry library used (JSTS) is \~500kb. I'm looking at ways to reduce the size.


## Credits

* Floor textures by 
  * [llexandro](https://www.deviantart.com/llexandro/gallery/54632558/sci-fi-textures) (free to use for everything).
  * [João Paulo](https://3dtextures.me/about/) under CC0.
  * [the3rdsequence](https://www.the3rdsequence.com/texturedb/) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
