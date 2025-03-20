import ast
import contextlib


def run_code(code, globals_dict, locals_dict, stdout, return_last):
    if not return_last:
        with contextlib.redirect_stdout(stdout):
            return exec(code, globals_dict, locals_dict)
    tree = ast.parse(code)
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
                    compile(ast.Expression(last_expr), filename="<cell>", mode="eval"),
                    globals_dict,
                    locals_dict,
                )
            exec(
                compile(tree, filename="<cell>", mode="exec"), globals_dict, locals_dict
            )
