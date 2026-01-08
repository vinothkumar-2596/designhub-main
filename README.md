# DesignHub Monorepo

Welcome to the DesignHub project. This project is structured as a professional monorepo to separate concerns between the frontend and backend.

## Project Structure

- **`client/`**: The frontend application built with Vite, React, and Tailwind CSS.
- **`backend/`**: The Node.js API server using Express and MongoDB.

## Getting Started

### Prerequisites
- Node.js & npm installed

### Quick Start (Monorepo)
To start both the client and backend simultaneously:

```sh
# Step 1: Install root and workspace dependencies
npm install

# Step 2: Set up environment variables
# Copy .env.example to .env in both /client and /backend

# Step 3: Run the development environment
npm run dev
```

### Individual Workspaces
You can also run commands for specific workspaces from the root:
- `npm run dev --workspace=client`
- `npm run dev --workspace=backend`

## Technologies
- **Frontend**: Vite, TypeScript, React, shadcn-ui, Tailwind CSS
- **Backend**: Node.js, Express, MongoDB (Atlas), Socket.io

## Deployment
- **Frontend**: Deployed to Vercel (Root: `client`)
- **Backend**: Deployed to Render (Root: `backend`)
