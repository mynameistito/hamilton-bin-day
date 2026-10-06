# Documentation app

## OVERVIEW

Private Blume app that builds the project documentation into the web deployment's `/docs` path.

## STRUCTURE

```text
content/       MDX pages (index, privacy, terms)
public/        Static documentation assets
blume.config.ts Base path, content root, project metadata, and theme
```

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| Add or edit a docs page | `content/*.mdx` | Blume content convention |
| Change docs routing/theme | `blume.config.ts` | Base path is `/docs`; do not make it root-mounted |
| Build/check docs | `package.json` | `blume build`; `blume check && tsc --noEmit` |

## CONVENTIONS

- Keep user-facing documentation in source `content/`; generated output is `dist/` and should not be hand-edited.
- Changes to API descriptions should remain aligned with the Worker implementation and root README.
