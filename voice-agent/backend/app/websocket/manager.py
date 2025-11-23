"""
WebSocket Manager for Real-time Voice Communication
"""
import logging
import asyncio
from typing import Dict, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class WebSocketManager:
    def __init__(self, max_connections: int = 10):
        """
        Initialize WebSocket manager

        Args:
            max_connections: Maximum number of concurrent connections
        """
        self.active_connections: Set[WebSocket] = set()
        self.max_connections = max_connections
        self.connection_count = 0

    async def connect(self, websocket: WebSocket):
        """
        Accept and register a new WebSocket connection

        Args:
            websocket: WebSocket connection to accept
        """
        if self.connection_count >= self.max_connections:
            await websocket.close(code=1008)  # Policy violation
            logger.warning("Connection rejected: maximum connections reached")
            return

        await websocket.accept()
        self.active_connections.add(websocket)
        self.connection_count += 1
        logger.info(f"WebSocket connected. Total connections: {self.connection_count}")

    def disconnect(self, websocket: WebSocket):
        """
        Remove a WebSocket connection

        Args:
            websocket: WebSocket connection to remove
        """
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            self.connection_count -= 1
            logger.info(f"WebSocket disconnected. Total connections: {self.connection_count}")

    async def broadcast(self, message: str):
        """
        Broadcast a message to all connected clients

        Args:
            message: Message to broadcast
        """
        disconnected = set()

        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Failed to send message to connection: {e}")
                disconnected.add(connection)

        # Clean up disconnected connections
        for connection in disconnected:
            self.disconnect(connection)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        """
        Send a message to a specific WebSocket connection

        Args:
            message: Message to send
            websocket: Target WebSocket connection
        """
        if websocket in self.active_connections:
            try:
                await websocket.send_text(message)
            except Exception as e:
                logger.error(f"Failed to send personal message: {e}")
                self.disconnect(websocket)

    async def send_json_message(self, data: Dict, websocket: WebSocket):
        """
        Send a JSON message to a specific WebSocket connection

        Args:
            data: Data to send as JSON
            websocket: Target WebSocket connection
        """
        if websocket in self.active_connections:
            try:
                await websocket.send_json(data)
            except Exception as e:
                logger.error(f"Failed to send JSON message: {e}")
                self.disconnect(websocket)

    async def broadcast_json(self, data: Dict):
        """
        Broadcast a JSON message to all connected clients

        Args:
            data: Data to broadcast as JSON
        """
        disconnected = set()

        for connection in self.active_connections:
            try:
                await connection.send_json(data)
            except Exception as e:
                logger.error(f"Failed to broadcast JSON to connection: {e}")
                disconnected.add(connection)

        # Clean up disconnected connections
        for connection in disconnected:
            self.disconnect(connection)

    def get_connection_count(self) -> int:
        """Get current number of active connections"""
        return self.connection_count

    async def heartbeat(self, interval: int = 30):
        """
        Send periodic heartbeat messages to all connections

        Args:
            interval: Heartbeat interval in seconds
        """
        while True:
            try:
                await self.broadcast_json({"type": "heartbeat", "timestamp": asyncio.get_event_loop().time()})
                await asyncio.sleep(interval)
            except Exception as e:
                logger.error(f"Heartbeat error: {e}")
                await asyncio.sleep(interval)

    async def close_all(self):
        """Close all active connections"""
        logger.info("Closing all WebSocket connections...")

        close_tasks = []
        for connection in self.active_connections:
            close_tasks.append(connection.close())

        if close_tasks:
            await asyncio.gather(*close_tasks, return_exceptions=True)

        self.active_connections.clear()
        self.connection_count = 0
        logger.info("All WebSocket connections closed")
