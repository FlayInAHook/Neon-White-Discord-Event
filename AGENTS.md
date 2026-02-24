# UI & Architecture Guidelines
- UI and server code is in ./bun-server

## Component Library
- Prefer **shadcn/ui** components whenever possible.
- Install components using:
  bun x --bun shadcn@latest add [component]
  (Do NOT use `bunx`.)

## Theming
- All implementations must support both **light** and **dark** mode.

## State Management
- Use **Jotai** for shared or cross-component state.
- Avoid unnecessary global state.

## Component Design
- Keep React components small and focused.
- Refactor large components into smaller, reusable pieces.
- Favor composition over monolithic components.

---