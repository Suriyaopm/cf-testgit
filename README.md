# Azure AI Foundry Agent Client - TOON/JSON Format

A Node.js client for interacting with Azure AI Foundry agents that supports both TOON (Token-Oriented Object Notation) and JSON output formats, with automatic token size comparison.

## 🎯 Features

✅ **Dual Format Support**: Switch between TOON and JSON output formats  
✅ **Token Comparison**: Automatic comparison of token sizes between formats  
✅ **Azure SDK Integration**: Secure authentication using DefaultAzureCredential  
✅ **Interactive CLI**: User-friendly command-line interface  
✅ **Error Handling**: Robust error handling with helpful messages  
✅ **Format Validation**: Automatic validation of TOON and JSON responses  

## 📋 Prerequisites

- Node.js (v14 or higher)
- Azure AI Foundry account with an agent configured
- Azure credentials configured (via Azure CLI or environment variables)

## 🚀 Installation

```bash
# Install dependencies
npm install
```

## ⚙️ Configuration

Create a `.env` file in the project root:

```env
# Required: Azure AI Foundry Configuration
AzureAIFoundryProjectEndpoint=https://your-project.cognitiveservices.azure.com/
AzureAIFoundryFixerAgentId=asst_xxxxxxxxxxxxxxxxxxxxx

# Optional: Output Format (defaults to TOON if not specified)
Format=TOON
```

### Format Options

- **`Format=TOON`**: Agent returns compact TOON format (recommended for token efficiency)
- **`Format=JSON`**: Agent returns standard JSON format

## 📖 Usage

### Run the Application

```bash
npm start
```

The application will prompt you for:
1. **Programming Language** (e.g., `C`, `Python`, `Java`)
2. **Category** (e.g., `Data Types`, `Control Flow`)
3. **Category Description** (e.g., `Basic data types like int, char, float`)

### Run Tests

```bash
# Test TOON encoding/decoding
npm test

# Test format placeholder replacement
npm run test:format
```

## 📊 Example Output

### When Format=TOON

```
=== Azure AI Foundry Agent Client ===

Using official @toon-format/toon library
Output Format: TOON

Enter the programming language: C
Enter the category: Data Types
Enter the category description: Basic data types

Calling Azure AI Foundry Agent...

✓ Processing TOON response from agent

================================================================================
AGENT RESPONSE (TOON FORMAT):
================================================================================
[5]{Category,Construct,ConstructVariant,SyntaxStructure,ExampleCodeSnippet,Remarks}:
  Data Types,Int,Int Declaration,INT <identifier>,...
  Data Types,Char,Char Declaration,CHAR <identifier>,...
  ...

================================================================================
TOKEN SIZE COMPARISON:
================================================================================

JSON Format:
  - Token Count: 1250 tokens
  - Character Count: 5432 chars

TOON Format:
  - Token Count: 890 tokens
  - Character Count: 3215 chars

Savings with TOON:
  - Token Savings: 360 tokens (28.80% reduction)
  - Character Savings: 2217 chars (40.81% reduction)

Total Token Size:
  - JSON: 1250 tokens
  - TOON: 890 tokens
  - Total tokens saved: 360

================================================================================
✓ Process completed successfully
================================================================================
```

## 📁 Project Structure

```
.
├── agent-client.js          # Main application
├── system-prompt-toon.txt   # System prompt template
├── test-toon.js             # TOON format tests
├── test-format.js           # Format replacement tests
├── package.json             # Dependencies and scripts
├── CONFIG.txt               # Configuration guide
├── IMPLEMENTATION_COMPLETE.txt  # Implementation details
└── README.md                # This file
```

## 🔧 How It Works

### Format Flow

1. **Configuration**: Reads `Format` from `.env` (defaults to TOON)
2. **Prompt Generation**: 
   - Replaces `{format}` placeholder with TOON or JSON
   - Replaces `{format_example}` with format-specific example
3. **Agent Call**: Sends request to Azure AI Foundry agent
4. **Response Processing**:
   - If Format=TOON: Validates TOON, converts to JSON for comparison
   - If Format=JSON: Parses JSON, converts to TOON for comparison
5. **Token Comparison**: Calculates and displays token savings

### Key Components

- **Azure SDK**: Uses `@azure/ai-projects` and `@azure/identity` for secure authentication
- **TOON Library**: Uses `@toon-format/toon` for encoding/decoding
- **Token Counting**: Uses `gpt-tokenizer` for accurate token counting
- **Thread API**: Uses Azure AI Foundry's thread-based conversation API

## 🎨 TOON Format Benefits

| Aspect | JSON | TOON | Savings |
|--------|------|------|---------|
| Token Count | 1250 | 890 | **28.8%** |
| Character Count | 5432 | 3215 | **40.8%** |
| Readability | Good | Excellent | Tabular |
| API Cost | Higher | Lower | **Save $$** |

## 🔍 Troubleshooting

### Common Issues

**Error: Missing required environment variables**
- Ensure `.env` file exists with required variables
- Check that variable names match exactly

**401 Unauthorized**
- Run `az login` to authenticate with Azure
- Verify your Azure credentials have access to the AI Foundry project

**Agent returns wrong format**
- Check Format setting in `.env`
- Verify system prompt is being loaded correctly
- Run `npm run test:format` to test prompt generation

### Debug Mode

Set `DEBUG=true` in `.env` for detailed error messages and stack traces.

## 📚 Additional Documentation

- **CONFIG.txt**: Detailed configuration guide
- **IMPLEMENTATION_COMPLETE.txt**: Technical implementation details
- **system-prompt-toon.txt**: Agent instruction template

## 🤝 Contributing

This is a proof-of-concept implementation. Feel free to extend and customize for your needs.

## 📄 License

ISC

## 🙏 Acknowledgments

- **TOON Format**: [@toon-format/toon](https://github.com/toon-format/toon)
- **Azure AI**: Microsoft Azure AI Foundry
- **gpt-tokenizer**: Accurate GPT token counting

---

**Ready to use!** Configure your `.env` file and run `npm start` 🚀

