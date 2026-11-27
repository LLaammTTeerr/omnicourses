import contract from '../../../backend/openapi.json';

interface Property {
  type?: string | string[];
  enum?: (string | number | null)[];
  anyOf?: Property[];
  oneOf?: Property[];
  items?: { enum?: (string | number | null)[] };
  maxItems?: number;
  maxLength?: number;
  maximum?: number;
}
interface Schema {
  properties: Record<string, Property>;
  required?: string[];
}
const schemas = contract.components.schemas as Record<string, Schema>;

type Presence = 'required' | 'optional';

export type Shape<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? 'optional' : 'required' };

export function contractShape(schema: string): Record<string, Presence> {
  const { properties, required = [] } = schemas[schema];
  return Object.fromEntries(Object.keys(properties).map((name) => [name, required.includes(name) ? 'required' : 'optional']));
}

export type NullableKeys<T> = { [K in keyof T]-?: null extends T[K] ? K : never }[keyof T];

const NULL_TYPE = 'null';

function mayBeNull(property: Property): boolean {
  const { type, enum: values, anyOf = [], oneOf = [] } = property;
  return [type].flat().includes(NULL_TYPE) || (values ?? []).includes(null) || [...anyOf, ...oneOf].some(mayBeNull);
}

export function contractNullable(schema: string): string[] {
  return Object.entries(schemas[schema].properties)
    .filter(([, property]) => mayBeNull(property))
    .map(([name]) => name)
    .sort();
}

export function nullableKeys<T>(keys: Record<NullableKeys<T>, true>): string[] {
  return Object.keys(keys).sort();
}

export function contractEnum(schema: string, property: string): (string | number | null)[] {
  const { enum: values, items } = schemas[schema].properties[property];
  return [...(values ?? items?.enum ?? [])].sort();
}

export function contractMaxItems(schema: string, property: string): number | undefined {
  return schemas[schema].properties[property].maxItems;
}

export function contractMaxLength(schema: string, property: string): number | undefined {
  return schemas[schema].properties[property].maxLength;
}

export function contractMaximum(schema: string, property: string): number | undefined {
  return schemas[schema].properties[property].maximum;
}

export const contractSchemaNames = (): string[] => Object.keys(schemas);
