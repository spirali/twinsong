export type JsonObjectId = number;

export interface JsonObjectDump {
  root: JsonObjectId;
  objects: JsonObject[];
}

export interface JsonObject {
  id: JsonObjectId;
  repr: string;
  value_type?: string;
  kind?: string;
  children?: [string, JsonObjectId][];
}

export interface JsonObjectStruct {
  root: JsonObjectId;
  objects: Map<JsonObjectId, JsonObject>;
}

export function parseJsonObjectStruct(data: string): JsonObjectStruct {
  const dump = JSON.parse(data) as JsonObjectDump;
  const objects = new Map<JsonObjectId, JsonObject>();
  for (const object of dump.objects) {
    objects.set(object.id, object);
  }
  return {
    root: dump.root,
    objects,
  };
}

export function extractGlobals(
  globals_data: [string, string | null][],
  old_globals: [string, JsonObjectStruct][],
): [string, JsonObjectStruct][] {
  const globals = globals_data.map(([name, data]) => {
    if (data === null) {
      return old_globals.find((x) => x[0] == name)!;
    } else {
      return [name, parseJsonObjectStruct(data)] as [string, JsonObjectStruct];
    }
  });
  globals.sort((a, b) => {
    const [a_name, a_struct] = a;
    const [b_name, b_struct] = b;
    const a_kind = a_struct.objects.get(a_struct.root)?.kind;
    const b_kind = b_struct.objects.get(b_struct.root)?.kind;
    for (const kind of ["module", "class", "callable"]) {
      if (a_kind === kind && b_kind !== kind) {
        return -1;
      }
      if (a_kind !== kind && b_kind === kind) {
        return 1;
      }
    }
    const minLength = Math.min(a_name.length, b_name.length);

    for (let i = 0; i < minLength; i++) {
      const charA = a_name.charCodeAt(i);
      const charB = b_name.charCodeAt(i);

      if (charA !== charB) {
        return charA - charB;
      }
    }
    return a_name.length - b_name.length;
  });
  return globals;
}
