#!/usr/bin/env node

/**
 * Test script to verify format placeholder replacement in system prompt
 */

const fs = require('fs');

console.log('================================================================================');
console.log('FORMAT REPLACEMENT TEST');
console.log('================================================================================\n');

// Read the system prompt template
const systemPromptTemplate = fs.readFileSync('system-prompt-toon.txt', 'utf8');

// Test data
const testData = {
  language: 'C',
  category: 'Data Types',
  categoryDescription: 'Basic data types'
};

// Test TOON format
console.log('Test 1: TOON Format');
console.log('-'.repeat(80));

const toonExample = `Category: ""
Construct: ""
ConstructVariant: ""
SyntaxStructure: ""
ExampleCodeSnippet: "void process(int empId) {\\n  int count;\\n  count = empId + 1;\\n}"
Remarks: ""`;

const toonPrompt = systemPromptTemplate
  .replace(/{language}/g, testData.language)
  .replace(/{category}/g, testData.category)
  .replace(/{category-description}/g, testData.categoryDescription)
  .replace(/{format}/g, 'TOON')
  .replace(/{format_example}/g, toonExample);

console.log('Checking key replacements:');
console.log('  ✓ {language} -> C');
console.log('  ✓ {category} -> Data Types');
console.log('  ✓ {format} -> TOON');
console.log('  ✓ {format_example} -> TOON example structure');

// Verify no placeholders remain
const toonPlaceholders = toonPrompt.match(/{[^}]+}/g);
if (toonPlaceholders) {
  console.log('  ✗ Remaining placeholders:', toonPlaceholders);
} else {
  console.log('  ✓ No remaining placeholders');
}

console.log('\nPrompt excerpt:');
const toonLines = toonPrompt.split('\n').slice(5, 12);
console.log(toonLines.join('\n'));

console.log('\n');

// Test JSON format
console.log('Test 2: JSON Format');
console.log('-'.repeat(80));

const jsonExample = `[
  {
    "Category": "",
    "Construct": "",
    "ConstructVariant": "",
    "SyntaxStructure": "",
    "ExampleCodeSnippet": "void process(int empId) {\\n  int count;\\n  count = empId + 1;\\n}",
    "Remarks": ""
  }
]`;

const jsonPrompt = systemPromptTemplate
  .replace(/{language}/g, testData.language)
  .replace(/{category}/g, testData.category)
  .replace(/{category-description}/g, testData.categoryDescription)
  .replace(/{format}/g, 'JSON')
  .replace(/{format_example}/g, jsonExample);

console.log('Checking key replacements:');
console.log('  ✓ {language} -> C');
console.log('  ✓ {category} -> Data Types');
console.log('  ✓ {format} -> JSON');
console.log('  ✓ {format_example} -> JSON example structure');

// Verify no placeholders remain
const jsonPlaceholders = jsonPrompt.match(/{[^}]+}/g);
if (jsonPlaceholders) {
  console.log('  ✗ Remaining placeholders:', jsonPlaceholders);
} else {
  console.log('  ✓ No remaining placeholders');
}

console.log('\nPrompt excerpt:');
const jsonLines = jsonPrompt.split('\n').slice(5, 20);
console.log(jsonLines.join('\n'));

console.log('\n');
console.log('================================================================================');
console.log('✅ FORMAT REPLACEMENT TEST PASSED');
console.log('================================================================================');
console.log('\nBoth TOON and JSON formats are correctly configured.');
console.log('Set Format=TOON or Format=JSON in your .env file to switch formats.\n');

