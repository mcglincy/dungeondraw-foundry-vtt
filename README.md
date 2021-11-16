# Dungeon Draw

A dungeon-drawing module for Foundry VTT.

![Screen Shot 2021-11-08 at 9 55 54 PM](https://user-images.githubusercontent.com/189172/140859282-ca8e78bc-0d9c-4c06-8b0d-e6d876a8cb5f.png)

## Tools

* Add rectangle - Draw a rectangular room or corridor.
* Remove rectangle - Remove rooms/corridors, or remove inner chunks of rooms.
* Add polygon - Draw a polygon; works like Foundry's polygon Drawing tool.
* Add door - Draw a new door.
* Remove doors - Remove all doors within an area.
* Undo - Undoes last change.
* Redo - Redoes next change.
* Config - Change various scene-specific drawing values: floor and wall color, wall width, optional floor texture, etc.
* Delete all - Nuke everything on the current dungeon/scene.


## How it works

* Need GM or Assistant GM permission to see new Dungeon Draw scene tools.
* New dungeon-drawing layer under the Foundry background layer.
* Auto-creates walls and doors from what you draw.
* Saved as a JournalEntry in a "Dungeon Draw" folder.
  * Map note in the upper left links the current scene to the JournalEntry.
  * JournalEntry and Note are created as soon as you start drawing a new dungeon.
  * To delete: delete the Note and/or the JournalEntry. 


## Wall and Door Creation

Dungeon Draw automatically creates Foundry lighting walls and doors from what you've drawn. Warning: every time you draw, Dungeon Draw deletes ALL EXISTING WALLS and recreates them. That means that using Dungeon Draw on a scene that already has manually placed walls WILL DELETE THOSE WALLS.


## Using floor textures

If you choose a floor texture it will be used in preference to the floor fill color.

Dungeon Draw currently assumes square texture files.

Some care needs to be taken when choosing texture files and sizes. Using larger texture files (e.g., 400x400, 600x600, etc) will cause fewer texture sprites and should perform better. Conversely, using a 50x50 texture on a big map can make your browser crawl.

Want some good floor textures? Check out this free Texture Pack 3 from Forgotten Adventures: https://www.patreon.com/posts/texture-pack-3-24886718


## Known issues

* Simultaneous map editors can trample each other's changes and cause save errors. It's best to stick to one map-maker at a time (either the GM or a single player).
* The geometry library used (JSTS) is ~500kb. I'm looking at ways to reduce the size.


## Credits

* Red-white checkerboard texture by [llexandro](https://www.deviantart.com/llexandro/gallery/54632558/sci-fi-textures)
