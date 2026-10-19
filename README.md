# TaskFlow — MERN Project & Task Manager

A full-stack internship portfolio project built with React, Vite, Node.js, Express, MongoDB, Mongoose and JWT.

## Features
- User registration and login with hashed passwords
- Registration password confirmation
- Email-based password reset with single-use, 15-minute reset links
- JWT-protected API routes
- Create, edit and delete projects
- Project membership by registered user email
- Create, update and delete tasks
- Task status, priority, due dates and assignees
- Dashboard counts and task filtering
- Responsive interface
- Basic input validation and authorization checks

## Requirements
- Node.js LTS and npm
- MongoDB Atlas account or a local MongoDB instance
- Git (optional but recommended)

## 1. Configure the backend
Open a terminal in `server`:

```bash
npm install
```

Copy `.env.example` to `.env` and set your MongoDB connection string and a long random JWT secret.

PowerShell:
```powershell
Copy-Item .env.example .env
```

Example `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/taskflow?retryWrites=true&w=majority
JWT_SECRET=replace_with_a_long_random_secret
CLIENT_URL=http://localhost:5173
RESEND_API_KEY=re_your_resend_api_key
RESEND_FROM_EMAIL=onboarding@resend.dev
```

Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL` using your Resend dashboard. The Resend test sender is restricted to permitted test recipients; for sending to other users, verify a domain in Resend and use an address on that domain. Set `CLIENT_URL` to your frontend origin (for example, `https://task-flow-tan-six-64.vercel.app`). Reset links expire after 15 minutes and can be used only once.

Do not commit `.env` or share your API key or database credentials.

Start the API:
```bash
npm run dev
```

API health check: http://localhost:5000/api/health

## 2. Configure the frontend
Open a second terminal in `client`:

```bash
npm install
```

Copy `.env.example` to `.env` if you need to change the API URL. The default is `http://localhost:5000/api`.

PowerShell:
```powershell
Copy-Item .env.example .env
```

Start React:
```bash
npm run dev
```

Open the local URL printed by Vite, usually http://localhost:5173.

## 3. First run
1. Register a user.
2. Create a project.
3. Create tasks inside the project.
4. Change task status and priority.
5. To collaborate, register a second account and add its email as a project member.

## Deployment
- Frontend: deploy `client` to Vercel.
- Backend: deploy `server` to Render or another Node host.
- Database: MongoDB Atlas.
- Set backend environment variables in the hosting dashboard.
- Set frontend `VITE_API_URL` to the deployed API base URL ending in `/api`.
- Set backend `CLIENT_URL` to the deployed frontend origin.
- Use a strong production `JWT_SECRET`; never reuse or publish local secrets.

## Notes
This is a learning MVP, not a security-audited production SaaS. Before production use, add automated tests, rate limiting, stronger operational logging, email verification, and a reviewed cookie-based authentication strategy. The sample uses a bearer JWT stored in browser local storage for simplicity; local storage can be exposed by XSS, so harden the app before handling sensitive data.
