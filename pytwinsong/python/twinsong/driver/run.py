import ast
import contextlib

VARIABLES = {}


def run_code(code, stdout):
    tree = ast.parse(code)
    with contextlib.redirect_stdout(stdout):
        if tree.body:
            if isinstance(tree.body[-1], ast.Expr):
                last_expr = tree.body.pop().value
                exec(compile(tree, filename="<cell>", mode="exec"), VARIABLES)
                return eval(
                    compile(ast.Expression(last_expr), filename="<cell>", mode="eval"),
                    VARIABLES,
                )
            exec(compile(tree, filename="<cell>", mode="exec"), VARIABLES)
