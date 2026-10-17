# TaskFlow API Overview

Base URL for local development: `http://localhost:5000/api`

Authenticated routes require:
`Authorization: Bearer <JWT>`

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register` | Register a user |
| POST | `/auth/login` | Log in |
| GET | `/auth/me` | Current authenticated user |
| GET | `/projects` | List projects user can access |
| POST | `/projects` | Create a project |
| GET | `/projects/:id` | Read an accessible project |
| PATCH | `/projects/:id` | Update a project (owner only) |
| DELETE | `/projects/:id` | Delete project and its tasks (owner only) |
| POST | `/projects/:id/members` | Add existing user by email (owner only) |
| GET | `/projects/:projectId/tasks` | List tasks in an accessible project |
| POST | `/projects/:projectId/tasks` | Create a task |
| PATCH | `/tasks/:id` | Update task |
| DELETE | `/tasks/:id` | Delete task |
| GET | `/dashboard/summary` | Task counts across accessible projects |
| GET | `/health` | API health check (not under auth) |

Task status values: `todo`, `in_progress`, `done`.
Priority values: `low`, `medium`, `high`.

All API responses use a JSON object with `success`, and usually `data` or `message`.
