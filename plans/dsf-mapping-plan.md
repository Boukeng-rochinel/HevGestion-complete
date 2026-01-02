# DSF Mapping System Plan

## Current Problem

The DSF import system is too messy and unstructured. Users need a way to specify mappings between Excel headers and cell references for different report types.

## Proposed Solution

Create a flexible mapping configuration system that allows users to define:

- Sheet names (note1, note2, fiche1, etc.)
- Header patterns to match
- Cell references for data extraction
- Data types and validation rules

## Architecture Overview

### 1. Database Models

- **DSFMappingConfig**: Stores mapping configurations per sheet type
- **DSFMappingRule**: Individual rules for header-to-cell mappings
- **DSFMappingPreset**: Predefined templates for common mappings

### 2. Configuration Structure

```json
{
  "sheetName": "note1",
  "headerPatterns": ["Libellés", "Année N", "Année N-1"],
  "mappings": [
    {
      "headerPattern": "Libellés",
      "cellReference": "A5",
      "dataType": "string",
      "required": true
    },
    {
      "headerPattern": "Année N",
      "cellReference": "B5",
      "dataType": "number",
      "required": true
    }
  ]
}
```

### 3. API Endpoints

- `POST /api/dsf-config/mappings` - Create/update mapping config
- `GET /api/dsf-config/mappings/:sheetType` - Get mapping for sheet
- `POST /api/dsf-config/presets` - Create mapping presets
- `GET /api/dsf-config/presets` - List available presets

### 4. Frontend Components

- **MappingEditor**: Visual editor for creating mappings
- **MappingTester**: Test mappings against sample Excel files
- **MappingLibrary**: Browse and import preset mappings

### 5. Implementation Steps

1. Update database schema with mapping models
2. Create mapping service for data extraction
3. Update DSF import controller to use mappings
4. Build frontend mapping editor
5. Add preset management
6. Testing and validation

## Benefits

- Flexible configuration for different Excel layouts
- Reusable presets for common formats
- Visual mapping editor for ease of use
- Validation and error handling
- Extensible for future sheet types

## Next Steps

1. Gather requirements for specific mapping needs
2. Design database schema
3. Implement core mapping service
4. Create basic mapping editor
5. Test with sample DSF files
