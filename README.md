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
* Config - Change various scene-specific drawing values: floor and wall color, wall width, etc.


## How it works

* Need "Use Drawing Tools" permission to see new Dungeon Draw scene tools.
* New dungeon-drawing layer under the Foundry background layer.
* Saved as a JournalEntry in a "Dungeon Draw" folder.
  * Map note in the upper left links the current scene to the JournalEntry.
  * JournalEntry and Note are created as soon as you start drawing a new dungeon.
  * To delete: delete the Note and/or the JournalEntry. 


## Known issues

* Simultaneous map editors can trample each other's changes and cause save errors. It's best to stick to one map-maker at a time (either the GM or a single player).
* The geometry library used (JSTS) is ~500kb. I'm looking at ways to reduce the size.
