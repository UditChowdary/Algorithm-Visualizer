class AlgorithmRunner:
    def __init__(self, algorithm, data):
        self.algorithm = algorithm
        self.data = data
        self.history = []
        self.current_step = 0

    def next_step(self):
        """Advance algorithm by one step and update history."""
        if self.current_step < len(self.history) - 1:
            self.current_step += 1
        else:
            # Execute the algorithm's next step
            self.algorithm.step()
            # Update history with the current state of the algorithm
            self.history.append(self.algorithm.get_state())
            self.current_step += 1

    def previous_step(self):
        """Revert algorithm to the previous step."""
        if self.current_step > 0:
            self.current_step -= 1
            # Revert the algorithm to the previous state
            self.algorithm.set_state(self.history[self.current_step])

    def reset(self):
        """Reset the algorithm to the initial state."""
        self.current_step = 0
        self.history = [self.algorithm.get_state()]

    def get_state(self):
        """Return the current state of the algorithm for visualization."""
        return self.history[self.current_step]