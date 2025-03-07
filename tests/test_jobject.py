from dataclasses import dataclass

from utils import build_obj, build_raw_obj


class FooBar:
    pass


@dataclass
class Person:
    name: str
    age: int
    pets: list[str]


def test_jobject_basic():
    assert build_obj(None) == {"kind": "null", "repr": "None"}
    assert build_obj(-123) == {"kind": "number", "repr": "-123", "value_type": "int"}
    assert build_obj(5) == {"kind": "number", "repr": "5", "value_type": "int"}
    assert build_obj(5.0) == {"kind": "number", "repr": "5.0", "value_type": "float"}
    assert build_obj(1 / 3) == {
        "kind": "number",
        "repr": "0.3333333333333333",
        "value_type": "float",
    }


def test_jobject_list():
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
    assert build_obj([1, "a", 3]) == {
        "repr": "[1, 'a', 3]",
        "value_type": "list",
        "kind": "list",
        "children": [
            ("0", {"repr": "1", "value_type": "int", "kind": "number"}),
            ("1", {"repr": '"a"', "value_type": "str", "kind": "string"}),
            ("2", {"repr": "3", "value_type": "int", "kind": "number"}),
        ],
    }
    assert build_obj(["f"] * 30) == {
        "repr": "30 items",
        "value_type": "list[str]",
        "kind": "list",
        "children": [
            (str(i), {"repr": '"f"', "value_type": "str", "kind": "string"})
            for i in range(30)
        ],
    }


def test_jobject_tuple():
    assert build_obj((1, 2, 3)) == {
        "repr": "(1, 2, 3)",
        "value_type": "tuple[int]",
        "kindst": "tuple",
        "children": [
            ("0", {"repr": "1", "value_type": "int", "kind": "number"}),
            ("1", {"repr": "2", "value_type": "int", "kind": "number"}),
            ("2", {"repr": "3", "value_type": "int", "kind": "number"}),
        ],
    }


def test_jobject_recursive():
    x = []
    x.append(x)
    r = build_raw_obj(x)
    root = r["root"]
    assert r == {
        "root": root,
        "objects": [
            {
                "children": [["0", root]],
                "id": root,
                "kind": "list",
                "repr": "[[...]]",
                "value_type": "list",
            }
        ],
    }


def test_jobject_dict():
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
    assert build_obj({1: "a", 2: "b", 9: "c"}) == {
        "repr": "{1: 'a', 2: 'b', 9: 'c'}",
        "value_type": "dict[int, str]",
        "kind": "dict",
        "children": [
            ("1", {"repr": '"a"', "value_type": "str", "kind": "string"}),
            ("2", {"repr": '"b"', "value_type": "str", "kind": "string"}),
            ("9", {"repr": '"c"', "value_type": "str", "kind": "string"}),
        ],
    }
    assert build_obj({i: f"f{i}" for i in range(15)}) == {
        "repr": "15 items",
        "value_type": "dict[int, str]",
        "kind": "dict",
        "children": [
            (str(i), {"repr": f'"f{i}"', "value_type": "str", "kind": "string"})
            for i in range(15)
        ],
    }


def test_jobject_opaque():
    r = build_obj(FooBar())
    assert "FooBar" in r["repr"]
    del r["repr"]
    assert r == {"value_type": "FooBar"}


def test_jobject_callable():
    def f(x=10):
        pass

    r = build_obj(f)
    assert "f at" in r.pop("repr")
    assert r == {"value_type": "function", "kind": "callable"}


def test_jobject_dataclass():
    p = Person("John", 25, ["Foo", "Bar"])
    r = build_obj(p)
    assert r == {
        "repr": "3 items",
        "value_type": "Person",
        "kind": "dataclass",
        "children": [
            ("name", {"repr": '"John"', "value_type": "str", "kind": "string"}),
            ("age", {"repr": "25", "value_type": "int", "kind": "number"}),
            (
                "pets",
                {
                    "repr": "['Foo', 'Bar']",
                    "value_type": "list[str]",
                    "kind": "list",
                    "children": [
                        ("0", {"repr": '"Foo"', "value_type": "str", "kind": "string"}),
                        ("1", {"repr": '"Bar"', "value_type": "str", "kind": "string"}),
                    ],
                },
            ),
        ],
    }
