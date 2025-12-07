# =============================================================================
# Echo Voice Agent - Outputs
# =============================================================================

# API Endpoints
output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "api_stage_url" {
  description = "Full API stage URL"
  value       = "${aws_apigatewayv2_api.main.api_endpoint}/${var.environment}"
}

# CloudFront
output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "frontend_url" {
  description = "Frontend application URL"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

# S3 Buckets
output "audio_bucket_name" {
  description = "S3 bucket name for audio storage"
  value       = aws_s3_bucket.audio_storage.id
}

output "audio_bucket_arn" {
  description = "S3 bucket ARN for audio storage"
  value       = aws_s3_bucket.audio_storage.arn
}

output "frontend_bucket_name" {
  description = "S3 bucket name for frontend hosting"
  value       = aws_s3_bucket.frontend.id
}

# DynamoDB Tables
output "dynamodb_conversations_table" {
  description = "DynamoDB conversations table name"
  value       = aws_dynamodb_table.conversations.name
}

output "dynamodb_sessions_table" {
  description = "DynamoDB sessions table name"
  value       = aws_dynamodb_table.sessions.name
}

output "dynamodb_summaries_table" {
  description = "DynamoDB summaries table name"
  value       = aws_dynamodb_table.summaries.name
}

# Lambda Functions (only output when deployed)
output "lambda_voice_processor_arn" {
  description = "Voice processor Lambda ARN"
  value       = local.lambda_voice_processor_exists ? aws_lambda_function.voice_processor[0].arn : "Not deployed - add Lambda ZIP files"
}

output "lambda_voice_processor_name" {
  description = "Voice processor Lambda function name"
  value       = local.lambda_voice_processor_exists ? aws_lambda_function.voice_processor[0].function_name : "Not deployed"
}

# IAM
output "lambda_execution_role_arn" {
  description = "Lambda execution role ARN"
  value       = aws_iam_role.lambda_execution.arn
}

# Monitoring
output "cloudwatch_dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}

output "sns_alarms_topic_arn" {
  description = "SNS topic ARN for alarms"
  value       = aws_sns_topic.alarms.arn
}

# Environment Configuration (for backend .env file)
output "backend_env_config" {
  description = "Environment variables for backend configuration"
  sensitive   = true
  value       = <<-EOT
    # AWS Configuration
    AWS_REGION=${var.aws_region}
    
    # Service Configuration
    ECHO_STT_SERVICE=transcribe
    ECHO_LLM_SERVICE=bedrock
    ECHO_TTS_SERVICE=polly
    ECHO_STORAGE_SERVICE=aws
    
    # Bedrock Configuration
    BEDROCK_MODEL_ID=${var.bedrock_model_id}
    BEDROCK_REGION=${var.aws_region}
    
    # Polly Configuration
    POLLY_VOICE_ID=${var.polly_voice_id}
    POLLY_ENGINE=${var.polly_engine}
    
    # DynamoDB Configuration
    DYNAMODB_TABLE_CONVERSATIONS=${aws_dynamodb_table.conversations.name}
    DYNAMODB_TABLE_SESSIONS=${aws_dynamodb_table.sessions.name}
    DYNAMODB_TABLE_SUMMARIES=${aws_dynamodb_table.summaries.name}
    
    # S3 Configuration
    S3_BUCKET_AUDIO=${aws_s3_bucket.audio_storage.id}
    
    # API Configuration
    API_BASE_URL=${aws_apigatewayv2_api.main.api_endpoint}/${var.environment}
  EOT
}

# Frontend Environment Configuration
output "frontend_env_config" {
  description = "Environment variables for frontend configuration"
  value       = <<-EOT
    REACT_APP_API_BASE_URL=${aws_apigatewayv2_api.main.api_endpoint}/${var.environment}
    REACT_APP_WS_URL=wss://${replace(aws_apigatewayv2_api.main.api_endpoint, "https://", "")}/${var.environment}/ws/voice
  EOT
}

