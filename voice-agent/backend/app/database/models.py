"""
Database Models for Teaser
"""
import os
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, JSON, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import logging

logger = logging.getLogger(__name__)

Base = declarative_base()

class Conversation(Base):
    """Conversation history model"""
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(50), default="default_user")
    timestamp = Column(DateTime, default=datetime.utcnow)
    user_input = Column(Text, nullable=False)
    assistant_response = Column(Text, nullable=False)
    audio_path = Column(String(255), nullable=True)
    conversation_metadata = Column(JSON, nullable=True)
    processed = Column(Boolean, default=True)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "timestamp": self.timestamp.isoformat(),
            "user_input": self.user_input,
            "assistant_response": self.assistant_response,
            "audio_path": self.audio_path,
            "metadata": self.conversation_metadata,
            "processed": self.processed
        }

class User(Base):
    """User model for authentication (future use)"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    settings = Column(JSON, nullable=True)

# Database engine and session
engine = None
SessionLocal = None

def init_database(database_url: str = "sqlite:///data/conversations.db"):
    """
    Initialize database connection and create tables

    Args:
        database_url: Database connection URL
    """
    global engine, SessionLocal

    try:
        # Ensure data directory exists
        os.makedirs("./data", exist_ok=True)

        # Create engine
        engine = create_engine(
            database_url,
            connect_args={"check_same_thread": False} if "sqlite" in database_url else {},
            echo=False
        )

        # Create all tables
        Base.metadata.create_all(bind=engine)

        # Create session factory
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

        logger.info(f"Database initialized: {database_url}")

    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise

def get_db() -> Session:
    """Get database session"""
    if SessionLocal is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Conversation CRUD operations
def save_conversation(
    user_input: str,
    assistant_response: str,
    user_id: str = "default_user",
    audio_path: Optional[str] = None,
    conversation_metadata: Optional[Dict[str, Any]] = None
) -> Conversation:
    """
    Save a conversation to database

    Args:
        user_input: User's input text
        assistant_response: Assistant's response text
        user_id: User identifier
        audio_path: Path to audio file (optional)
        conversation_metadata: Additional metadata (optional)

    Returns:
        Created Conversation object
    """
    if SessionLocal is None:
        raise RuntimeError("Database not initialized")

    db = SessionLocal()
    try:
        conversation = Conversation(
            user_id=user_id,
            user_input=user_input,
            assistant_response=assistant_response,
            audio_path=audio_path,
            conversation_metadata=conversation_metadata
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        logger.info(f"Saved conversation: {conversation.id}")
        return conversation
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save conversation: {e}")
        raise
    finally:
        db.close()

def get_recent_conversations(
    user_id: str = "default_user",
    limit: int = 10,
    offset: int = 0
) -> List[Conversation]:
    """
    Get recent conversations for a user

    Args:
        user_id: User identifier
        limit: Maximum number of conversations to return
        offset: Number of conversations to skip

    Returns:
        List of Conversation objects
    """
    if SessionLocal is None:
        raise RuntimeError("Database not initialized")

    db = SessionLocal()
    try:
        conversations = db.query(Conversation)\
            .filter(Conversation.user_id == user_id)\
            .order_by(Conversation.timestamp.desc())\
            .offset(offset)\
            .limit(limit)\
            .all()

        return conversations
    except Exception as e:
        logger.error(f"Failed to get conversations: {e}")
        return []
    finally:
        db.close()

def get_conversation_by_id(conversation_id: int) -> Optional[Conversation]:
    """
    Get a specific conversation by ID

    Args:
        conversation_id: Conversation ID

    Returns:
        Conversation object or None if not found
    """
    if SessionLocal is None:
        raise RuntimeError("Database not initialized")

    db = SessionLocal()
    try:
        conversation = db.query(Conversation)\
            .filter(Conversation.id == conversation_id)\
            .first()

        return conversation
    except Exception as e:
        logger.error(f"Failed to get conversation {conversation_id}: {e}")
        return None
    finally:
        db.close()

def delete_conversation(conversation_id: int) -> bool:
    """
    Delete a conversation by ID

    Args:
        conversation_id: Conversation ID to delete

    Returns:
        True if deleted, False otherwise
    """
    if SessionLocal is None:
        raise RuntimeError("Database not initialized")

    db = SessionLocal()
    try:
        conversation = db.query(Conversation)\
            .filter(Conversation.id == conversation_id)\
            .first()

        if conversation:
            db.delete(conversation)
            db.commit()
            logger.info(f"Deleted conversation: {conversation_id}")
            return True
        return False
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete conversation {conversation_id}: {e}")
        return False
    finally:
        db.close()
