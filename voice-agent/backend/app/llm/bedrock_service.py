"""
AWS Bedrock LLM Service
Uses Amazon Bedrock for LLM capabilities (Claude, Titan, etc.)
"""

import logging
import os
import json
import time
from typing import Optional, Dict, List, AsyncGenerator

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class AWSBedrockLLM:
    """AWS Bedrock Large Language Model Service"""
    
    def __init__(self):
        """Initialize AWS Bedrock client"""
        self.region = os.getenv("AWS_REGION", "ap-southeast-2")
        self.model_id = os.getenv(
            "BEDROCK_MODEL_ID",
            "arn:aws:bedrock:ap-southeast-2:058264223017:inference-profile/au.anthropic.claude-haiku-4-5-20251001-v1:0"
        )
        self.max_tokens = int(os.getenv("BEDROCK_MAX_TOKENS", "1024"))
        self.temperature = float(os.getenv("BEDROCK_TEMPERATURE", "0.7"))
        
        logger.info(f"Initializing AWS Bedrock in region {self.region}")
        logger.info(f"Using model: {self.model_id}")
        
        self.bedrock_runtime = boto3.client(
            "bedrock-runtime",
            region_name=self.region
        )
        
        # System prompt for Echo voice assistant
        self.system_prompt = os.getenv(
            "ECHO_SYSTEM_PROMPT",
            """You are Echo, a helpful and friendly voice assistant. 
You provide clear, concise responses suitable for voice conversation.
Keep responses brief but informative - typically 1-3 sentences unless more detail is requested.
Be conversational and natural in your responses."""
        )
        
        logger.info("AWS Bedrock service initialized")
    
    async def generate_response(self, prompt: str, context: Optional[Dict] = None) -> Dict:
        """
        Generate a response using AWS Bedrock.
        
        Args:
            prompt: User input text
            context: Optional context dictionary
            
        Returns:
            Dictionary with answer, model info, and token usage
        """
        try:
            start_time = time.time()
            
            logger.info(f"Generating response for: '{prompt[:100]}...'")
            
            # Prepare the request based on model type
            if "anthropic" in self.model_id.lower():
                response = await self._invoke_claude(prompt, context)
            elif "titan" in self.model_id.lower():
                response = await self._invoke_titan(prompt, context)
            elif "llama" in self.model_id.lower():
                response = await self._invoke_llama(prompt, context)
            else:
                # Default to Claude format
                response = await self._invoke_claude(prompt, context)
            
            elapsed_ms = int((time.time() - start_time) * 1000)
            
            result = {
                "answer": response.get("answer", ""),
                "model": self.model_id,
                "provider": "aws_bedrock",
                "token_usage": response.get("token_usage", {}),
                "reasoning": response.get("reasoning"),
                "timings": {
                    "total_duration_ms": elapsed_ms
                }
            }
            
            logger.info(f"Generated response in {elapsed_ms}ms")
            return result
            
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            logger.error(f"AWS Bedrock error ({error_code}): {e}")
            raise RuntimeError(f"LLM generation failed: {e}")
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            raise RuntimeError(f"LLM generation failed: {e}")
    
    async def _invoke_claude(self, prompt: str, context: Optional[Dict] = None) -> Dict:
        """Invoke Claude model via Bedrock"""
        
        messages = []
        
        # Add conversation context if provided
        if context and "history" in context:
            for msg in context["history"]:
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", "")
                })
        
        # Add current user message
        messages.append({
            "role": "user",
            "content": prompt
        })
        
        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            "system": self.system_prompt,
            "messages": messages
        }
        
        response = self.bedrock_runtime.invoke_model(
            modelId=self.model_id,
            body=json.dumps(request_body),
            contentType="application/json",
            accept="application/json"
        )
        
        response_body = json.loads(response["body"].read())
        
        # Extract response text
        content = response_body.get("content", [])
        answer = ""
        reasoning = None
        
        for block in content:
            if block.get("type") == "text":
                answer += block.get("text", "")
        
        # Extract token usage
        usage = response_body.get("usage", {})
        token_usage = {
            "prompt": usage.get("input_tokens", 0),
            "completion": usage.get("output_tokens", 0),
            "total": usage.get("input_tokens", 0) + usage.get("output_tokens", 0)
        }
        
        return {
            "answer": answer.strip(),
            "token_usage": token_usage,
            "reasoning": reasoning
        }
    
    async def _invoke_titan(self, prompt: str, context: Optional[Dict] = None) -> Dict:
        """Invoke Amazon Titan model via Bedrock"""
        
        # Build prompt with context
        full_prompt = f"{self.system_prompt}\n\nUser: {prompt}\n\nAssistant:"
        
        if context and "history" in context:
            history_text = ""
            for msg in context["history"]:
                role = msg.get("role", "user").capitalize()
                content = msg.get("content", "")
                history_text += f"{role}: {content}\n"
            full_prompt = f"{self.system_prompt}\n\n{history_text}User: {prompt}\n\nAssistant:"
        
        request_body = {
            "inputText": full_prompt,
            "textGenerationConfig": {
                "maxTokenCount": self.max_tokens,
                "temperature": self.temperature,
                "topP": 0.9,
                "stopSequences": ["User:"]
            }
        }
        
        response = self.bedrock_runtime.invoke_model(
            modelId=self.model_id,
            body=json.dumps(request_body),
            contentType="application/json",
            accept="application/json"
        )
        
        response_body = json.loads(response["body"].read())
        
        results = response_body.get("results", [])
        answer = results[0].get("outputText", "") if results else ""
        
        # Token usage for Titan
        token_usage = {
            "prompt": response_body.get("inputTextTokenCount", 0),
            "completion": len(answer.split()),  # Approximation
            "total": response_body.get("inputTextTokenCount", 0) + len(answer.split())
        }
        
        return {
            "answer": answer.strip(),
            "token_usage": token_usage,
            "reasoning": None
        }
    
    async def _invoke_llama(self, prompt: str, context: Optional[Dict] = None) -> Dict:
        """Invoke Meta Llama model via Bedrock"""
        
        full_prompt = f"<s>[INST] <<SYS>>\n{self.system_prompt}\n<</SYS>>\n\n{prompt} [/INST]"
        
        request_body = {
            "prompt": full_prompt,
            "max_gen_len": self.max_tokens,
            "temperature": self.temperature,
            "top_p": 0.9
        }
        
        response = self.bedrock_runtime.invoke_model(
            modelId=self.model_id,
            body=json.dumps(request_body),
            contentType="application/json",
            accept="application/json"
        )
        
        response_body = json.loads(response["body"].read())
        answer = response_body.get("generation", "")
        
        token_usage = {
            "prompt": response_body.get("prompt_token_count", 0),
            "completion": response_body.get("generation_token_count", 0),
            "total": response_body.get("prompt_token_count", 0) + response_body.get("generation_token_count", 0)
        }
        
        return {
            "answer": answer.strip(),
            "token_usage": token_usage,
            "reasoning": None
        }
    
    async def summarize_text(self, text: str, max_length: int = 100) -> str:
        """
        Summarize the given text.
        
        Args:
            text: Text to summarize
            max_length: Maximum length hint for summary
            
        Returns:
            Summarized text
        """
        try:
            prompt = f"""Please provide a brief summary of the following text in {max_length} words or less:

{text}

Summary:"""
            
            result = await self.generate_response(prompt)
            return result.get("answer", "")
            
        except Exception as e:
            logger.error(f"Error summarizing text: {e}")
            return f"Summary unavailable: {str(e)}"
    
    async def stream_response(self, prompt: str) -> AsyncGenerator[str, None]:
        """
        Stream response from Bedrock (for supported models).
        
        Args:
            prompt: User input text
            
        Yields:
            Response text chunks
        """
        try:
            messages = [{"role": "user", "content": prompt}]
            
            request_body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": self.max_tokens,
                "temperature": self.temperature,
                "system": self.system_prompt,
                "messages": messages
            }
            
            response = self.bedrock_runtime.invoke_model_with_response_stream(
                modelId=self.model_id,
                body=json.dumps(request_body),
                contentType="application/json",
                accept="application/json"
            )
            
            for event in response.get("body", []):
                chunk = event.get("chunk")
                if chunk:
                    chunk_data = json.loads(chunk.get("bytes", b"{}").decode())
                    if chunk_data.get("type") == "content_block_delta":
                        delta = chunk_data.get("delta", {})
                        if delta.get("type") == "text_delta":
                            yield delta.get("text", "")
                            
        except Exception as e:
            logger.error(f"Error streaming response: {e}")
            yield f"Error: {str(e)}"
    
    def get_available_models(self) -> List[str]:
        """Get list of recommended Bedrock models"""
        return [
            # Inference profiles (region-specific)
            "arn:aws:bedrock:ap-southeast-2:058264223017:inference-profile/au.anthropic.claude-haiku-4-5-20251001-v1:0",
            # Standard model IDs
            "anthropic.claude-3-sonnet-20240229-v1:0",
            "anthropic.claude-3-haiku-20240307-v1:0",
            "anthropic.claude-3-opus-20240229-v1:0",
            "amazon.titan-text-express-v1",
            "amazon.titan-text-lite-v1",
            "meta.llama3-8b-instruct-v1:0",
            "meta.llama3-70b-instruct-v1:0"
        ]
    
    def cleanup(self) -> None:
        """Cleanup resources"""
        logger.info("AWS Bedrock service cleanup completed")

