"""
Q&A Service for Construction Site Updates
Allows managers to ask questions about worker updates
"""
import logging
from typing import Optional, Dict, Any, List
from datetime import date, timedelta
from ..llm.ollama_service import OllamaLLM
from ..database.models import (
    get_worker_updates,
    get_updates_for_workers,
    get_site_worker,
    DailyUpdate
)

logger = logging.getLogger(__name__)


SINGLE_WORKER_SYSTEM_PROMPT = """You are an AI assistant answering questions about worker updates.

CRITICAL RULES - FOLLOW STRICTLY:
1. Answer ONLY using information explicitly stated in the provided updates
2. DO NOT make up, infer, or assume ANY information
3. DO NOT add details that are not in the updates
4. If the answer is not in the updates, say "This information was not mentioned in the updates"
5. When citing information, reference the specific date it was mentioned
6. Be concise and factual

If asked about something not covered in the updates, clearly state it wasn't mentioned.
Never fabricate or guess information."""


MULTI_WORKER_SYSTEM_PROMPT = """You are an AI assistant answering questions about multiple workers' updates.

CRITICAL RULES - FOLLOW STRICTLY:
1. Answer ONLY using information explicitly stated in the provided updates
2. DO NOT make up, infer, or assume ANY information
3. DO NOT add details that are not in the updates
4. Always specify which worker said what
5. If information is not available, say "This was not mentioned in the updates"
6. Do not draw conclusions beyond what workers explicitly stated

Only report facts from the updates. Never fabricate information."""


class QAService:
    """Service for answering manager questions about construction updates"""

    def __init__(self, llm_service: Optional[OllamaLLM] = None):
        """
        Initialize the Q&A service

        Args:
            llm_service: Optional LLM service instance
        """
        self.llm = llm_service or OllamaLLM()
        logger.info("QAService initialized")

    def _format_update_for_context(self, update: DailyUpdate) -> str:
        """Format a single update for LLM context"""
        worker_name = update.worker.name if update.worker else "Unknown Worker"
        worker_role = update.worker.role if update.worker else "Worker"
        date_str = update.update_date.strftime("%Y-%m-%d") if update.update_date else "Unknown Date"

        return f"""[{date_str}] {worker_name} ({worker_role}):
Original: {update.original_message}
Summary: {update.summary or 'No summary available'}
---"""

    def _build_context_from_updates(self, updates: List[DailyUpdate]) -> str:
        """Build context string from list of updates"""
        if not updates:
            return "No updates available for the specified criteria."

        formatted_updates = [self._format_update_for_context(u) for u in updates]
        return "\n".join(formatted_updates)

    async def answer_single_worker_question(
        self,
        question: str,
        worker_id: int,
        days_back: int = 7
    ) -> Dict[str, Any]:
        """
        Answer a question about a single worker's updates

        Args:
            question: The manager's question
            worker_id: ID of the worker to query about
            days_back: Number of days of history to consider

        Returns:
            Dict containing answer and metadata
        """
        try:
            # Get worker info
            worker = get_site_worker(worker_id)
            if not worker:
                return {
                    "answer": f"Worker with ID {worker_id} not found.",
                    "error": "Worker not found"
                }

            # Get recent updates
            start_date = date.today() - timedelta(days=days_back)
            updates = get_worker_updates(
                worker_id=worker_id,
                start_date=start_date,
                limit=days_back * 2  # Allow for multiple updates per day
            )

            if not updates:
                return {
                    "answer": f"No updates found for {worker.name} in the last {days_back} days.",
                    "context_summary": {"worker": worker.name, "updates_found": 0}
                }

            # Build context
            context = self._build_context_from_updates(updates)

            # Create prompt
            prompt = f"""Answer this question using ONLY the information in the updates below. Do not add any information not explicitly stated.

Question: {question}

Updates from {worker.name} ({worker.role or 'Worker'}):
{context}

IMPORTANT: If the answer is not in the updates above, say "This information was not mentioned in the updates." Do not guess or make up information."""

            # Generate answer
            result = await self.llm.generate_response(
                prompt=prompt,
                system_prompt=SINGLE_WORKER_SYSTEM_PROMPT
            )

            answer = result.get("answer", "Unable to generate answer.")

            logger.info(f"Answered question about worker {worker_id}: '{question[:50]}...'")

            return {
                "answer": answer,
                "worker": worker.to_dict(),
                "updates_analyzed": len(updates),
                "date_range": {
                    "start": start_date.isoformat(),
                    "end": date.today().isoformat()
                },
                "model": result.get("model"),
                "token_usage": result.get("token_usage"),
                "context_summary": {
                    "worker_name": worker.name,
                    "worker_role": worker.role,
                    "updates_count": len(updates)
                }
            }

        except Exception as e:
            logger.error(f"Error answering single worker question: {e}")
            return {
                "answer": f"Error processing question: {str(e)}",
                "error": str(e)
            }

    async def answer_multi_worker_question(
        self,
        question: str,
        worker_ids: List[int],
        days_back: int = 7
    ) -> Dict[str, Any]:
        """
        Answer a question about multiple workers' updates

        Args:
            question: The manager's question
            worker_ids: List of worker IDs to query about
            days_back: Number of days of history to consider

        Returns:
            Dict containing answer and metadata
        """
        try:
            if not worker_ids:
                return {
                    "answer": "No workers specified for the query.",
                    "error": "No worker IDs provided"
                }

            # Get updates for all workers
            start_date = date.today() - timedelta(days=days_back)
            updates = get_updates_for_workers(
                worker_ids=worker_ids,
                start_date=start_date
            )

            if not updates:
                return {
                    "answer": f"No updates found for the specified workers in the last {days_back} days.",
                    "context_summary": {"workers_queried": len(worker_ids), "updates_found": 0}
                }

            # Group updates by worker for better organization
            workers_info = {}
            for update in updates:
                if update.worker:
                    worker_name = update.worker.name
                    if worker_name not in workers_info:
                        workers_info[worker_name] = {
                            "role": update.worker.role,
                            "update_count": 0
                        }
                    workers_info[worker_name]["update_count"] += 1

            # Build context
            context = self._build_context_from_updates(updates)

            # Create prompt
            worker_list = ", ".join([f"{name} ({info['role'] or 'Worker'})" for name, info in workers_info.items()])

            prompt = f"""Answer this question using ONLY the information in the updates below. Do not add any information not explicitly stated.

Question: {question}

Updates from workers ({worker_list}):
{context}

IMPORTANT: Only use information explicitly stated above. Specify which worker mentioned what. If something is not in the updates, say "This was not mentioned in the updates." Do not guess or fabricate information."""

            # Generate answer
            result = await self.llm.generate_response(
                prompt=prompt,
                system_prompt=MULTI_WORKER_SYSTEM_PROMPT
            )

            answer = result.get("answer", "Unable to generate answer.")

            logger.info(f"Answered multi-worker question for {len(worker_ids)} workers: '{question[:50]}...'")

            return {
                "answer": answer,
                "workers_analyzed": list(workers_info.keys()),
                "updates_analyzed": len(updates),
                "date_range": {
                    "start": start_date.isoformat(),
                    "end": date.today().isoformat()
                },
                "model": result.get("model"),
                "token_usage": result.get("token_usage"),
                "context_summary": {
                    "worker_count": len(workers_info),
                    "workers": workers_info,
                    "total_updates": len(updates)
                }
            }

        except Exception as e:
            logger.error(f"Error answering multi-worker question: {e}")
            return {
                "answer": f"Error processing question: {str(e)}",
                "error": str(e)
            }

    async def get_site_summary(
        self,
        site_location: str,
        target_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Get a summary of all activity at a specific site

        Args:
            site_location: The site location to summarize
            target_date: Date to summarize (defaults to today)

        Returns:
            Dict containing site summary
        """
        try:
            from ..database.models import get_updates_by_date, get_all_site_workers

            target = target_date or date.today()

            # Get all workers at this site
            workers = get_all_site_workers(site_location=site_location)
            if not workers:
                return {
                    "summary": f"No workers registered at site: {site_location}",
                    "error": "No workers found"
                }

            # Get updates for this date
            updates = get_updates_by_date(target, site_location=site_location)

            if not updates:
                return {
                    "summary": f"No updates submitted for {site_location} on {target.isoformat()}",
                    "workers_at_site": len(workers),
                    "updates_submitted": 0
                }

            # Build context
            context = self._build_context_from_updates(updates)

            prompt = f"""Summarize ONLY what workers reported for site "{site_location}" today:

{context}

Summarize ONLY:
- What work was actually mentioned
- Issues explicitly stated by workers
- Any other details workers actually reported

Do NOT add recommendations, predictions, or information not in the updates."""

            system_prompt = """You are a construction site report summarizer.
CRITICAL: Only include information explicitly stated by workers.
DO NOT add recommendations, suggestions, or inferred information.
Simply condense what workers actually reported.
Respond with the summary only."""

            result = await self.llm.generate_response(
                prompt=prompt,
                system_prompt=system_prompt
            )

            summary = result.get("answer", "Unable to generate site summary.")

            return {
                "summary": summary,
                "site_location": site_location,
                "date": target.isoformat(),
                "workers_at_site": len(workers),
                "updates_submitted": len(updates),
                "reporting_rate": f"{len(updates)}/{len(workers)} workers reported",
                "model": result.get("model")
            }

        except Exception as e:
            logger.error(f"Error generating site summary: {e}")
            return {
                "summary": f"Error generating summary: {str(e)}",
                "error": str(e)
            }

    async def compare_workers(
        self,
        worker_ids: List[int],
        comparison_aspect: str = "progress"
    ) -> Dict[str, Any]:
        """
        Compare progress or updates between workers

        Args:
            worker_ids: List of worker IDs to compare
            comparison_aspect: What to compare (progress, issues, productivity)

        Returns:
            Dict containing comparison analysis
        """
        try:
            if len(worker_ids) < 2:
                return {
                    "comparison": "Need at least 2 workers to compare.",
                    "error": "Insufficient workers"
                }

            # Get recent updates for all workers
            start_date = date.today() - timedelta(days=7)
            updates = get_updates_for_workers(worker_ids, start_date=start_date)

            if not updates:
                return {
                    "comparison": "No updates available for comparison.",
                    "error": "No updates found"
                }

            context = self._build_context_from_updates(updates)

            prompt = f"""Compare what these workers reported, focusing on {comparison_aspect}:

{context}

ONLY report:
- What each worker actually stated about {comparison_aspect}
- Differences in what they reported

DO NOT add performance judgments, recommendations, or inferred information. Only use facts from the updates."""

            system_prompt = f"""You are comparing worker reports.
CRITICAL: Only state facts from the updates. Do not judge performance.
Do not add recommendations or inferred information.
Simply report what each worker stated about {comparison_aspect}."""

            result = await self.llm.generate_response(
                prompt=prompt,
                system_prompt=system_prompt
            )

            return {
                "comparison": result.get("answer", "Unable to generate comparison."),
                "workers_compared": len(worker_ids),
                "comparison_aspect": comparison_aspect,
                "updates_analyzed": len(updates),
                "model": result.get("model")
            }

        except Exception as e:
            logger.error(f"Error comparing workers: {e}")
            return {
                "comparison": f"Error: {str(e)}",
                "error": str(e)
            }

