import ast
import contextlib
from typing import Any


class ScopeWrapper:
    def __init__(self, scope_dict: dict, globals_dict: dict):
        self.__scope_dict = scope_dict
        self.__globals_dict = globals_dict

    def __setattr__(self, name: str, value: Any):
        if name.startswith("_ScopeWrapper__"):
            super().__setattr__(name, value)
        else:
            self.__scope_dict[name] = value
            self.__globals_dict[name] = value

    def __getattr__(self, name: str):
        if name.startswith("_ScopeWrapper__"):
            return super().__getattr__(name)
        else:
            return self.__scope_dict[name]


def run_code(code, globals_dict, parent_dict, locals_dict, stdout, return_last):
    if not return_last:
        with contextlib.redirect_stdout(stdout):
            return exec(code, globals_dict, locals_dict)
    tree = ast.parse(code)
    if parent_dict is not None and "parent_scope" not in locals_dict:
        parent_scope = ScopeWrapper(parent_dict, globals_dict)
        locals_dict["parent_scope"] = parent_scope
    else:
        parent_scope = None
    try:
        with contextlib.redirect_stdout(stdout):
            if tree.body:
                if isinstance(tree.body[-1], ast.Expr):
                    last_expr = tree.body.pop().value
                    exec(
                        compile(tree, filename="<cell>", mode="exec"),
                        globals_dict,
                        locals_dict,
                    )
                    return eval(
                        compile(
                            ast.Expression(last_expr), filename="<cell>", mode="eval"
                        ),
                        globals_dict,
                        locals_dict,
                    )
                exec(
                    compile(tree, filename="<cell>", mode="exec"),
                    globals_dict,
                    locals_dict,
                )
    finally:
        if parent_scope is not None and locals_dict.get("parent_scope") is parent_scope:
            del locals_dict["parent_scope"]
