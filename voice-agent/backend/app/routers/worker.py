"""
Worker API Router - Endpoints for site workers to submit daily updates
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
import logging
import base64

from ..database.models import (
    create_site_worker,
    get_site_worker,
    get_site_worker_by_employee_id,
    get_all_site_workers,
    create_daily_update,
    update_daily_update_summary,
    get_worker_updates,
    get_unique_sites
)
from ..stt.whisper_service import WhisperSTT
from ..tts.piper_service import PiperTTS
from ..services.summarization import SummarizationService
from ..llm.ollama_service import OllamaLLM

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/worker", tags=["worker"])

# Initialize services (will be properly injected in main.py)
stt_service = None
tts_service = None
llm_service = None
summarization_service = None


def init_worker_services(stt: WhisperSTT, tts: PiperTTS, llm: OllamaLLM):
    """Initialize services for worker router"""
    global stt_service, tts_service, llm_service, summarization_service
    stt_service = stt
    tts_service = tts
    llm_service = llm
    summarization_service = SummarizationService(llm)
    logger.info("Worker router services initialized")


# ============================================
# REQUEST/RESPONSE MODELS
# ============================================

class WorkerRegistration(BaseModel):
    name: str
    employee_id: str
    site_location: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None


class WorkerResponse(BaseModel):
    id: int
    name: str
    employee_id: str
    site_location: Optional[str]
    role: Optional[str]
    phone: Optional[str]
    is_active: bool


# ============================================
# WORKER REGISTRATION ENDPOINTS
# ============================================

@router.post("/register", response_model=dict)
async def register_worker(worker: WorkerRegistration):
    """Register a new site worker"""
    try:
        # Check if employee ID already exists
        existing = get_site_worker_by_employee_id(worker.employee_id)
        if existing:
            return {
                "success": True,
                "message": "Worker already registered",
                "worker": existing.to_dict()
            }

        new_worker = create_site_worker(
            name=worker.name,
            employee_id=worker.employee_id,
            site_location=worker.site_location,
            role=worker.role,
            phone=worker.phone
        )

        logger.info(f"Registered new worker: {new_worker.name} ({new_worker.employee_id})")

        return {
            "success": True,
            "message": "Worker registered successfully",
            "worker": new_worker.to_dict()
        }

    except Exception as e:
        logger.error(f"Error registering worker: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{worker_id}", response_model=dict)
async def get_worker(worker_id: int):
    """Get worker details by ID"""
    worker = get_site_worker(worker_id)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    return {"worker": worker.to_dict()}


@router.get("/employee/{employee_id}", response_model=dict)
async def get_worker_by_employee_id(employee_id: str):
    """Get worker details by employee ID"""
    worker = get_site_worker_by_employee_id(employee_id)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    return {"worker": worker.to_dict()}


# ============================================
# DAILY UPDATE ENDPOINTS
# ============================================

@router.post("/{worker_id}/update", response_model=dict)
async def submit_daily_update(
    worker_id: int,
    file: UploadFile = File(...)
):
    """
    Submit a daily voice update for a worker
    
    Process:
    1. Transcribe audio using Whisper
    2. Store original transcription
    3. Generate summary using LLM
    4. Store summary
    5. Return both with audio playback of summary
    """
    global stt_service, tts_service, summarization_service

    if not stt_service or not summarization_service:
        raise HTTPException(status_code=500, detail="Services not initialized")

    try:
        # Verify worker exists
        worker = get_site_worker(worker_id)
        if not worker:
            raise HTTPException(status_code=404, detail="Worker not found")

        # Read audio file
        audio_data = await file.read()
        logger.info(f"Received update audio for worker {worker_id}: {len(audio_data)} bytes")

        if len(audio_data) < 100:
            raise HTTPException(status_code=400, detail="Audio data too small")

        # Step 1: Transcribe audio
        logger.info("Transcribing worker update...")
        original_message = await stt_service.transcribe_audio(audio_data)

        if not original_message or original_message.strip() == "":
            raise HTTPException(status_code=400, detail="Could not transcribe audio")

        logger.info(f"Transcribed: {original_message[:100]}...")

        # Step 2: Create initial update record
        update = create_daily_update(
            worker_id=worker_id,
            original_message=original_message,
            update_date=date.today(),
            metadata={
                "audio_size": len(audio_data),
                "transcription_length": len(original_message)
            }
        )

        # Step 3: Generate summary
        logger.info("Generating summary...")
        summary_result = await summarization_service.summarize_update(
            original_message=original_message,
            worker_name=worker.name,
            worker_role=worker.role,
            site_location=worker.site_location
        )

        summary_text = summary_result.get("summary", "")

        # Step 4: Update record with summary (returns dict now)
        update_dict = update_daily_update_summary(update.id, summary_text)

        # Step 5: Generate audio for summary (optional - for playback)
        summary_audio = None
        if tts_service and summary_text:
            try:
                summary_audio_bytes = await tts_service.synthesize_speech(summary_text)
                if summary_audio_bytes:
                    summary_audio = base64.b64encode(summary_audio_bytes).decode('utf-8')
            except Exception as e:
                logger.warning(f"TTS failed for summary: {e}")

        update_id = update_dict.get("id") if update_dict else update.id
        logger.info(f"Daily update processed for worker {worker_id}: update_id={update_id}")

        return {
            "success": True,
            "update": update_dict,
            "original_message": original_message,
            "summary": summary_text,
            "summary_metadata": summary_result,
            "summary_audio": summary_audio,
            "message": "Daily update submitted and summarized successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing daily update: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{worker_id}/updates", response_model=dict)
async def get_worker_update_history(
    worker_id: int,
    days: int = Query(default=30, ge=1, le=365),
    limit: int = Query(default=30, ge=1, le=100)
):
    """Get update history for a worker"""
    worker = get_site_worker(worker_id)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    from datetime import timedelta
    start_date = date.today() - timedelta(days=days)

    updates = get_worker_updates(
        worker_id=worker_id,
        start_date=start_date,
        limit=limit
    )

    return {
        "worker": worker.to_dict(),
        "updates": [u.to_dict() for u in updates],
        "total_updates": len(updates),
        "date_range": {
            "start": start_date.isoformat(),
            "end": date.today().isoformat()
        }
    }


# ============================================
# GENERAL ENDPOINTS
# ============================================

@router.get("/", response_model=dict)
async def list_workers(
    site_location: Optional[str] = None,
    active_only: bool = True
):
    """List all workers, optionally filtered by site"""
    workers = get_all_site_workers(site_location=site_location, active_only=active_only)

    return {
        "workers": [w.to_dict() for w in workers],
        "total": len(workers),
        "filter": {
            "site_location": site_location,
            "active_only": active_only
        }
    }


@router.get("/sites/list", response_model=dict)
async def list_sites():
    """Get list of all unique site locations"""
    sites = get_unique_sites()
    return {
        "sites": sites,
        "total": len(sites)
    }

