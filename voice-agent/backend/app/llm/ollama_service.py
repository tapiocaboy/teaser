"""
Ollama LLM Service
"""
import logging
from typing import Optional, List, Dict, Any, AsyncGenerator, Tuple
import ollama
import json

logger = logging.getLogger(__name__)

class OllamaLLM:
    def __init__(
        self,
        model: str = "mistral",
        temperature: float = 0.7,
        max_tokens: int = 512,
        context_window: int = 4096
    ):
        """
        Initialize Ollama LLM service

        Args:
            model: Model name (mistral, llama3.2, llama2, etc.)
            temperature: Sampling temperature (0.0 to 1.0)
            max_tokens: Maximum tokens to generate
            context_window: Maximum context window size
        """
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.context_window = context_window

        try:
            self.client = ollama.Client()
            logger.info(f"Ollama client initialized with model: {model}")
        except Exception as e:
            logger.error(f"Failed to initialize Ollama client: {e}")
            logger.error("Ollama must be installed and running. Please run: ollama serve")
            raise RuntimeError("Ollama client not available. Install Ollama and run 'ollama serve'")

    async def generate_response(
        self,
        prompt: str,
        context: Optional[str] = None,
        system_prompt: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Generate response from LLM

        Args:
            prompt: User input prompt
            context: Additional context (optional)
            system_prompt: System prompt (optional)
            conversation_history: Previous conversation messages (optional)

        Returns:
            Dict containing answer text plus debugging metadata
        """
        try:
            # Build messages array
            messages = []

            # Add system prompt
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            else:
                default_system = (
                    "You are a helpful, intelligent voice assistant. "
                    "Respond in valid JSON with keys 'answer' and 'reasoning'. "
                    "'answer' must be the concise reply read aloud to the user. "
                    "'reasoning' should summarize your thought process in <=2 sentences."
                )
                messages.append({"role": "system", "content": default_system})

            # Add context if provided
            if context:
                messages.append({"role": "system", "content": f"Context: {context}"})

            # Add conversation history
            if conversation_history:
                messages.extend(conversation_history[-10:])  # Keep last 10 messages

            # Add current user prompt
            messages.append({"role": "user", "content": prompt})

            # Generate response
            response = self.client.chat(
                model=self.model,
                messages=messages,
                options={
                    "temperature": self.temperature,
                    "num_predict": self.max_tokens,
                    "top_p": 0.9,
                    "top_k": 40,
                }
            )

            raw_text = response['message']['content'].strip()
            answer_text, reasoning_text = self._parse_structured_response(raw_text)

            prompt_tokens = response.get('prompt_eval_count', 0)
            completion_tokens = response.get('eval_count', 0)
            timings = {
                "total_duration_ms": self._ns_to_ms(response.get('total_duration')),
                "prompt_eval_ms": self._ns_to_ms(response.get('prompt_eval_duration')),
                "generation_ms": self._ns_to_ms(response.get('eval_duration')),
            }

            logger.info(
                "Generated response (%s chars, prompt_tokens=%s, completion_tokens=%s)",
                len(answer_text),
                prompt_tokens,
                completion_tokens
            )

            return {
                "answer": answer_text,
                "reasoning": reasoning_text,
                "raw_response": raw_text,
                "model": response.get('model', self.model),
                "token_usage": {
                    "prompt": prompt_tokens,
                    "completion": completion_tokens,
                    "total": (prompt_tokens or 0) + (completion_tokens or 0),
                },
                "timings": timings
            }

        except Exception as e:
            logger.error(f"Error generating LLM response: {e}")
            return {
                "answer": "I'm sorry, I encountered an error processing your request.",
                "reasoning": None,
                "raw_response": "",
                "model": self.model,
                "token_usage": {
                    "prompt": 0,
                    "completion": 0,
                    "total": 0
                },
                "timings": {}
            }

    async def stream_response(
        self,
        prompt: str,
        context: Optional[str] = None,
        system_prompt: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """
        Stream response from LLM (chunked generation)

        Args:
            prompt: User input prompt
            context: Additional context (optional)
            system_prompt: System prompt (optional)

        Yields:
            Text chunks as they are generated
        """
        try:
            messages = []

            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            else:
                messages.append({
                    "role": "system",
                    "content": "You are a helpful voice assistant. Keep responses clear and concise."
                })

            if context:
                messages.append({"role": "system", "content": f"Context: {context}"})

            messages.append({"role": "user", "content": prompt})

            # Stream response
            stream = self.client.chat(
                model=self.model,
                messages=messages,
                stream=True,
                options={
                    "temperature": self.temperature,
                    "num_predict": self.max_tokens,
                }
            )

            for chunk in stream:
                if 'message' in chunk and 'content' in chunk['message']:
                    content = chunk['message']['content']
                    if content:
                        yield content

        except Exception as e:
            logger.error(f"Error streaming LLM response: {e}")
            yield "I'm sorry, I encountered an error."

    def list_available_models(self) -> List[str]:
        """List all available Ollama models"""
        try:
            models = self.client.list()
            return [model['name'] for model in models['models']]
        except Exception as e:
            logger.error(f"Error listing models: {e}")
            return []

    def check_model_availability(self, model_name: str) -> bool:
        """Check if a specific model is available"""
        available_models = self.list_available_models()
        return model_name in available_models

    async def pull_model(self, model_name: str):
        """Pull a model from Ollama registry"""
        try:
            logger.info(f"Pulling model: {model_name}")
            self.client.pull(model_name)
            logger.info(f"Successfully pulled model: {model_name}")
        except Exception as e:
            logger.error(f"Error pulling model {model_name}: {e}")
            raise

    def get_model_info(self, model_name: str) -> Dict[str, Any]:
        """Get information about a specific model"""
        try:
            models = self.client.list()
            for model in models['models']:
                if model['name'] == model_name:
                    return model
            return {}
        except Exception as e:
            logger.error(f"Error getting model info: {e}")
            return {}

    def _parse_structured_response(self, raw_content: str) -> Tuple[str, Optional[str]]:
        """Extract answer/reasoning from JSON or tagged content."""
        content = raw_content.strip()
        answer = content
        reasoning = None

        if content.startswith("{") and content.endswith("}"):
            try:
                data = json.loads(content)
                answer = data.get("answer") or data.get("response") or answer
                reasoning = data.get("reasoning") or data.get("thoughts")
                return answer.strip(), reasoning.strip() if isinstance(reasoning, str) else reasoning
            except json.JSONDecodeError:
                pass

        lowered = content.lower()
        for marker in ["reasoning:", "chain of thought:", "thought process:"]:
            idx = lowered.find(marker)
            if idx != -1:
                reasoning_text = content[idx + len(marker):].strip()
                answer = content[:idx].strip()
                reasoning = reasoning_text
                break

        return answer, reasoning

    @staticmethod
    def _ns_to_ms(value: Optional[int]) -> Optional[float]:
        if value is None:
            return None
        return round(value / 1_000_000, 2)
