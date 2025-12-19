"""
Summarization Service for Construction Site Daily Updates
Uses LLM to generate concise summaries of worker updates
"""
import logging
from typing import Optional, Dict, Any
from ..llm.ollama_service import OllamaLLM

logger = logging.getLogger(__name__)


SUMMARIZATION_SYSTEM_PROMPT = """You are a construction site update summarizer. Your ONLY job is to condense the worker's exact words into a shorter form.

CRITICAL RULES - FOLLOW STRICTLY:
1. ONLY use information explicitly stated in the input
2. DO NOT add, infer, assume, or make up ANY details
3. DO NOT add percentages, numbers, or metrics unless the worker said them
4. DO NOT add safety concerns unless the worker mentioned them
5. DO NOT add materials, issues, or progress unless explicitly stated
6. If something is unclear, summarize it as stated - do not clarify or interpret
7. If the input is vague, the summary should also be vague
8. NEVER hallucinate or fabricate any information

Focus on condensing what was actually said:
- Work mentioned as completed
- Materials explicitly mentioned  
- Issues explicitly mentioned
- Any other details the worker actually stated

Keep summaries under 80 words. Use only facts from the input.
Respond with ONLY the summary text, no formatting."""


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
            prompt = f"""Summarize ONLY what is stated in this worker's update. Do not add any information that is not explicitly mentioned.

WORKER'S UPDATE:
---
{original_message}
---

Create a brief summary using ONLY the information above. If something is not mentioned, do not include it."""

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

Summarize ONLY what the workers actually reported. Do not add any information not explicitly stated above."""

            system_prompt = """You are a construction site report summarizer.
CRITICAL: Only include information explicitly stated by workers.
DO NOT add, infer, or assume any details not in the input.
DO NOT add recommendations, priorities, or suggestions.
DO NOT add safety concerns unless workers mentioned them.
Simply condense the workers' actual reports into a shorter form.
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

