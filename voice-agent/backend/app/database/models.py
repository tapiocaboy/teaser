"""
Database Models for Construction Site Voice Agent
"""
import os
from datetime import datetime, date
from typing import Optional, Dict, Any, List
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, JSON, Boolean, Date, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship, joinedload
import logging

logger = logging.getLogger(__name__)

Base = declarative_base()


# ============================================
# CONSTRUCTION SITE MODELS
# ============================================

class SiteWorker(Base):
    """Site Worker model - construction workers who submit daily updates"""
    __tablename__ = "site_workers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    employee_id = Column(String(50), unique=True, nullable=False)
    site_location = Column(String(200), nullable=True)
    role = Column(String(100), nullable=True)  # e.g., "Electrician", "Mason", "Foreman"
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    daily_updates = relationship("DailyUpdate", back_populates="worker", lazy="dynamic")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "employee_id": self.employee_id,
            "site_location": self.site_location,
            "role": self.role,
            "phone": self.phone,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class SiteManager(Base):
    """Site Manager model - managers who review updates and ask questions"""
    __tablename__ = "site_managers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    employee_id = Column(String(50), unique=True, nullable=False)
    managed_sites = Column(JSON, nullable=True)  # List of site locations
    email = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    queries = relationship("ManagerQuery", back_populates="manager", lazy="dynamic")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "employee_id": self.employee_id,
            "managed_sites": self.managed_sites,
            "email": self.email,
            "phone": self.phone,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class DailyUpdate(Base):
    """Daily Update model - worker's daily voice updates"""
    __tablename__ = "daily_updates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    worker_id = Column(Integer, ForeignKey("site_workers.id"), nullable=False)
    update_date = Column(Date, nullable=False, default=date.today)
    original_message = Column(Text, nullable=False)
    summary = Column(Text, nullable=True)
    audio_path = Column(String(255), nullable=True)
    summary_audio_path = Column(String(255), nullable=True)
    update_metadata = Column(JSON, nullable=True)  # Pipeline metadata, timing, etc.
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    worker = relationship("SiteWorker", back_populates="daily_updates")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "worker_id": self.worker_id,
            "worker_name": self.worker.name if self.worker else None,
            "worker_role": self.worker.role if self.worker else None,
            "site_location": self.worker.site_location if self.worker else None,
            "update_date": self.update_date.isoformat() if self.update_date else None,
            "original_message": self.original_message,
            "summary": self.summary,
            "audio_path": self.audio_path,
            "summary_audio_path": self.summary_audio_path,
            "metadata": self.update_metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ManagerQuery(Base):
    """Manager Query model - questions asked by managers about updates"""
    __tablename__ = "manager_queries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    manager_id = Column(Integer, ForeignKey("site_managers.id"), nullable=False)
    query_type = Column(String(20), nullable=False)  # 'single' or 'multiple'
    worker_ids = Column(JSON, nullable=True)  # List of worker IDs queried
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=True)
    answer_audio_path = Column(String(255), nullable=True)
    context_used = Column(JSON, nullable=True)  # Summary of context provided to LLM
    query_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    manager = relationship("SiteManager", back_populates="queries")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "manager_id": self.manager_id,
            "manager_name": self.manager.name if self.manager else None,
            "query_type": self.query_type,
            "worker_ids": self.worker_ids,
            "question": self.question,
            "answer": self.answer,
            "answer_audio_path": self.answer_audio_path,
            "context_used": self.context_used,
            "metadata": self.query_metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ============================================
# ORIGINAL ECHO MODELS (preserved for compatibility)
# ============================================

class Conversation(Base):
    """Conversation history model (original Echo functionality)"""
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


# ============================================
# DATABASE ENGINE AND SESSION
# ============================================

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


def get_db_session() -> Session:
    """Get a database session directly (non-generator version)"""
    if SessionLocal is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")
    return SessionLocal()


# ============================================
# SITE WORKER CRUD OPERATIONS
# ============================================

def create_site_worker(
    name: str,
    employee_id: str,
    site_location: Optional[str] = None,
    role: Optional[str] = None,
    phone: Optional[str] = None
) -> SiteWorker:
    """Create a new site worker"""
    db = get_db_session()
    try:
        worker = SiteWorker(
            name=name,
            employee_id=employee_id,
            site_location=site_location,
            role=role,
            phone=phone
        )
        db.add(worker)
        db.commit()
        db.refresh(worker)
        logger.info(f"Created site worker: {worker.name} (ID: {worker.id})")
        return worker
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create site worker: {e}")
        raise
    finally:
        db.close()


def get_site_worker(worker_id: int) -> Optional[SiteWorker]:
    """Get a site worker by ID"""
    db = get_db_session()
    try:
        return db.query(SiteWorker).filter(SiteWorker.id == worker_id).first()
    finally:
        db.close()


def get_site_worker_by_employee_id(employee_id: str) -> Optional[SiteWorker]:
    """Get a site worker by employee ID"""
    db = get_db_session()
    try:
        return db.query(SiteWorker).filter(SiteWorker.employee_id == employee_id).first()
    finally:
        db.close()


def get_all_site_workers(site_location: Optional[str] = None, active_only: bool = True) -> List[SiteWorker]:
    """Get all site workers, optionally filtered by site location"""
    db = get_db_session()
    try:
        query = db.query(SiteWorker)
        if active_only:
            query = query.filter(SiteWorker.is_active == True)
        if site_location:
            query = query.filter(SiteWorker.site_location == site_location)
        return query.order_by(SiteWorker.name).all()
    finally:
        db.close()


# ============================================
# SITE MANAGER CRUD OPERATIONS
# ============================================

def create_site_manager(
    name: str,
    employee_id: str,
    managed_sites: Optional[List[str]] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None
) -> SiteManager:
    """Create a new site manager"""
    db = get_db_session()
    try:
        manager = SiteManager(
            name=name,
            employee_id=employee_id,
            managed_sites=managed_sites or [],
            email=email,
            phone=phone
        )
        db.add(manager)
        db.commit()
        db.refresh(manager)
        logger.info(f"Created site manager: {manager.name} (ID: {manager.id})")
        return manager
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create site manager: {e}")
        raise
    finally:
        db.close()


def get_site_manager(manager_id: int) -> Optional[SiteManager]:
    """Get a site manager by ID"""
    db = get_db_session()
    try:
        return db.query(SiteManager).filter(SiteManager.id == manager_id).first()
    finally:
        db.close()


def get_site_manager_by_employee_id(employee_id: str) -> Optional[SiteManager]:
    """Get a site manager by employee ID"""
    db = get_db_session()
    try:
        return db.query(SiteManager).filter(SiteManager.employee_id == employee_id).first()
    finally:
        db.close()


def get_all_site_managers(active_only: bool = True) -> List[SiteManager]:
    """Get all site managers"""
    db = get_db_session()
    try:
        query = db.query(SiteManager)
        if active_only:
            query = query.filter(SiteManager.is_active == True)
        return query.order_by(SiteManager.name).all()
    finally:
        db.close()


# ============================================
# DAILY UPDATE CRUD OPERATIONS
# ============================================

def create_daily_update(
    worker_id: int,
    original_message: str,
    summary: Optional[str] = None,
    update_date: Optional[date] = None,
    audio_path: Optional[str] = None,
    summary_audio_path: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> DailyUpdate:
    """Create a new daily update"""
    db = get_db_session()
    try:
        update = DailyUpdate(
            worker_id=worker_id,
            update_date=update_date or date.today(),
            original_message=original_message,
            summary=summary,
            audio_path=audio_path,
            summary_audio_path=summary_audio_path,
            update_metadata=metadata
        )
        db.add(update)
        db.commit()
        # Re-query with eager loading to get worker relationship
        update = db.query(DailyUpdate).options(joinedload(DailyUpdate.worker)).filter(DailyUpdate.id == update.id).first()
        logger.info(f"Created daily update for worker {worker_id}: {update.id}")
        return update
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create daily update: {e}")
        raise
    finally:
        db.close()


def update_daily_update_summary(update_id: int, summary: str, summary_audio_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Update the summary for a daily update"""
    db = get_db_session()
    try:
        update = db.query(DailyUpdate).options(joinedload(DailyUpdate.worker)).filter(DailyUpdate.id == update_id).first()
        if update:
            update.summary = summary
            if summary_audio_path:
                update.summary_audio_path = summary_audio_path
            db.commit()
            db.refresh(update)
            logger.info(f"Updated summary for daily update {update_id}")
            # Convert to dict while session is still open
            return update.to_dict()
        return None
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update daily update summary: {e}")
        raise
    finally:
        db.close()


def get_daily_update(update_id: int) -> Optional[DailyUpdate]:
    """Get a daily update by ID"""
    db = get_db_session()
    try:
        return db.query(DailyUpdate).options(joinedload(DailyUpdate.worker)).filter(DailyUpdate.id == update_id).first()
    finally:
        db.close()


def get_worker_updates(
    worker_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = 30
) -> List[DailyUpdate]:
    """Get daily updates for a specific worker"""
    db = get_db_session()
    try:
        query = db.query(DailyUpdate).options(joinedload(DailyUpdate.worker)).filter(DailyUpdate.worker_id == worker_id)
        if start_date:
            query = query.filter(DailyUpdate.update_date >= start_date)
        if end_date:
            query = query.filter(DailyUpdate.update_date <= end_date)
        return query.order_by(DailyUpdate.update_date.desc()).limit(limit).all()
    finally:
        db.close()


def get_updates_by_date(
    target_date: date,
    site_location: Optional[str] = None
) -> List[DailyUpdate]:
    """Get all daily updates for a specific date, optionally filtered by site"""
    db = get_db_session()
    try:
        query = db.query(DailyUpdate).options(joinedload(DailyUpdate.worker)).join(SiteWorker).filter(DailyUpdate.update_date == target_date)
        if site_location:
            query = query.filter(SiteWorker.site_location == site_location)
        return query.order_by(SiteWorker.name).all()
    finally:
        db.close()


def get_updates_for_workers(
    worker_ids: List[int],
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit_per_worker: int = 7
) -> List[DailyUpdate]:
    """Get daily updates for multiple workers"""
    db = get_db_session()
    try:
        query = db.query(DailyUpdate).options(joinedload(DailyUpdate.worker)).filter(DailyUpdate.worker_id.in_(worker_ids))
        if start_date:
            query = query.filter(DailyUpdate.update_date >= start_date)
        if end_date:
            query = query.filter(DailyUpdate.update_date <= end_date)
        return query.order_by(DailyUpdate.update_date.desc(), DailyUpdate.worker_id).all()
    finally:
        db.close()


def get_todays_updates(site_location: Optional[str] = None) -> List[DailyUpdate]:
    """Get all updates for today"""
    return get_updates_by_date(date.today(), site_location)


def get_unique_sites() -> List[str]:
    """Get list of unique site locations"""
    db = get_db_session()
    try:
        sites = db.query(SiteWorker.site_location).distinct().filter(
            SiteWorker.site_location.isnot(None)
        ).all()
        return [site[0] for site in sites if site[0]]
    finally:
        db.close()


# ============================================
# MANAGER QUERY CRUD OPERATIONS
# ============================================

def create_manager_query(
    manager_id: int,
    query_type: str,
    question: str,
    worker_ids: Optional[List[int]] = None,
    answer: Optional[str] = None,
    answer_audio_path: Optional[str] = None,
    context_used: Optional[Dict[str, Any]] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> ManagerQuery:
    """Create a new manager query"""
    db = get_db_session()
    try:
        query = ManagerQuery(
            manager_id=manager_id,
            query_type=query_type,
            worker_ids=worker_ids or [],
            question=question,
            answer=answer,
            answer_audio_path=answer_audio_path,
            context_used=context_used,
            query_metadata=metadata
        )
        db.add(query)
        db.commit()
        # Re-query with eager loading
        query = db.query(ManagerQuery).options(joinedload(ManagerQuery.manager)).filter(ManagerQuery.id == query.id).first()
        logger.info(f"Created manager query for manager {manager_id}: {query.id}")
        return query
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create manager query: {e}")
        raise
    finally:
        db.close()


def update_manager_query_answer(
    query_id: int,
    answer: str,
    answer_audio_path: Optional[str] = None,
    context_used: Optional[Dict[str, Any]] = None
) -> Optional[Dict[str, Any]]:
    """Update the answer for a manager query"""
    db = get_db_session()
    try:
        query = db.query(ManagerQuery).options(joinedload(ManagerQuery.manager)).filter(ManagerQuery.id == query_id).first()
        if query:
            query.answer = answer
            if answer_audio_path:
                query.answer_audio_path = answer_audio_path
            if context_used:
                query.context_used = context_used
            db.commit()
            db.refresh(query)
            logger.info(f"Updated answer for manager query {query_id}")
            # Return dict while session is open
            return query.to_dict()
        return None
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update manager query answer: {e}")
        raise
    finally:
        db.close()


def get_manager_queries(manager_id: int, limit: int = 20) -> List[ManagerQuery]:
    """Get queries made by a specific manager"""
    db = get_db_session()
    try:
        return db.query(ManagerQuery).options(joinedload(ManagerQuery.manager)).filter(
            ManagerQuery.manager_id == manager_id
        ).order_by(ManagerQuery.created_at.desc()).limit(limit).all()
    finally:
        db.close()


# ============================================
# ORIGINAL CONVERSATION CRUD (preserved)
# ============================================

def save_conversation(
    user_input: str,
    assistant_response: str,
    user_id: str = "default_user",
    audio_path: Optional[str] = None,
    conversation_metadata: Optional[Dict[str, Any]] = None
) -> Conversation:
    """Save a conversation to database"""
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
    """Get recent conversations for a user"""
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
    """Get a specific conversation by ID"""
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
    """Delete a conversation by ID"""
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
