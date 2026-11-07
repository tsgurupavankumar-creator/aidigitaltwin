from workflows.state import TwinState
from workflows.persistence_client import persist_state

def persistence_node(state: TwinState) -> dict:
    return persist_state(state)
