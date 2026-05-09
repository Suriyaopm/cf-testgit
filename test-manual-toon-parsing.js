#!/usr/bin/env node

/**
 * Test manual TOON parsing for agent responses
 */

const { encode: tokenEncode } = require('gpt-tokenizer');

// Helper function to parse CSV row with quoted values
function parseCSVRow(row) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    const nextChar = row[i + 1];
    
    if (char === '"' && !inQuotes) {
      inQuotes = true;
    } else if (char === '"' && inQuotes) {
      if (nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = false;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Push the last value
  if (current) {
    values.push(current.trim());
  }
  
  return values;
}

// Sample TOON response from agent (like what you showed)
const toonResponse = `[9]{Category,Construct,ConstructVariant,SyntaxStructure,ExampleCodeSnippet,Remarks}:
DB ENtity SChema,Struct,Struct Definition,STRUCT <identifier> { {<type> <member>;}+ },struct EMPLOYEE { int id;\\nchar name[50];\\ndouble salary; };,standard_version-C89/C99/C11; status=stable; members represent fields/columns.
DB ENtity SChema,Struct,Struct Variable Declaration,STRUCT <identifier> <variable>[<size>],struct EMPLOYEE e1;\\nstruct EMPLOYEE empArr[10];,standard_version-C89/C99/C11; status=stable; can be single or array variables.
DB ENtity SChema,Struct,Struct Pointer Declaration,STRUCT <identifier> *<variable>,struct EMPLOYEE *ePtr;,standard_version-C89/C99/C11; status=stable; pointer to entity instance.
DB ENtity SChema,Union,Union Definition,UNION <identifier> { {<type> <member>;}+ },union DBFIELD { int i;\\ndouble d;\\nchar s[32]; };,standard_version-C89/C99/C11; status=stable; entity with variant field storage.
DB ENtity SChema,Union,Union Variable Declaration,UNION <identifier> <variable>[<size>],union DBFIELD f1;\\nunion DBFIELD fArr[3];,standard_version-C89/C99/C11; status=stable; variable/array of union entity.
DB ENtity SChema,Union,Union Pointer Declaration,UNION <identifier> *<variable>,union DBFIELD *fPtr;,standard_version-C89/C99/C11; status=stable; pointer to union entity.
DB ENtity SChema,Typedef,Typedef Struct Definition,TYPEDEF STRUCT <identifier> <type_name>,typedef struct { int id; char name[30]; } EMPREC;,standard_version-C89/C99/C11; status=stable; typedef creates new type for table/entity.
DB ENtity SChema,Typedef,Typedef Union Definition,TYPEDEF UNION <identifier> <type_name>,typedef union { int i; float f; } VALUETYPE;,standard_version-C89/C99/C11; status=stable; typedef creates new type for variant entity.
DB ENtity SChema,File,File Pointer Declaration,FILE *<variable>,FILE *dbFile;\\nint c = fgetc(dbFile);,standard_version-C89/C99/C11; status=stable; entity representing external database/file.`;

console.log('================================================================================');
console.log('MANUAL TOON PARSING TEST');
console.log('================================================================================\n');

try {
  // Parse the TOON structure manually
  const lines = toonResponse.split('\n');
  const headerMatch = lines[0].match(/^\[(\d+)\]\{([^}]+)\}:/);
  
  if (!headerMatch) {
    console.error('❌ Failed to match header pattern');
    process.exit(1);
  }
  
  const rowCount = parseInt(headerMatch[1]);
  const keys = headerMatch[2].split(',');
  
  console.log(`✓ Parsed header:`);
  console.log(`  Row count: ${rowCount}`);
  console.log(`  Keys: ${keys.join(', ')}\n`);
  
  const jsonResult = [];
  let parsedRows = 0;
  
  for (let i = 1; i <= rowCount && i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      const values = parseCSVRow(line);
      const obj = {};
      keys.forEach((key, idx) => {
        obj[key] = values[idx] || '';
      });
      jsonResult.push(obj);
      parsedRows++;
    }
  }
  
  console.log(`✓ Parsed ${parsedRows} rows\n`);
  
  if (parsedRows !== rowCount) {
    console.warn(`⚠️  Warning: Expected ${rowCount} rows but parsed ${parsedRows}`);
  }
  
  // Convert to JSON
  const jsonFormatted = JSON.stringify(jsonResult, null, 2);
  
  console.log('Converted JSON (first 500 chars):');
  console.log('─'.repeat(80));
  console.log(jsonFormatted.substring(0, 500) + '...\n');
  
  // Token comparison
  const toonTokens = tokenEncode(toonResponse).length;
  const jsonTokens = tokenEncode(jsonFormatted).length;
  
  console.log('Token Comparison:');
  console.log('─'.repeat(80));
  console.log(`TOON Format: ${toonTokens} tokens (${toonResponse.length} chars)`);
  console.log(`JSON Format: ${jsonTokens} tokens (${jsonFormatted.length} chars)`);
  console.log(`\nSavings: ${jsonTokens - toonTokens} tokens (${((1 - toonTokens / jsonTokens) * 100).toFixed(2)}% reduction)`);
  
  console.log('\n================================================================================');
  console.log('✅ MANUAL TOON PARSING TEST PASSED');
  console.log('================================================================================');
  
} catch (error) {
  console.error('\n❌ TEST FAILED:', error.message);
  console.error(error.stack);
  process.exit(1);
}

