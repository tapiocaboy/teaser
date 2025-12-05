# Echo Voice Agent - Terraform Infrastructure

This directory contains Terraform configurations to deploy the Echo Voice Agent infrastructure on AWS.

## 🏗️ Infrastructure Components

| Component | AWS Service | Purpose |
|-----------|------------|---------|
| **Storage** | DynamoDB | Store conversations, sessions, summaries |
| **Audio Storage** | S3 | Store input/output audio files |
| **Speech-to-Text** | AWS Transcribe | Convert audio to text |
| **LLM** | AWS Bedrock | Generate AI responses & summaries |
| **Text-to-Speech** | AWS Polly | Convert text to speech |
| **API** | API Gateway (HTTP) | REST API endpoints |
| **Compute** | Lambda | Serverless processing |
| **Frontend** | S3 + CloudFront | Static website hosting |
| **Monitoring** | CloudWatch | Logs, metrics, dashboards, alarms |

## 📁 File Structure

```
terraform/
├── main.tf                 # Provider configuration & locals
├── variables.tf            # Input variables
├── outputs.tf              # Output values
├── dynamodb.tf             # DynamoDB tables
├── s3.tf                   # S3 buckets
├── iam.tf                  # IAM roles and policies
├── lambda.tf               # Lambda functions
├── api_gateway.tf          # API Gateway configuration
├── cloudfront.tf           # CloudFront distribution
├── monitoring.tf           # CloudWatch dashboards & alarms
├── terraform.tfvars.example # Example variables file
├── lambda/                 # Lambda deployment packages
│   ├── functions/          # Function zip files
│   └── layers/             # Layer zip files
└── README.md               # This file
```

## 🚀 Quick Start

### Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Terraform** >= 1.0.0
3. **AWS Account** with Bedrock access enabled

### Step 1: Initialize Terraform

```bash
cd terraform
terraform init
```

### Step 2: Create Variables File

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
```

### Step 3: Create Lambda Placeholder Files

Before running Terraform, create placeholder Lambda packages:

```bash
# Create directories
mkdir -p lambda/functions lambda/layers

# Create placeholder zip files (replace with actual packages later)
echo '{"placeholder": true}' > /tmp/placeholder.json
zip lambda/functions/voice_processor.zip /tmp/placeholder.json
zip lambda/functions/stt_processor.zip /tmp/placeholder.json
zip lambda/functions/llm_processor.zip /tmp/placeholder.json
zip lambda/functions/tts_processor.zip /tmp/placeholder.json
zip lambda/functions/summarization.zip /tmp/placeholder.json
zip lambda/functions/conversations_api.zip /tmp/placeholder.json
zip lambda/layers/dependencies.zip /tmp/placeholder.json
```

### Step 4: Plan & Apply

```bash
# Preview changes
terraform plan

# Apply infrastructure
terraform apply
```

### Step 5: Deploy Frontend

After Terraform completes, deploy the frontend:

```bash
# Build frontend
cd ../frontend
npm run build

# Upload to S3
aws s3 sync build/ s3://$(terraform -chdir=../terraform output -raw frontend_bucket_name) --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $(terraform -chdir=../terraform output -raw cloudfront_distribution_id) \
  --paths "/*"
```

## 🔧 Configuration

### Environment Variables

The `outputs.tf` provides environment configurations:

```bash
# Get backend .env configuration
terraform output -raw backend_env_config > ../backend/.env.aws

# Get frontend .env configuration
terraform output -raw frontend_env_config > ../frontend/.env.production
```

### Bedrock Model Options

| Model ID | Description | Use Case |
|----------|-------------|----------|
| `anthropic.claude-3-sonnet-20240229-v1:0` | Balanced performance | Default |
| `anthropic.claude-3-haiku-20240307-v1:0` | Fast, cost-effective | High volume |
| `anthropic.claude-3-opus-20240229-v1:0` | Most capable | Complex tasks |
| `amazon.titan-text-express-v1` | AWS native | Cost optimization |

### Polly Voice Options

| Voice ID | Language | Gender | Engine |
|----------|----------|--------|--------|
| `Joanna` | en-US | Female | Neural |
| `Matthew` | en-US | Male | Neural |
| `Amy` | en-GB | Female | Neural |
| `Brian` | en-GB | Male | Neural |

## 💰 Cost Estimation

| Service | Estimated Monthly Cost |
|---------|----------------------|
| DynamoDB (On-Demand) | $1-25 |
| S3 | $1-5 |
| Lambda | $5-20 |
| API Gateway | $3-10 |
| CloudFront | $1-10 |
| CloudWatch | $5-15 |
| **Subtotal Infrastructure** | **$16-85** |
| AWS Transcribe | $24/hour of audio |
| AWS Bedrock (Claude) | ~$0.003/1K tokens |
| AWS Polly (Neural) | $16/1M characters |
| **Total (moderate usage)** | **$100-400** |

## 🔒 Security

- All S3 buckets have public access blocked
- DynamoDB tables use server-side encryption
- Lambda functions use least-privilege IAM roles
- API Gateway uses HTTPS only
- CloudFront serves content over HTTPS

## 📊 Monitoring

Access the CloudWatch dashboard:

```bash
terraform output cloudwatch_dashboard_url
```

### Alarms Configured

- Lambda errors > 5 per 5 minutes
- Lambda duration > 80% of timeout
- API Gateway 5XX errors > 10 per 5 minutes
- API Gateway latency > 5 seconds
- DynamoDB throttling

## 🗑️ Cleanup

To destroy all resources:

```bash
# Empty S3 buckets first (if force_destroy is false)
aws s3 rm s3://$(terraform output -raw audio_bucket_name) --recursive
aws s3 rm s3://$(terraform output -raw frontend_bucket_name) --recursive

# Destroy infrastructure
terraform destroy
```

## 🐛 Troubleshooting

### Lambda Deployment Fails

Ensure Lambda packages exist:
```bash
ls -la lambda/functions/
ls -la lambda/layers/
```

### Bedrock Access Denied

1. Enable Bedrock in your AWS account
2. Request access to foundation models
3. Wait for approval (usually instant for Claude)

### API Gateway CORS Issues

Update `allow_origins` in `api_gateway.tf` if using a custom domain.

## 📚 Resources

- [AWS Terraform Provider Docs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)

