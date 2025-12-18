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


SINGLE_WORKER_SYSTEM_PROMPT = """You are an AI assistant helping a construction site manager understand worker updates.

You have access to the recent updates from a specific worker. Answer questions based ONLY on the information provided in the context.

Be specific and cite which update or date you're referring to when answering.
If the information isn't in the provided updates, say so clearly.
Keep responses concise but informative.

Respond with a clear, direct answer. No JSON formatting needed."""


MULTI_WORKER_SYSTEM_PROMPT = """You are an AI assistant helping a construction site manager understand updates from multiple workers.

You have access to recent updates from several workers. When answering:
1. Provide a comprehensive answer considering all workers
2. Compare or contrast information between workers when relevant
3. Identify patterns or common themes
4. Be specific about which worker said what
5. If information isn't available, say so clearly

Respond with a clear, organized answer. No JSON formatting needed."""


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
            prompt = f"""Based on the following updates from {worker.name} ({worker.role or 'Worker'}), answer this question:

Question: {question}

Worker Updates:
{context}

Please provide a clear, specific answer based on the updates above."""

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

            prompt = f"""Based on updates from the following workers: {worker_list}

Answer this question:
{question}

Worker Updates:
{context}

Provide a comprehensive answer that considers information from all workers. Note any differences or patterns between workers."""

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

            prompt = f"""Create an executive summary for site "{site_location}" based on today's worker updates:

{context}

Include:
1. Overall progress and accomplishments
2. Active work areas
3. Issues or blockers affecting the site
4. Safety observations
5. Recommendations for tomorrow"""

            system_prompt = """You are a construction site coordinator creating daily site summaries.
Be concise but comprehensive. Prioritize actionable information.
Respond with the summary only, no JSON."""

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

            prompt = f"""Compare the following workers based on their recent updates, focusing on {comparison_aspect}:

{context}

Provide a comparison that:
1. Highlights differences in {comparison_aspect} between workers
2. Identifies top performers
3. Notes any concerns or areas needing attention
4. Provides actionable recommendations"""

            system_prompt = f"""You are helping a construction site manager compare worker performance.
Focus on {comparison_aspect} metrics and provide objective, fair comparisons.
Base your analysis only on the provided updates."""

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

