from twinsong.twinsong import create_jobject
import json


def make_jobject(obj):
    return json.loads(create_jobject(obj))


def build_obj(obj):
    jobject = make_jobject(obj)
    objects = {v["id"]: v for v in jobject["objects"]}
    for v in objects.values():
        del v["id"]
        if "children" in v:
            v["children"] = [(k, objects[v]) for k, v in v["children"]]
    root = objects[jobject["root"]]
    print(json.dumps(root, indent=4))
    return root


class FooBar:
    pass


def test_jobject():
    assert build_obj(None) == {"kind": "null", "repr": "None"}
    assert build_obj(-123) == {"kind": "number", "repr": "-123", "value_type": "int"}
    assert build_obj(5) == {"kind": "number", "repr": "5", "value_type": "int"}
    assert build_obj(5.0) == {"kind": "number", "repr": "5.0", "value_type": "float"}
    assert build_obj(1 / 3) == {
        "kind": "number",
        "repr": "0.3333333333333333",
        "value_type": "float",
    }

    assert build_obj([1, 2, 3]) == {
        "repr": "[1, 2, 3]",
        "value_type": "list[int]",
        "kind": "list",
        "children": [
            ("0", {"repr": "1", "value_type": "int", "kind": "number"}),
            ("1", {"repr": "2", "value_type": "int", "kind": "number"}),
            ("2", {"repr": "3", "value_type": "int", "kind": "number"}),
        ],
    }

    assert build_obj({"a": 1, "b": 2, "c": 9}) == {
        "repr": "{'a': 1, 'b': 2, 'c': 9}",
        "value_type": "dict[str, int]",
        "kind": "dict",
        "children": [
            ("a", {"repr": "1", "value_type": "int", "kind": "number"}),
            ("b", {"repr": "2", "value_type": "int", "kind": "number"}),
            ("c", {"repr": "9", "value_type": "int", "kind": "number"}),
        ],
    }

    r = build_obj(FooBar())
    assert "FooBar" in r["repr"]
    del r["repr"]
    assert r == {"value_type": "FooBar"}

    x = []
    x.append(x)
    r = make_jobject(x)
    root = r["root"]
    assert r == {
        "root": root,
        "objects": [
            {
                "children": [["0", root]],
                "id": root,
                "kind": "list",
                "repr": "1 items",
                "value_type": "list",
            }
        ],
    }
