"""V28 enrichment is deterministic and reports heuristics, not fabricated certainty."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from syllabus_parser import enrich_syllabus_tree

def test_hierarchy_and_default_tiers():
    source = {'modules':[{'name':'Unit I','orderIndex':0,'topics':[
        {'name':'1 Intro to AI','orderIndex':0},
        {'name':'1.1 Search Algorithms','orderIndex':1},
        {'name':'1.1.1 Advanced Graph Search','orderIndex':2},
    ]}]}
    result=enrich_syllabus_tree(source)
    topics=result['modules'][0]['topics']
    assert topics[0]['depth']==0
    assert topics[1]['depth']==1 and topics[1]['parentTopicIndex']==0
    assert topics[2]['depth']==2 and topics[2]['parentTopicIndex']==1
    assert topics[2]['levelTarget']=='ADVANCED'
    assert result['overallConfidence']==0.5
    assert result['warnings']
