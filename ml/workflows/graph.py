from langgraph.graph import END, START, StateGraph
from workflows.state import TwinState
from workflows.nodes.learning_node import learning_node
from workflows.nodes.attendance_node import attendance_node
from workflows.nodes.knowledge_gap_node import knowledge_gap_node
from workflows.nodes.study_plan_node import study_plan_node
from workflows.nodes.persistence_node import persistence_node


def build_graph():
    graph = StateGraph(TwinState)
    for name, fn in [('learning', learning_node), ('attendance', attendance_node),
                     ('knowledge_gap', knowledge_gap_node), ('study_plan_node', study_plan_node),
                     ('persistence', persistence_node)]:
        graph.add_node(name, fn)
    graph.add_edge(START, 'learning')
    graph.add_edge('learning', 'attendance')
    graph.add_edge('attendance', 'knowledge_gap')
    graph.add_conditional_edges('knowledge_gap', lambda state: 'persistence' if state['degraded'] else 'study_plan_node',
                                {'persistence': 'persistence', 'study_plan_node': 'study_plan_node'})
    graph.add_edge('study_plan_node', 'persistence')
    graph.add_edge('persistence', END)
    return graph.compile()


def run_twin_orchestrator(state: TwinState) -> TwinState:
    return build_graph().invoke(state)
