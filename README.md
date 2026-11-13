# TAKE-N: The King of Iron Takes Tournament

A retro browser fighting game where pollsters and political take-makers settle it the old-fashioned way. Affectionate parody.

**Play:** https://alexanderfurnas.com/take-n/

## Controls
| | Move | LP | RP | LK | RK | Hot Take |
|---|---|---|---|---|---|---|
| P1 | WASD | U | I | J | K | O |
| P2 | Arrows | `[` | `]` | `;` | `'` | `\` |

Specials: ↓↘→+P and ↓↙←+K. Hold back to block. Esc pauses, M mutes. Gamepads supported.

## Code
- `js/engine.js` — fight logic, input, audio, rendering
- `js/stages.js` — backgrounds
- `js/roster.js` — the fighters (copy an entry to add one)
- `js/main.js` — menus, HUD, CPU AI, game loop
