# NYC Dispatch Simulator

A single-player emergency dispatch game running in the
browser with a small C# backend as the source of truth for game data.

## Stack

- **Frontend:** React + TypeScript (strict) + Vite + Tailwind CSS + Zustand + MapLibre GL JS
- **Backend:** ASP.NET Core 8 minimal API, in-memory data store

## Architecture

```
Browser (Vite @ :5173)  ──HTTP/JSON──▶  C# API (ASP.NET Core @ :5174)
  Zustand stores  ◀── fetch ──  /api/stations, /api/vehicles, /api/calls
  MapLibre markers                in-memory seeded data (DispatchData)
```

The backend owns all data (stations, vehicles, calls). The frontend loads it on
startup via REST and renders it on the map. No database — data is seeded in memory
and resets on restart.

## Running

You need **two terminals**.

### 1. Backend

```bash
cd server/NycDispatch.Api
dotnet run
```

Serves on `http://localhost:5174` (CORS allows the Vite dev origin). Endpoints:

- `GET /api/stations` · `GET /api/stations/{id}`
- `GET /api/vehicles` · `GET /api/vehicles/{id}`
- `GET /api/calls` · `GET /api/calls/{id}`

### 2. Frontend

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The header shows a connection badge
(Connected / Loading / Backend unavailable).

The API base URL can be overridden via `VITE_API_BASE_URL` (see `.env`).

> Note: `dotnet` is added to your PATH by the installer — open a **new** terminal
> if it was just installed.