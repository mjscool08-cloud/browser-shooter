IMPORTANT LAUNCH FIX
====================
This build uses http://localhost:8766 instead of port 8000.

Why:
An older Browsercraft v5 Python server can remain running on port 8000.
If the launcher opens port 8000 again, the browser can show v5 even though
the files in the new ZIP are v6.

START-GAME.bat now:
- changes directory to its own folder before serving files
- uses dedicated port 8766
- opens a cache-busted v6 URL
- clearly labels the command window Browser Shooter v6

BROWSER SHOOTER v7
==================

This is the actual v6 rebuild, based on the working v5 chunk engine.

WHAT CHANGED
------------
Browsercraft is now Browser Shooter, a sandbox-shooter hybrid.

PLAYER
------
100 HP
Enemy contact attacks reduce HP.
At 0 HP, you die and respawn after a short delay.

NORMAL WEAPONS
--------------
6 Sword
- 13 damage
- wide arc
- strong knockback

7 Pistol
- 9 damage
- long-range hitscan

8 Rifle
- 7 damage
- very fast fire
- long range

9 Shotgun
- 5 damage per pellet
- 5 pellets
- close-range spread

0 Greatsword
- 22 damage
- huge swing arc
- very strong knockback

MOBS
----
Green Grunt
Yellow Runner: low HP, fast
Red Brute: high HP, slow, stronger hit

BOSS
----
Purple Boss
220 HP
22 contact damage
Large size
Slow movement
Respawns more slowly

CHEATCODE MENU
--------------
Press the actual arrow keys:

UP
UP
DOWN
DOWN
LEFT
RIGHT
LEFT
RIGHT

A cheat input box opens.

CODES
-----
Th3P71h0n
Unlocks Python.
Base melee damage: 10
E: large projectile, 15 damage
Q: loops the attack 5 times

67
Unlocks 67.
Normal attack rapidly shoots 6/7 projectiles doing 6 or 7 damage.
E: shoots a 67-damage projectile.
Special cooldown: 67 seconds.

Damage1ncr3a23
Adds +20 damage.
Can stack if entered more than once.

SANDBOX
-------
1-5 still select blocks.
Right click breaks.
Left click places blocks when a block is selected.
The v5 chunk renderer is preserved to keep mass block placement far lighter than old per-block rendering.

START
-----
Double-click START-GAME.bat.
No Node required.


V7 INVENTORY UPDATE
-------------------
New keyboard weapon hotkeys:
- Minus (-) equips Python after it has been unlocked.
- Equals (=) equips 67 after it has been unlocked.

Inventory:
- I opens/closes inventory.
- Up/Down selects.
- Left/Right switches between HOTBAR and STORAGE.
- Enter moves the selected item.
- Escape closes inventory.
- Weapons can be put away and brought back later.
- The five building blocks remain fixed on the hotbar so core building controls are not broken.
