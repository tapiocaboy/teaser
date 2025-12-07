# =============================================================================
# Echo Voice Agent - Monitoring & Alarms
# =============================================================================

# SNS Topic for Alarms
resource "aws_sns_topic" "alarms" {
  name = "${local.name_prefix}-alarms"

  tags = {
    Name = "${local.name_prefix}-alarms"
  }
}

# SNS Email Subscription (if email provided)
resource "aws_sns_topic_subscription" "alarm_email" {
  count     = var.alarm_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# =============================================================================
# Lambda Alarms (only created when Lambda functions are deployed)
# =============================================================================

# Voice Processor Error Alarm
resource "aws_cloudwatch_metric_alarm" "voice_processor_errors" {
  count               = local.lambda_voice_processor_exists ? 1 : 0
  alarm_name          = "${local.name_prefix}-voice-processor-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Voice processor Lambda errors exceeded threshold"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  dimensions = {
    FunctionName = aws_lambda_function.voice_processor[0].function_name
  }

  tags = {
    Name = "${local.name_prefix}-voice-processor-errors"
  }
}

# Voice Processor Duration Alarm
resource "aws_cloudwatch_metric_alarm" "voice_processor_duration" {
  count               = local.lambda_voice_processor_exists ? 1 : 0
  alarm_name          = "${local.name_prefix}-voice-processor-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Average"
  threshold           = var.lambda_timeout * 1000 * 0.8  # 80% of timeout
  alarm_description   = "Voice processor Lambda duration approaching timeout"
  alarm_actions       = [aws_sns_topic.alarms.arn]

  dimensions = {
    FunctionName = aws_lambda_function.voice_processor[0].function_name
  }

  tags = {
    Name = "${local.name_prefix}-voice-processor-duration"
  }
}

# =============================================================================
# API Gateway Alarms
# =============================================================================

# API Gateway 5XX Errors
resource "aws_cloudwatch_metric_alarm" "api_5xx_errors" {
  alarm_name          = "${local.name_prefix}-api-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "API Gateway 5XX errors exceeded threshold"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  dimensions = {
    ApiId = aws_apigatewayv2_api.main.id
    Stage = var.environment
  }

  tags = {
    Name = "${local.name_prefix}-api-5xx-errors"
  }
}

# API Gateway Latency
resource "aws_cloudwatch_metric_alarm" "api_latency" {
  alarm_name          = "${local.name_prefix}-api-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "Latency"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Average"
  threshold           = 5000  # 5 seconds
  alarm_description   = "API Gateway latency exceeded 5 seconds"
  alarm_actions       = [aws_sns_topic.alarms.arn]

  dimensions = {
    ApiId = aws_apigatewayv2_api.main.id
    Stage = var.environment
  }

  tags = {
    Name = "${local.name_prefix}-api-latency"
  }
}

# =============================================================================
# DynamoDB Alarms
# =============================================================================

# DynamoDB Throttling
resource "aws_cloudwatch_metric_alarm" "dynamodb_throttling" {
  alarm_name          = "${local.name_prefix}-dynamodb-throttling"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "DynamoDB throttling detected"
  alarm_actions       = [aws_sns_topic.alarms.arn]

  dimensions = {
    TableName = aws_dynamodb_table.conversations.name
  }

  tags = {
    Name = "${local.name_prefix}-dynamodb-throttling"
  }
}

# =============================================================================
# CloudWatch Dashboard
# =============================================================================

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.name_prefix}-dashboard"

  dashboard_body = jsonencode({
    widgets = concat(
      # Title
      [
        {
          type   = "text"
          x      = 0
          y      = 0
          width  = 24
          height = 1
          properties = {
            markdown = "# Echo Voice Agent Dashboard - ${upper(var.environment)}"
          }
        }
      ],
      # API Gateway Requests
      [
        {
          type   = "metric"
          x      = 0
          y      = 1
          width  = 12
          height = 6
          properties = {
            title  = "API Gateway Requests"
            region = var.aws_region
            metrics = [
              ["AWS/ApiGateway", "Count", "ApiId", aws_apigatewayv2_api.main.id, "Stage", var.environment]
            ]
            stat   = "Sum"
            period = 300
          }
        }
      ],
      # API Gateway Latency
      [
        {
          type   = "metric"
          x      = 12
          y      = 1
          width  = 12
          height = 6
          properties = {
            title  = "API Gateway Latency"
            region = var.aws_region
            metrics = [
              ["AWS/ApiGateway", "Latency", "ApiId", aws_apigatewayv2_api.main.id, "Stage", var.environment, { stat = "Average", label = "Average" }],
              [".", ".", ".", ".", ".", ".", { stat = "p99", label = "p99" }]
            ]
            period = 300
          }
        }
      ],
      # DynamoDB Read/Write Capacity
      [
        {
          type   = "metric"
          x      = 0
          y      = 7
          width  = 12
          height = 6
          properties = {
            title  = "DynamoDB Consumed Capacity"
            region = var.aws_region
            metrics = [
              ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", aws_dynamodb_table.conversations.name, { label = "Read" }],
              [".", "ConsumedWriteCapacityUnits", ".", ".", { label = "Write" }]
            ]
            stat   = "Sum"
            period = 300
          }
        }
      ],
      # S3 Bucket Size
      [
        {
          type   = "metric"
          x      = 12
          y      = 7
          width  = 12
          height = 6
          properties = {
            title  = "S3 Audio Bucket Size"
            region = var.aws_region
            metrics = [
              ["AWS/S3", "BucketSizeBytes", "BucketName", aws_s3_bucket.audio_storage.id, "StorageType", "StandardStorage"]
            ]
            stat   = "Average"
            period = 86400
          }
        }
      ]
    )
  })
}
