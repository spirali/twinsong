def save_data(path, obj):
    import dill

    with open(path, "wb") as f:
        dill.dump(obj, f)


def load_data(path):
    import dill

    with open(path, "rb") as f:
        return dill.load(f)
