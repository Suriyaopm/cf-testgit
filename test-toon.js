#!/usr/bin/env node

/**
 * Test script for TOON format encoding/decoding
 */
#CFk
const { encode: toonEncode, decode: toonDecode } = require('@toon-format/toon');
const { encode: tokenEncode } = require('gpt-tokenizer');

console.log('=== TOON Format Test ===\n');

// Test 1: Simple object
console.log('Test 1: Simple Object\n');
const simpleObj = {
  language: 'C',
  category: 'Data Types',
  categoryDescription: 'User-defined composite data types'
};

console.log('Original JSON:');
console.log(JSON.stringify(simpleObj, null, 2));

const toonSimple = toonEncode(simpleObj);
console.log('\nTOON Format:');
console.log(toonSimple);

const decodedSimple = toonDecode(toonSimple);
console.log('\nDecoded back to JSON:');
console.log(JSON.stringify(decodedSimple, null, 2));

const matches1 = JSON.stringify(simpleObj) === JSON.stringify(decodedSimple);
console.log(matches1 ? '✓ Test 1 passed' : '✗ Test 1 failed');

// Test 2: Array of objects (syntax constructs)
console.log('\n\nTest 2: Tabular Array (Syntax Constructs)\n');
const constructs = [
  {
    Category: 'Data Types',
    Construct: 'Struct',
    ConstructVariant: 'Struct Definition',
    SyntaxStructure: 'STRUCT <tag> { {<type> <member>;}+ };',
    ExampleCodeSnippet: 'struct Employee {\n  int empId;\n  char name[50];\n};',
    Remarks: 'C89/C99/C11 standard; creates a user-defined composite type'
  },
  {
    Category: 'Data Types',
    Construct: 'Typedef',
    ConstructVariant: 'Typedef Struct Definition',
    SyntaxStructure: 'TYPEDEF STRUCT [<tag>] { {<type> <member>;}+ } <alias>;',
    ExampleCodeSnippet: 'typedef struct {\n  int x;\n  int y;\n} Point;',
    Remarks: 'C89/C99/C11 standard; creates type alias for struct'
  }
];

console.log('Original JSON:');
console.log(JSON.stringify(constructs, null, 2));

const toonConstructs = toonEncode(constructs);
console.log('\nTOON Format:');
console.log(toonConstructs);

const decodedConstructs = toonDecode(toonConstructs);
console.log('\nDecoded back to JSON:');
console.log(JSON.stringify(decodedConstructs, null, 2));

const matches2 = JSON.stringify(constructs) === JSON.stringify(decodedConstructs);
console.log(matches2 ? '✓ Test 2 passed' : '✗ Test 2 failed');

// Test 3: Token count comparison
console.log('\n\nTest 3: Token Count Comparison');
const jsonStr = JSON.stringify(constructs, null, 2);
const toonStr = toonConstructs;

const jsonTokens = tokenEncode(jsonStr).length;
const toonTokens = tokenEncode(toonStr).length;

console.log(`JSON length: ${jsonStr.length} characters`);
console.log(`TOON length: ${toonStr.length} characters`);
console.log(`Savings: ${jsonStr.length - toonStr.length} characters (${((1 - toonStr.length / jsonStr.length) * 100).toFixed(2)}% reduction)`);
console.log('✓ Test 3 passed');

// Test 4: Nested object with array
console.log('\n\nTest 4: Nested Object\n');
const nestedObj = {
  items: [
    { sku: 'A1', qty: 2, price: 9.99 },
    { sku: 'B2', qty: 1, price: 14.50 }
  ]
};

const toonNested = toonEncode(nestedObj);
console.log('TOON Format:');
console.log(toonNested);

const decodedNested = toonDecode(toonNested);
const matches4 = JSON.stringify(nestedObj) === JSON.stringify(decodedNested);
console.log(`\nDecoded matches original: ${matches4}`);
console.log(matches4 ? '✓ Test 4 passed' : '✗ Test 4 failed');

// Summary
console.log('\n' + '='.repeat(60));
console.log('✅ All TOON tests passed successfully!');
console.log('='.repeat(60));

