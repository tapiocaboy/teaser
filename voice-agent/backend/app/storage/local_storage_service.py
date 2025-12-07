"""
Local Storage Service
Uses SQLite for conversation storage and local filesystem for audio files.
"""

import logging
import os
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List

logger = logging.getLogger(__name__)


class LocalStorageService:
    """Local SQLite + Filesystem Storage Service"""
    
    def __init__(self):
        """Initialize local storage"""
        self.db_path = os.getenv("SQLITE_DB_PATH", "data/echo.db")
        self.audio_path = os.getenv("LOCAL_AUDIO_PATH", "data/audio")
        
        # Ensure directories exist
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        Path(self.audio_path).mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Initializing Local Storage")
        logger.info(f"SQLite DB: {self.db_path}")
        logger.info(f"Audio path: {self.audio_path}")
        
        self._init_database()
        
        logger.info("Local Storage service initialized")
    
    def _init_database(self):
        """Initialize SQLite database schema"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create conversations table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                user_input TEXT NOT NULL,
                assistant_response TEXT NOT NULL,
                session_id TEXT,
                timestamp TEXT,
                metadata TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        """)
        
        # Create index for session lookups
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_session_id ON conversations(session_id)
        """)
        
        # Create index for timestamp lookups
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_timestamp ON conversations(timestamp DESC)
        """)
        
        conn.commit()
        conn.close()
    
    def _get_connection(self) -> sqlite3.Connection:
        """Get a database connection"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    async def save_conversation(
        self,
        user_input: str,
        assistant_response: str,
        session_id: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> str:
        """
        Save a conversation to SQLite.
        
        Args:
            user_input: User's speech transcript
            assistant_response: LLM response
            session_id: Optional session ID
            metadata: Optional metadata
            
        Returns:
            Conversation ID
        """
        import json
        
        try:
            conversation_id = str(uuid.uuid4())
            timestamp = datetime.utcnow().isoformat()
            
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO conversations 
                (id, user_input, assistant_response, session_id, timestamp, metadata, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                conversation_id,
                user_input,
                assistant_response,
                session_id or str(uuid.uuid4()),
                timestamp,
                json.dumps(metadata) if metadata else None,
                timestamp,
                timestamp
            ))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Saved conversation {conversation_id}")
            return conversation_id
            
        except Exception as e:
            logger.error(f"Error saving conversation: {e}")
            raise RuntimeError(f"Failed to save conversation: {e}")
    
    async def get_conversation(self, conversation_id: str) -> Optional[Dict]:
        """
        Get a conversation by ID from SQLite.
        
        Args:
            conversation_id: Conversation ID
            
        Returns:
            Conversation data or None
        """
        import json
        
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT * FROM conversations WHERE id = ?
            """, (conversation_id,))
            
            row = cursor.fetchone()
            conn.close()
            
            if row:
                return {
                    "id": row["id"],
                    "user_input": row["user_input"],
                    "assistant_response": row["assistant_response"],
                    "session_id": row["session_id"],
                    "timestamp": row["timestamp"],
                    "metadata": json.loads(row["metadata"]) if row["metadata"] else {},
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"]
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting conversation: {e}")
            return None
    
    async def get_recent_conversations(self, limit: int = 10, offset: int = 0) -> List[Dict]:
        """
        Get recent conversations from SQLite.
        
        Args:
            limit: Maximum number of conversations to return
            offset: Number of conversations to skip
            
        Returns:
            List of conversation dictionaries
        """
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, user_input, assistant_response, session_id, timestamp, created_at
                FROM conversations
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            """, (limit, offset))
            
            rows = cursor.fetchall()
            conn.close()
            
            return [
                {
                    "id": row["id"],
                    "user_input": row["user_input"],
                    "assistant_response": row["assistant_response"],
                    "session_id": row["session_id"],
                    "timestamp": row["timestamp"],
                    "created_at": row["created_at"]
                }
                for row in rows
            ]
            
        except Exception as e:
            logger.error(f"Error getting recent conversations: {e}")
            return []
    
    async def get_session_conversations(self, session_id: str) -> List[Dict]:
        """
        Get all conversations for a session.
        
        Args:
            session_id: Session ID
            
        Returns:
            List of conversations in the session
        """
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, user_input, assistant_response, timestamp
                FROM conversations
                WHERE session_id = ?
                ORDER BY timestamp ASC
            """, (session_id,))
            
            rows = cursor.fetchall()
            conn.close()
            
            return [
                {
                    "id": row["id"],
                    "user_input": row["user_input"],
                    "assistant_response": row["assistant_response"],
                    "timestamp": row["timestamp"]
                }
                for row in rows
            ]
            
        except Exception as e:
            logger.error(f"Error getting session conversations: {e}")
            return []
    
    async def save_audio(self, audio_data: bytes, key: str) -> str:
        """
        Save audio data to local filesystem.
        
        Args:
            audio_data: Raw audio bytes
            key: Storage key (relative path)
            
        Returns:
            Full path to the stored audio
        """
        try:
            # Construct full path
            full_path = Path(self.audio_path) / key
            
            # Ensure directory exists
            full_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Write audio file
            with open(full_path, "wb") as f:
                f.write(audio_data)
            
            logger.info(f"Saved audio to {full_path}")
            return str(full_path)
            
        except Exception as e:
            logger.error(f"Error saving audio: {e}")
            raise RuntimeError(f"Failed to save audio: {e}")
    
    async def get_audio(self, key: str) -> Optional[bytes]:
        """
        Retrieve audio data from local filesystem.
        
        Args:
            key: Storage key (relative path)
            
        Returns:
            Audio data bytes or None
        """
        try:
            full_path = Path(self.audio_path) / key
            
            if not full_path.exists():
                logger.warning(f"Audio not found: {key}")
                return None
            
            with open(full_path, "rb") as f:
                return f.read()
            
        except Exception as e:
            logger.error(f"Error getting audio: {e}")
            return None
    
    async def delete_conversation(self, conversation_id: str) -> bool:
        """
        Delete a conversation from SQLite.
        
        Args:
            conversation_id: Conversation ID to delete
            
        Returns:
            True if deleted successfully
        """
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                DELETE FROM conversations WHERE id = ?
            """, (conversation_id,))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Deleted conversation {conversation_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting conversation: {e}")
            return False
    
    def cleanup(self) -> None:
        """Cleanup resources"""
        logger.info("Local Storage service cleanup completed")

