"""
Manager API Router - Endpoints for site managers to review updates and ask questions
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, timedelta
import logging
import base64

from ..database.models import (
    create_site_manager,
    get_site_manager,
    get_site_manager_by_employee_id,
    get_all_site_managers,
    get_all_site_workers,
    get_updates_by_date,
    get_todays_updates,
    get_daily_update,
    create_manager_query,
    update_manager_query_answer,
    get_manager_queries,
    get_unique_sites
)
from ..stt.whisper_service import WhisperSTT
from ..tts.piper_service import PiperTTS
from ..services.qa_service import QAService
from ..services.summarization import SummarizationService
from ..llm.ollama_service import OllamaLLM

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/manager", tags=["manager"])

# Initialize services (will be properly injected in main.py)
stt_service = None
tts_service = None
llm_service = None
qa_service = None
summarization_service = None


def init_manager_services(stt: WhisperSTT, tts: PiperTTS, llm: OllamaLLM):
    """Initialize services for manager router"""
    global stt_service, tts_service, llm_service, qa_service, summarization_service
    stt_service = stt
    tts_service = tts
    llm_service = llm
    qa_service = QAService(llm)
    summarization_service = SummarizationService(llm)
    logger.info("Manager router services initialized")


# ============================================
# REQUEST/RESPONSE MODELS
# ============================================

class ManagerRegistration(BaseModel):
    name: str
    employee_id: str
    managed_sites: Optional[List[str]] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class TextQuestion(BaseModel):
    question: str
    worker_id: Optional[int] = None
    worker_ids: Optional[List[int]] = None
    days_back: int = 7


# ============================================
# MANAGER REGISTRATION ENDPOINTS
# ============================================

@router.post("/register", response_model=dict)
async def register_manager(manager: ManagerRegistration):
    """Register a new site manager"""
    try:
        # Check if employee ID already exists
        existing = get_site_manager_by_employee_id(manager.employee_id)
        if existing:
            return {
                "success": True,
                "message": "Manager already registered",
                "manager": existing.to_dict()
            }

        new_manager = create_site_manager(
            name=manager.name,
            employee_id=manager.employee_id,
            managed_sites=manager.managed_sites,
            email=manager.email,
            phone=manager.phone
        )

        logger.info(f"Registered new manager: {new_manager.name} ({new_manager.employee_id})")

        return {
            "success": True,
            "message": "Manager registered successfully",
            "manager": new_manager.to_dict()
        }

    except Exception as e:
        logger.error(f"Error registering manager: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{manager_id}", response_model=dict)
async def get_manager(manager_id: int):
    """Get manager details by ID"""
    manager = get_site_manager(manager_id)
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")

    return {"manager": manager.to_dict()}


# ============================================
# UPDATE SUMMARY ENDPOINTS
# ============================================

@router.get("/updates/today", response_model=dict)
async def get_today_updates(site_location: Optional[str] = None):
    """Get all updates submitted today"""
    updates = get_todays_updates(site_location=site_location)

    return {
        "date": date.today().isoformat(),
        "site_location": site_location,
        "updates": [u.to_dict() for u in updates],
        "total": len(updates)
    }


@router.get("/updates/by-date", response_model=dict)
async def get_updates_for_date(
    target_date: str = Query(..., description="Date in YYYY-MM-DD format"),
    site_location: Optional[str] = None
):
    """Get all updates for a specific date"""
    try:
        parsed_date = date.fromisoformat(target_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    updates = get_updates_by_date(parsed_date, site_location=site_location)

    return {
        "date": parsed_date.isoformat(),
        "site_location": site_location,
        "updates": [u.to_dict() for u in updates],
        "total": len(updates)
    }


@router.get("/updates/summary", response_model=dict)
async def get_aggregated_summary(
    target_date: Optional[str] = None,
    site_location: Optional[str] = None
):
    """Get an aggregated summary of updates for a date/site"""
    global summarization_service

    if not summarization_service:
        raise HTTPException(status_code=500, detail="Services not initialized")

    try:
        parsed_date = date.fromisoformat(target_date) if target_date else date.today()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    updates = get_updates_by_date(parsed_date, site_location=site_location)

    if not updates:
        return {
            "date": parsed_date.isoformat(),
            "site_location": site_location,
            "summary": "No updates available for the specified date/location",
            "update_count": 0
        }

    # Prepare updates for aggregation
    update_dicts = []
    for u in updates:
        update_dicts.append({
            "worker_name": u.worker.name if u.worker else "Unknown",
            "worker_role": u.worker.role if u.worker else "Worker",
            "original_message": u.original_message,
            "summary": u.summary
        })

    # Generate aggregated summary
    result = await summarization_service.summarize_multiple_updates(
        updates=update_dicts,
        aggregation_type="daily"
    )

    # Generate audio for summary
    summary_audio = None
    if tts_service and result.get("summary"):
        try:
            audio_bytes = await tts_service.synthesize_speech(result["summary"])
            if audio_bytes:
                summary_audio = base64.b64encode(audio_bytes).decode('utf-8')
        except Exception as e:
            logger.warning(f"TTS failed: {e}")

    return {
        "date": parsed_date.isoformat(),
        "site_location": site_location,
        "summary": result.get("summary"),
        "update_count": result.get("update_count"),
        "summary_audio": summary_audio,
        "metadata": {
            "model": result.get("model"),
            "token_usage": result.get("token_usage")
        }
    }


@router.get("/updates/{update_id}/audio", response_model=dict)
async def get_update_audio(update_id: int, content_type: str = "summary"):
    """Get audio playback for an update (summary or original)"""
    global tts_service

    if not tts_service:
        raise HTTPException(status_code=500, detail="TTS service not initialized")

    update = get_daily_update(update_id)
    if not update:
        raise HTTPException(status_code=404, detail="Update not found")

    # Choose content to synthesize
    if content_type == "summary":
        text = update.summary or "No summary available"
    elif content_type == "original":
        text = update.original_message
    else:
        raise HTTPException(status_code=400, detail="content_type must be 'summary' or 'original'")

    try:
        audio_bytes = await tts_service.synthesize_speech(text)
        if audio_bytes:
            audio_data = base64.b64encode(audio_bytes).decode('utf-8')
            return {
                "update_id": update_id,
                "content_type": content_type,
                "text": text,
                "audio_data": audio_data
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to generate audio")
    except Exception as e:
        logger.error(f"Error generating audio: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# Q&A ENDPOINTS
# ============================================

@router.post("/query/single", response_model=dict)
async def query_single_worker(
    manager_id: int,
    question_data: TextQuestion
):
    """
    Ask a question about a single worker's updates
    Can use text question or voice input
    """
    global qa_service

    if not qa_service:
        raise HTTPException(status_code=500, detail="Services not initialized")

    if not question_data.worker_id:
        raise HTTPException(status_code=400, detail="worker_id is required for single worker query")

    # Verify manager exists
    manager = get_site_manager(manager_id)
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")

    try:
        # Get answer from Q&A service
        result = await qa_service.answer_single_worker_question(
            question=question_data.question,
            worker_id=question_data.worker_id,
            days_back=question_data.days_back
        )

        # Store the query
        query_record = create_manager_query(
            manager_id=manager_id,
            query_type="single",
            question=question_data.question,
            worker_ids=[question_data.worker_id],
            answer=result.get("answer"),
            context_used=result.get("context_summary")
        )

        # Generate audio for answer
        answer_audio = None
        if tts_service and result.get("answer"):
            try:
                audio_bytes = await tts_service.synthesize_speech(result["answer"])
                if audio_bytes:
                    answer_audio = base64.b64encode(audio_bytes).decode('utf-8')
            except Exception as e:
                logger.warning(f"TTS failed: {e}")

        return {
            "query_id": query_record.id if query_record else None,
            "question": question_data.question,
            "answer": result.get("answer"),
            "answer_audio": answer_audio,
            "worker": result.get("worker"),
            "updates_analyzed": result.get("updates_analyzed"),
            "date_range": result.get("date_range"),
            "metadata": {
                "model": result.get("model"),
                "token_usage": result.get("token_usage")
            }
        }

    except Exception as e:
        logger.error(f"Error processing single worker query: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/query/multiple", response_model=dict)
async def query_multiple_workers(
    manager_id: int,
    question_data: TextQuestion
):
    """
    Ask a question about multiple workers' updates
    """
    global qa_service

    if not qa_service:
        raise HTTPException(status_code=500, detail="Services not initialized")

    if not question_data.worker_ids or len(question_data.worker_ids) == 0:
        raise HTTPException(status_code=400, detail="worker_ids is required for multi-worker query")

    # Verify manager exists
    manager = get_site_manager(manager_id)
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")

    try:
        # Get answer from Q&A service
        result = await qa_service.answer_multi_worker_question(
            question=question_data.question,
            worker_ids=question_data.worker_ids,
            days_back=question_data.days_back
        )

        # Store the query
        query_record = create_manager_query(
            manager_id=manager_id,
            query_type="multiple",
            question=question_data.question,
            worker_ids=question_data.worker_ids,
            answer=result.get("answer"),
            context_used=result.get("context_summary")
        )

        # Generate audio for answer
        answer_audio = None
        if tts_service and result.get("answer"):
            try:
                audio_bytes = await tts_service.synthesize_speech(result["answer"])
                if audio_bytes:
                    answer_audio = base64.b64encode(audio_bytes).decode('utf-8')
            except Exception as e:
                logger.warning(f"TTS failed: {e}")

        return {
            "query_id": query_record.id if query_record else None,
            "question": question_data.question,
            "answer": result.get("answer"),
            "answer_audio": answer_audio,
            "workers_analyzed": result.get("workers_analyzed"),
            "updates_analyzed": result.get("updates_analyzed"),
            "date_range": result.get("date_range"),
            "metadata": {
                "model": result.get("model"),
                "token_usage": result.get("token_usage")
            }
        }

    except Exception as e:
        logger.error(f"Error processing multi-worker query: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/query/voice", response_model=dict)
async def query_with_voice(
    manager_id: int,
    file: UploadFile = File(...),
    worker_id: Optional[int] = None,
    worker_ids: Optional[str] = None,
    days_back: int = 7
):
    """
    Ask a question using voice input
    Transcribes the question and then processes it
    """
    global stt_service, qa_service

    if not stt_service or not qa_service:
        raise HTTPException(status_code=500, detail="Services not initialized")

    # Verify manager exists
    manager = get_site_manager(manager_id)
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")

    try:
        # Read and transcribe audio
        audio_data = await file.read()
        if len(audio_data) < 100:
            raise HTTPException(status_code=400, detail="Audio data too small")

        question = await stt_service.transcribe_audio(audio_data)
        if not question or question.strip() == "":
            raise HTTPException(status_code=400, detail="Could not transcribe question")

        logger.info(f"Transcribed question: {question}")

        # Parse worker_ids if provided as string
        parsed_worker_ids = None
        if worker_ids:
            try:
                parsed_worker_ids = [int(x.strip()) for x in worker_ids.split(",")]
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid worker_ids format")

        # Determine query type and process
        if worker_id:
            result = await qa_service.answer_single_worker_question(
                question=question,
                worker_id=worker_id,
                days_back=days_back
            )
            query_type = "single"
            query_worker_ids = [worker_id]
        elif parsed_worker_ids:
            result = await qa_service.answer_multi_worker_question(
                question=question,
                worker_ids=parsed_worker_ids,
                days_back=days_back
            )
            query_type = "multiple"
            query_worker_ids = parsed_worker_ids
        else:
            raise HTTPException(
                status_code=400,
                detail="Either worker_id or worker_ids must be provided"
            )

        # Store the query
        query_record = create_manager_query(
            manager_id=manager_id,
            query_type=query_type,
            question=question,
            worker_ids=query_worker_ids,
            answer=result.get("answer"),
            context_used=result.get("context_summary")
        )

        # Generate audio for answer
        answer_audio = None
        if tts_service and result.get("answer"):
            try:
                audio_bytes = await tts_service.synthesize_speech(result["answer"])
                if audio_bytes:
                    answer_audio = base64.b64encode(audio_bytes).decode('utf-8')
            except Exception as e:
                logger.warning(f"TTS failed: {e}")

        return {
            "query_id": query_record.id if query_record else None,
            "transcribed_question": question,
            "answer": result.get("answer"),
            "answer_audio": answer_audio,
            "query_type": query_type,
            "updates_analyzed": result.get("updates_analyzed"),
            "metadata": {
                "model": result.get("model")
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing voice query: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/site/summary/{site_location}", response_model=dict)
async def get_site_summary(
    site_location: str,
    target_date: Optional[str] = None
):
    """Get a comprehensive summary for a specific site"""
    global qa_service

    if not qa_service:
        raise HTTPException(status_code=500, detail="Services not initialized")

    try:
        parsed_date = date.fromisoformat(target_date) if target_date else None
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    result = await qa_service.get_site_summary(
        site_location=site_location,
        target_date=parsed_date
    )

    # Generate audio for summary
    summary_audio = None
    if tts_service and result.get("summary") and "error" not in result:
        try:
            audio_bytes = await tts_service.synthesize_speech(result["summary"])
            if audio_bytes:
                summary_audio = base64.b64encode(audio_bytes).decode('utf-8')
        except Exception as e:
            logger.warning(f"TTS failed: {e}")

    result["summary_audio"] = summary_audio
    return result


@router.get("/query/history/{manager_id}", response_model=dict)
async def get_query_history(
    manager_id: int,
    limit: int = Query(default=20, ge=1, le=100)
):
    """Get query history for a manager"""
    manager = get_site_manager(manager_id)
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")

    queries = get_manager_queries(manager_id, limit=limit)

    return {
        "manager": manager.to_dict(),
        "queries": [q.to_dict() for q in queries],
        "total": len(queries)
    }


# ============================================
# GENERAL ENDPOINTS
# ============================================

@router.get("/workers/list", response_model=dict)
async def list_all_workers(site_location: Optional[str] = None):
    """List all workers for the manager to select"""
    workers = get_all_site_workers(site_location=site_location)

    return {
        "workers": [w.to_dict() for w in workers],
        "total": len(workers)
    }


@router.get("/sites/list", response_model=dict)
async def list_all_sites():
    """Get list of all unique site locations"""
    sites = get_unique_sites()
    return {
        "sites": sites,
        "total": len(sites)
    }


@router.get("/managers/list", response_model=dict)
async def list_managers():
    """List all managers"""
    managers = get_all_site_managers()

    return {
        "managers": [m.to_dict() for m in managers],
        "total": len(managers)
    }

