import contract from '../../../backend/openapi.json';

// The committed OpenAPI contract (src/backend/openapi.json), for specs that check a value the client keeps at run time
// (an ordered list, a length) against it. The types themselves are generated from it (ADR 0018).

interface Schema {
  properties: Record<string, { enum?: (string | number)[] }>;
  required?: string[];
}
const schemas = contract.components.schemas as Record<string, Schema>;

type Presence = 'required' | 'optional';

/** Each property of a contract schema, and whether it must be present. */
export function contractShape(schema: string): Record<string, Presence> {
  const { properties, required = [] } = schemas[schema];
  return Object.fromEntries(Object.keys(properties).map((name) => [name, required.includes(name) ? 'required' : 'optional']));
}

/** The values a contract schema allows for one property, sorted. */
export function contractEnum(schema: string, property: string): (string | number)[] {
  return [...(schemas[schema].properties[property].enum ?? [])].sort();
}
