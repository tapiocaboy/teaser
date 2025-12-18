"""
Summarization Service for Construction Site Daily Updates
Uses LLM to generate concise summaries of worker updates
"""
import logging
from typing import Optional, Dict, Any
from ..llm.ollama_service import OllamaLLM

logger = logging.getLogger(__name__)


SUMMARIZATION_SYSTEM_PROMPT = """You are a construction site update summarizer. Your job is to create concise, actionable summaries of daily worker updates.

When summarizing, focus on:
1. Work completed today (specific tasks and areas)
2. Materials used or needed
3. Issues, blockers, or delays encountered
4. Safety observations or concerns
5. Progress percentage or milestones reached
6. Weather impacts if mentioned
7. Coordination with other trades

Keep summaries under 100 words while preserving all critical details.
Format the summary as a clear, professional report.
Do not add information that wasn't in the original update.

Respond with ONLY the summary text, no JSON formatting."""


class SummarizationService:
    """Service for summarizing construction site daily updates"""

    def __init__(self, llm_service: Optional[OllamaLLM] = None):
        """
        Initialize the summarization service

        Args:
            llm_service: Optional LLM service instance (creates new one if not provided)
        """
        self.llm = llm_service or OllamaLLM()
        logger.info("SummarizationService initialized")

    async def summarize_update(
        self,
        original_message: str,
        worker_name: Optional[str] = None,
        worker_role: Optional[str] = None,
        site_location: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Summarize a single worker's daily update

        Args:
            original_message: The full transcribed update from the worker
            worker_name: Optional worker name for context
            worker_role: Optional worker role (e.g., "Electrician")
            site_location: Optional site location

        Returns:
            Dict containing summary and metadata
        """
        try:
            # Build context
            context_parts = []
            if worker_name:
                context_parts.append(f"Worker: {worker_name}")
            if worker_role:
                context_parts.append(f"Role: {worker_role}")
            if site_location:
                context_parts.append(f"Site: {site_location}")

            context = " | ".join(context_parts) if context_parts else None

            # Create prompt for summarization
            prompt = f"""Summarize this construction site daily update:

---
{original_message}
---

Provide a concise summary focusing on work done, materials, issues, and progress."""

            # Generate summary using LLM
            result = await self.llm.generate_response(
                prompt=prompt,
                context=context,
                system_prompt=SUMMARIZATION_SYSTEM_PROMPT
            )

            summary = result.get("answer", "Unable to generate summary.")

            logger.info(f"Generated summary ({len(summary)} chars) from update ({len(original_message)} chars)")

            return {
                "summary": summary,
                "original_length": len(original_message),
                "summary_length": len(summary),
                "compression_ratio": round(len(original_message) / max(len(summary), 1), 2),
                "model": result.get("model"),
                "token_usage": result.get("token_usage"),
            }

        except Exception as e:
            logger.error(f"Error summarizing update: {e}")
            return {
                "summary": f"Summary generation failed: {str(e)}",
                "original_length": len(original_message),
                "summary_length": 0,
                "error": str(e)
            }

    async def summarize_multiple_updates(
        self,
        updates: list,
        aggregation_type: str = "daily"
    ) -> Dict[str, Any]:
        """
        Create an aggregated summary from multiple worker updates

        Args:
            updates: List of update dictionaries with worker info and messages
            aggregation_type: Type of aggregation ("daily", "weekly", "site")

        Returns:
            Dict containing aggregated summary and metadata
        """
        try:
            if not updates:
                return {
                    "summary": "No updates to summarize.",
                    "update_count": 0
                }

            # Build combined context
            combined_updates = []
            for update in updates:
                worker_info = f"{update.get('worker_name', 'Unknown')} ({update.get('worker_role', 'Worker')})"
                message = update.get('original_message') or update.get('summary', '')
                combined_updates.append(f"[{worker_info}]: {message}")

            combined_text = "\n\n".join(combined_updates)

            # Create aggregation prompt
            if aggregation_type == "daily":
                prompt_intro = "Create a daily site summary from these worker updates:"
            elif aggregation_type == "weekly":
                prompt_intro = "Create a weekly progress summary from these worker updates:"
            else:
                prompt_intro = "Create a comprehensive site summary from these worker updates:"

            prompt = f"""{prompt_intro}

---
{combined_text}
---

Provide an executive summary highlighting:
1. Overall progress across all workers
2. Key accomplishments
3. Common issues or blockers
4. Safety concerns if any
5. Recommendations or priorities"""

            system_prompt = """You are a construction site project coordinator. 
Create executive summaries that help site managers understand overall progress.
Be concise but comprehensive. Highlight patterns across workers.
Respond with ONLY the summary text."""

            result = await self.llm.generate_response(
                prompt=prompt,
                system_prompt=system_prompt
            )

            summary = result.get("answer", "Unable to generate aggregated summary.")

            logger.info(f"Generated aggregated summary from {len(updates)} updates")

            return {
                "summary": summary,
                "update_count": len(updates),
                "aggregation_type": aggregation_type,
                "model": result.get("model"),
                "token_usage": result.get("token_usage"),
            }

        except Exception as e:
            logger.error(f"Error creating aggregated summary: {e}")
            return {
                "summary": f"Aggregation failed: {str(e)}",
                "update_count": len(updates),
                "error": str(e)
            }

    async def extract_key_metrics(self, update_message: str) -> Dict[str, Any]:
        """
        Extract structured metrics from an update message

        Args:
            update_message: The worker's update text

        Returns:
            Dict containing extracted metrics
        """
        try:
            prompt = f"""Analyze this construction update and extract key metrics:

---
{update_message}
---

Extract and return as JSON:
- tasks_completed: list of completed tasks
- materials_used: list of materials mentioned
- issues: list of problems or blockers
- progress_percentage: number if mentioned, null otherwise
- safety_concerns: list of safety issues
- weather_impact: string describing weather effects, null if not mentioned
- workers_needed: number if mentioned, null otherwise"""

            system_prompt = """You are a construction data extraction system.
Extract structured information from worker updates.
Respond in valid JSON format only.
If information is not mentioned, use null or empty lists."""

            result = await self.llm.generate_response(
                prompt=prompt,
                system_prompt=system_prompt
            )

            # Try to parse JSON from response
            import json
            try:
                raw_answer = result.get("answer", "{}")
                # Clean up response if needed
                if raw_answer.startswith("```"):
                    raw_answer = raw_answer.split("```")[1]
                    if raw_answer.startswith("json"):
                        raw_answer = raw_answer[4:]
                metrics = json.loads(raw_answer)
            except json.JSONDecodeError:
                metrics = {"raw_extraction": result.get("answer")}

            return {
                "metrics": metrics,
                "model": result.get("model"),
            }

        except Exception as e:
            logger.error(f"Error extracting metrics: {e}")
            return {
                "metrics": {},
                "error": str(e)
            }

