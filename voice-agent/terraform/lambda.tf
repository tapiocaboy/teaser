# =============================================================================
# Echo Voice Agent - Lambda Functions
# =============================================================================
# NOTE: Lambda functions are optional. The Echo backend can run as:
# 1. Local FastAPI server (current setup) - No Lambda needed
# 2. AWS Lambda functions (serverless) - Requires building ZIP packages
#
# To deploy Lambda functions:
# 1. Build the ZIP packages: cd lambda && ./build.sh
# 2. Run: terraform apply
# =============================================================================

locals {
  # Check if Lambda deployment packages exist
  lambda_layer_exists         = fileexists("${path.module}/lambda/layers/dependencies.zip")
  lambda_voice_processor_exists = fileexists("${path.module}/lambda/functions/voice_processor.zip")
  lambda_stt_processor_exists   = fileexists("${path.module}/lambda/functions/stt_processor.zip")
  lambda_llm_processor_exists   = fileexists("${path.module}/lambda/functions/llm_processor.zip")
  lambda_tts_processor_exists   = fileexists("${path.module}/lambda/functions/tts_processor.zip")
  lambda_summarization_exists   = fileexists("${path.module}/lambda/functions/summarization.zip")
  lambda_conversations_exists   = fileexists("${path.module}/lambda/functions/conversations_api.zip")
}

# Lambda Layer for Python dependencies
resource "aws_lambda_layer_version" "dependencies" {
  count               = local.lambda_layer_exists ? 1 : 0
  layer_name          = "${local.name_prefix}-dependencies"
  description         = "Python dependencies for Echo Lambda functions"
  compatible_runtimes = [var.lambda_runtime]

  filename         = "${path.module}/lambda/layers/dependencies.zip"
  source_code_hash = local.lambda_layer_exists ? filebase64sha256("${path.module}/lambda/layers/dependencies.zip") : null

  lifecycle {
    create_before_destroy = true
  }
}

# Main Voice Processing Lambda
resource "aws_lambda_function" "voice_processor" {
  count         = local.lambda_voice_processor_exists ? 1 : 0
  function_name = "${local.name_prefix}-voice-processor"
  description   = "Processes voice input: STT -> LLM -> TTS"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "handler.process_voice"
  runtime       = var.lambda_runtime
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory_size

  filename         = "${path.module}/lambda/functions/voice_processor.zip"
  source_code_hash = local.lambda_voice_processor_exists ? filebase64sha256("${path.module}/lambda/functions/voice_processor.zip") : null

  layers = local.lambda_layer_exists ? [aws_lambda_layer_version.dependencies[0].arn] : []

  environment {
    variables = {
      ENVIRONMENT               = var.environment
      DYNAMODB_CONVERSATIONS    = aws_dynamodb_table.conversations.name
      DYNAMODB_SESSIONS         = aws_dynamodb_table.sessions.name
      DYNAMODB_SUMMARIES        = aws_dynamodb_table.summaries.name
      S3_AUDIO_BUCKET           = aws_s3_bucket.audio_storage.id
      BEDROCK_MODEL_ID          = var.bedrock_model_id
      POLLY_VOICE_ID            = var.polly_voice_id
      POLLY_ENGINE              = var.polly_engine
      LOG_LEVEL                 = var.environment == "prod" ? "INFO" : "DEBUG"
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = {
    Name = "${local.name_prefix}-voice-processor"
  }

  depends_on = [
    aws_iam_role_policy_attachment.echo_services,
    aws_cloudwatch_log_group.lambda_voice_processor
  ]
}

# Speech-to-Text Lambda
resource "aws_lambda_function" "stt_processor" {
  count         = local.lambda_stt_processor_exists ? 1 : 0
  function_name = "${local.name_prefix}-stt-processor"
  description   = "Processes audio to text using AWS Transcribe"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "handler.transcribe_audio"
  runtime       = var.lambda_runtime
  timeout       = var.lambda_timeout
  memory_size   = 256

  filename         = "${path.module}/lambda/functions/stt_processor.zip"
  source_code_hash = local.lambda_stt_processor_exists ? filebase64sha256("${path.module}/lambda/functions/stt_processor.zip") : null

  layers = local.lambda_layer_exists ? [aws_lambda_layer_version.dependencies[0].arn] : []

  environment {
    variables = {
      ENVIRONMENT     = var.environment
      S3_AUDIO_BUCKET = aws_s3_bucket.audio_storage.id
      LOG_LEVEL       = var.environment == "prod" ? "INFO" : "DEBUG"
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = {
    Name = "${local.name_prefix}-stt-processor"
  }

  depends_on = [aws_cloudwatch_log_group.lambda_stt_processor]
}

# LLM Processing Lambda
resource "aws_lambda_function" "llm_processor" {
  count         = local.lambda_llm_processor_exists ? 1 : 0
  function_name = "${local.name_prefix}-llm-processor"
  description   = "Processes text using AWS Bedrock LLM"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "handler.generate_response"
  runtime       = var.lambda_runtime
  timeout       = var.lambda_timeout
  memory_size   = 256

  filename         = "${path.module}/lambda/functions/llm_processor.zip"
  source_code_hash = local.lambda_llm_processor_exists ? filebase64sha256("${path.module}/lambda/functions/llm_processor.zip") : null

  layers = local.lambda_layer_exists ? [aws_lambda_layer_version.dependencies[0].arn] : []

  environment {
    variables = {
      ENVIRONMENT      = var.environment
      BEDROCK_MODEL_ID = var.bedrock_model_id
      LOG_LEVEL        = var.environment == "prod" ? "INFO" : "DEBUG"
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = {
    Name = "${local.name_prefix}-llm-processor"
  }

  depends_on = [aws_cloudwatch_log_group.lambda_llm_processor]
}

# Text-to-Speech Lambda
resource "aws_lambda_function" "tts_processor" {
  count         = local.lambda_tts_processor_exists ? 1 : 0
  function_name = "${local.name_prefix}-tts-processor"
  description   = "Synthesizes speech using AWS Polly"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "handler.synthesize_speech"
  runtime       = var.lambda_runtime
  timeout       = var.lambda_timeout
  memory_size   = 256

  filename         = "${path.module}/lambda/functions/tts_processor.zip"
  source_code_hash = local.lambda_tts_processor_exists ? filebase64sha256("${path.module}/lambda/functions/tts_processor.zip") : null

  layers = local.lambda_layer_exists ? [aws_lambda_layer_version.dependencies[0].arn] : []

  environment {
    variables = {
      ENVIRONMENT     = var.environment
      S3_AUDIO_BUCKET = aws_s3_bucket.audio_storage.id
      POLLY_VOICE_ID  = var.polly_voice_id
      POLLY_ENGINE    = var.polly_engine
      LOG_LEVEL       = var.environment == "prod" ? "INFO" : "DEBUG"
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = {
    Name = "${local.name_prefix}-tts-processor"
  }

  depends_on = [aws_cloudwatch_log_group.lambda_tts_processor]
}

# Text Summarization Lambda
resource "aws_lambda_function" "summarization" {
  count         = local.lambda_summarization_exists ? 1 : 0
  function_name = "${local.name_prefix}-summarization"
  description   = "Summarizes conversations using AWS Bedrock"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "handler.summarize_text"
  runtime       = var.lambda_runtime
  timeout       = var.lambda_timeout
  memory_size   = 256

  filename         = "${path.module}/lambda/functions/summarization.zip"
  source_code_hash = local.lambda_summarization_exists ? filebase64sha256("${path.module}/lambda/functions/summarization.zip") : null

  layers = local.lambda_layer_exists ? [aws_lambda_layer_version.dependencies[0].arn] : []

  environment {
    variables = {
      ENVIRONMENT        = var.environment
      BEDROCK_MODEL_ID   = var.bedrock_model_id
      DYNAMODB_SUMMARIES = aws_dynamodb_table.summaries.name
      LOG_LEVEL          = var.environment == "prod" ? "INFO" : "DEBUG"
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = {
    Name = "${local.name_prefix}-summarization"
  }

  depends_on = [aws_cloudwatch_log_group.lambda_summarization]
}

# Conversations API Lambda
resource "aws_lambda_function" "conversations_api" {
  count         = local.lambda_conversations_exists ? 1 : 0
  function_name = "${local.name_prefix}-conversations-api"
  description   = "CRUD operations for conversations"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "handler.conversations_handler"
  runtime       = var.lambda_runtime
  timeout       = 30
  memory_size   = 256

  filename         = "${path.module}/lambda/functions/conversations_api.zip"
  source_code_hash = local.lambda_conversations_exists ? filebase64sha256("${path.module}/lambda/functions/conversations_api.zip") : null

  layers = local.lambda_layer_exists ? [aws_lambda_layer_version.dependencies[0].arn] : []

  environment {
    variables = {
      ENVIRONMENT            = var.environment
      DYNAMODB_CONVERSATIONS = aws_dynamodb_table.conversations.name
      DYNAMODB_SESSIONS      = aws_dynamodb_table.sessions.name
      LOG_LEVEL              = var.environment == "prod" ? "INFO" : "DEBUG"
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = {
    Name = "${local.name_prefix}-conversations-api"
  }

  depends_on = [aws_cloudwatch_log_group.lambda_conversations_api]
}

# CloudWatch Log Groups for Lambda functions (always created for future use)
resource "aws_cloudwatch_log_group" "lambda_voice_processor" {
  name              = "/aws/lambda/${local.name_prefix}-voice-processor"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "lambda_stt_processor" {
  name              = "/aws/lambda/${local.name_prefix}-stt-processor"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "lambda_llm_processor" {
  name              = "/aws/lambda/${local.name_prefix}-llm-processor"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "lambda_tts_processor" {
  name              = "/aws/lambda/${local.name_prefix}-tts-processor"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "lambda_summarization" {
  name              = "/aws/lambda/${local.name_prefix}-summarization"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "lambda_conversations_api" {
  name              = "/aws/lambda/${local.name_prefix}-conversations-api"
  retention_in_days = var.log_retention_days
}
