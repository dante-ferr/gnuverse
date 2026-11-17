# GNUverse — method

Method book for the GNUverse multimodal project (MATA68, 2026.2): free software as a way to democratize access to technology. Two independent areas — a **moderated authorial blog** and a **collaborative towers game**. This book is the authority for team method.

The external course brief lives at [`docs/references/trabalho-multimodal-2026.2.pdf`](../references/trabalho-multimodal-2026.2.pdf). Do not copy the PDF into chapters; use it as the problem source.

## How to read

| Chapter | What it explains |
| :--- | :--- |
| [Locked decisions](decisions.md) | Choices already locked; what is still open |
| [Repository map](architecture/overview.md) | The three processes and where code lives |
| [Authorization](architecture/authorization.md) | Single account, roles, and People and access |
| [Blog](blog/index.md) | Editorial method, code, local test, cloud |
| [Game](game/index.md) | Rules, code map, local test, production |
| [Planning](team/planning.md) | Team split and schedule |
| [Roadmap](engineering/roadmap.md) | Open work |
| [History](engineering/history.md) | Chronology of attempts and records |

Local preview:

```bash
make docs-serve
```

Opens at `http://localhost:3003` (port `3000` belongs to the site).
