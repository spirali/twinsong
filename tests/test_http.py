def test_execute_command(client):
    r = client.create_new_notebook()
    k = client.create_new_kernel(r["notebook"]["id"])
    assert "3" == k.run_code_simple("1 + 2")
    assert [{'Text': {'value': 'Hello'}}, {'Text': {'value': '\n'}}, {'Text': {'value': 'World'}},
            {'Text': {'value': '\n'}}, 'None'] == k.run_code("print('Hello')\nprint('World')")
