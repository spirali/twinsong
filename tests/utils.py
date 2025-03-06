from twinsong.twinsong import create_jobject
import json


def compose_jobject(jobject):
    objects = {v["id"]: v for v in jobject["objects"]}
    for v in objects.values():
        del v["id"]
        if "children" in v:
            v["children"] = [(k, objects[v]) for k, v in v["children"]]
    root = objects[jobject["root"]]
    # print(json.dumps(root, indent=4))
    return root


def build_jobject_from_text(text_data):
    return compose_jobject(json.loads(text_data))


def build_raw_obj(obj):
    json.loads(create_jobject(obj))


def build_obj(obj):
    return build_jobject_from_text(create_jobject(obj))
