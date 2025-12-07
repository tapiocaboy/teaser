"""
AWS Storage Service
Uses DynamoDB for conversation storage and S3 for audio files.
"""

import logging
import os
import uuid
from datetime import datetime
from typing import Optional, Dict, List

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class AWSStorageService:
    """AWS DynamoDB + S3 Storage Service"""
    
    def __init__(self):
        """Initialize AWS storage clients"""
        self.region = os.getenv("AWS_REGION", "ap-southeast-2")
        self.conversations_table = os.getenv("DYNAMODB_TABLE_CONVERSATIONS", "echo-conversations")
        self.sessions_table = os.getenv("DYNAMODB_TABLE_SESSIONS", "echo-sessions")
        self.s3_bucket = os.getenv("S3_BUCKET_AUDIO", "echo-audio-storage")
        
        logger.info(f"Initializing AWS Storage in region {self.region}")
        logger.info(f"DynamoDB table: {self.conversations_table}")
        logger.info(f"S3 bucket: {self.s3_bucket}")
        
        self.dynamodb = boto3.resource("dynamodb", region_name=self.region)
        self.s3_client = boto3.client("s3", region_name=self.region)
        
        # Get table references
        self.conversations = self.dynamodb.Table(self.conversations_table)
        
        logger.info("AWS Storage service initialized")
    
    async def save_conversation(
        self,
        user_input: str,
        assistant_response: str,
        session_id: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> str:
        """
        Save a conversation to DynamoDB.
        
        Args:
            user_input: User's speech transcript
            assistant_response: LLM response
            session_id: Optional session ID
            metadata: Optional metadata (model info, latencies, etc.)
            
        Returns:
            Conversation ID (format: id#timestamp)
        """
        try:
            from datetime import timedelta
            from decimal import Decimal
            
            conversation_id = str(uuid.uuid4())
            timestamp = datetime.utcnow().isoformat()
            
            item = {
                "id": conversation_id,
                "timestamp": timestamp,  # Range key
                "user_input": user_input,
                "assistant_response": assistant_response,
                "session_id": session_id or str(uuid.uuid4()),
                "created_at": timestamp,
                "updated_at": timestamp
            }
            
            # Add metadata if provided (convert floats to Decimal for DynamoDB)
            if metadata:
                item["metadata"] = self._convert_floats_to_decimal(metadata)
            
            # Add TTL for auto-expiry (90 days)
            ttl_days = int(os.getenv("DYNAMODB_TTL_DAYS", "90"))
            if ttl_days > 0:
                ttl_timestamp = datetime.utcnow() + timedelta(days=ttl_days)
                item["ttl"] = int(ttl_timestamp.timestamp())
            
            self.conversations.put_item(Item=item)
            
            logger.info(f"Saved conversation {conversation_id}")
            return conversation_id
            
        except ClientError as e:
            logger.error(f"Error saving conversation: {e}")
            raise RuntimeError(f"Failed to save conversation: {e}")
    
    def _convert_floats_to_decimal(self, obj):
        """Convert float values to Decimal for DynamoDB compatibility"""
        from decimal import Decimal
        
        if isinstance(obj, float):
            return Decimal(str(obj))
        elif isinstance(obj, dict):
            return {k: self._convert_floats_to_decimal(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._convert_floats_to_decimal(v) for v in obj]
        return obj
    
    async def get_conversation(self, conversation_id: str, timestamp: Optional[str] = None) -> Optional[Dict]:
        """
        Get a conversation by ID from DynamoDB.
        
        Args:
            conversation_id: Conversation ID
            timestamp: Optional timestamp (range key). If not provided, queries by ID prefix.
            
        Returns:
            Conversation data or None
        """
        try:
            if timestamp:
                # Direct lookup with both keys
                response = self.conversations.get_item(
                    Key={"id": conversation_id, "timestamp": timestamp}
                )
                item = response.get("Item")
            else:
                # Query by id only (will get all items with this id)
                from boto3.dynamodb.conditions import Key
                response = self.conversations.query(
                    KeyConditionExpression=Key("id").eq(conversation_id),
                    Limit=1
                )
                items = response.get("Items", [])
                item = items[0] if items else None
            
            if item:
                return {
                    "id": item.get("id"),
                    "user_input": item.get("user_input"),
                    "assistant_response": item.get("assistant_response"),
                    "session_id": item.get("session_id"),
                    "timestamp": item.get("timestamp"),
                    "metadata": self._convert_decimal_to_float(item.get("metadata", {})),
                    "created_at": item.get("created_at"),
                    "updated_at": item.get("updated_at")
                }
            
            return None
            
        except ClientError as e:
            logger.error(f"Error getting conversation: {e}")
            return None
    
    def _convert_decimal_to_float(self, obj):
        """Convert Decimal values back to float for JSON serialization"""
        from decimal import Decimal
        
        if isinstance(obj, Decimal):
            return float(obj)
        elif isinstance(obj, dict):
            return {k: self._convert_decimal_to_float(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._convert_decimal_to_float(v) for v in obj]
        return obj
    
    async def get_recent_conversations(self, limit: int = 10, offset: int = 0) -> List[Dict]:
        """
        Get recent conversations from DynamoDB.
        
        Note: DynamoDB scan is used here; for production, consider using a GSI
        with a timestamp-based partition key for better scalability.
        
        Args:
            limit: Maximum number of conversations to return
            offset: Number of conversations to skip
            
        Returns:
            List of conversation dictionaries
        """
        try:
            # Scan with limit (not ideal for large datasets but works for moderate usage)
            all_items = []
            last_evaluated_key = None
            
            # Paginate through results until we have enough
            while len(all_items) < limit + offset:
                scan_kwargs = {
                    "Limit": min(100, (limit + offset) - len(all_items) + 50),  # Fetch extra for sorting
                    "ProjectionExpression": "id, user_input, assistant_response, session_id, #ts, created_at, metadata",
                    "ExpressionAttributeNames": {"#ts": "timestamp"}
                }
                
                if last_evaluated_key:
                    scan_kwargs["ExclusiveStartKey"] = last_evaluated_key
                
                response = self.conversations.scan(**scan_kwargs)
                all_items.extend(response.get("Items", []))
                
                last_evaluated_key = response.get("LastEvaluatedKey")
                if not last_evaluated_key:
                    break
            
            # Sort by timestamp descending
            all_items.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
            
            # Apply offset and limit
            items = all_items[offset:offset + limit]
            
            return [
                {
                    "id": item.get("id"),
                    "user_input": item.get("user_input"),
                    "assistant_response": item.get("assistant_response"),
                    "session_id": item.get("session_id"),
                    "timestamp": item.get("timestamp"),
                    "created_at": item.get("created_at"),
                    "metadata": self._convert_decimal_to_float(item.get("metadata", {}))
                }
                for item in items
            ]
            
        except ClientError as e:
            logger.error(f"Error getting recent conversations: {e}")
            return []
    
    async def get_session_conversations(self, session_id: str) -> List[Dict]:
        """
        Get all conversations for a session using the GSI.
        
        Args:
            session_id: Session ID
            
        Returns:
            List of conversations in the session
        """
        try:
            from boto3.dynamodb.conditions import Key
            
            # Use the GSI for efficient session queries
            response = self.conversations.query(
                IndexName="session-index",
                KeyConditionExpression=Key("session_id").eq(session_id),
                ScanIndexForward=True  # Sort by timestamp ascending
            )
            
            items = response.get("Items", [])
            
            return [
                {
                    "id": item.get("id"),
                    "user_input": item.get("user_input"),
                    "assistant_response": item.get("assistant_response"),
                    "timestamp": item.get("timestamp"),
                    "metadata": self._convert_decimal_to_float(item.get("metadata", {}))
                }
                for item in items
            ]
            
        except ClientError as e:
            logger.error(f"Error getting session conversations: {e}")
            return []
    
    async def save_audio(self, audio_data: bytes, key: str) -> str:
        """
        Save audio data to S3.
        
        Args:
            audio_data: Raw audio bytes
            key: Storage key (path in S3)
            
        Returns:
            S3 URI for the stored audio
        """
        try:
            # Determine content type from key
            content_type = "audio/webm"
            if key.endswith(".mp3"):
                content_type = "audio/mpeg"
            elif key.endswith(".wav"):
                content_type = "audio/wav"
            elif key.endswith(".ogg"):
                content_type = "audio/ogg"
            
            self.s3_client.put_object(
                Bucket=self.s3_bucket,
                Key=key,
                Body=audio_data,
                ContentType=content_type
            )
            
            s3_uri = f"s3://{self.s3_bucket}/{key}"
            logger.info(f"Saved audio to {s3_uri}")
            return s3_uri
            
        except ClientError as e:
            logger.error(f"Error saving audio to S3: {e}")
            raise RuntimeError(f"Failed to save audio: {e}")
    
    async def get_audio(self, key: str) -> Optional[bytes]:
        """
        Retrieve audio data from S3.
        
        Args:
            key: Storage key (path in S3)
            
        Returns:
            Audio data bytes or None
        """
        try:
            response = self.s3_client.get_object(
                Bucket=self.s3_bucket,
                Key=key
            )
            
            return response["Body"].read()
            
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                logger.warning(f"Audio not found: {key}")
                return None
            logger.error(f"Error getting audio from S3: {e}")
            return None
    
    async def get_audio_url(self, key: str, expires_in: int = 3600) -> Optional[str]:
        """
        Get a presigned URL for audio access.
        
        Args:
            key: Storage key (path in S3)
            expires_in: URL expiration time in seconds
            
        Returns:
            Presigned URL or None
        """
        try:
            url = self.s3_client.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": self.s3_bucket,
                    "Key": key
                },
                ExpiresIn=expires_in
            )
            return url
            
        except ClientError as e:
            logger.error(f"Error generating presigned URL: {e}")
            return None
    
    async def delete_conversation(self, conversation_id: str, timestamp: Optional[str] = None) -> bool:
        """
        Delete a conversation from DynamoDB.
        
        Args:
            conversation_id: Conversation ID to delete
            timestamp: Timestamp (range key). If not provided, will query first.
            
        Returns:
            True if deleted successfully
        """
        try:
            if not timestamp:
                # Need to get the timestamp first
                conv = await self.get_conversation(conversation_id)
                if conv:
                    timestamp = conv.get("timestamp")
                else:
                    logger.warning(f"Conversation {conversation_id} not found")
                    return False
            
            self.conversations.delete_item(
                Key={"id": conversation_id, "timestamp": timestamp}
            )
            logger.info(f"Deleted conversation {conversation_id}")
            return True
            
        except ClientError as e:
            logger.error(f"Error deleting conversation: {e}")
            return False
    
    def cleanup(self) -> None:
        """Cleanup resources"""
        logger.info("AWS Storage service cleanup completed")

