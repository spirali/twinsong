import { SerializedGlobalsUpdate } from "./messages";
import { Globals } from "./notebook";

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

export function applyGlobalsUpdate(
  update: SerializedGlobalsUpdate,
  old_globals: Globals | null,
): Globals {
  const variables = Object.entries(update.variables).map(([name, data]) => {
    if (data === null) {
      return old_globals!.variables.find((x) => x[0] == name)!;
    } else {
      return [name, parseJsonObjectStruct(data)] as [string, JsonObjectStruct];
    }
  });
  variables.sort((a, b) => {
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
  const children = Object.entries(update.children).map(
    ([id, up]) =>
      [
        id,
        applyGlobalsUpdate(
          up,
          old_globals?.children.find((x) => x[0] == id)?.[1] ?? null,
        ),
      ] as [string, Globals],
  );
  children.sort((a, b) => a[1].name.localeCompare(b[1].name));
  return {
    variables,
    name: update.name,
    children,
  };
}
