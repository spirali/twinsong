from twinsong.twinsong import create_jobject
import json


def build_obj(obj):
    jobject = json.loads(create_jobject("root", obj))
    values = {v["id"]: v for v in jobject["values"]}
    for v in values.values():
        del v["id"]
        if "children" in v:
            v["children"] = [values[c] for c in v["children"]]
    root = values[jobject["root"]]
    print(json.dumps(root, indent=4))
    return root


class FooBar:
    pass


def test_jobject():
    assert build_obj(None) == {'kind': 'null', 'repr': 'None', 'slot': 'root', 'value_type': ''}
    assert build_obj(-123) == {'kind': 'number', 'repr': '-123', 'slot': 'root', 'value_type': 'int'}
    assert build_obj(5) == {'kind': 'number', 'repr': '5', 'slot': 'root', 'value_type': 'int'}
    assert build_obj(5.0) == {'kind': 'number', 'repr': '5.0', 'slot': 'root', 'value_type': 'float'}
    assert build_obj(1 / 3) == {'kind': 'number', 'repr': '0.3333333333333333', 'slot': 'root', 'value_type': 'float'}

    assert build_obj([1, 2, 3]) == {
        "slot": "root",
        "repr": "[1, 2, 3]",
        "value_type": "list[int]",
        "children": [
            {
                "slot": "0",
                "repr": "1",
                "value_type": "int",
                "kind": "number"
            },
            {
                "slot": "1",
                "repr": "2",
                "value_type": "int",
                "kind": "number"
            },
            {
                "slot": "2",
                "repr": "3",
                "value_type": "int",
                "kind": "number"
            }
        ]
    }

    r = build_obj(FooBar())
    assert "FooBar" in r["repr"]
    del r["repr"]
    assert r == {
        "slot": "root",
        "value_type": "FooBar"
    }
