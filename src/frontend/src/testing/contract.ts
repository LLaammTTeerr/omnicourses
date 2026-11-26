import contract from '../../../backend/openapi.json';

interface Schema {
  properties: Record<string, { enum?: (string | number)[] }>;
  required?: string[];
}
const schemas = contract.components.schemas as Record<string, Schema>;

type Presence = 'required' | 'optional';

export type Shape<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? 'optional' : 'required' };

export function contractShape(schema: string): Record<string, Presence> {
  const { properties, required = [] } = schemas[schema];
  return Object.fromEntries(Object.keys(properties).map((name) => [name, required.includes(name) ? 'required' : 'optional']));
}

export function contractEnum(schema: string, property: string): (string | number)[] {
  return [...(schemas[schema].properties[property].enum ?? [])].sort();
}
