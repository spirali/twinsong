
export type JsonObjectId = number;

export interface JsonObjectDump {
    root: JsonObjectId;
    objects: JsonObject[];
}

export interface JsonObject {
    id: JsonObjectId;
    repr: string;
    value_type?: string,
    kind?: string,
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