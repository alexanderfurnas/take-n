# TAKE-N: The King of Iron Takes Tournament

A retro browser fighting game where pollsters and political take-makers settle it the old-fashioned way. Affectionate parody.

**Play:** https://alexanderfurnas.com/take-n/

## Controls
| Move | Punch | Kick | Throw | Specials | Hot Take |
|---|---|---|---|---|---|
| Arrows | Z | X | Z+X | A / S | D |

- Hold back to block (down-back blocks sweeps). Punches whiff on crouching opponents.
- Z,Z,X is a combo; Z,Z,Z ends in a launcher. Down+Z = uppercut, Down+X = sweep, Forward+Z = strong punch.
- The classic ↓↘→ / ↓↙← motions + Z or X also do specials.
- Esc pauses and shows the move list, M mutes, H hides the on-screen key guide.
- Gamepad: X/Y punch, A/B kick, LB/LT specials, RB hot take.

New to fighting games? Leave DIFFICULTY on EASY and try PRACTICE first.

## Code
- `js/engine.js` — fight logic, input, audio, rendering
- `js/stages.js` — backgrounds
- `js/roster.js` — the fighters (copy an entry to add one)
- `js/main.js` — menus, HUD, CPU AI, game loop
