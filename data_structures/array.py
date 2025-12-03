class Array:
    def __init__(self, data):
        self.data = data

    def to_json(self):
        return {'data': self.data}
