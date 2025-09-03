Prerequisites
Node.js: Use Node 18+ (LTS recommended). 
Verify with:
node -v
Package manager: npm (comes with Node).
1) Install dependencies
From the project root run the following in two separate steps:
  cd client
  npm install
and
  cd ../server
  npm install
2) Start the signaling server (Socket.IO)
The server has no start script and its entry is server/server.js. 
  Run it directly:
   cd server
   node server.js
Runs on: http://localhost:3001
CORS: open to all origins (good for local dev).
Keep this terminal running.
3) Start the Svelte client (Vite)
In a new terminal:
  cd client
  npm run dev
Default Vite dev server: http://localhost:5173
Open http://localhost:5173 in your browser.
4) Test quickly
Open two browser windows/tabs at http://localhost:5173.
Join the same room ID in both tabs to see peers connect via the signaling server at port 3001.