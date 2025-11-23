"""
Ollama LLM Service
"""
import logging
from typing import Optional, List, Dict, Any, AsyncGenerator
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
    ) -> str:
        """
        Generate response from LLM

        Args:
            prompt: User input prompt
            context: Additional context (optional)
            system_prompt: System prompt (optional)
            conversation_history: Previous conversation messages (optional)

        Returns:
            Generated response text
        """
        try:
            # Build messages array
            messages = []

            # Add system prompt
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            else:
                default_system = "You are a helpful, intelligent voice assistant. Keep your responses clear and concise since they will be spoken aloud."
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

            generated_text = response['message']['content'].strip()
            logger.info(f"Generated response: {len(generated_text)} characters")
            return generated_text

        except Exception as e:
            logger.error(f"Error generating LLM response: {e}")
            return "I'm sorry, I encountered an error processing your request."

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
