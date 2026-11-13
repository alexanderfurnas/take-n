# TAKE-N: The King of Iron Takes Tournament

A retro browser fighting game where pollsters and political take-makers settle it the old-fashioned way. Affectionate parody.

**Play:** https://alexanderfurnas.com/take-n/

## Controls
| | Move | LP | RP | LK | RK | Hot Take |
|---|---|---|---|---|---|---|
| P1 | WASD | U | I | J | K | P |
| P2 | Arrows | `[` | `]` | `;` | `'` | Right Shift |

Specials: P1 presses O or L (P2: `\` or `/`), or the classic ↓↘→+P and ↓↙←+K motions. Hold back to block. Esc pauses and shows the move list, M mutes, C hides the on-screen key guide. Gamepads supported (LB/LT specials, RB hot take).

New to fighting games? Leave DIFFICULTY on EASY and try PRACTICE first.

## Code
- `js/engine.js` — fight logic, input, audio, rendering
- `js/stages.js` — backgrounds
- `js/roster.js` — the fighters (copy an entry to add one)
- `js/main.js` — menus, HUD, CPU AI, game loop
