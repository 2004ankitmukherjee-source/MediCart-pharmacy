# MediCart E-Commerce Backend

## Requirements
- Node.js 18+ recommended
- npm

## Run
1. Open this folder in VS Code.
2. Open Terminal.
3. Run:
   `npm install`
4. Start:
   `npm start`
5. Open:
   `http://localhost:3000`

A `medicart.db` SQLite database is created automatically on first run.

## API
- GET `/api/products`
- GET `/api/products/:id`
- POST `/api/products`
- PUT `/api/products/:id`
- DELETE `/api/products/:id`
- POST `/api/orders`
- GET `/api/orders`
- GET `/api/orders/:id`
- PATCH `/api/orders/:id/status`
- GET `/api/health`

This is a college/demo project. It does not implement real payment processing, authentication, prescription verification, or pharmacy regulatory workflows.
