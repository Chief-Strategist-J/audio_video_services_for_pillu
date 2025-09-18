import json
from typing import Dict, Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

app = FastAPI()


static_dir = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=static_dir), name="static")


rooms: Dict[str, Set[WebSocket]] = {}


@app.get("/")
def index():
    """Serve the main page."""
    return FileResponse(static_dir / "index.html")


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    # Join room from query param, default to "default"
    room = ws.query_params.get("room", "default")
    await ws.accept()

    # Add connection to the room
    if room not in rooms:
        rooms[room] = set()
    rooms[room].add(ws)

    try:
        while True:
            # Receive a message from this client
            msg = await ws.receive_text()

            # Forward to all peers in the same room
            for peer in list(rooms.get(room, [])):
                if peer is not ws:
                    try:
                        await peer.send_text(msg)
                    except Exception:
                        # If peer is dead, ignore for now
                        pass
    except WebSocketDisconnect:
        # Client disconnected normally
        pass
    finally:
        # Cleanup: remove this websocket from the room
        if room in rooms and ws in rooms[room]:
            rooms[room].remove(ws)
        # Do NOT call await ws.close() here → FastAPI handles closure
