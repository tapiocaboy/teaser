# =============================================================================
# Echo Voice Agent - API Gateway (HTTP API)
# =============================================================================

# HTTP API
resource "aws_apigatewayv2_api" "main" {
  name          = "${local.name_prefix}-api"
  protocol_type = "HTTP"
  description   = "Echo Voice Agent API"

  cors_configuration {
    allow_origins     = var.environment == "prod" ? ["https://${var.domain_name}"] : ["*"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers     = ["Content-Type", "Authorization", "X-Session-Id"]
    expose_headers    = ["X-Request-Id"]
    max_age           = 3600
    allow_credentials = var.environment == "prod"
  }

  tags = {
    Name = "${local.name_prefix}-api"
  }
}

# API Stage
resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = var.environment
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId         = "$context.requestId"
      ip                = "$context.identity.sourceIp"
      requestTime       = "$context.requestTime"
      httpMethod        = "$context.httpMethod"
      routeKey          = "$context.routeKey"
      status            = "$context.status"
      protocol          = "$context.protocol"
      responseLength    = "$context.responseLength"
      integrationError  = "$context.integrationErrorMessage"
      integrationLatency = "$context.integrationLatency"
    })
  }

  default_route_settings {
    throttling_burst_limit = var.api_throttling_burst_limit
    throttling_rate_limit  = var.api_throttling_rate_limit
  }

  tags = {
    Name = "${local.name_prefix}-api-stage"
  }
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${local.name_prefix}-api"
  retention_in_days = var.log_retention_days
}

# =============================================================================
# Lambda Integrations (only created when Lambda functions exist)
# =============================================================================

# Voice Processor Integration
resource "aws_apigatewayv2_integration" "voice_processor" {
  count                  = local.lambda_voice_processor_exists ? 1 : 0
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.voice_processor[0].invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = var.lambda_timeout * 1000
}

# Conversations API Integration
resource "aws_apigatewayv2_integration" "conversations_api" {
  count                  = local.lambda_conversations_exists ? 1 : 0
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.conversations_api[0].invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000
}

# Summarization Integration
resource "aws_apigatewayv2_integration" "summarization" {
  count                  = local.lambda_summarization_exists ? 1 : 0
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.summarization[0].invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = var.lambda_timeout * 1000
}

# =============================================================================
# Routes (only created when integrations exist)
# =============================================================================

# POST /api/voice/process - Main voice processing endpoint
resource "aws_apigatewayv2_route" "voice_process" {
  count     = local.lambda_voice_processor_exists ? 1 : 0
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/voice/process"
  target    = "integrations/${aws_apigatewayv2_integration.voice_processor[0].id}"
}

# GET /api/conversations - List conversations
resource "aws_apigatewayv2_route" "conversations_list" {
  count     = local.lambda_conversations_exists ? 1 : 0
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/conversations"
  target    = "integrations/${aws_apigatewayv2_integration.conversations_api[0].id}"
}

# GET /api/conversations/{id} - Get single conversation
resource "aws_apigatewayv2_route" "conversations_get" {
  count     = local.lambda_conversations_exists ? 1 : 0
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/conversations/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.conversations_api[0].id}"
}

# POST /api/summarize - Summarize text
resource "aws_apigatewayv2_route" "summarize" {
  count     = local.lambda_summarization_exists ? 1 : 0
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/summarize"
  target    = "integrations/${aws_apigatewayv2_integration.summarization[0].id}"
}

# GET /health - Health check
resource "aws_apigatewayv2_route" "health" {
  count     = local.lambda_conversations_exists ? 1 : 0
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /health"
  target    = "integrations/${aws_apigatewayv2_integration.conversations_api[0].id}"
}

# =============================================================================
# Lambda Permissions for API Gateway (only when Lambda functions exist)
# =============================================================================

resource "aws_lambda_permission" "voice_processor" {
  count         = local.lambda_voice_processor_exists ? 1 : 0
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.voice_processor[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "conversations_api" {
  count         = local.lambda_conversations_exists ? 1 : 0
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.conversations_api[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "summarization" {
  count         = local.lambda_summarization_exists ? 1 : 0
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.summarization[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
